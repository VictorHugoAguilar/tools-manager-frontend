import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

const mocks = {
  '@angular/core': `
    export const Injectable = () => (target) => target;
    export const inject = () => globalThis.monitoringHttp;
  `,
  '@angular/common/http': `
    export const HttpClient = 'http';
    export class HttpParams {
      constructor(values = {}) { this.values = values; }
      set(key, value) { return new HttpParams({ ...this.values, [key]: value }); }
    }
  `,
  environment: `export const environment = { apiUrl: 'http://api.example' };`
};

const compiled = await build({
  entryPoints: ['src/app/services/monitoring-api.service.ts'],
  bundle: true,
  write: false,
  format: 'esm',
  platform: 'node',
  tsconfigRaw: { compilerOptions: { experimentalDecorators: true } },
  plugins: [{
    name: 'monitoring-http-mocks',
    setup(plugin) {
      plugin.onResolve({ filter: /^(?:@angular\/core|@angular\/common\/http)$/ },
        ({ path }) => ({ path, namespace: 'mock' }));
      plugin.onResolve({ filter: /environments\/environment$/ },
        () => ({ path: 'environment', namespace: 'mock' }));
      plugin.onLoad({ filter: /.*/, namespace: 'mock' }, ({ path }) => ({ contents: mocks[path], loader: 'js' }));
    }
  }]
});
const source = compiled.outputFiles[0].text;
const { MonitoringApiService } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);

test('metrics and services requests use the documented endpoints and structured parameters', () => {
  const calls = [];
  globalThis.monitoringHttp = { get: (url, options) => { calls.push({ url, options }); } };
  const api = new MonitoringApiService();
  api.metrics({
    from: '2026-11-10T09:00:00.000Z', to: '2026-11-11T09:00:00.000Z',
    interval: '1h', service: 'backend', metric: 'http_requests'
  });
  assert.equal(calls[0].url, 'http://api.example/api/monitoring/metrics');
  assert.deepEqual(calls[0].options.params.values, {
    from: '2026-11-10T09:00:00.000Z', to: '2026-11-11T09:00:00.000Z',
    interval: '1h', service: 'backend', metric: 'http_requests'
  });
  api.services();
  assert.equal(calls[1].url, 'http://api.example/api/monitoring/services');
});
