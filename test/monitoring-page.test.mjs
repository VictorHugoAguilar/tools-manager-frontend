import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

const mocks = {
  '@angular/core': `
    export const DestroyRef = 'destroy';
    export const ChangeDetectionStrategy = { OnPush: 0 };
    export const Component = () => (target) => target;
    export const inject = (token) => globalThis.monitoringTest[token];
    export const signal = (initial) => {
      let value = initial;
      const read = () => value;
      read.set = (next) => { value = next; };
      return read;
    };
    export const computed = (callback) => callback;
  `,
  '@angular/core/rxjs-interop': `export const takeUntilDestroyed = () => (value) => value;`,
  '@angular/common': `export const CommonModule = {};`,
  '@angular/common/http': `export class HttpErrorResponse extends Error {}`,
  '@angular/forms': `export const FormsModule = {};`,
  'ng2-charts': `export const BaseChartDirective = {};`,
  'monitoring-api': `export const MonitoringApiService = 'api';`,
  'storage-history': `export const StorageAuditHistoryComponent = {};`
};

const compiled = await build({
  entryPoints: ['src/app/pages/monitoring/monitoring-page.component.ts'],
  bundle: true,
  write: false,
  format: 'esm',
  platform: 'node',
  tsconfigRaw: { compilerOptions: { experimentalDecorators: true } },
  plugins: [{
    name: 'monitoring-mocks',
    setup(plugin) {
      plugin.onResolve({ filter: /^(?:@angular\/core|@angular\/core\/rxjs-interop|@angular\/common|@angular\/common\/http|@angular\/forms|ng2-charts)$/ },
        ({ path }) => ({ path, namespace: 'mock' }));
      plugin.onResolve({ filter: /monitoring-api\.service$/ },
        () => ({ path: 'monitoring-api', namespace: 'mock' }));
      plugin.onResolve({ filter: /storage-audit-history\.component$/ },
        () => ({ path: 'storage-history', namespace: 'mock' }));
      plugin.onLoad({ filter: /.*/, namespace: 'mock' }, ({ path }) => ({ contents: mocks[path], loader: 'js' }));
    }
  }]
});
const source = compiled.outputFiles[0].text;
const { MonitoringPageComponent } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);

function setup() {
  const calls = [];
  const requests = [];
  const observable = (name, args) => {
    calls.push({ name, args });
    return {
      pipe() { return this; },
      subscribe(observer) { requests.push({ name, observer }); }
    };
  };
  globalThis.monitoringTest = {
    destroy: {},
    api: {
      overview: (...args) => observable('overview', args),
      auditStatus: (...args) => observable('auditStatus', args),
      events: (...args) => observable('events', args),
      trace: (...args) => observable('trace', args),
      metrics: (...args) => observable('metrics', args),
      services: (...args) => observable('services', args)
    }
  };
  const component = new MonitoringPageComponent();
  requests.find((entry) => entry.name === 'overview').observer.next({ period: '1h', generatedAt: '2026-11-11T12:00:00.000Z' });
  requests.find((entry) => entry.name === 'auditStatus').observer.next({});
  return { component, calls, requests };
}

test('search uses the server overview range and navigates cursors in both directions', () => {
  const { component, calls, requests } = setup();
  component.searchService = 'backend';
  component.searchEvents();
  assert.deepEqual(calls.at(-1), { name: 'events', args: [{
    from: '2026-11-11T11:00:00.000Z', to: '2026-11-11T12:00:00.000Z',
    service: 'backend', level: '', eventName: '', traceId: ''
  }] });
  requests.at(-1).observer.next({ events: [{ eventId: 'first' }], nextCursor: 'cursor1' });
  component.loadMoreEvents();
  assert.equal(calls.at(-1).args[0].cursor, 'cursor1');
  requests.at(-1).observer.next({ events: [{ eventId: 'second' }], nextCursor: null });
  assert.equal(component.pageNumber(), 2);
  component.loadPreviousEvents();
  assert.equal(calls.at(-1).args[0].cursor, undefined);
  requests.at(-1).observer.next({ events: [{ eventId: 'first' }], nextCursor: 'cursor1' });
  assert.equal(component.pageNumber(), 1);
  assert.equal(component.searchResults()[0].eventId, 'first');
});

test('invalid custom dates are reported without sending a query', () => {
  const { component, calls } = setup();
  component.searchFrom = '2026-11-01T10:00';
  component.searchTo = '2026-11-10T10:00';
  component.searchEvents();
  assert.match(component.searchError(), /siete días/);
  assert.equal(calls.filter((call) => call.name === 'events').length, 0);
  component.searchTo = '';
  component.searchEvents();
  assert.match(component.searchError(), /fechas válidas/);
});

