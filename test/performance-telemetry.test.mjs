import test from 'node:test';
import assert from 'node:assert/strict';
import { PerformanceTelemetry } from '../src/app/services/performance-telemetry.ts';
import { TelemetryBuffer } from '../src/app/services/telemetry-buffer.ts';

function setup(supported = ['navigation', 'paint', 'largest-contentful-paint', 'longtask']) {
  let time = 1000;
  const events = [];
  const callbacks = {};
  const stopped = [];
  const observe = (type, callback) => {
    if (!supported.includes(type)) return null;
    callbacks[type] = callback;
    return () => stopped.push(type);
  };
  const telemetry = new PerformanceTelemetry((name, details) => events.push([name, details.durationMs]), observe, () => time);
  return { telemetry, events, callbacks, stopped, advance: (ms) => { time += ms; } };
}

test('page load and first contentful paint are emitted from browser entries', () => {
  const { telemetry, events, callbacks } = setup();
  telemetry.start();
  telemetry.start();
  callbacks.navigation([{ loadEventEnd: 0 }]);
  callbacks.navigation([{ loadEventEnd: 1800 }]);
  callbacks.paint([{ name: 'first-paint', startTime: 300 }, { name: 'first-contentful-paint', startTime: 420 }]);
  assert.deepEqual(events, [
    ['frontend.performance.page.loaded', 1800],
    ['frontend.performance.first_contentful_paint', 420]
  ]);
});

test('LCP is reported once, with the latest candidate, only when the page is hidden', () => {
  const { telemetry, events, callbacks } = setup();
  telemetry.start();
  telemetry.pageHidden();
  callbacks['largest-contentful-paint']([{ startTime: 900 }, { startTime: 1500 }]);
  assert.deepEqual(events, []);
  telemetry.pageHidden();
  telemetry.pageHidden();
  assert.deepEqual(events, [['frontend.performance.largest_contentful_paint', 1500]]);
});

test('only long tasks of 200 ms or more are emitted, up to ten per session', () => {
  const { telemetry, events, callbacks } = setup();
  telemetry.start();
  callbacks.longtask([{ duration: 120 }]);
  callbacks.longtask(Array.from({ length: 15 }, () => ({ duration: 250 })));
  assert.equal(events.length, 10);
  assert.ok(events.every(([name, duration]) => name === 'frontend.performance.long_task' && duration === 250));
});

test('route transitions are measured only when navigation completes', () => {
  const { telemetry, events, advance } = setup();
  telemetry.navigationFinished();
  telemetry.navigationStarted();
  advance(180);
  telemetry.navigationFinished();
  telemetry.navigationStarted();
  advance(50);
  telemetry.navigationAborted();
  telemetry.navigationFinished();
  assert.deepEqual(events, [['frontend.performance.route_transition', 180]]);
});

test('unsupported entry types are skipped and stop disconnects observers', () => {
  const { telemetry, events, stopped } = setup(['paint']);
  telemetry.start();
  telemetry.stop();
  assert.deepEqual(events, []);
  assert.deepEqual(stopped, ['paint']);
});

test('performance measurements are low priority and never evict errors', () => {
  const buffer = new TelemetryBuffer(1);
  buffer.add({ event: { schemaVersion: 1, eventId: 'a', occurredAt: 'x', eventName: 'frontend.runtime.error' }, attempts: 0 });
  assert.equal(buffer.add({ event: { schemaVersion: 1, eventId: 'b', occurredAt: 'x', eventName: 'frontend.performance.long_task', durationMs: 300 }, attempts: 0 }), false);
  assert.equal(buffer.size, 1);
});
