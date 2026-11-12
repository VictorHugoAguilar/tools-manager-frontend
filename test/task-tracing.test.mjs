import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

const mocks = {
  '@angular/core': `
    export const DestroyRef = 'destroy';
    export const ChangeDetectionStrategy = { OnPush: 0 };
    export const Component = (metadata) => (target) => { target.metadata = metadata; return target; };
    export const inject = (token) => globalThis.taskTraceTest[token];
    export const input = { required: () => { let value; const read = () => value; read.set = (next) => value = next; return read; } };
    export const signal = (initial) => { let value = initial; const read = () => value; read.set = (next) => value = next; return read; };
  `,
  '@angular/core/rxjs-interop': `export const takeUntilDestroyed = () => (value) => value;`,
  '@angular/common': `export const CommonModule = {};`,
  '@angular/common/http': `export const HttpClient = 'http'; export class HttpErrorResponse extends Error {}`,
  auth: `export const AuthService = 'auth';`,
  environment: `export const environment = { apiUrl: 'http://api.example' };`
};
const compiled = await build({
  entryPoints: ['src/app/components/task-tracing.component.ts'], bundle: true, write: false,
  format: 'esm', platform: 'node', tsconfigRaw: { compilerOptions: { experimentalDecorators: true } },
  plugins: [{
    name: 'task-tracing-mocks',
    setup(plugin) {
      plugin.onResolve({ filter: /^(?:@angular\/core|@angular\/core\/rxjs-interop|@angular\/common|@angular\/common\/http)$/ },
        ({ path }) => ({ path, namespace: 'mock' }));
      plugin.onResolve({ filter: /auth\.service$/ }, () => ({ path: 'auth', namespace: 'mock' }));
      plugin.onResolve({ filter: /environments\/environment$/ }, () => ({ path: 'environment', namespace: 'mock' }));
      plugin.onLoad({ filter: /.*/, namespace: 'mock' }, ({ path }) => ({ contents: mocks[path], loader: 'js' }));
    }
  }]
});
const source = compiled.outputFiles[0].text;
const { TaskTracingComponent } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);

function setup() {
  const calls = [];
  const requests = [];
  globalThis.taskTraceTest = {
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
  const component = new TaskTracingComponent();
  component.module.set('todo');
  component.taskId.set('id 1');
  return { component, calls, requests };
}

test('history is on demand, guarded by tracing permission and warns about global access', () => {
  const { component, calls, requests } = setup();
  assert.match(TaskTracingComponent.metadata.template, /permissions\?\.includes\('tracing:app'\)/);
  assert.match(TaskTracingComponent.metadata.template, /tareas privadas de cualquier proyecto/);
  assert.equal(calls.length, 0);
  component.load();
  component.load();
  assert.deepEqual(calls, ['http://api.example/api/tracing/tasks/todo/id%201/history']);
  assert.equal(component.loading(), true);
  requests[0].observer.next({ events: [] });
  assert.deepEqual(component.events(), []);
  assert.equal(component.loading(), false);
});

test('changing task cancels the request and clears data; errors are visible', () => {
  const { component, requests } = setup();
  component.load();
  component.taskId.set('two');
  component.ngOnChanges();
  assert.equal(requests[0].cancelled, true);
  assert.equal(component.loading(), false);
  assert.equal(component.events(), null);
  component.load();
  requests[1].observer.error(new Error('offline'));
  assert.match(component.error(), /No se pudo consultar/);
  assert.equal(component.events(), null);
});

test('board and todo histories use their respective endpoints', () => {
  const { component, calls, requests } = setup();
  component.module.set('board');
  component.load();
  assert.equal(calls[0], 'http://api.example/api/tracing/tasks/board/id%201/history');
  component.module.set('todo');
  component.ngOnChanges();
  assert.equal(requests[0].cancelled, true);
  component.load();
  assert.equal(calls[1], 'http://api.example/api/tracing/tasks/todo/id%201/history');
});