test('trace detail uses the active range and does not apply event filters', () => {
  const { component, calls, requests } = setup();
  component.searchService = 'backend';
  component.searchEvents();
  requests.at(-1).observer.next({ events: [], nextCursor: null });
  component.showTrace('trace-id');
  assert.equal(calls.at(-1).name, 'trace');
  assert.equal(calls.at(-1).args[0], 'trace-id');
  assert.deepEqual(calls.at(-1).args[1], {
    from: '2026-11-11T11:00:00.000Z', to: '2026-11-11T12:00:00.000Z'
  });
  requests.at(-1).observer.next({ events: [{ eventId: 'trace-event' }], nextCursor: 'next' });
  component.loadMoreEvents();
  assert.equal(calls.at(-1).name, 'trace');
  assert.equal(calls.at(-1).args[1].cursor, 'next');
});

test('activity traces use the overview interval instead of a previous filtered search', () => {
  const { component, calls, requests } = setup();
  component.searchFrom = '2026-11-09T10:00';
  component.searchTo = '2026-11-09T11:00';
  component.searchEvents();
  requests.at(-1).observer.next({ events: [], nextCursor: null });
  component.showActivityTrace('activity-trace');
  assert.equal(calls.at(-1).name, 'trace');
  assert.deepEqual(calls.at(-1).args, ['activity-trace', {
    from: '2026-11-11T11:00:00.000Z', to: '2026-11-11T12:00:00.000Z'
  }]);
});

test('returning from a trace restores the previous page, applied filters and pagination without a request', () => {
  const { component, calls, requests } = setup();
  component.searchService = 'backend';
  component.searchEventName = 'storage.box.viewed';
  component.searchEvents();
  requests.at(-1).observer.next({ events: [{ eventId: 'first' }], nextCursor: 'first-cursor' });
  component.loadMoreEvents();
  requests.at(-1).observer.next({ events: [{ eventId: 'second' }], nextCursor: 'second-cursor' });
  component.searchService = 'frontend';
  component.searchTraceId = 'draft';
  component.showTrace('trace-id');
  assert.equal(component.searchTraceId, 'draft');
  requests.at(-1).observer.next({ events: [{ eventId: 'trace' }], nextCursor: null });
  const count = calls.length;
  component.returnToEvents();
  assert.equal(calls.length, count);
  assert.equal(component.traceView(), null);
  assert.equal(component.canReturnToEvents(), false);
  assert.equal(component.pageNumber(), 2);
  assert.equal(component.nextCursor(), 'second-cursor');
  assert.equal(component.searchResults()[0].eventId, 'second');
  assert.equal(component.activeFilters().service, 'backend');
  assert.equal(component.activeFilters().eventName, 'storage.box.viewed');
  component.loadPreviousEvents();
  assert.equal(calls.at(-1).args[0].service, 'backend');
  assert.equal(calls.at(-1).args[0].cursor, undefined);
});

test('overview traces ignore unsubmitted custom dates and return to the overview', () => {
  const { component, calls, requests } = setup();
  component.searchFrom = '2026-11-09T10:00';
  component.searchTo = '2026-11-09T11:00';
  component.showTrace('trace-id');
  assert.deepEqual(calls.at(-1).args[1], {
    from: '2026-11-11T11:00:00.000Z', to: '2026-11-11T12:00:00.000Z'
  });
  requests.at(-1).observer.error(new Error('offline'));
  component.returnToEvents();
  assert.equal(component.searchResults(), null);
  assert.equal(component.activeRange(), null);
  assert.equal(component.searchError(), '');
});

test('overview queries use the period returned with the displayed data', () => {
  const { component, calls } = setup();
  component.period.set('7d');
  component.showActivityTrace('trace-id');
  assert.deepEqual(calls.at(-1).args[1], {
    from: '2026-11-11T11:00:00.000Z', to: '2026-11-11T12:00:00.000Z'
  });
});

test('returning from a trace preserves a failed search instead of presenting it as empty', () => {
  const { component, requests } = setup();
  component.searchEvents();
  requests.at(-1).observer.error(new Error('offline'));
  component.showActivityTrace('trace-id');
  requests.at(-1).observer.next({ events: [], nextCursor: null });
  component.returnToEvents();
  assert.match(component.searchError(), /No se pudieron consultar/);
  assert.equal(component.activeFilters(), null);
  assert.equal(component.activeRange(), null);
});

