import { ChangeDetectionStrategy, Component, computed, inject, OnDestroy, signal, viewChildren } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { FormsModule } from '@angular/forms';
import { BaseChartDirective } from 'ng2-charts';
import { ChartData, ChartOptions } from 'chart.js';
import { Tool } from '../../models/tool.model';
import { ToolStoreService } from '../../services/tool-store.service';
import { ToastService } from '../../services/toast.service';

@Component({
  selector: 'app-reports-page',
  imports: [CommonModule, FormsModule, BaseChartDirective],
  templateUrl: './reports-page.component.html',
  styleUrl: './reports-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ReportsPageComponent implements OnDestroy {
  protected readonly store = inject(ToolStoreService);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly toastService = inject(ToastService);
  private readonly chartDirectives = viewChildren(BaseChartDirective);
  private readonly typePalette = ['#4677f6', '#5f8eff', '#77a3ff', '#91b6ff', '#b0c9ff'];
  private readonly materialPalette = ['#f0a43d', '#f5bc62', '#ffd487', '#ffe0ad', '#ffebc8'];
  protected readonly exportSummary = signal(true);
  protected readonly exportFilters = signal(true);
  protected readonly exportCharts = signal(true);
  protected readonly exportInsights = signal(true);
  protected readonly exportDetails = signal(true);
  protected readonly stateFilter = signal<'all' | 'available' | 'active' | 'maintenance'>('all');
  protected readonly categoryFilter = signal('all');
  protected readonly typeFilter = signal('all');
  protected readonly materialFilter = signal('all');
  protected readonly exportingExcel = signal(false);
  protected readonly exportingPdf = signal(false);
  protected readonly previewingPdf = signal(false);
  protected readonly pdfPreviewUrl = signal<string | null>(null);
  protected readonly safePdfPreviewUrl = signal<SafeResourceUrl | null>(null);
  protected readonly pdfPreviewFileName = signal('');

  protected readonly stateOptions = [
    { value: 'all', label: 'Todos los estados' },
    { value: 'available', label: 'Disponible' },
    { value: 'active', label: 'En uso' },
    { value: 'maintenance', label: 'En mantenimiento' }
  ] as const;

  protected readonly reportBaseTools = computed(() => this.store.filteredTools());

  protected readonly categoryOptions = computed(() => this.extractDistinctValues(this.reportBaseTools(), 'category'));
  protected readonly typeOptions = computed(() => this.extractDistinctValues(this.reportBaseTools(), 'type'));
  protected readonly materialOptions = computed(() => this.extractDistinctValues(this.reportBaseTools(), 'material'));

  protected readonly reportTools = computed(() => {
    const stateFilter = this.stateFilter();
    const categoryFilter = this.categoryFilter();
    const typeFilter = this.typeFilter();
    const materialFilter = this.materialFilter();

    return this.reportBaseTools().filter((tool) => {
      if (stateFilter !== 'all' && this.normalizeState(tool.state) !== stateFilter) {
        return false;
      }

      if (categoryFilter !== 'all' && tool.category !== categoryFilter) {
        return false;
      }

      if (typeFilter !== 'all' && tool.type !== typeFilter) {
        return false;
      }

      if (materialFilter !== 'all' && tool.material !== materialFilter) {
        return false;
      }

      return true;
    });
  });

  protected readonly reportCategories = computed(() => this.groupCategories(this.reportTools()));

  protected readonly reportMetrics = computed(() => {
    const tools = this.reportTools();
    const totalTools = tools.length;
    const total = totalTools || 1;
    const available = tools.filter((tool) => this.normalizeState(tool.state) === 'available').length;
    const active = tools.filter((tool) => this.normalizeState(tool.state) === 'active').length;
    const maintenance = tools.filter((tool) => this.normalizeState(tool.state) === 'maintenance').length;
    const averageLong = totalTools === 0
      ? 0
      : tools.reduce((accumulator, tool) => accumulator + tool.long, 0) / totalTools;

    return {
      totalTools,
      availableCount: available,
      activeCount: active,
      maintenanceCount: maintenance,
      availableRate: Math.round((available / total) * 100),
      activeRate: Math.round((active / total) * 100),
      maintenanceRate: Math.round((maintenance / total) * 100),
      averageLong: averageLong.toFixed(1),
      byType: this.groupByField(tools, 'type'),
      byMaterial: this.groupByField(tools, 'material')
    };
  });

  protected readonly activeFilterCount = computed(() => (
    Number(this.stateFilter() !== 'all') +
    Number(this.categoryFilter() !== 'all') +
    Number(this.typeFilter() !== 'all') +
    Number(this.materialFilter() !== 'all')
  ));

  protected readonly selectedExportSectionCount = computed(() => (
    Number(this.exportSummary()) +
    Number(this.exportFilters()) +
    Number(this.exportCharts()) +
    Number(this.exportInsights()) +
    Number(this.exportDetails())
  ));

  protected readonly hasInventoryData = computed(() => this.store.filteredTools().length > 0);
  protected readonly hasData = computed(() => this.reportMetrics().totalTools > 0);

  protected readonly stateChartData = computed<ChartData<'doughnut'>>(() => {
    const metrics = this.reportMetrics();

    return {
      labels: ['Disponible', 'En uso', 'En mantenimiento'],
      datasets: [
        {
          data: [
            metrics.availableCount,
            metrics.activeCount,
            metrics.maintenanceCount
          ],
          backgroundColor: ['#49a34c', '#f0a43d', '#5a6b92'],
          borderWidth: 0,
          hoverOffset: 10
        }
      ]
    };
  });

  protected readonly typeChartData = computed<ChartData<'bar'>>(() => {
    const entries = this.reportMetrics().byType;

    return {
      labels: entries.map((entry) => entry.label),
      datasets: [
        {
          label: 'Herramientas por tipo',
          data: entries.map((entry) => entry.total),
          backgroundColor: this.buildPalette(entries.length, this.typePalette),
          borderRadius: 14,
          borderSkipped: false,
          maxBarThickness: 20
        }
      ]
    };
  });

  protected readonly materialChartData = computed<ChartData<'polarArea'>>(() => {
    const entries = this.reportMetrics().byMaterial;

    return {
      labels: entries.map((entry) => entry.label),
      datasets: [
        {
          data: entries.map((entry) => entry.total),
          backgroundColor: this.buildPalette(entries.length, this.materialPalette),
          borderWidth: 0
        }
      ]
    };
  });

  protected readonly categoryChartData = computed<ChartData<'bar'>>(() => {
    const entries = this.reportCategories().slice(0, 6);

    return {
      labels: entries.map((entry) => entry.name),
      datasets: [
        {
          label: 'Disponibles',
          data: entries.map((entry) => entry.available),
          backgroundColor: '#4f9b43',
          borderRadius: 12,
          borderSkipped: false,
          stack: 'category-status'
        },
        {
          label: 'No disponibles',
          data: entries.map((entry) => Math.max(entry.total - entry.available, 0)),
          backgroundColor: '#dbe2f1',
          borderRadius: 12,
          borderSkipped: false,
          stack: 'category-status'
        }
      ]
    };
  });

  protected readonly stateChartOptions: ChartOptions<'doughnut'> = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '70%',
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          usePointStyle: true,
          pointStyle: 'circle',
          boxWidth: 10,
          padding: 18,
          color: '#334155'
        }
      },
      tooltip: {
        backgroundColor: '#122033',
        padding: 12
      }
    }
  };

  protected readonly horizontalBarOptions: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    indexAxis: 'y',
    plugins: {
      legend: {
        display: false
      },
      tooltip: {
        backgroundColor: '#122033',
        padding: 12
      }
    },
    scales: {
      x: {
        beginAtZero: true,
        ticks: {
          precision: 0,
          color: '#66718c'
        },
        grid: {
          color: '#edf1fa'
        },
        border: {
          display: false
        }
      },
      y: {
        ticks: {
          color: '#25324a'
        },
        grid: {
          display: false
        },
        border: {
          display: false
        }
      }
    }
  };

  protected readonly polarAreaOptions: ChartOptions<'polarArea'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          usePointStyle: true,
          pointStyle: 'circle',
          boxWidth: 10,
          padding: 16,
          color: '#334155'
        }
      },
      tooltip: {
        backgroundColor: '#122033',
        padding: 12
      }
    },
    scales: {
      r: {
        beginAtZero: true,
        ticks: {
          precision: 0,
          color: '#74829f',
          backdropColor: 'transparent'
        },
        grid: {
          color: '#edf1fa'
        },
        angleLines: {
          color: '#edf1fa'
        },
        pointLabels: {
          color: '#25324a'
        }
      }
    }
  };

  protected readonly stackedBarOptions: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          usePointStyle: true,
          pointStyle: 'circle',
          boxWidth: 10,
          padding: 16,
          color: '#334155'
        }
      },
      tooltip: {
        backgroundColor: '#122033',
        padding: 12
      }
    },
    scales: {
      x: {
        stacked: true,
        ticks: {
          color: '#25324a'
        },
        grid: {
          display: false
        },
        border: {
          display: false
        }
      },
      y: {
        stacked: true,
        beginAtZero: true,
        ticks: {
          precision: 0,
          color: '#66718c'
        },
        grid: {
          color: '#edf1fa'
        },
        border: {
          display: false
        }
      }
    }
  };

  ngOnDestroy(): void {
    this.closePdfPreview();
  }

  private buildPalette(length: number, palette: string[]): string[] {
    return Array.from({ length }, (_, index) => palette[index % palette.length]);
  }

  private collectChartSnapshots(): Array<{ title: string; image: string }> {
    const titles = [
      'Disponibilidad general',
      'Herramientas por tipo',
      'Composicion del parque',
      'Cobertura por categoria'
    ];

    return this.chartDirectives()
      .map((directive, index) => {
        const image = directive.chart?.toBase64Image?.();

        if (!image) {
          return null;
        }

        return {
          title: titles[index] ?? `Grafica ${index + 1}`,
          image
        };
      })
      .filter((item): item is { title: string; image: string } => item !== null);
  }

  private getActiveFilters(): Array<{ label: string; value: string }> {
    return [
      this.stateFilter() !== 'all'
        ? {
            label: 'Estado',
            value: this.stateOptions.find((option) => option.value === this.stateFilter())?.label ?? this.stateFilter()
          }
        : null,
      this.categoryFilter() !== 'all' ? { label: 'Categoria', value: this.categoryFilter() } : null,
      this.typeFilter() !== 'all' ? { label: 'Tipo', value: this.typeFilter() } : null,
      this.materialFilter() !== 'all' ? { label: 'Material', value: this.materialFilter() } : null
    ].filter((item): item is { label: string; value: string } => item !== null);
  }

  private buildFileName(baseName: string, extension: 'pdf' | 'xlsx'): string {
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    return `${baseName}-${stamp}.${extension}`;
  }

  protected clearFilters(): void {
    this.stateFilter.set('all');
    this.categoryFilter.set('all');
    this.typeFilter.set('all');
    this.materialFilter.set('all');
  }

  protected setAllExportSections(value: boolean): void {
    this.exportSummary.set(value);
    this.exportFilters.set(value);
    this.exportCharts.set(value);
    this.exportInsights.set(value);
    this.exportDetails.set(value);
  }

  protected closePdfPreview(): void {
    const currentUrl = this.pdfPreviewUrl();

    if (currentUrl) {
      URL.revokeObjectURL(currentUrl);
    }

    this.pdfPreviewUrl.set(null);
    this.safePdfPreviewUrl.set(null);
    this.pdfPreviewFileName.set('');
  }

  protected downloadPreviewBlob(): void {
    const previewUrl = this.pdfPreviewUrl();

    if (!previewUrl) {
      return;
    }

    const link = document.createElement('a');
    link.href = previewUrl;
    link.download = this.pdfPreviewFileName() || this.buildFileName('reporte-herramientas', 'pdf');
    link.click();
  }

  protected async previewPdf(): Promise<void> {
    if (!this.canExport()) {
      return;
    }

    this.previewingPdf.set(true);

    try {
      const { document, fileName } = await this.generatePdfDocument();
      const blob = document.output('blob');
      const previewUrl = URL.createObjectURL(blob);
      this.closePdfPreview();
      this.pdfPreviewUrl.set(previewUrl);
      this.safePdfPreviewUrl.set(this.sanitizer.bypassSecurityTrustResourceUrl(previewUrl));
      this.pdfPreviewFileName.set(fileName);
      this.toastService.show({
        title: 'Vista previa lista',
        message: 'Ya puedes revisar el PDF antes de descargarlo.',
        tone: 'success'
      });
    } catch {
      this.toastService.show({
        title: 'No se pudo previsualizar',
        message: 'Hubo un problema al generar la vista previa del PDF.',
        tone: 'error'
      });
    } finally {
      this.previewingPdf.set(false);
    }
  }

  protected async exportExcel(): Promise<void> {
    if (!this.canExport()) {
      return;
    }

    this.exportingExcel.set(true);

    try {
      const XLSX = await import('xlsx');
      const workbook = XLSX.utils.book_new();
      const metrics = this.reportMetrics();
      const filters = this.getActiveFilters();
      const exportedAt = new Date().toLocaleString('es-ES');

      if (this.exportSummary() || this.exportFilters()) {
        const summaryRows: Array<Array<string | number>> = [
          ['Reporte de herramientas'],
          ['Generado el', exportedAt]
        ];

        if (this.exportFilters()) {
          summaryRows.push([], ['Filtros activos']);
          summaryRows.push(...(
            filters.length > 0
              ? filters.map((filter) => [filter.label, filter.value])
              : [['Estado de filtros', 'Sin filtros activos']]
          ));
        }

        if (this.exportSummary()) {
          summaryRows.push(
            [],
            ['Metricas', 'Valor'],
            ['Total herramientas', metrics.totalTools],
            ['Disponibilidad', `${metrics.availableRate}%`],
            ['En uso', `${metrics.activeRate}%`],
            ['En mantenimiento', `${metrics.maintenanceRate}%`],
            ['Promedio longitud', `${metrics.averageLong} cm`]
          );
        }

        const summarySheet = XLSX.utils.aoa_to_sheet(summaryRows);
        summarySheet['!cols'] = [{ wch: 24 }, { wch: 24 }];
        XLSX.utils.book_append_sheet(workbook, summarySheet, 'Resumen');
      }

      if (this.exportDetails()) {
        const toolsSheet = XLSX.utils.json_to_sheet(
          this.reportTools().map((tool) => ({
            ID: tool.id,
            Nombre: tool.name,
            Tipo: tool.type,
            Categoria: tool.category,
            Estado: tool.state,
            Material: tool.material,
            Longitud: tool.long,
            Marca: tool.brand,
            Modelo: tool.model,
            Descripcion: tool.description
          }))
        );

        toolsSheet['!cols'] = [
          { wch: 28 },
          { wch: 24 },
          { wch: 20 },
          { wch: 20 },
          { wch: 18 },
          { wch: 16 },
          { wch: 12 },
          { wch: 18 },
          { wch: 18 },
          { wch: 42 }
        ];

        XLSX.utils.book_append_sheet(workbook, toolsSheet, 'Herramientas');
      }

      if (this.exportInsights()) {
        const byTypeSheet = XLSX.utils.json_to_sheet(
          this.reportMetrics().byType.map((entry) => ({
            Tipo: entry.label,
            Total: entry.total,
            Porcentaje: `${entry.ratio}%`
          }))
        );

        const byMaterialSheet = XLSX.utils.json_to_sheet(
          this.reportMetrics().byMaterial.map((entry) => ({
            Material: entry.label,
            Total: entry.total,
            Porcentaje: `${entry.ratio}%`
          }))
        );

        const categoriesSheet = XLSX.utils.json_to_sheet(
          this.reportCategories().map((entry) => ({
            Categoria: entry.name,
            Total: entry.total,
            Disponibles: entry.available,
            'No disponibles': Math.max(entry.total - entry.available, 0)
          }))
        );

        byTypeSheet['!cols'] = [{ wch: 24 }, { wch: 12 }, { wch: 14 }];
        byMaterialSheet['!cols'] = [{ wch: 24 }, { wch: 12 }, { wch: 14 }];
        categoriesSheet['!cols'] = [{ wch: 24 }, { wch: 12 }, { wch: 14 }, { wch: 16 }];

        XLSX.utils.book_append_sheet(workbook, byTypeSheet, 'Por tipo');
        XLSX.utils.book_append_sheet(workbook, byMaterialSheet, 'Por material');
        XLSX.utils.book_append_sheet(workbook, categoriesSheet, 'Categorias');
      }

      XLSX.writeFile(workbook, this.buildFileName('reporte-herramientas', 'xlsx'));

      this.toastService.show({
        title: 'Excel generado',
        message: 'El reporte filtrado se ha descargado en formato Excel.',
        tone: 'success'
      });
    } catch {
      this.toastService.show({
        title: 'No se pudo exportar',
        message: 'Hubo un problema al generar el archivo Excel.',
        tone: 'error'
      });
    } finally {
      this.exportingExcel.set(false);
    }
  }

  protected async exportPdf(): Promise<void> {
    if (!this.canExport()) {
      return;
    }

    this.exportingPdf.set(true);

    try {
      const { document, fileName } = await this.generatePdfDocument();
      document.save(fileName);

      this.toastService.show({
        title: 'PDF generado',
        message: 'El reporte filtrado se ha descargado en formato PDF.',
        tone: 'success'
      });
    } catch {
      this.toastService.show({
        title: 'No se pudo exportar',
        message: 'Hubo un problema al generar el archivo PDF.',
        tone: 'error'
      });
    } finally {
      this.exportingPdf.set(false);
    }
  }

  private canExport(): boolean {
    if (!this.hasData()) {
      this.toastService.show({
        title: 'Sin datos para exportar',
        message: 'Aplica otros filtros o carga herramientas antes de generar el archivo.',
        tone: 'warning'
      });
      return false;
    }

    if (this.selectedExportSectionCount() === 0) {
      this.toastService.show({
        title: 'Selecciona una seccion',
        message: 'Marca al menos una seccion para exportar el reporte.',
        tone: 'warning'
      });
      return false;
    }

    return true;
  }

  private async generatePdfDocument(): Promise<{ document: any; fileName: string }> {
    const [{ jsPDF }, { default: autoTable }] = await Promise.all([
      import('jspdf'),
      import('jspdf-autotable')
    ]);
    const document = new jsPDF({ unit: 'pt', format: 'a4' }) as any;
    const metrics = this.reportMetrics();
    const filters = this.getActiveFilters();
    const exportedAt = new Date().toLocaleString('es-ES');
    const fileName = this.buildFileName('reporte-herramientas', 'pdf');

    document.setFillColor(24, 43, 85);
    document.rect(0, 0, document.internal.pageSize.getWidth(), 86, 'F');
    document.setTextColor(255, 255, 255);
    document.setFont('helvetica', 'bold');
    document.setFontSize(22);
    document.text('Reporte de Herramientas', 40, 42);
    document.setFont('helvetica', 'normal');
    document.setFontSize(10);
    document.text(`Generado el ${exportedAt}`, 40, 60);
    document.setTextColor(30, 41, 59);

    let startY = 104;

    if (this.exportSummary()) {
      autoTable(document, {
        startY,
        head: [['Indicador', 'Valor']],
        body: [
          ['Total herramientas', String(metrics.totalTools)],
          ['Disponibilidad', `${metrics.availableRate}%`],
          ['En uso', `${metrics.activeRate}%`],
          ['En mantenimiento', `${metrics.maintenanceRate}%`],
          ['Promedio longitud', `${metrics.averageLong} cm`]
        ],
        theme: 'grid',
        headStyles: {
          fillColor: [77, 119, 239]
        }
      });

      startY = (document.lastAutoTable?.finalY ?? startY) + 18;
    }

    if (this.exportFilters()) {
      autoTable(document, {
        startY,
        head: [['Filtro', 'Valor']],
        body: filters.length > 0
          ? filters.map((filter) => [filter.label, filter.value])
          : [['Estado de filtros', 'Sin filtros activos']],
        theme: 'striped',
        headStyles: {
          fillColor: [90, 107, 146]
        }
      });

      startY = (document.lastAutoTable?.finalY ?? startY) + 18;
    }

    if (this.exportInsights()) {
      autoTable(document, {
        startY,
        head: [['Tipo', 'Total', 'Porcentaje']],
        body: this.reportMetrics().byType.map((entry) => [entry.label, String(entry.total), `${entry.ratio}%`]),
        theme: 'striped',
        headStyles: {
          fillColor: [70, 119, 246]
        }
      });
    }

    if (this.exportCharts()) {
      const snapshots = this.collectChartSnapshots();

      if (snapshots.length > 0) {
        snapshots.forEach((snapshot, index) => {
          if (index % 2 === 0) {
            document.addPage();
            document.setFont('helvetica', 'bold');
            document.setFontSize(18);
            document.text('Graficas del reporte', 40, 42);
          }

          const slot = index % 2;
          const chartX = slot === 0 ? 40 : 300;
          const chartY = 72;

          document.setFont('helvetica', 'bold');
          document.setFontSize(12);
          document.text(snapshot.title, chartX, chartY);
          document.addImage(snapshot.image, 'PNG', chartX, chartY + 12, 240, 180);
        });
      }
    }

    if (this.exportDetails()) {
      document.addPage();
      document.setFont('helvetica', 'bold');
      document.setFontSize(18);
      document.text('Detalle de herramientas filtradas', 40, 42);

      autoTable(document, {
        startY: 64,
        head: [['Herramienta', 'Categoria', 'Estado', 'Material']],
        body: this.reportTools().slice(0, 12).map((tool) => [
          tool.name,
          tool.category,
          tool.state,
          tool.material
        ]),
        theme: 'grid',
        headStyles: {
          fillColor: [79, 155, 67]
        }
      });
    }

    return { document, fileName };
  }

  private extractDistinctValues(tools: Tool[], key: 'category' | 'type' | 'material'): string[] {
    return Array.from(new Set(tools.map((tool) => tool[key]).filter(Boolean))).sort((left, right) => left.localeCompare(right));
  }

  private normalizeState(state: string): 'available' | 'active' | 'maintenance' {
    const normalized = state.toLowerCase();

    if (normalized.includes('mant') || normalized.includes('repar')) {
      return 'maintenance';
    }

    if (normalized.includes('uso') || normalized.includes('prest') || normalized.includes('obra')) {
      return 'active';
    }

    return 'available';
  }

  private groupByField(tools: Tool[], key: 'type' | 'material'): Array<{ label: string; total: number; ratio: number }> {
    const counts = new Map<string, number>();

    for (const tool of tools) {
      counts.set(tool[key], (counts.get(tool[key]) ?? 0) + 1);
    }

    const total = tools.length || 1;

    return Array.from(counts.entries())
      .map(([label, amount]) => ({
        label,
        total: amount,
        ratio: Math.round((amount / total) * 100)
      }))
      .sort((left, right) => right.total - left.total);
  }

  private groupCategories(tools: Tool[]): Array<{ name: string; total: number; available: number }> {
    const grouped = new Map<string, { total: number; available: number }>();

    for (const tool of tools) {
      const current = grouped.get(tool.category) ?? { total: 0, available: 0 };
      current.total += 1;

      if (this.normalizeState(tool.state) === 'available') {
        current.available += 1;
      }

      grouped.set(tool.category, current);
    }

    return Array.from(grouped.entries())
      .map(([name, value]) => ({
        name,
        total: value.total,
        available: value.available
      }))
      .sort((left, right) => right.total - left.total);
  }
}
