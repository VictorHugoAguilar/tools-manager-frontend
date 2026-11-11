import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { BaseChartDirective } from 'ng2-charts';
import { ChartData, ChartOptions } from 'chart.js';
import { FormsModule } from '@angular/forms';
import { MonitoringApiService, MonitoringEvent, MonitoringEventFilters, MonitoringOverview, MonitoringPeriod } from '../../services/monitoring-api.service';

@Component({
  selector: 'app-monitoring-page',
  imports: [CommonModule, FormsModule, BaseChartDirective],
  templateUrl: './monitoring-page.component.html',
  styleUrl: './monitoring-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MonitoringPageComponent {
  private readonly api = inject(MonitoringApiService);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly period = signal<MonitoringPeriod>('1h');
  protected readonly data = signal<MonitoringOverview | null>(null);
  protected readonly loading = signal(false);
  protected readonly error = signal('');
  protected readonly searchLoading = signal(false);
  protected readonly searchError = signal('');
  protected readonly searchResults = signal<MonitoringEvent[] | null>(null);
  protected readonly nextCursor = signal<string | null>(null);
  protected searchService = '';
  protected searchLevel = '';
  protected searchEventName = '';
  protected searchTraceId = '';
  private searchFilters: MonitoringEventFilters | null = null;
  protected readonly latencyChart = computed<ChartData<'line'>>(() => {
    const metrics = this.data()?.httpMetrics;
    if (!metrics) return { labels: [], datasets: [] };
    const step = metrics.resolutionSeconds * 1000;
    const points = new Map(metrics.points.map((point) => [Date.parse(point.start), point.averageMs]));
    const labels: string[] = [];
    const values: (number | null)[] = [];
    for (let time = Math.floor(Date.parse(metrics.from) / step) * step; time < Date.parse(metrics.to); time += step) {
      labels.push(new Intl.DateTimeFormat('es-ES', metrics.resolutionSeconds === 60
        ? { hour: '2-digit', minute: '2-digit' }
        : { day: '2-digit', month: '2-digit', hour: '2-digit' }).format(time));
      values.push(points.get(time) ?? null);
    }
    return {
      labels,
      datasets: [{
        label: 'Latencia media API (ms)',
        data: values,
        borderColor: '#208ff4',
        backgroundColor: '#208ff41a',
        fill: true,
        pointRadius: 2,
        tension: 0.2,
        spanGaps: false
      }]
    };
  });
  protected readonly chartOptions: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    scales: { y: { beginAtZero: true, title: { display: true, text: 'Milisegundos' } } }
  };

  constructor() {
    this.refresh();
  }

  protected changePeriod(value: string): void {
    if (value !== '1h' && value !== '24h' && value !== '7d') return;
    this.period.set(value);
    this.searchResults.set(null);
    this.nextCursor.set(null);
    this.searchFilters = null;
    this.refresh();
  }

  protected searchEvents(): void {
    const now = this.data()?.generatedAt;
    if (!now || this.searchLoading()) return;
    const end = Date.parse(now);
    const duration = this.period() === '1h' ? 3600000 : this.period() === '24h' ? 86400000 : 604800000;
    this.searchFilters = {
      from: new Date(end - duration).toISOString(),
      to: new Date(end).toISOString(),
      service: this.searchService,
      level: this.searchLevel,
      eventName: this.searchEventName.trim(),
      traceId: this.searchTraceId.trim()
    };
    this.searchResults.set([]);
    this.nextCursor.set(null);
    this.loadEvents(false);
  }

  protected loadMoreEvents(): void {
    this.loadEvents(true);
  }

  private loadEvents(append: boolean): void {
    if (!this.searchFilters || this.searchLoading()) return;
    const cursor = append ? this.nextCursor() : null;
    if (append && !cursor) return;
    this.searchLoading.set(true);
    this.searchError.set('');
    this.api.events({ ...this.searchFilters, ...(cursor ? { cursor } : {}) })
      .pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: (page) => {
          this.searchResults.set(page.events);
          this.nextCursor.set(page.nextCursor);
          this.searchLoading.set(false);
        },
        error: (error: unknown) => {
          this.searchError.set(error instanceof HttpErrorResponse && error.status === 400
            ? 'Comprueba los filtros y el identificador de traza.'
            : error instanceof HttpErrorResponse && error.status === 503 &&
              error.error?.code === 'MONITORING_INDEX_UNAVAILABLE'
              ? 'Faltan índices de Firestore o aún se están creando. Contacta con el administrador y vuelve a intentarlo cuando estén listos.'
              : 'No se pudieron consultar los eventos. Comprueba los permisos, la conexión y los índices de Firestore.');
          this.searchLoading.set(false);
        }
      });
  }

  protected refresh(): void {
    if (this.loading()) return;
    this.loading.set(true);
    this.error.set('');
    this.api.overview(this.period()).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (data) => {
        this.data.set(data);
        this.loading.set(false);
      },
      error: (error: unknown) => {
        this.data.set(null);
        this.error.set(error instanceof HttpErrorResponse && error.status === 503 &&
          typeof error.error?.message === 'string'
          ? error.error.message
          : 'No se pudo cargar la monitorización. Comprueba los permisos y la conexión con el servidor.');
        this.loading.set(false);
      }
    });
  }
}
