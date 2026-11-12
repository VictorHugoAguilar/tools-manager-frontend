export type FrontendTelemetryName = 'frontend.runtime.error' | 'frontend.api.request.failed' |
  'frontend.route.changed' | 'frontend.performance.measurement' | 'frontend.tools.search.completed' |
  'frontend.collaboration.sync.completed' | 'frontend.collaboration.reconnected' |
  'frontend.collaboration.persist.completed';

const LOW_PRIORITY = new Set<FrontendTelemetryName>([
  'frontend.route.changed', 'frontend.performance.measurement', 'frontend.tools.search.completed',
  'frontend.collaboration.sync.completed', 'frontend.collaboration.reconnected',
  'frontend.collaboration.persist.completed'
]);

export interface FrontendTelemetryEvent {
  schemaVersion: 1;
  eventId: string;
  occurredAt: string;
  eventName: FrontendTelemetryName;
  traceId?: string;
  durationMs?: number;
}

export interface BufferedTelemetry {
  event: FrontendTelemetryEvent;
  attempts: number;
}

export class TelemetryBuffer {
  private readonly items: BufferedTelemetry[] = [];
  private readonly capacity: number;
  dropped = 0;

  constructor(capacity: number) {
    this.capacity = capacity;
  }

  get size(): number {
    return this.items.length;
  }

  add(item: BufferedTelemetry): boolean {
    if (this.items.length >= this.capacity) {
      const lowPriority = this.items.findIndex(({ event }) => LOW_PRIORITY.has(event.eventName));
      if (lowPriority < 0 || LOW_PRIORITY.has(item.event.eventName)) {
        this.dropped++;
        return false;
      }
      this.items.splice(lowPriority, 1);
      this.dropped++;
    }
    this.items.push(item);
    return true;
  }

  take(limit: number): BufferedTelemetry[] {
    return this.items.splice(0, limit);
  }

  clear(): void {
    this.items.length = 0;
  }
}
