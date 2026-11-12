import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

const mocks = {
  '@angular/core': `
    export const DestroyRef = 'destroy';
    export const ChangeDetectionStrategy = { OnPush: 0 };
    export const Component = () => (target) => target;
    export const inject = (token) => globalThis.toolTraceTest[token];
    export const input = { required: () => () => [] };
    export const signal = (initial) => { let value = initial; const read = () => value; read.set = (next) => value = next; return read; };
  `,
  '@angular/core/rxjs-interop': `export const takeUntilDestroyed = () => (value) => value;`,
  '@angular/common': `export const CommonModule = {};`,
  '@angular/common/http': `export const HttpClient = 'http'; export class HttpErrorResponse extends Error {}`,
  '@angular/router': `export const RouterLink = {};`,
  auth: `export const AuthService = 'auth';`,
  environment: `export const environment = { apiUrl: 'http://api.example' };`
};
const compiled = await build({
  entryPoints: ['src/app/components/tool-tracing.component.ts'], bundle: true, write: false,
  format: 'esm', platform: 'node', tsconfigRaw: { compilerOptions: { experimentalDecorators: true } },
  plugins: [{
    name: 'tool-tracing-mocks',
    setup(plugin) {
      plugin.onResolve({ filter: /^(?:@angular\/core|@angular\/core\/rxjs-interop|@angular\/common|@angular\/common\/http|@angular\/router)$/ },
        ({ path }) => ({ path, namespace: 'mock' }));
      plugin.onResolve({ filter: /auth\.service$/ }, () => ({ path: 'auth', namespace: 'mock' }));
      plugin.onResolve({ filter: /environments\/environment$/ }, () => ({ path: 'environment', namespace: 'mock' }));
      plugin.onLoad({ filter: /.*/, namespace: 'mock' }, ({ path }) => ({ contents: mocks[path], loader: 'js' }));
    }
  }]
});
const source = compiled.outputFiles[0].text;
const { ToolTracingComponent } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);

function setup() {
  const calls = [];
  const requests = [];
  globalThis.toolTraceTest = {
    destroy: {}, auth: { user: () => ({ permissions: ['tracing:app'] }) },
    http: { get(url) {
      calls.push(url);
      return { pipe() { return this; }, subscribe(observer) {
        const request = { observer, cancelled: false };
        requests.push(request);
        return { unsubscribe() { request.cancelled = true; } };
      } };
    } }
  };
  return { component: new ToolTracingComponent(), calls, requests };
}

test('history loads only on demand and encodes the selected identifier', () => {
  const { component, calls, requests } = setup();
  component.load();
  assert.equal(calls.length, 0);
  component.select('id 1');
  component.load();
  component.load();
  assert.deepEqual(calls, ['http://api.example/api/tracing/tools/id%201/history']);
  assert.equal(component.loading(), true);
  requests[0].observer.next({ events: [] });
  assert.deepEqual(component.events(), []);
  assert.equal(component.loading(), false);
});

test('changing tools cancels the previous request and clears its state', () => {
  const { component, requests } = setup();
  component.select('one');
  component.load();
  component.select('two');
  assert.equal(requests[0].cancelled, true);
  assert.equal(component.loading(), false);
  assert.equal(component.events(), null);
  component.load();
  requests[1].observer.error(new Error('offline'));
  assert.match(component.error(), /No se pudo consultar/);
  assert.equal(component.events(), null);
});
