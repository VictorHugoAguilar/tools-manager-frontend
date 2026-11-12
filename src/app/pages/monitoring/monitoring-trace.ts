import type { MonitoringEvent } from '../../services/monitoring-api.service';
import { describeEvent } from './monitoring-event-catalog';

export type TraceVerdict = 'failed' | 'warning' | 'ok';

export interface TraceStep {
  event: MonitoringEvent;
  offsetMs: number;
  barPercent: number | null;
  actor: string;
  summary: string;
  isCause: boolean;
}

export interface TraceView {
  verdict: TraceVerdict;
  verdictLabel: string;
  request: string | null;
  actorId: string | null;
  page: string | null;
  startedAt: string;
  spanMs: number;
  services: string[];
  steps: TraceStep[];
  sequence: string[];
  complete: boolean;
  notices: string[];
}

export interface TraceOptions {
  truncated?: boolean;
  limit?: number;
  now?: number;
}

const RECENT_MS = 30_000;

const ACTORS: Record<string, string> = { frontend: 'Navegador', backend: 'Backend', websocket: 'WebSocket' };

function describe(event: MonitoringEvent): string {
  const text = describeEvent(event.eventName);
  return event.http ? `${text}: ${event.http.method} ${event.http.route} → ${event.http.statusCode}` : text;
}

export function buildTraceView(events: MonitoringEvent[], options: TraceOptions = {}): TraceView | null {
  if (!events.length) return null;
  const sorted = [...events].sort((a, b) => a.receivedAt.localeCompare(b.receivedAt) || a.eventId.localeCompare(b.eventId));
  const origin = Date.parse(sorted[0].receivedAt);
  const spanMs = Math.max(0, Date.parse(sorted.at(-1)!.receivedAt) - origin);
  const longest = Math.max(0, ...sorted.map((event) => event.durationMs ?? 0));
  const firstError = sorted.find((event) => event.level === 'ERROR');
  const verdict: TraceVerdict = firstError ? 'failed' : sorted.some((event) => event.level === 'WARN') ? 'warning' : 'ok';
  const withHttp = firstError?.http ? firstError : sorted.find((event) => event.http);
  const withPage = sorted.find((event) => event.page);
  const withActor = sorted.find((event) => event.actorId);
  const steps = sorted.map((event): TraceStep => ({
    event,
    offsetMs: Math.max(0, Date.parse(event.receivedAt) - origin),
    barPercent: longest > 0 && event.durationMs !== undefined ? Math.max(2, event.durationMs / longest * 100) : null,
    actor: ACTORS[event.service] ?? event.service,
    summary: describe(event),
    isCause: event === firstError
  }));
  return {
    verdict,
    verdictLabel: verdict === 'failed' ? 'Falló' : verdict === 'warning' ? 'Con avisos' : 'Correcta',
    request: withHttp?.http ? `${withHttp.http.method} ${withHttp.http.route} → ${withHttp.http.statusCode}` : null,
    actorId: withActor?.actorId ?? null,
    page: withPage?.page ?? null,
    startedAt: sorted[0].receivedAt,
    spanMs,
    services: [...new Set(sorted.map((event) => ACTORS[event.service] ?? event.service))],
    steps,
    sequence: buildSequence(sorted),
    ...completeness(sorted, options)
  };
}

// Une el fallo del navegador con el 5xx del backend porque comparten traceId (cabecera X-Trace-Id).
function buildSequence(sorted: MonitoringEvent[]): string[] {
  const front = sorted.find((event) => event.eventName === 'frontend.api.request.failed');
  const backend = sorted.find((event) => event.service === 'backend' && event.level === 'ERROR');
  const sequence: string[] = [];
  if (front?.page) sequence.push(`Navegador: el usuario estaba en ${front.page}`);
  const call = front?.http ?? backend?.http;
  if (call) sequence.push(`Navegador: llamó a ${call.method} ${call.route}`);
  if (backend) {
    sequence.push(`Backend: ${backend.http ? `respondió ${backend.http.statusCode}` : 'registró un error'} (${backend.eventName})`);
  } else if (front) {
    sequence.push('Backend: no hay evento de error asociado (la petición pudo no llegar, ser un 4xx o perderse la telemetría)');
  }
  if (front) sequence.push(`Navegador: la petición falló${front.http?.statusCode ? ` con ${front.http.statusCode}` : ' sin respuesta del servidor'}`);
  return sequence.length > 1 ? sequence : [];
}

function completeness(sorted: MonitoringEvent[], options: TraceOptions): { complete: boolean; notices: string[] } {
  const notices: string[] = [];
  const now = options.now ?? Date.now();
  if (options.truncated) {
    notices.push(`Traza incompleta: se muestran solo ${options.limit ?? sorted.length} eventos. El veredicto, la causa y los tiempos pueden cambiar con el resto.`);
  } else {
    const front = sorted.some((event) => event.eventName === 'frontend.api.request.failed');
    const backendError = sorted.some((event) => event.service === 'backend' && event.level === 'ERROR');
    if (front && !backendError) {
      notices.push('No hay ningún error del backend con esta traza: la petición pudo no llegar al servidor, acabar con un 4xx (no se registra como fallo) o perderse el evento.');
    }
    if (backendError && !front) {
      notices.push('No hay evento del navegador: la llamada pudo venir de otro cliente o el navegador no llegó a enviar su telemetría (pestaña cerrada, bloqueo de red).');
    }
  }
  if (now - Date.parse(sorted.at(-1)!.receivedAt) < RECENT_MS) {
    notices.push('Traza muy reciente: el navegador envía su telemetría por lotes, pueden llegar más eventos en unos segundos. Vuelve a abrirla para actualizarla.');
  }
  return { complete: notices.length === 0, notices };
}
