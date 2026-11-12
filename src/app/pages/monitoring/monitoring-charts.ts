import { ChartData, ChartDataset } from 'chart.js';
import { MonitoringEvent, MonitoringMetricResult, MonitoringOverview } from '../../services/monitoring-api.service';

const MAX_CHART_POINTS = 1500;

type MetricRange = Pick<MonitoringOverview['httpMetrics'], 'from' | 'to' | 'resolutionSeconds'>;
interface Point { start: string }
interface Series<T> { label: string; color: string; value: (point: T) => number }

function chartData<T extends Point>(
  range: MetricRange, points: T[], series: Series<T>[]
): ChartData<'line'> | null {
  const step = range.resolutionSeconds * 1000;
  const start = Math.floor(Date.parse(range.from) / step) * step;
  const end = Date.parse(range.to);
  const count = Math.max(0, Math.ceil((end - start) / step));
  if (count > MAX_CHART_POINTS) return null;
  const byTime = new Map(points.map((point) => [Date.parse(point.start), point]));
  const formatter = new Intl.DateTimeFormat('es-ES', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZoneName: 'shortOffset'
  });
  const labels: string[] = [];
  const values = series.map(() => [] as (number | null)[]);
  for (let time = start; time < end; time += step) {
    labels.push(formatter.format(time));
    const point = byTime.get(time);
    series.forEach((entry, index) => values[index].push(point ? entry.value(point) : null));
  }
  const datasets: ChartDataset<'line'>[] = series.map((entry, index) => ({
    label: entry.label, data: values[index], borderColor: entry.color,
    pointRadius: 2, tension: 0.2, spanGaps: false
  }));
  return { labels, datasets };
}

export function latencyChartData(metrics: MonitoringOverview['httpMetrics'], label = 'Latencia media API (ms)'): ChartData<'line'> | null {
  return chartData(metrics, metrics.points, [
    { label, color: '#208ff4', value: (point) => point.averageMs }
  ]);
}

export function activityChartData(metrics: MonitoringMetricResult): ChartData<'line'> | null {
  if (metrics.service === 'backend' && metrics.metric === 'database_operations') {
    return chartData(metrics, metrics.points, [
      { label: 'Operaciones', color: '#208ff4', value: (point) => point.count },
      { label: 'Operaciones fallidas', color: '#b52e42', value: (point) => point.errors }
    ]);
  }
  if (metrics.service === 'backend') {
    return chartData(metrics, metrics.points, [
      { label: 'Peticiones', color: '#208ff4', value: (point) => point.count },
      { label: 'Errores 5xx', color: '#b52e42', value: (point) => point.errors }
    ]);
  }
  return chartData(metrics, metrics.points, [
    { label: 'Aperturas', color: '#208ff4', value: (point) => point.opened },
    { label: 'Cierres', color: '#b52e42', value: (point) => point.closed },
    { label: 'Actualizaciones', color: '#35ad71', value: (point) => point.updates },
    { label: 'Presencia', color: '#8a63d2', value: (point) => point.awareness ?? 0 },
    { label: 'Mensajes rechazados', color: '#e0a21b', value: (point) => point.rejected ?? 0 },
    { label: 'Cierres anómalos', color: '#7a2230', value: (point) => point.abnormalClosed ?? 0 }
  ]);
}

export function errorRateChartData(metrics: MonitoringOverview['httpMetrics']): ChartData<'line'> | null {
  return chartData(metrics, metrics.points, [
    { label: 'Tasa de errores 5xx (%)', color: '#b52e42', value: (point) => point.count ? point.errors / point.count * 100 : 0 }
  ]);
}

export function statusDoughnutData(count: number, errors: number): ChartData<'doughnut'> | null {
  if (!count) return null;
  return {
    labels: ['Correctas o 4xx', 'Errores 5xx'],
    datasets: [{ data: [Math.max(0, count - errors), errors], backgroundColor: ['#35ad71', '#b52e42'], borderWidth: 0 }]
  };
}

const LEVEL_COLORS: Record<string, string> = { DEBUG: '#8d9cad', INFO: '#208ff4', WARN: '#e0a21b', ERROR: '#b52e42' };

export function levelCountsDoughnutData(counts: Partial<Record<string, number>>): ChartData<'doughnut'> | null {
  const levels = Object.keys(LEVEL_COLORS).filter((level) => (counts[level] ?? 0) > 0);
  if (!levels.length) return null;
  return {
    labels: levels,
    datasets: [{ data: levels.map((level) => counts[level] ?? 0), backgroundColor: levels.map((level) => LEVEL_COLORS[level]), borderWidth: 0 }]
  };
}

export function levelDoughnutData(events: Pick<MonitoringEvent, 'level'>[]): ChartData<'doughnut'> | null {
  const counts: Record<string, number> = {};
  for (const event of events) counts[event.level] = (counts[event.level] ?? 0) + 1;
  return levelCountsDoughnutData(counts);
}

export function usagePercent(used: number, total: number): number {
  return total > 0 ? Math.min(100, Math.max(0, used / total * 100)) : 0;
}

export type CollectorState = 'ok' | 'warn' | 'error';

export function collectorStatus(collector: MonitoringOverview['collector']): { state: CollectorState; label: string; reasons: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  const metrics = collector.httpMetrics;
  if (collector.consecutiveWriteFailures > 0) errors.push(`${collector.consecutiveWriteFailures} fallos consecutivos al escribir eventos`);
  if (collector.heartbeat.consecutiveFailures > 0) errors.push(`${collector.heartbeat.consecutiveFailures} fallos consecutivos de heartbeat`);
  if (metrics.consecutiveFailures > 0) errors.push(`${metrics.consecutiveFailures} fallos consecutivos al escribir métricas`);
  const important = (collector.droppedByLevel['WARN'] ?? 0) + (collector.droppedByLevel['ERROR'] ?? 0);
  if (important > 0) warnings.push(`${important} eventos WARN/ERROR descartados`);
  if (collector.failedEvents > 0) warnings.push(`${collector.failedEvents} eventos no se pudieron escribir`);
  if (metrics.dropped > 0 || metrics.failed > 0) warnings.push(`${metrics.dropped + metrics.failed} intervalos de métricas perdidos`);
  if (collector.queueCapacity > 0 && collector.queuePending / collector.queueCapacity >= 0.8) warnings.push('La cola está al 80 % o más');
  if (errors.length) return { state: 'error', label: 'Con fallos', reasons: [...errors, ...warnings] };
  if (warnings.length) return { state: 'warn', label: 'Degradado', reasons: warnings };
  return { state: 'ok', label: 'Operativo', reasons: [] };
}