test('opening another trace preserves the original return view and clearing removes it', () => {
  const { component, requests } = setup();
  component.showTrace('first-trace');
  requests.at(-1).observer.next({ events: [], nextCursor: null });
  component.showActivityTrace('second-trace');
  requests.at(-1).observer.next({ events: [], nextCursor: null });
  component.returnToEvents();
  assert.equal(component.searchResults(), null);
  component.showTrace('third-trace');
  requests.at(-1).observer.next({ events: [], nextCursor: null });
  component.clearSearch();
  assert.equal(component.canReturnToEvents(), false);
});

test('a new search from a trace discards the previous view and applies the draft filters', () => {
  const { component, calls, requests } = setup();
  component.showTrace('trace-id');
  requests.at(-1).observer.next({ events: [], nextCursor: null });
  component.searchService = 'frontend';
  component.searchEvents();
  assert.equal(component.canReturnToEvents(), false);
  assert.equal(component.traceView(), null);
  assert.equal(calls.at(-1).args[0].service, 'frontend');
  requests.at(-1).observer.next({ events: [], nextCursor: null });
  assert.equal(component.activeFilters().service, 'frontend');
});

test('custom dates are converted from local time to UTC and remain fixed during pagination', () => {
  const { component, calls, requests } = setup();
  component.searchFrom = '2026-11-10T10:00';
  component.searchTo = '2026-11-11T10:00';
  component.searchEvents();
  const first = calls.at(-1).args[0];
  assert.equal(first.from, new Date('2026-11-10T10:00').toISOString());
  assert.equal(first.to, new Date('2026-11-11T10:00').toISOString());
  requests.at(-1).observer.next({ events: [], nextCursor: 'next' });
  component.searchFrom = '2026-11-09T10:00';
  component.loadMoreEvents();
  assert.equal(calls.at(-1).args[0].from, first.from);
});

test('failed page navigation preserves the current page; refresh and clear reset results', () => {
  const { component, requests } = setup();
  component.searchEvents();
  requests.at(-1).observer.next({ events: [{ eventId: 'first' }], nextCursor: 'cursor1' });
  component.loadMoreEvents();
  requests.at(-1).observer.error(new Error('offline'));
  assert.equal(component.pageNumber(), 1);
  assert.equal(component.searchResults()[0].eventId, 'first');
  assert.match(component.searchError(), /No se pudieron consultar/);
  component.refresh();
  assert.equal(component.searchResults(), null);
  assert.equal(component.searchError(), '');
  requests.at(-1).observer.next({ generatedAt: '2026-11-11T13:00:00.000Z' });
  component.searchFrom = '2026-11-11T10:00';
  component.clearSearch();
  assert.equal(component.searchFrom, '');
  assert.equal(component.traceView(), null);
});

test('metrics validate range and query the correct service and resolution', () => {
  const { component, calls, requests } = setup();
  component.queryMetrics();
  assert.match(component.metricError(), /un minuto y siete días/);
  assert.equal(calls.filter((call) => call.name === 'metrics').length, 0);
  component.metricFrom = '2026-11-10T10:00';
  component.metricTo = '2026-11-11T10:00';
  component.metricInterval = '1m';
  component.metricService = 'websocket';
  component.queryMetrics();
  assert.deepEqual(calls.at(-1), { name: 'metrics', args: [{
    from: new Date('2026-11-10T10:00').toISOString(),
    to: new Date('2026-11-11T10:00').toISOString(),
    service: 'websocket', metric: 'websocket_activity', interval: '1m'
  }] });
  component.queryMetrics();
  assert.equal(calls.filter((call) => call.name === 'metrics').length, 1);
  const result = { service: 'websocket', metric: 'websocket_activity', points: [] };
  requests.at(-1).observer.next(result);
  assert.equal(component.metricResult(), result);
  component.metricService = 'backend';
  component.queryMetrics();
  assert.equal(calls.at(-1).args[0].metric, 'http_requests');
  assert.equal(component.metricResult(), null);
  requests.at(-1).observer.error(new Error('offline'));
  assert.match(component.metricError(), /No se pudieron consultar métricas/);
  assert.equal(component.metricLoading(), false);
});

test('services are requested on demand and failures do not appear as healthy data', () => {
  const { component, calls, requests } = setup();
  assert.equal(calls.some((call) => call.name === 'services'), false);
  component.queryServices();
  component.queryServices();
  assert.equal(calls.filter((call) => call.name === 'services').length, 1);
  const result = { services: { frontend: null, storage: null } };
  requests.at(-1).observer.next(result);
  assert.equal(component.servicesResult(), result);
  component.queryServices();
  assert.equal(component.servicesResult(), null);
  requests.at(-1).observer.error(new Error('offline'));
  assert.match(component.servicesError(), /No se pudieron consultar servicios/);
  assert.equal(component.servicesLoading(), false);
});
