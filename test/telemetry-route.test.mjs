import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

const compiled = await build({
  entryPoints: ['src/app/services/telemetry-route.ts'], bundle: true, write: false, format: 'esm', platform: 'node'
});
const { failedRequestDetails, normalizeTelemetryPath } = await import(
  `data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].text).toString('base64')}`);

test('paths keep literal segments and hide identifiers', () => {
  assert.equal(normalizeTelemetryPath('/api/tools/-Nabc123XYZ/assign'), '/api/tools/:id/assign');
  assert.equal(normalizeTelemetryPath('/inventario/9f8e7d6c-1111-4222-8333-444455556666'), '/inventario/:id');
  assert.equal(normalizeTelemetryPath('/'), '/');
});

test('failed request details include method, route, status and origin page', () => {
  assert.deepEqual(failedRequestDetails('post', '/api/tools/abc-12/assign', 500, '/inventario/42'), {
    page: '/inventario/:id', http: { method: 'POST', route: '/api/tools/:id/assign', statusCode: 500 }
  });
  assert.equal(failedRequestDetails('GET', '/api/tools', undefined, '/').http.statusCode, 0);
  assert.equal(failedRequestDetails('TRACE', '/api/tools', 500, '/').http, undefined);
});
