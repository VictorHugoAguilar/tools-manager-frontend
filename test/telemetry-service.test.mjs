import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

const mocks = {
  '@angular/core': `
    export const DestroyRef = 'destroy';
    export const Injectable = () => (target) => target;
    export const inject = (token) => globalThis.telemetryTest.providers[token];
    export const effect = (callback) => callback();
  `,
  '@angular/core/rxjs-interop': `export const takeUntilDestroyed = () => (value) => value;`,
  '@angular/router': `export const Router = 'router'; export class NavigationEnd {}`,
  'rxjs': `
    export const filter = () => (value) => value;
    export const firstValueFrom = (value) => value;
  `,
  'environment': `export const environment = { telemetryEnabled: true, apiUrl: 'http://localhost:3000' };`,
  'auth': `export const AuthService = 'auth';`,
  'csrf': `export const CsrfTokenService = 'csrf';`
};

const compiled = await build({
  entryPoints: ['src/app/services/telemetry.service.ts'],
  bundle: true,
  write: false,
  format: 'esm',
  platform: 'node',
  tsconfigRaw: { compilerOptions: { experimentalDecorators: true } },
  plugins: [{
    name: 'test-mocks',
    setup(plugin) {
      plugin.onResolve({ filter: /^(?:@angular\/core|@angular\/core\/rxjs-interop|@angular\/router|rxjs)$/ },
        ({ path }) => ({ path, namespace: 'mock' }));
      plugin.onResolve({ filter: /(?:environments\/environment|\.\/auth\.service|\.\/csrf-token\.service)$/ },
        ({ path }) => ({ path: path.includes('environment') ? 'environment' : path.includes('auth.') ? 'auth' : 'csrf', namespace: 'mock' }));
      plugin.onLoad({ filter: /.*/, namespace: 'mock' }, ({ path }) => ({ contents: mocks[path], loader: 'js' }));
    }
  }]
});
const source = compiled.outputFiles[0].text;
const { TelemetryService } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);

function setup() {
  let actor = 'user-1';
  let token = 'csrf-token';
  const calls = [];
  let response = async (_url, options) => {
    calls.push(options);
    const body = JSON.parse(options.body);
    return { status: 202, json: async () => ({ accepted: body.events.length, rejected: 0 }) };
  };
  globalThis.window = { setInterval: () => 1, clearInterval() {}, addEventListener() {}, removeEventListener() {} };
  globalThis.document = { visibilityState: 'visible', addEventListener() {}, removeEventListener() {} };
  globalThis.fetch = (...args) => response(...args);
  globalThis.telemetryTest = { providers: {
    auth: { user: () => actor ? { id: actor } : null },
    csrf: { cachedToken: () => token, getToken: () => Promise.resolve(token) },
    destroy: { onDestroy() {} },
    router: { events: { pipe: () => ({ subscribe() {} }) } }
  } };
  return {
    service: new TelemetryService(), calls,
    setActor: (value) => { actor = value; },
    setToken: (value) => { token = value; },
    setResponse: (value) => { response = value; }
  };
}

test('authenticated events are batched with CSRF and no error or URL content', async () => {
  const { service, calls } = setup();
  service.track('frontend.api.request.failed', { traceId: '01234567-0123-4123-8123-0123456789ab', durationMs: 42 });
  await service.flush();
  assert.equal(calls.length, 1);
  assert.equal(calls[0].credentials, 'include');
  assert.equal(calls[0].headers['X-CSRF-Token'], 'csrf-token');
  const body = JSON.parse(calls[0].body);
  assert.equal(body.events.length, 1);
  assert.deepEqual(Object.keys(body.events[0]).sort(), ['durationMs', 'eventId', 'eventName', 'occurredAt', 'schemaVersion', 'traceId']);
  assert.equal(service.getStats().pending, 0);
});

test('session changes discard queued events rather than attributing them to a new actor', async () => {
  const { service, calls, setActor } = setup();
  service.track('frontend.runtime.error');
  setActor('user-2');
  await service.flush();
  assert.equal(calls.length, 0);
  service.track('frontend.runtime.error');
  await service.flush();
  assert.equal(calls.length, 1);
});

test('session changes while obtaining CSRF abort the in-flight batch', async () => {
  const { service, calls, setActor, setToken } = setup();
  let release;
  setToken(new Promise((resolve) => { release = resolve; }));
  service.track('frontend.runtime.error');
  const sending = service.flush();
  setActor('user-2');
  release('csrf-token');
  await sending;
  assert.equal(calls.length, 0);
  assert.equal(service.getStats().pending, 0);
});

test('25 events trigger a batch and server rejections are counted without retry', async () => {
  const { service, calls, setResponse } = setup();
  let complete;
  const sent = new Promise((resolve) => { complete = resolve; });
  setResponse(async (_url, options) => {
    calls.push(options);
    complete();
    return { status: 202, json: async () => ({ accepted: 24, rejected: 1 }) };
  });
  for (let i = 0; i < 25; i++) service.track('frontend.runtime.error');
  await sent;
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(JSON.parse(calls[0].body).events.length, 25);
  assert.equal(service.getStats().rejected, 1);
  assert.equal(service.getStats().pending, 0);
});

test('final flush requires a cached CSRF token and uses keepalive', async () => {
  const { service, calls, setToken } = setup();
  service.track('frontend.runtime.error');
  setToken(null);
  await service.flush(true);
  assert.equal(service.getStats().pending, 1);
  assert.equal(calls.length, 0);
  setToken('csrf-token');
  await service.flush(true);
  assert.equal(calls[0].keepalive, true);
});

test('network failures retry only three times and account for discarded events', async () => {
  const { service, setResponse } = setup();
  let attempts = 0;
  setResponse(async () => { attempts++; throw new Error('offline'); });
  service.track('frontend.runtime.error');
  const original = console.error;
  console.error = () => {};
  try {
    await service.flush(true);
    await service.flush(true);
    await service.flush(true);
    assert.equal(attempts, 3);
    assert.equal(service.getStats().pending, 0);
    assert.equal(service.getStats().rejected, 1);
  } finally {
    console.error = original;
  }
});
