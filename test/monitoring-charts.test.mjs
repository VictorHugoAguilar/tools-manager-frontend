import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

const compiled = await build({
  entryPoints: ['src/app/pages/monitoring/monitoring-charts.ts'],
  bundle: true,
  write: false,
  format: 'esm',
  platform: 'node'
});
const source = compiled.outputFiles[0].text;
const { activityChartData, latencyChartData, errorRateChartData, levelDoughnutData, statusDoughnutData, usagePercent, levelCountsDoughnutData, collectorStatus } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);

test('HTTP charts preserve gaps and zero error counts in aligned hourly intervals', () => {
  const metrics = {
    service: 'backend', metric: 'http_requests',
    from: '2026-11-10T10:15:00.000Z', to: '2026-11-10T13:15:00.000Z',
    resolutionSeconds: 3600,
    points: [
      { start: '2026-11-10T10:00:00.000Z', count: 10, errors: 0, averageMs: 42 },
      { start: '2026-11-10T12:00:00.000Z', count: 5, errors: 2, averageMs: 200 }
    ]
  };
  const activity = activityChartData(metrics);
  assert.equal(activity.labels.length, 4);
  assert.deepEqual(activity.datasets[0].data, [10, null, 5, null]);
  assert.deepEqual(activity.datasets[1].data, [0, null, 2, null]);
  assert.ok(activity.datasets.every((dataset) => dataset.spanGaps === false));
  assert.deepEqual(latencyChartData(metrics).datasets[0].data, [42, null, 200, null]);
});

test('WebSocket charts show each recorded series and preserve missing intervals', () => {
  const metrics = {
    service: 'websocket', metric: 'websocket_activity',
    from: '2026-11-10T10:00:00.000Z', to: '2026-11-10T10:03:00.000Z',
    resolutionSeconds: 60,
    points: [{ start: '2026-11-10T10:01:00.000Z', opened: 0, closed: 3, updates: 8, awareness: 5, rejected: 1, abnormalClosed: 2 }]
  };
  const chart = activityChartData(metrics);
  assert.deepEqual(chart.datasets.map((dataset) => dataset.label), ['Aperturas', 'Cierres', 'Actualizaciones', 'Presencia', 'Mensajes rechazados', 'Cierres anómalos']);
  assert.deepEqual(chart.datasets.map((dataset) => dataset.data), [
    [null, 0, null], [null, 3, null], [null, 8, null], [null, 5, null], [null, 1, null], [null, 2, null]
  ]);
});

test('chart size is bounded without truncating or aggregating data', () => {
  const start = Date.parse('2026-11-10T00:00:00.000Z');
  const metrics = {
    service: 'backend', metric: 'http_requests', from: new Date(start).toISOString(),
    to: new Date(start + 1500 * 60000).toISOString(), resolutionSeconds: 60, points: []
  };
  assert.equal(activityChartData(metrics).labels.length, 1500);
  metrics.to = new Date(start + 1501 * 60000).toISOString();
  assert.equal(activityChartData(metrics), null);
  assert.equal(latencyChartData(metrics), null);
});

test('new overview charts derive rates, status split and level counts', () => {
  const metrics = {
    from: '2026-11-12T10:00:00.000Z', to: '2026-11-12T10:03:00.000Z', resolutionSeconds: 60,
    points: [{ start: '2026-11-12T10:00:00.000Z', count: 200, errors: 10, averageMs: 5 },
      { start: '2026-11-12T10:02:00.000Z', count: 0, errors: 0, averageMs: 0 }]
  };
  const rate = errorRateChartData(metrics);
  assert.deepEqual(rate.datasets[0].data, [5, null, 0]);
  assert.equal(statusDoughnutData(0, 0), null);
  assert.deepEqual(statusDoughnutData(100, 3).datasets[0].data, [97, 3]);
  const levels = levelDoughnutData([{ level: 'INFO' }, { level: 'ERROR' }, { level: 'INFO' }]);
  assert.deepEqual(levels.labels, ['INFO', 'ERROR']);
  assert.deepEqual(levels.datasets[0].data, [2, 1]);
  assert.equal(levelDoughnutData([]), null);
  const totals = levelCountsDoughnutData({ DEBUG: 0, INFO: 900, WARN: 12, ERROR: 3 });
  assert.deepEqual(totals.labels, ['INFO', 'WARN', 'ERROR']);
  assert.deepEqual(totals.datasets[0].data, [900, 12, 3]);
  assert.equal(usagePercent(50, 0), 0);
  assert.equal(usagePercent(150, 100), 100);
});

test('collector status reports failures, losses and queue pressure', () => {
  const base = {
    queuePending: 10, queueCapacity: 1000, droppedByLevel: { DEBUG: 5, INFO: 2, WARN: 0, ERROR: 0 }, failedEvents: 0,
    lastSuccessfulFlushAt: null, lastFlushDurationMs: null, consecutiveWriteFailures: 0,
    heartbeat: { consecutiveFailures: 0, lastSuccess: null },
    httpMetrics: { pending: 0, activeIntervals: 0, dropped: 0, droppedSamples: 0, failed: 0, consecutiveFailures: 0 }
  };
  assert.equal(collectorStatus(base).state, 'ok');
  assert.equal(collectorStatus({ ...base, queuePending: 900 }).state, 'warn');
  assert.equal(collectorStatus({ ...base, droppedByLevel: { WARN: 1 } }).state, 'warn');
  const failing = collectorStatus({ ...base, consecutiveWriteFailures: 3, failedEvents: 2 });
  assert.equal(failing.state, 'error');
  assert.equal(failing.reasons.length, 2);
});
