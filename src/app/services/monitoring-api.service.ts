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

export interface MonitoringOverview {
  period: MonitoringPeriod;
  generatedAt: string;
  events: MonitoringEvent[];
  heartbeats: {
    freshnessSeconds: number;
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
    points: { start: string; opened: number; closed: number; updates: number }[];
  };
  collector: {
    queuePending: number;
    queueCapacity: number;
    droppedByLevel: Record<string, number>;
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

  auditStatus() {
    return this.http.get<MonitoringAuditStatus>(`${environment.apiUrl}/api/monitoring/audit-status`);
  }
}
