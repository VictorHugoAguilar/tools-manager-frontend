import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from '../../environments/environment';

export type MonitoringPeriod = '1h' | '24h' | '7d';

export interface MonitoringEvent {
  eventId: string;
  receivedAt: string;
  service: string;
  level: string;
  eventName: string;
  traceId?: string;
  connectionId?: string;
  durationMs?: number;
  http?: { method: string; route: string; statusCode: number };
}

export interface MonitoringEventFilters {
  from: string;
  to: string;
  service?: string;
  level?: string;
  eventName?: string;
  traceId?: string;
  cursor?: string;
}

export interface MonitoringEventsPage {
  events: MonitoringEvent[];
  nextCursor: string | null;
}

export interface MonitoringAuditStatus {
  checkedAt: string;
  pending: { count: number; truncated: boolean };
  publisher: {
    running: boolean;
    inFlight: boolean;
    consecutiveFailures: number;
    lastAttemptAt: string | null;
    lastSuccessfulCheckAt: string | null;
    lastFailureAt: string | null;
  };
}

export interface MonitoringResourceInstance {
  instanceId: string;
  heartbeatAt: string;
  process: { sampledAt: string; cpuPercent: number | null; rssBytes: number } | null;
  disk: { sampledAt: string; totalBytes: number; usedBytes: number; availableBytes: number } | null;
}

export interface MonitoringResources {
  backend: MonitoringResourceInstance[];
  websocket: MonitoringResourceInstance[];
}

export interface MonitoringOverview {
  period: MonitoringPeriod;
  generatedAt: string;
  activeUsers?: { count: number; windowMinutes: number; checkedAt: string } | null;
  events: MonitoringEvent[];
  heartbeats: {
    freshnessSeconds: number;
    resources?: MonitoringResources;
    services: {
      backend: { recentInstances: number; lastHeartbeatAt: string | null };
      websocket: {
        recentInstances: number;
        lastHeartbeatAt: string | null;
        activeConnections: number | null;
        metricHealth: {
          pending: number;
          activeIntervals: number;
          dropped: number;
          droppedSamples: number;
          failed: number;
          consecutiveFailures: number;
        } | null;
      };
    };
  };
  httpMetrics: {
    from: string;
    to: string;
    resolutionSeconds: number;
    count: number;
    errors: number;
    averageMs: number | null;
    p95Range: string | null;
    p99Range: string | null;
    points: { start: string; count: number; errors: number; averageMs: number }[];
  };
  webSocketMetrics: {
    from: string;
    to: string;
    resolutionSeconds: number;
    points: {
      start: string; opened: number; closed: number; updates: number;
      awareness?: number; rejected?: number; abnormalClosed?: number;
    }[];
  };
  collector: {
    queuePending: number;
    queueCapacity: number;
    droppedByLevel: Record<string, number>;
    sampledOutByLevel?: Record<string, number>;
    sampleRates?: Record<string, number>;
    failedEvents: number;
    lastSuccessfulFlushAt: string | null;
    lastFlushDurationMs: number | null;
    consecutiveWriteFailures: number;
    heartbeat: { consecutiveFailures: number; lastSuccess: string | null };
    httpMetrics: {
      pending: number;
      activeIntervals: number;
      dropped: number;
      droppedSamples: number;
      failed: number;
      consecutiveFailures: number;
    };
  };
}

export type MonitoringMetricInterval = '1m' | '1h';
export type MonitoringMetricRequest = {
  from: string;
  to: string;
  interval: MonitoringMetricInterval;
} & (
  | { service: 'backend'; metric: 'http_requests' | 'database_operations' }
  | { service: 'websocket'; metric: 'websocket_activity' }
);

export type MonitoringMetricResult =
  | ({ service: 'backend'; metric: 'http_requests' | 'database_operations' } & MonitoringOverview['httpMetrics'])
  | ({ service: 'websocket'; metric: 'websocket_activity' } & MonitoringOverview['webSocketMetrics']);

export interface MonitoringServices {
  generatedAt: string;
  freshnessSeconds: number;
  services: MonitoringOverview['heartbeats']['services'] & { frontend: null; storage: null };
  resources?: MonitoringResources;
}

@Injectable({ providedIn: 'root' })
export class MonitoringApiService {
  private readonly http = inject(HttpClient);

  overview(period: MonitoringPeriod) {
    return this.http.get<MonitoringOverview>(`${environment.apiUrl}/api/monitoring/overview`, {
      params: new HttpParams().set('period', period)
    });
  }

  events(filters: MonitoringEventFilters) {
    let params = new HttpParams();
    for (const [key, value] of Object.entries(filters)) {
      if (value) params = params.set(key, value);
    }
    return this.http.get<MonitoringEventsPage>(`${environment.apiUrl}/api/monitoring/events`, { params });
  }

  trace(traceId: string, filters: Pick<MonitoringEventFilters, 'from' | 'to' | 'cursor'>) {
    let params = new HttpParams().set('from', filters.from).set('to', filters.to);
    if (filters.cursor) params = params.set('cursor', filters.cursor);
    return this.http.get<MonitoringEventsPage>(
      `${environment.apiUrl}/api/monitoring/traces/${encodeURIComponent(traceId)}`, { params }
    );
  }

  metrics(filters: MonitoringMetricRequest) {
    const params = new HttpParams()
      .set('from', filters.from).set('to', filters.to)
      .set('service', filters.service).set('metric', filters.metric).set('interval', filters.interval);
    return this.http.get<MonitoringMetricResult>(`${environment.apiUrl}/api/monitoring/metrics`, { params });
  }

  services() {
    return this.http.get<MonitoringServices>(`${environment.apiUrl}/api/monitoring/services`);
  }

  auditStatus() {
    return this.http.get<MonitoringAuditStatus>(`${environment.apiUrl}/api/monitoring/audit-status`);
  }
}
