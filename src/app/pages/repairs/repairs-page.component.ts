import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Tool } from '../../models/tool.model';
import { RepairPayload, RepairRecord } from '../../models/repair.model';
import { LocationStoreService } from '../../services/location-store.service';
import { TechnicianStoreService } from '../../services/technician-store.service';
import { ToolStoreService } from '../../services/tool-store.service';
import { ToolApiService } from '../../services/tool-api.service';
import { ToastService } from '../../services/toast.service';

interface ToolRepairMeta {
  code: string;
}

@Component({
  selector: 'app-repairs-page',
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './repairs-page.component.html',
  styleUrl: './repairs-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RepairsPageComponent {
  protected readonly store = inject(ToolStoreService);
  protected readonly toolApi = inject(ToolApiService);
  protected readonly technicianStore = inject(TechnicianStoreService);
  protected readonly locationStore = inject(LocationStoreService);
  private readonly toastService = inject(ToastService);
  private readonly formBuilder = new FormBuilder();

  protected readonly selectedToolId = signal('');
  protected readonly metaStore = signal<Record<string, ToolRepairMeta>>({});
  protected readonly historyStore = signal<Record<string, RepairRecord[]>>({});
  protected readonly historyLoading = signal(false);
  protected readonly historyError = signal<string | null>(null);
  protected readonly updatingLocation = signal(false);

  protected readonly tools = computed(() => this.store.tools());
  protected readonly technicians = computed(() => this.technicianStore.activeTechnicians());
  protected readonly locationOptions = computed(() => {
    const baseOptions = this.locationStore.locationNames();
    const currentLocation = this.selectedTool()?.location?.trim() ?? '';

    if (currentLocation && !baseOptions.includes(currentLocation)) {
      return [currentLocation, ...baseOptions];
    }

    return baseOptions;
  });
  protected readonly selectedTool = computed(() => {
    const tools = this.tools();
    const selectedId = this.selectedToolId();

    return tools.find((tool) => tool.id === selectedId) ?? tools[0] ?? null;
  });
  protected readonly selectedMeta = computed(() => {
    const tool = this.selectedTool();

    if (!tool) {
      return null;
    }

    return this.metaStore()[tool.id] ?? null;
  });
  protected readonly selectedHistory = computed(() => {
    const tool = this.selectedTool();

    if (!tool) {
      return [];
    }

    return this.historyStore()[tool.id] ?? [];
  });

  protected readonly repairForm = this.formBuilder.nonNullable.group({
    entryDate: [this.getIsoDateFromOffset(0), [Validators.required]],
    exitDate: [this.getIsoDateFromOffset(4), [Validators.required]],
    status: ['Reparado', [Validators.required]],
    priority: ['Normal', [Validators.required]],
    issue: ['', [Validators.required, Validators.minLength(10)]],
    description: ['', [Validators.required, Validators.minLength(20)]],
    technicianId: ['', [Validators.required]],
    cost: [null as number | null],
    observations: ['']
  });

  private historyRequestToken = 0;

  constructor() {
    this.technicianStore.ensureLoaded();
    this.locationStore.ensureLoaded();

    effect(() => {
      const tools = this.store.tools();

      if (tools.length === 0) {
        return;
      }

      if (!this.selectedToolId() || !tools.some((tool) => tool.id === this.selectedToolId())) {
        this.selectedToolId.set(tools[0].id);
      }

      this.metaStore.update((current) => {
        const next = { ...current };

        tools.forEach((tool, index) => {
          next[tool.id] ??= {
            code: `HT-${String(index + 1).padStart(5, '0')}`
          };
        });

        return next;
      });
    });

    effect(() => {
      const technicians = this.technicians();
      const currentTechnicianId = this.repairForm.getRawValue().technicianId;

      if (technicians.length === 0) {
        this.repairForm.patchValue({ technicianId: '' }, { emitEvent: false });
        return;
      }

      if (!currentTechnicianId || !technicians.some((item) => item.id === currentTechnicianId)) {
        this.repairForm.patchValue({ technicianId: technicians[0].id }, { emitEvent: false });
      }
    });

    effect(() => {
      const tool = this.selectedTool();

      if (!tool) {
        return;
      }

      this.loadRepairHistory(tool.id);
    });
  }

  protected selectTool(toolId: string): void {
    this.selectedToolId.set(toolId);
  }

  protected updateLocation(value: string): void {
    const tool = this.selectedTool();

    if (!tool) {
      return;
    }

    if (tool.location === value) {
      return;
    }

    this.updatingLocation.set(true);

    this.toolApi.updateTool(tool.id, {
      ...tool,
      location: value
    }).subscribe({
      next: (updatedTool) => {
        this.store.tools.update((current) =>
          current.map((item) => item.id === updatedTool.id ? updatedTool : item)
        );
        this.toastService.show({
          title: 'Ubicacion actualizada',
          message: `${tool.name} ahora figura en "${value}".`,
          tone: 'success'
        });
        this.updatingLocation.set(false);
      },
      error: (error: unknown) => {
        this.toastService.show({
          title: 'No se pudo actualizar la ubicacion',
          message: this.extractErrorMessage(error),
          tone: 'error'
        });
        this.updatingLocation.set(false);
      }
    });
  }

  protected openSelectedToolEditor(): void {
    const tool = this.selectedTool();

    if (!tool) {
      return;
    }

    this.store.openEditModal(tool);
  }

  protected clearRepairForm(): void {
    this.repairForm.reset({
      entryDate: this.getIsoDateFromOffset(0),
      exitDate: this.getIsoDateFromOffset(4),
      status: 'Reparado',
      priority: 'Normal',
      issue: '',
      description: '',
      technicianId: this.technicians()[0]?.id ?? '',
      cost: null,
      observations: ''
    });
  }

  protected saveRepair(): void {
    const tool = this.selectedTool();

    if (!tool) {
      this.toastService.show({
        title: 'Selecciona una herramienta',
        message: 'Necesitas elegir una herramienta antes de registrar un arreglo.',
        tone: 'warning'
      });
      return;
    }

    if (this.technicians().length === 0) {
      this.toastService.show({
        title: 'Sin tecnicos disponibles',
        message: 'Debes registrar al menos un tecnico activo antes de guardar un arreglo.',
        tone: 'warning'
      });
      return;
    }

    if (this.repairForm.invalid) {
      this.repairForm.markAllAsTouched();
      this.toastService.show({
        title: 'Formulario incompleto',
        message: 'Revisa los campos obligatorios del arreglo antes de guardar.',
        tone: 'warning'
      });
      return;
    }

    const raw = this.repairForm.getRawValue();
    const payload: RepairPayload = {
      entryDate: raw.entryDate,
      exitDate: raw.exitDate,
      status: raw.status,
      priority: raw.priority,
      issue: raw.issue,
      description: raw.description,
      technicianId: raw.technicianId,
      cost: this.normalizeCost(raw.cost),
      observations: raw.observations
    };

    this.toolApi.createToolRepair(tool.id, payload).subscribe({
      next: (record) => {
        this.historyStore.update((current) => ({
          ...current,
          [tool.id]: [record, ...(current[tool.id] ?? [])]
        }));

        this.clearRepairForm();

        this.toastService.show({
          title: 'Arreglo registrado',
          message: `Se ha guardado un nuevo registro de arreglo para ${tool.name}.`,
          tone: 'success'
        });
      },
      error: (error: unknown) => {
        this.toastService.show({
          title: 'No se pudo guardar el arreglo',
          message: this.extractErrorMessage(error),
          tone: 'error'
        });
      }
    });
  }

  protected exportHistory(): void {
    const tool = this.selectedTool();
    const history = this.selectedHistory();

    if (!tool || history.length === 0) {
      this.toastService.show({
        title: 'Sin datos para exportar',
        message: 'Esta herramienta todavia no tiene historial de arreglos.',
        tone: 'info'
      });
      return;
    }

    this.generateHistoryPdf(tool, history).catch(() => {
      this.toastService.show({
        title: 'No se pudo exportar',
        message: 'Hubo un problema al generar el PDF del historial.',
        tone: 'error'
      });
    });
  }

  protected getToolStateTone(state: string): 'available' | 'active' | 'maintenance' {
    const normalized = state.trim().toLowerCase();

    if (normalized.includes('mant') || normalized.includes('repar')) {
      return 'maintenance';
    }

    if (normalized.includes('uso') || normalized.includes('prest') || normalized.includes('obra')) {
      return 'active';
    }

    return 'available';
  }

  protected fieldError(name: keyof ReturnType<typeof this.repairForm.getRawValue>): string | null {
    const control = this.repairForm.get(name);

    if (!control || !control.invalid || !control.touched) {
      return null;
    }

    if (control.errors?.['required']) {
      return 'Este campo es obligatorio.';
    }

    if (control.errors?.['minlength']) {
      return `Debe tener al menos ${control.errors['minlength'].requiredLength} caracteres.`;
    }

    return 'Valor no valido.';
  }

  protected formatDate(value: string): string {
    const [year, month, day] = value.split('-');
    return `${day}/${month}/${year}`;
  }

  protected formatCost(value: number | null): string {
    if (value === null) {
      return 'Sin coste';
    }

    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(value);
  }

  private getIsoDateFromOffset(offsetDays: number): string {
    const date = new Date();
    date.setDate(date.getDate() + offsetDays);
    return date.toISOString().slice(0, 10);
  }

  private normalizeCost(value: string | number | null): number | null {
    if (value === null || value === undefined || value === '') {
      return null;
    }

    if (typeof value === 'number') {
      return Number.isFinite(value) ? value : null;
    }

    const normalized = value.trim();

    if (normalized === '') {
      return null;
    }

    const parsed = Number(normalized.replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : null;
  }

  private async generateHistoryPdf(tool: Tool, history: RepairRecord[]): Promise<void> {
    const [{ jsPDF }, { default: autoTable }] = await Promise.all([
      import('jspdf'),
      import('jspdf-autotable')
    ]);

    const document = new jsPDF({ unit: 'pt', format: 'a4' }) as any;
    const exportedAt = new Date().toLocaleString('es-ES');

    document.setFillColor(20, 53, 111);
    document.rect(0, 0, document.internal.pageSize.getWidth(), 88, 'F');
    document.setTextColor(255, 255, 255);
    document.setFont('helvetica', 'bold');
    document.setFontSize(21);
    document.text('Historico de Arreglos', 40, 40);
    document.setFont('helvetica', 'normal');
    document.setFontSize(10);
    document.text(`Generado el ${exportedAt}`, 40, 60);

    document.setTextColor(30, 41, 59);

    autoTable(document, {
      startY: 108,
      theme: 'grid',
      head: [['Dato', 'Valor', 'Dato', 'Valor']],
      body: [
        ['Codigo / ID', this.selectedMeta()?.code ?? tool.id, 'Nombre', tool.name],
        ['Marca', tool.brand, 'Modelo', tool.model],
        ['Numero de Serie', tool.serialNumber, 'Ubicacion', tool.location],
        ['Categoria', tool.category, 'Tipo', tool.type],
        ['Estado actual', tool.state, 'Material', tool.material]
      ],
      headStyles: {
        fillColor: [77, 119, 239]
      },
      styles: {
        fontSize: 9,
        cellPadding: 7
      },
      columnStyles: {
        0: { fontStyle: 'bold' },
        2: { fontStyle: 'bold' }
      }
    });

    autoTable(document, {
      startY: (document.lastAutoTable?.finalY ?? 108) + 20,
      theme: 'grid',
      head: [[
        '#',
        'Entrada',
        'Salida',
        'Estado',
        'Prioridad',
        'Tecnico',
        'Costo',
        'Motivo / Falla',
        'Descripcion',
        'Observaciones'
      ]],
      body: history.map((record, index) => [
        String(history.length - index),
        this.formatDate(record.entryDate),
        this.formatDate(record.exitDate),
        record.status,
        record.priority,
        record.technicianName,
        this.formatCost(record.cost),
        record.issue,
        record.description,
        record.observations || '-'
      ]),
      headStyles: {
        fillColor: [20, 53, 111]
      },
      styles: {
        fontSize: 8,
        cellPadding: 6,
        overflow: 'linebreak',
        valign: 'top'
      },
      columnStyles: {
        0: { cellWidth: 26, halign: 'center' },
        1: { cellWidth: 52 },
        2: { cellWidth: 52 },
        3: { cellWidth: 55 },
        4: { cellWidth: 54 },
        5: { cellWidth: 72 },
        6: { cellWidth: 60 },
        7: { cellWidth: 92 },
        8: { cellWidth: 125 },
        9: { cellWidth: 95 }
      }
    });

    const fileName = `historial-arreglos-${tool.name.toLowerCase().replaceAll(' ', '-')}.pdf`;
    document.save(fileName);

    this.toastService.show({
      title: 'PDF generado',
      message: 'El historial de arreglos se ha exportado correctamente.',
      tone: 'success'
    });
  }

  private loadRepairHistory(toolId: string): void {
    if (this.historyStore()[toolId]) {
      this.historyError.set(null);
      return;
    }

    const requestToken = ++this.historyRequestToken;
    this.historyLoading.set(true);
    this.historyError.set(null);

    this.toolApi.getToolRepairs(toolId).subscribe({
      next: (history) => {
        if (requestToken !== this.historyRequestToken) {
          return;
        }

        this.historyStore.update((current) => ({
          ...current,
          [toolId]: history
        }));
        this.historyLoading.set(false);
      },
      error: (error: unknown) => {
        if (requestToken !== this.historyRequestToken) {
          return;
        }

        this.historyLoading.set(false);
        this.historyError.set(this.extractErrorMessage(error));
      }
    });
  }

  private extractErrorMessage(error: unknown): string {
    if (typeof error === 'object' && error !== null && 'error' in error) {
      const payload = (error as {
        error?: { message?: string; errors?: string[] };
        message?: string;
      }).error;

      if (Array.isArray(payload?.errors) && payload.errors.length > 0) {
        return payload.errors.join(' ');
      }

      if (typeof payload?.message === 'string' && payload.message.trim() !== '') {
        return payload.message;
      }
    }

    if (error instanceof Error && error.message.trim() !== '') {
      return error.message;
    }

    return 'Ha ocurrido un error inesperado.';
  }
}
