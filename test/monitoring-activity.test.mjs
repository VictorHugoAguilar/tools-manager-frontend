import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

const compiled = await build({
  entryPoints: ['src/app/pages/monitoring/monitoring-activity.ts'],
  bundle: true,
  write: false,
  format: 'esm',
  platform: 'node'
});
const source = compiled.outputFiles[0].text;
const { recentStorageActivity } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);

test('activity only describes known backend storage reads and keeps HTTP failures visible', () => {
  const date = '2026-11-11T12:00:00.000Z';
  const events = [
    { eventId: '1', receivedAt: date, service: 'backend', eventName: 'storage.workshop.searched',
      http: { statusCode: 403 }, traceId: 'trace' },
    { eventId: '2', receivedAt: date, service: 'backend', eventName: 'storage.box.viewed',
      http: { statusCode: 200 } },
    { eventId: '3', receivedAt: date, service: 'frontend', eventName: 'storage.boxes.viewed' },
    { eventId: '4', receivedAt: date, service: 'backend', eventName: 'storage.boxes.deleted' },
    { eventId: '5', receivedAt: date, service: 'backend', eventName: 'constructor' }
  ];
  assert.deepEqual(recentStorageActivity(events), [
    { eventId: '1', receivedAt: date, label: 'Búsqueda en el inventario del taller', statusCode: 403, traceId: 'trace' },
    { eventId: '2', receivedAt: date, label: 'Consulta de una caja', statusCode: 200 }
  ]);
});

test('missing status is unknown and empty input remains empty', () => {
  const [activity] = recentStorageActivity([{
    eventId: '1', receivedAt: '2026-11-11T12:00:00.000Z', service: 'backend', eventName: 'storage.boxes.viewed'
  }]);
  assert.equal(activity.statusCode, null);
  assert.equal(activity.label, 'Consulta de cajas');
  assert.deepEqual(recentStorageActivity([]), []);
});

test('all supported storage read event names are displayed', () => {
  const names = [
    'storage.workshop.viewed', 'storage.workshop.searched', 'storage.workshop.categories.viewed',
    'storage.boxes.viewed', 'storage.box.viewed', 'storage.boxes.searched', 'storage.shelf_config.viewed'
  ];
  const events = names.map((eventName, index) => ({
    eventId: String(index), receivedAt: '2026-11-11T12:00:00.000Z', service: 'backend', eventName
  }));
  const activity = recentStorageActivity(events);
  assert.equal(activity.length, names.length);
  assert.deepEqual(activity.map((item) => item.eventId), events.map((event) => event.eventId));
});
