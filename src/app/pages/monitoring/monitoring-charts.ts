import { ChartData, ChartDataset } from 'chart.js';
import { MonitoringMetricResult, MonitoringOverview } from '../../services/monitoring-api.service';

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

export function latencyChartData(metrics: MonitoringOverview['httpMetrics']): ChartData<'line'> | null {
  return chartData(metrics, metrics.points, [
    { label: 'Latencia media API (ms)', color: '#208ff4', value: (point) => point.averageMs }
  ]);
}

export function activityChartData(metrics: MonitoringMetricResult): ChartData<'line'> | null {
  if (metrics.service === 'backend') {
    return chartData(metrics, metrics.points, [
      { label: 'Peticiones', color: '#208ff4', value: (point) => point.count },
      { label: 'Errores 5xx', color: '#b52e42', value: (point) => point.errors }
    ]);
  }
  return chartData(metrics, metrics.points, [
    { label: 'Aperturas', color: '#208ff4', value: (point) => point.opened },
    { label: 'Cierres', color: '#b52e42', value: (point) => point.closed },
    { label: 'Actualizaciones', color: '#35ad71', value: (point) => point.updates }
  ]);
}
