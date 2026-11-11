import { DestroyRef, effect, inject, Injectable } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { filter, firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';
import { CsrfTokenService } from './csrf-token.service';
import { BufferedTelemetry, FrontendTelemetryName, TelemetryBuffer } from './telemetry-buffer';

@Injectable({ providedIn: 'root' })
export class TelemetryService {
  private readonly auth = inject(AuthService);
  private readonly csrf = inject(CsrfTokenService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly buffer = new TelemetryBuffer(200);
  private readonly endpoint = `${environment.apiUrl}/api/telemetry/events`;
  private actorId: string | null = null;
  private generation = 0;
  private inFlight = false;
  private retryAt = 0;
  private failures = 0;
  private rejected = 0;

  constructor() {
    if (!environment.telemetryEnabled) return;
    effect(() => this.syncActor(this.auth.user()?.id ?? null));
    this.router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(() => this.track('frontend.route.changed'));
    const timer = window.setInterval(() => void this.flush(), 5000);
    const onPageHide = () => void this.flush(true);
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') void this.flush(true);
    };
    window.addEventListener('pagehide', onPageHide);
    document.addEventListener('visibilitychange', onVisibilityChange);
    this.destroyRef.onDestroy(() => {
      window.clearInterval(timer);
      window.removeEventListener('pagehide', onPageHide);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    });
  }

  track(eventName: FrontendTelemetryName, details: { traceId?: string; durationMs?: number } = {}): void {
    if (!environment.telemetryEnabled) return;
    this.syncActor(this.auth.user()?.id ?? null);
    if (!this.actorId) return;
    if (typeof crypto.randomUUID !== 'function') {
      console.error('La telemetría requiere un contexto seguro para generar identificadores.');
      return;
    }
    const accepted = this.buffer.add({
      event: {
        schemaVersion: 1,
        eventId: crypto.randomUUID(),
        occurredAt: new Date().toISOString(),
        eventName,
        ...(details.traceId ? { traceId: details.traceId } : {}),
        ...(details.durationMs !== undefined ? { durationMs: Math.min(86400000, Math.max(0, details.durationMs)) } : {})
      },
      attempts: 0
    });
    if (accepted && this.buffer.size >= 25) void this.flush();
  }

  getStats(): { pending: number; dropped: number; rejected: number; failures: number } {
    return { pending: this.buffer.size, dropped: this.buffer.dropped, rejected: this.rejected, failures: this.failures };
  }

  private syncActor(id: string | null): void {
    if (id === this.actorId) return;
    this.actorId = id;
    this.generation++;
    this.buffer.clear();
    this.retryAt = 0;
  }

  async flush(final = false): Promise<void> {
    if (!environment.telemetryEnabled || this.inFlight) return;
    this.syncActor(this.auth.user()?.id ?? null);
    if (!this.actorId || !this.buffer.size || (!final && Date.now() < this.retryAt)) return;
    const generation = this.generation;
    this.inFlight = true;
    let batch: BufferedTelemetry[] = [];
    try {
      const cachedToken = final ? this.csrf.cachedToken() : null;
      if (final && !cachedToken) return;
      batch = this.buffer.take(25);
      const token = cachedToken ?? await firstValueFrom(this.csrf.getToken());
      this.syncActor(this.auth.user()?.id ?? null);
      if (!token || generation !== this.generation) return;
      if (!batch.length) return;
      const response = await fetch(this.endpoint, {
        method: 'POST',
        credentials: 'include',
        keepalive: final,
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token },
        body: JSON.stringify({ schemaVersion: 1, events: batch.map(({ event }) => event) })
      });
      if (response.status !== 202) throw new Error(`HTTP ${response.status}`);
      const result: unknown = await response.json();
      if (!result || typeof result !== 'object' ||
          !('accepted' in result) || !('rejected' in result) ||
          !Number.isInteger(result.accepted) || !Number.isInteger(result.rejected) ||
          typeof result.accepted !== 'number' || typeof result.rejected !== 'number' ||
          result.accepted < 0 || result.rejected < 0 || result.accepted + result.rejected !== batch.length) {
        throw new Error('Respuesta de ingesta no válida');
      }
      this.rejected += result.rejected;
      this.failures = 0;
      this.retryAt = 0;
    } catch {
      this.failures++;
      this.retryAt = Date.now() + Math.min(60000, 1000 * 2 ** Math.min(this.failures - 1, 6));
      this.syncActor(this.auth.user()?.id ?? null);
      if (generation === this.generation) {
        for (const item of batch) {
          if (++item.attempts < 3) this.buffer.add(item);
          else this.rejected++;
        }
      }
      if (this.failures === 1 || this.failures % 60 === 0) {
        console.error('No se pudo enviar la telemetría del navegador.');
      }
    } finally {
      this.inFlight = false;
    }
  }
}
