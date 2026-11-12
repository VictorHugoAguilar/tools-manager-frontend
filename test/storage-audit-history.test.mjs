import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

const mocks = {
  '@angular/core': `
    export const DestroyRef = 'destroy';
    export const ChangeDetectionStrategy = { OnPush: 0 };
    export const Component = () => (target) => target;
    export const inject = (token) => globalThis.historyTest[token];
    export const input = { required: () => () => globalThis.historyTest.scope };
    export const signal = (initial) => {
      let value = initial;
      const read = () => value;
      read.set = (next) => { value = next; };
      return read;
    };
  `,
  '@angular/core/rxjs-interop': `export const takeUntilDestroyed = () => (value) => value;`,
  '@angular/common': `export const CommonModule = {};`,
  '@angular/common/http': `
    export const HttpClient = 'http';
    export const HttpErrorResponse = globalThis.HistoryHttpErrorResponse = class extends Error {
      constructor(status, error) { super(); this.status = status; this.error = error; }
    };
  `,
  auth: `export const AuthService = 'auth';`,
  environment: `export const environment = { apiUrl: 'http://api.example' };`
};

const compiled = await build({
  entryPoints: ['src/app/pages/monitoring/storage-audit-history.component.ts'],
  bundle: true,
  write: false,
  format: 'esm',
  platform: 'node',
  tsconfigRaw: { compilerOptions: { experimentalDecorators: true } },
  plugins: [{
    name: 'storage-history-mocks',
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
const { StorageAuditHistoryComponent } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);

function setup(scope) {
  const calls = [];
  const requests = [];
  globalThis.historyTest = {
    scope,
    destroy: {},
    auth: { user: () => ({ permissions: ['monitoring:app'] }) },
    http: { get(url) {
      calls.push(url);
      return {
        pipe() { return this; },
        subscribe(observer) { requests.push(observer); }
      };
    } }
  };
  return { component: new StorageAuditHistoryComponent(), calls, requests };
}

for (const scope of ['boxes', 'workshop']) {
  test(`history ${scope} is loaded on demand and handles empty and populated results`, () => {
    const { component, calls, requests } = setup(scope);
    assert.equal(calls.length, 0);
    component.load();
    component.load();
    assert.deepEqual(calls, [`http://api.example/api/monitoring/storage-history/${scope}`]);
    assert.equal(component.loading(), true);
    requests[0].next({ events: [] });
    assert.deepEqual(component.events(), []);
    assert.equal(component.loading(), false);
    component.load();
    assert.equal(component.events(), null);
    const records = [{ eventId: 'event', action: 'updated', actorId: 'actor', targetId: 'target' }];
    requests[1].next({ events: records });
    assert.deepEqual(component.events(), records);
  });
}

test('history failures remain explicit and do not masquerade as an empty result', () => {
  const { component, requests } = setup('boxes');
  component.load();
  requests[0].error(new Error('offline'));
  assert.equal(component.events(), null);
  assert.equal(component.loading(), false);
  assert.match(component.error(), /No se pudo consultar/);
  component.load();
  assert.equal(component.error(), '');
  requests[1].next({ events: [] });
  assert.deepEqual(component.events(), []);
});

test('history reports missing Firestore indexes without showing an empty result', () => {
  const { component, requests } = setup('workshop');
  component.load();
  requests[0].error(new globalThis.HistoryHttpErrorResponse(503, { code: 'MONITORING_INDEX_UNAVAILABLE' }));
  assert.equal(component.events(), null);
  assert.equal(component.loading(), false);
  assert.match(component.error(), /índices de Firestore/);
});
