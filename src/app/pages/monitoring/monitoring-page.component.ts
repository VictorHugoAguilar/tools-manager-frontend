import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { BaseChartDirective } from 'ng2-charts';
import { ChartData, ChartOptions } from 'chart.js';
import { FormsModule } from '@angular/forms';
import { MonitoringApiService, MonitoringAuditStatus, MonitoringEvent, MonitoringEventFilters, MonitoringMetricInterval, MonitoringMetricRequest, MonitoringMetricResult, MonitoringOverview, MonitoringPeriod, MonitoringServices } from '../../services/monitoring-api.service';
import { StorageAuditHistoryComponent } from './storage-audit-history.component';
import { activityChartData, latencyChartData } from './monitoring-charts';
import { recentStorageActivity } from './monitoring-activity';

@Component({
  selector: 'app-monitoring-page',
  imports: [CommonModule, FormsModule, BaseChartDirective, StorageAuditHistoryComponent],
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
  protected readonly pageNumber = signal(1);
  protected readonly traceView = signal<string | null>(null);
  protected readonly activeRange = signal<{ from: string; to: string } | null>(null);
  protected readonly auditStatus = signal<MonitoringAuditStatus | null>(null);
  protected readonly auditStatusLoading = signal(false);
  protected readonly auditStatusError = signal('');
  protected readonly metricResult = signal<MonitoringMetricResult | null>(null);
  protected readonly metricLoading = signal(false);
  protected readonly metricError = signal('');
  protected readonly servicesResult = signal<MonitoringServices | null>(null);
  protected readonly servicesLoading = signal(false);
  protected readonly servicesError = signal('');
  protected metricService: 'backend' | 'websocket' = 'backend';
  protected metricInterval: MonitoringMetricInterval = '1h';
  protected metricFrom = '';
  protected metricTo = '';
  protected searchService = '';
  protected searchLevel = '';
  protected searchEventName = '';
  protected searchTraceId = '';
  protected searchFrom = '';
  protected searchTo = '';
  private searchFilters: MonitoringEventFilters | null = null;
  private pageCursors: (string | null)[] = [null];
  protected readonly recentActivity = computed(() => recentStorageActivity(this.data()?.events ?? []));
  protected readonly latencyChart = computed<ChartData<'line'>>(() => {
    const metrics = this.data()?.httpMetrics;
    return metrics ? latencyChartData(metrics) ?? { labels: [], datasets: [] } : { labels: [], datasets: [] };
  });
  protected readonly metricActivityChart = computed(() => {
    const metrics = this.metricResult();
    return metrics ? activityChartData(metrics) : null;
  });
  protected readonly metricLatencyChart = computed(() => {
    const metrics = this.metricResult();
    return metrics?.service === 'backend' ? latencyChartData(metrics) : null;
  });
  protected readonly activityChartOptions: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    scales: { y: { beginAtZero: true, title: { display: true, text: 'Eventos registrados' } } }
  };
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
    this.refresh();
  }

  protected searchEvents(): void {
    if (this.searchLoading() || this.loading()) return;
    const range = this.searchRange();
    if (!range) return;
    this.searchFilters = {
      ...range,
      service: this.searchService,
      level: this.searchLevel,
      eventName: this.searchEventName.trim(),
      traceId: this.searchTraceId.trim()
    };
    this.traceView.set(null);
    this.startSearch();
  }

  protected loadMoreEvents(): void {
    const cursor = this.nextCursor();
    if (cursor) this.loadEvents(cursor, this.pageNumber() + 1);
  }

  protected loadPreviousEvents(): void {
    const previousPage = this.pageNumber() - 1;
    if (previousPage >= 1) this.loadEvents(this.pageCursors[previousPage - 1], previousPage);
  }

  protected showTrace(traceId: string): void {
    if (this.searchLoading() || this.loading()) return;
    const range = this.activeRange() ?? this.searchRange();
    if (!range) return;
    this.openTrace(traceId, range);
  }

  protected showActivityTrace(traceId: string): void {
    if (this.searchLoading() || this.loading()) return;
    const range = this.overviewRange();
    if (!range) return;
    this.openTrace(traceId, range);
  }

  private openTrace(traceId: string, range: { from: string; to: string }): void {
    this.searchTraceId = traceId;
    this.searchFilters = { ...range, traceId };
    this.traceView.set(traceId);
    this.startSearch();
  }

  protected clearSearch(): void {
    if (this.searchLoading() || this.loading()) return;
    this.searchService = '';
    this.searchLevel = '';
    this.searchEventName = '';
    this.searchTraceId = '';
    this.searchFrom = '';
    this.searchTo = '';
    this.resetResults();
  }

  protected queryMetrics(): void {
    if (this.metricLoading()) return;
    const from = Date.parse(this.metricFrom);
    const to = Date.parse(this.metricTo);
    if (!this.metricFrom || !this.metricTo || !Number.isFinite(from) || !Number.isFinite(to) ||
      to - from < 60000 || to - from > 7 * 86400000) {
      this.metricError.set('Indica un intervalo válido entre un minuto y siete días.');
      return;
    }
    const range = { from: new Date(from).toISOString(), to: new Date(to).toISOString(), interval: this.metricInterval };
    const filters: MonitoringMetricRequest = this.metricService === 'backend'
      ? { ...range, service: 'backend', metric: 'http_requests' }
      : { ...range, service: 'websocket', metric: 'websocket_activity' };
    this.metricLoading.set(true);
    this.metricError.set('');
    this.metricResult.set(null);
    this.api.metrics(filters).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (result) => { this.metricResult.set(result); this.metricLoading.set(false); },
      error: (error: unknown) => {
        this.metricError.set(this.queryError(error, 'métricas'));
        this.metricLoading.set(false);
      }
    });
  }

  protected queryServices(): void {
    if (this.servicesLoading()) return;
    this.servicesLoading.set(true);
    this.servicesError.set('');
    this.servicesResult.set(null);
    this.api.services().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (result) => { this.servicesResult.set(result); this.servicesLoading.set(false); },
      error: (error: unknown) => {
        this.servicesError.set(this.queryError(error, 'servicios'));
        this.servicesLoading.set(false);
      }
    });
  }

  private queryError(error: unknown, subject: string): string {
    if (error instanceof HttpErrorResponse && error.status === 400) {
      return 'Comprueba las fechas y los filtros; la fecha final no puede estar en el futuro.';
    }
    if (error instanceof HttpErrorResponse && error.status === 503 && typeof error.error?.message === 'string') {
      return error.error.message;
    }
    return `No se pudieron consultar ${subject}. Comprueba los permisos y la conexión.`;
  }

  private searchRange(): { from: string; to: string } | null {
    if (this.searchFrom || this.searchTo) {
      const from = Date.parse(this.searchFrom);
      const to = Date.parse(this.searchTo);
      if (!this.searchFrom || !this.searchTo || !Number.isFinite(from) || !Number.isFinite(to) ||
        from >= to || to - from > 7 * 86400000) {
        this.searchError.set('Indica fechas válidas en orden, con un intervalo máximo de siete días.');
        return null;
      }
      return { from: new Date(from).toISOString(), to: new Date(to).toISOString() };
    }
    return this.overviewRange();
  }

  private overviewRange(): { from: string; to: string } | null {
    const generatedAt = this.data()?.generatedAt;
    if (!generatedAt) return null;
    const end = Date.parse(generatedAt);
    const duration = this.period() === '1h' ? 3600000 : this.period() === '24h' ? 86400000 : 604800000;
    return { from: new Date(end - duration).toISOString(), to: new Date(end).toISOString() };
  }

  private startSearch(): void {
    this.searchResults.set([]);
    this.nextCursor.set(null);
    this.pageCursors = [null];
    this.pageNumber.set(1);
    this.activeRange.set(null);
    this.loadEvents(null, 1);
  }

  private resetResults(): void {
    this.searchResults.set(null);
    this.searchError.set('');
    this.nextCursor.set(null);
    this.traceView.set(null);
    this.activeRange.set(null);
    this.searchFilters = null;
    this.pageCursors = [null];
    this.pageNumber.set(1);
  }

  private loadEvents(cursor: string | null, pageNumber: number): void {
    if (!this.searchFilters || this.searchLoading()) return;
    this.searchLoading.set(true);
    this.searchError.set('');
    const filters = { ...this.searchFilters, ...(cursor ? { cursor } : {}) };
    const traceId = this.traceView();
    const request = traceId ? this.api.trace(traceId, {
      from: filters.from, to: filters.to, ...(cursor ? { cursor } : {})
    }) : this.api.events(filters);
    request
      .pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: (page) => {
          this.searchResults.set(page.events);
          this.nextCursor.set(page.nextCursor);
          this.pageCursors = this.pageCursors.slice(0, pageNumber - 1);
          this.pageCursors.push(cursor);
          this.pageNumber.set(pageNumber);
          this.activeRange.set({ from: filters.from, to: filters.to });
          this.searchLoading.set(false);
        },
        error: (error: unknown) => {
          this.searchError.set(error instanceof HttpErrorResponse && error.status === 400
            ? 'Comprueba los filtros, fechas y el identificador de traza. Si un cursor ha caducado, inicia una nueva búsqueda.'
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
    this.resetResults();
    this.loading.set(true);
    this.error.set('');
    this.loadAuditStatus();
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

  private loadAuditStatus(): void {
    if (this.auditStatusLoading()) return;
    this.auditStatus.set(null);
    this.auditStatusError.set('');
    this.auditStatusLoading.set(true);
    this.api.auditStatus().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (status) => {
        this.auditStatus.set(status);
        this.auditStatusLoading.set(false);
      },
      error: () => {
        this.auditStatusError.set('No se pudo consultar la outbox de auditoría. Revisa los permisos y las conexiones de Firebase.');
        this.auditStatusLoading.set(false);
      }
    });
  }
}
