import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

const mocks = {
  '@angular/core': `
    export const DestroyRef = 'destroy';
    export const Injectable = () => (target) => target;
    export const inject = (token) => globalThis.activityTest.providers[token];
  `,
  rxjs: `export const firstValueFrom = (value) => value;`,
  environment: `export const environment = { telemetryEnabled: true, apiUrl: 'http://api.example' };`,
  auth: `export const AuthService = 'auth';`,
  csrf: `export const CsrfTokenService = 'csrf';`
};

const compiled = await build({
  entryPoints: ['src/app/services/active-user.service.ts'], bundle: true, write: false,
  format: 'esm', platform: 'node',
  tsconfigRaw: { compilerOptions: { experimentalDecorators: true } },
  plugins: [{
    name: 'activity-mocks',
    setup(plugin) {
      plugin.onResolve({ filter: /^(?:@angular\/core|rxjs)$/ }, ({ path }) => ({ path, namespace: 'mock' }));
      plugin.onResolve({ filter: /(?:environments\/environment|\.\/auth\.service|\.\/csrf-token\.service)$/ },
        ({ path }) => ({ path: path.includes('environment') ? 'environment' : path.includes('auth.') ? 'auth' : 'csrf', namespace: 'mock' }));
      plugin.onLoad({ filter: /.*/, namespace: 'mock' }, ({ path }) => ({ contents: mocks[path], loader: 'js' }));
    }
  }]
});
const source = compiled.outputFiles[0].text;
const { ActiveUserService } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const tick = () => new Promise((resolve) => setImmediate(resolve));

function setup(t) {
  let actor = 'user-1';
  let time = 0;
  let timer = null;
  let destroy;
  const listeners = new Map();
  const calls = [];
  const originals = { document: globalThis.document, fetch: globalThis.fetch, performance: globalThis.performance,
    setTimeout: globalThis.setTimeout, clearTimeout: globalThis.clearTimeout };
  globalThis.document = {
    visibilityState: 'visible',
    addEventListener: (name, listener) => listeners.set(name, listener),
    removeEventListener: (name) => listeners.delete(name)
  };
  globalThis.performance = { now: () => time };
  globalThis.setTimeout = (callback, delay) => { timer = { callback, delay }; return 1; };
  globalThis.clearTimeout = () => { timer = null; };
  globalThis.fetch = async (...args) => { calls.push(args); return { status: 204 }; };
  globalThis.activityTest = { providers: {
    auth: { user: () => actor ? { id: actor } : null },
    csrf: { getToken: () => Promise.resolve('csrf') },
    destroy: { onDestroy: (callback) => { destroy = callback; } }
  } };
  new ActiveUserService();
  t.after(() => { destroy(); Object.assign(globalThis, originals); delete globalThis.activityTest; });
  return {
    calls, listeners, event: (name, trusted = true) => listeners.get(name)({ isTrusted: trusted }),
    setActor: (next) => { actor = next; },
    runTimer: () => { time += timer.delay; const callback = timer.callback; timer = null; callback(); },
    timer: () => timer, destroy: () => destroy()
  };
}

test('only trusted visible authenticated interactions send a CSRF-protected signal', async (t) => {
  const s = setup(t);
  s.event('pointerdown', false);
  document.visibilityState = 'hidden';
  s.event('keydown');
  document.visibilityState = 'visible';
  s.setActor(null);
  s.event('keydown');
  assert.equal(s.calls.length, 0);
  s.setActor('user-1');
  s.event('pointerdown');
  await tick();
  assert.equal(s.calls.length, 1);
  assert.equal(s.calls[0][0], 'http://api.example/api/telemetry/interaction');
  assert.equal(s.calls[0][1].method, 'POST');
  assert.equal(s.calls[0][1].credentials, 'include');
  assert.equal(s.calls[0][1].headers['X-CSRF-Token'], 'csrf');
  assert.ok(s.calls[0][1].signal instanceof AbortSignal);
  assert.equal(s.timer(), null);
});

test('continuous input is throttled and a trailing signal only follows actual input', async (t) => {
  const s = setup(t);
  s.event('keydown');
  await tick();
  s.event('wheel');
  s.event('pointerdown');
  assert.equal(s.timer().delay, 15000);
  s.runTimer();
  await tick();
  assert.equal(s.calls.length, 2);
  assert.equal(s.timer(), null);
});

test('a session change discards pending interactions rather than sending for another user', async (t) => {
  const s = setup(t);
  s.event('keydown');
  await tick();
  s.event('wheel');
  s.setActor('user-2');
  s.runTimer();
  await tick();
  assert.equal(s.calls.length, 1);
});

test('a session change while awaiting CSRF does not send an interaction', async (t) => {
  const s = setup(t);
  let release;
  globalThis.activityTest.providers.csrf.getToken = () => new Promise((resolve) => { release = resolve; });
  s.event('keydown');
  s.setActor('user-2');
  release('csrf');
  await tick();
  assert.equal(s.calls.length, 0);
});

test('failed sends are logged and new interactions can retry', async (t) => {
  const s = setup(t);
  const previous = console.error;
  const errors = [];
  console.error = (...args) => errors.push(args);
  t.after(() => { console.error = previous; });
  globalThis.fetch = async (...args) => { s.calls.push(args); return { status: 503 }; };
  s.event('pointerdown');
  await tick();
  assert.equal(errors.length, 1);
  s.event('keydown');
  s.runTimer();
  await tick();
  assert.equal(s.calls.length, 2);
});
