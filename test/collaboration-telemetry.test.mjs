import test from 'node:test';
import assert from 'node:assert/strict';
import { CollaborationTelemetry } from '../src/app/services/collaboration-telemetry.ts';
import { TelemetryBuffer } from '../src/app/services/telemetry-buffer.ts';

function setup() {
  let time = 1000;
  const events = [];
  const telemetry = new CollaborationTelemetry((name, details) => events.push([name, details.durationMs]), () => time);
  return { telemetry, events, advance: (ms) => { time += ms; } };
}

test('first synchronization is measured once from connection start', () => {
  const { telemetry, events, advance } = setup();
  advance(250);
  telemetry.firstSync();
  advance(100);
  telemetry.firstSync();
  assert.deepEqual(events, [['frontend.collaboration.sync.completed', 250]]);
});

test('only a recovered disconnection counts as a reconnection, with its offline duration', () => {
  const { telemetry, events, advance } = setup();
  telemetry.status('connecting');
  advance(50);
  telemetry.status('connected');
  assert.deepEqual(events, []);
  advance(500);
  telemetry.status('disconnected');
  advance(100);
  telemetry.status('connecting');
  advance(200);
  telemetry.status('connected');
  telemetry.status('connected');
  assert.deepEqual(events, [['frontend.collaboration.reconnected', 300]]);
});

test('a connection that never succeeded or never recovered emits no reconnection', () => {
  const { telemetry, events, advance } = setup();
  telemetry.status('disconnected');
  advance(100);
  telemetry.status('connecting');
  telemetry.status('connected');
  telemetry.status('disconnected');
  assert.deepEqual(events, []);
});

test('persist duration is emitted only when the returned callback runs', () => {
  const { telemetry, events, advance } = setup();
  const failed = telemetry.startPersist();
  advance(40);
  const completed = telemetry.startPersist();
  advance(60);
  completed();
  assert.deepEqual(events, [['frontend.collaboration.persist.completed', 60]]);
  void failed;
});

test('collaboration measurements are low priority and never evict errors', () => {
  const buffer = new TelemetryBuffer(1);
  const item = (eventName, eventId) => ({
    event: { schemaVersion: 1, eventId, occurredAt: '2026-01-01T00:00:00.000Z', eventName }, attempts: 0
  });
  buffer.add(item('frontend.runtime.error', 'error'));
  assert.equal(buffer.add(item('frontend.collaboration.reconnected', 'reconnected')), false);
  assert.deepEqual(buffer.take(5).map(({ event }) => event.eventId), ['error']);
});
