import type { FrontendTelemetryName } from './telemetry-buffer';

type Track = (eventName: FrontendTelemetryName, details: { durationMs: number }) => void;
type Observe = (type: string, callback: (entries: PerformanceEntry[]) => void) => (() => void) | null;

const LONG_TASK_MIN_MS = 200;
const MAX_LONG_TASKS = 10;

function defaultObserve(type: string, callback: (entries: PerformanceEntry[]) => void): (() => void) | null {
  if (typeof PerformanceObserver === 'undefined' || !PerformanceObserver.supportedEntryTypes?.includes(type)) return null;
  try {
    const observer = new PerformanceObserver((list) => callback(list.getEntries()));
    observer.observe({ type, buffered: true });
    return () => observer.disconnect();
  } catch {
    return null;
  }
}

/**
 * Emite solo duraciones del navegador (carga, primer pintado, LCP, tareas largas y
 * transiciones de ruta). No incluye URLs, nombres de recursos ni contenido.
 */
export class PerformanceTelemetry {
  private readonly track: Track;
  private readonly observe: Observe;
  private readonly now: () => number;
  private readonly stops: (() => void)[] = [];
  private largestPaint: number | null = null;
  private longTasks = 0;
  private navigationStartedAt: number | null = null;
  private started = false;

  constructor(track: Track, observe: Observe = defaultObserve, now: () => number = () => performance.now()) {
    this.track = track;
    this.observe = observe;
    this.now = now;
  }

  start(): void {
    if (this.started) return;
    this.started = true;
    this.add(this.observe('navigation', (entries) => {
      const entry = entries[0] as PerformanceNavigationTiming | undefined;
      if (entry && entry.loadEventEnd > 0) this.track('frontend.performance.page.loaded', { durationMs: entry.loadEventEnd });
    }));
    this.add(this.observe('paint', (entries) => {
      const paint = entries.find((entry) => entry.name === 'first-contentful-paint');
      if (paint) this.track('frontend.performance.first_contentful_paint', { durationMs: paint.startTime });
    }));
    this.add(this.observe('largest-contentful-paint', (entries) => {
      const last = entries.at(-1);
      if (last) this.largestPaint = last.startTime;
    }));
    this.add(this.observe('longtask', (entries) => {
      for (const entry of entries) {
        if (entry.duration < LONG_TASK_MIN_MS || this.longTasks >= MAX_LONG_TASKS) continue;
        this.longTasks += 1;
        this.track('frontend.performance.long_task', { durationMs: entry.duration });
      }
    }));
  }

  // El LCP solo es definitivo cuando la página se oculta o se descarga.
  pageHidden(): void {
    if (this.largestPaint === null) return;
    this.track('frontend.performance.largest_contentful_paint', { durationMs: this.largestPaint });
    this.largestPaint = null;
  }

  navigationStarted(): void {
    this.navigationStartedAt = this.now();
  }

  navigationFinished(): void {
    if (this.navigationStartedAt === null) return;
    this.track('frontend.performance.route_transition', { durationMs: this.now() - this.navigationStartedAt });
    this.navigationStartedAt = null;
  }

  navigationAborted(): void {
    this.navigationStartedAt = null;
  }

  stop(): void {
    for (const stop of this.stops.splice(0)) stop();
    this.started = false;
  }

  private add(stop: (() => void) | null): void {
    if (stop) this.stops.push(stop);
  }
}
