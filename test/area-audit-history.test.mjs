import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

const mocks = {
  '@angular/core': `
    export const DestroyRef = 'destroy';
    export const ChangeDetectionStrategy = { OnPush: 0 };
    export const Component = () => (target) => target;
    export const inject = (token) => globalThis.areaHistoryTest[token];
    export const input = { required: () => () => globalThis.areaHistoryTest.scope };
    export const signal = (initial) => { let value = initial; const read = () => value; read.set = (next) => value = next; return read; };
  `,
  '@angular/core/rxjs-interop': `export const takeUntilDestroyed = () => (value) => value;`,
  '@angular/common': `export const CommonModule = {};`,
  '@angular/common/http': `export const HttpClient = 'http'; export class HttpErrorResponse extends Error {}`,
  environment: `export const environment = { apiUrl: 'http://api.example' };`
};
const compiled = await build({
  entryPoints: ['src/app/pages/monitoring/area-audit-history.component.ts'], bundle: true, write: false,
  format: 'esm', platform: 'node', tsconfigRaw: { compilerOptions: { experimentalDecorators: true } },
  plugins: [{ name: 'area-mocks', setup(plugin) {
    plugin.onResolve({ filter: /^(?:@angular\/core|@angular\/core\/rxjs-interop|@angular\/common|@angular\/common\/http)$/ },
      ({ path }) => ({ path, namespace: 'mock' }));
    plugin.onResolve({ filter: /environments\/environment$/ }, () => ({ path: 'environment', namespace: 'mock' }));
    plugin.onLoad({ filter: /.*/, namespace: 'mock' }, ({ path }) => ({ contents: mocks[path], loader: 'js' }));
  } }]
});
const { AreaAuditHistoryComponent } = await import(`data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].text).toString('base64')}`);

for (const scope of ['tools', 'board', 'todo', 'drawing', 'catalogs', 'identity']) {
  test(`loads ${scope} on demand and shows failures`, () => {
    const calls = [];
    const requests = [];
    globalThis.areaHistoryTest = {
      scope, destroy: {}, http: { get(url) {
        calls.push(url);
        return { pipe() { return this; }, subscribe(observer) { requests.push(observer); } };
      } }
    };
    const component = new AreaAuditHistoryComponent();
    assert.equal(calls.length, 0);
    component.load();
    component.load();
    assert.deepEqual(calls, [`http://api.example/api/monitoring/audit-history/${scope}`]);
    requests[0].next({ events: [] });
    assert.deepEqual(component.events(), []);
    component.load();
    requests[1].error(new Error('offline'));
    assert.equal(component.events(), null);
    assert.match(component.error(), /No se pudo consultar/);
  });
}
