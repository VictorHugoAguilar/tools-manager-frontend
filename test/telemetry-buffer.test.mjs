import test from 'node:test';
import assert from 'node:assert/strict';
import { TelemetryBuffer } from '../src/app/services/telemetry-buffer.ts';

function item(eventName, id) {
  return {
    event: { schemaVersion: 1, eventId: id, occurredAt: '2026-01-01T00:00:00.000Z', eventName },
    attempts: 0
  };
}

test('buffer is bounded and retains errors over lower-priority events', () => {
  const buffer = new TelemetryBuffer(2);
  assert.equal(buffer.add(item('frontend.route.changed', 'navigation')), true);
  assert.equal(buffer.add(item('frontend.runtime.error', 'error')), true);
  assert.equal(buffer.add(item('frontend.api.request.failed', 'request')), true);
  assert.equal(buffer.add(item('frontend.performance.measurement', 'performance')), false);
  assert.equal(buffer.size, 2);
  assert.equal(buffer.dropped, 2);
  assert.deepEqual(buffer.take(25).map(({ event }) => event.eventId), ['error', 'request']);
});

test('buffer extracts bounded batches and clears pending events on session change', () => {
  const buffer = new TelemetryBuffer(30);
  for (let i = 0; i < 30; i++) buffer.add(item('frontend.runtime.error', `${i}`));
  assert.equal(buffer.take(25).length, 25);
  assert.equal(buffer.size, 5);
  buffer.clear();
  assert.equal(buffer.size, 0);
});
