import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

const compiled = await build({
  entryPoints: ['src/app/pages/monitoring/monitoring-trace.ts'], bundle: true, write: false, format: 'esm', platform: 'node'
});
const { buildTraceView } = await import(`data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].text).toString('base64')}`);

const event = (id, at, over) => ({ eventId: id, receivedAt: at, service: 'backend', level: 'INFO', eventName: 'x', ...over });

test('trace view orders ascending, flags the cause and joins browser and backend', () => {
  const view = buildTraceView([
    event('b', '2026-11-12T10:00:05.000Z', { service: 'frontend', level: 'ERROR', eventName: 'frontend.api.request.failed',
      http: { method: 'POST', route: '/api/tools/:id/assign', statusCode: 500 }, page: '/inventario', actorId: 'u1', durationMs: 80 }),
    event('a', '2026-11-12T10:00:00.000Z', { level: 'ERROR', eventName: 'http.request.failed',
      http: { method: 'POST', route: '/api/tools/:id/assign', statusCode: 500 }, durationMs: 40 })
  ]);
  assert.equal(view.verdict, 'failed');
  assert.deepEqual(view.steps.map((s) => s.event.eventId), ['a', 'b']);
  assert.equal(view.steps[0].isCause, true);
  assert.equal(view.steps[1].offsetMs, 5000);
  assert.equal(view.steps[1].barPercent, 100);
  assert.equal(view.request, 'POST /api/tools/:id/assign → 500');
  assert.equal(view.actorId, 'u1');
  assert.equal(view.page, '/inventario');
  assert.deepEqual(view.services, ['Backend', 'Navegador']);
  assert.equal(view.sequence.length, 4);
  assert.match(view.sequence[2], /Backend: respondió 500/);
});

test('trace view handles empty, successful and browser-only traces', () => {
  assert.equal(buildTraceView([]), null);
  assert.equal(buildTraceView([event('a', '2026-11-12T10:00:00.000Z')]).verdict, 'ok');
  const only = buildTraceView([event('a', '2026-11-12T10:00:00.000Z', { service: 'frontend', level: 'ERROR', eventName: 'frontend.api.request.failed' })]);
  assert.equal(only.verdictLabel, 'Falló');
  assert.match(only.sequence[0], /no hay evento de error asociado/);
  assert.match(only.sequence[1], /sin respuesta del servidor/);
});

test('trace notices explain truncation, missing counterparts and very recent traces', () => {
  const now = Date.parse('2026-11-12T11:00:00.000Z');
  const old = '2026-11-12T10:00:00.000Z';
  const front = event('f', old, { service: 'frontend', level: 'ERROR', eventName: 'frontend.api.request.failed' });
  const back = event('b', old, { level: 'ERROR', eventName: 'http.request.failed' });
  const noBackend = buildTraceView([front], { now });
  assert.equal(noBackend.complete, false);
  assert.match(noBackend.notices[0], /No hay ningún error del backend/);
  assert.match(buildTraceView([back], { now }).notices[0], /No hay evento del navegador/);
  const both = buildTraceView([front, back], { now });
  assert.equal(both.complete, true);
  assert.deepEqual(both.notices, []);
  const truncated = buildTraceView([front], { now, truncated: true, limit: 200 });
  assert.equal(truncated.notices.length, 1);
  assert.match(truncated.notices[0], /incompleta.*200 eventos/);
  const recent = buildTraceView([front, back], { now: Date.parse(old) + 5000 });
  assert.equal(recent.complete, false);
  assert.match(recent.notices[0], /muy reciente/);
});
