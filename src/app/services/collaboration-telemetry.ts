import type { FrontendTelemetryName } from './telemetry-buffer';

type Track = (eventName: FrontendTelemetryName, details: { durationMs: number }) => void;

/**
 * Mide desde el navegador lo que el servidor no puede observar: tiempo hasta la primera
 * sincronización, duración de las desconexiones recuperadas y tiempo de confirmación de guardado.
 * No emite nada con identificadores de documento, página, sala ni contenido.
 */
export class CollaborationTelemetry {
  private readonly track: Track;
  private readonly now: () => number;
  private readonly startedAt: number;
  private synced = false;
  private everConnected = false;
  private offlineSince: number | null = null;

  constructor(track: Track, now: () => number = () => performance.now()) {
    this.track = track;
    this.now = now;
    this.startedAt = now();
  }

  status(status: string): void {
    if (status === 'connected') {
      if (this.everConnected && this.offlineSince !== null) {
        this.track('frontend.collaboration.reconnected', { durationMs: this.now() - this.offlineSince });
      }
      this.everConnected = true;
      this.offlineSince = null;
    } else if (this.everConnected && this.offlineSince === null) {
      this.offlineSince = this.now();
    }
  }

  firstSync(): void {
    if (this.synced) return;
    this.synced = true;
    this.track('frontend.collaboration.sync.completed', { durationMs: this.now() - this.startedAt });
  }

  startPersist(): () => void {
    const startedAt = this.now();
    return () => this.track('frontend.collaboration.persist.completed', { durationMs: this.now() - startedAt });
  }
}
