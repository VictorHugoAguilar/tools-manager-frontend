import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

const mocks = {
  '@angular/core': `
    export const Injectable = () => (target) => target;
    export const inject = (token) => globalThis.toolSearchTest[token];
    export const DestroyRef = 'destroy';
    export const signal = (initial) => { let value = initial; const read = () => value; read.set = (next) => value = next; return read; };
    export const computed = (callback) => callback;
  `,
  '@angular/common/http': `export class HttpErrorResponse extends Error {}`,
  rxjs: `export const finalize = () => {};`,
  data: `export const demoTools = [];`,
  toolApi: `export const ToolApiService = 'toolApi';`,
  confirm: `export const ConfirmService = 'confirm';`,
  toast: `export const ToastService = 'toast';`,
  telemetry: `export const TelemetryService = 'telemetry';`,
  auth: `export const AuthService = 'auth';`
};
const compiled = await build({
  entryPoints: ['src/app/services/tool-store.service.ts'], bundle: true, write: false,
  format: 'esm', platform: 'node', tsconfigRaw: { compilerOptions: { experimentalDecorators: true } },
  plugins: [{
    name: 'tool-search-mocks',
    setup(plugin) {
      plugin.onResolve({ filter: /^(?:@angular\/core|@angular\/common\/http|rxjs)$/ },
        ({ path }) => ({ path, namespace: 'mock' }));
      plugin.onResolve({ filter: /(?:data\/demo-tools|tool-api\.service|confirm\.service|toast\.service|telemetry\.service|auth\.service)$/ },
        ({ path }) => ({ path: path.includes('demo-tools') ? 'data' : path.includes('tool-api') ? 'toolApi'
          : path.includes('confirm') ? 'confirm' : path.includes('toast') ? 'toast'
            : path.includes('telemetry') ? 'telemetry' : 'auth', namespace: 'mock' }));
      plugin.onLoad({ filter: /.*/, namespace: 'mock' }, ({ path }) => ({ contents: mocks[path], loader: 'js' }));
    }
  }]
});
const source = compiled.outputFiles[0].text;
const { ToolStoreService } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);

test('tool search emits a debounced event without the search text or attribution after a user change', (t) => {
  let actor = 'first';
  let pending;
  const events = [];
  const oldSetTimeout = globalThis.setTimeout;
  const oldClearTimeout = globalThis.clearTimeout;
  globalThis.setTimeout = (callback, delay) => { pending = { callback, delay }; return 1; };
  globalThis.clearTimeout = () => { pending = undefined; };
  t.after(() => { globalThis.setTimeout = oldSetTimeout; globalThis.clearTimeout = oldClearTimeout; });
  globalThis.toolSearchTest = {
    toolApi: {}, confirm: {}, toast: {}, destroy: { onDestroy() {} },
    auth: { user: () => ({ id: actor }) }, telemetry: { track: (...args) => events.push(args) }
  };
  const store = new ToolStoreService();
  store.updateSearch('private search');
  store.updateSearch('private search extended');
  assert.equal(pending.delay, 1000);
  const firstTimer = pending;
  pending = undefined;
  firstTimer.callback();
  assert.deepEqual(events, [['frontend.tools.search.completed']]);
  store.updateSearch('other');
  actor = 'second';
  const secondTimer = pending;
  pending = undefined;
  secondTimer.callback();
  assert.equal(events.length, 1);
  store.updateSearch('');
  assert.equal(pending, undefined);
});
