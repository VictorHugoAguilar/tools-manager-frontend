import { DestroyRef, inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';
import { CsrfTokenService } from './csrf-token.service';

const SEND_INTERVAL_MS = 15000;

@Injectable({ providedIn: 'root' })
export class ActiveUserService {
  private readonly auth = inject(AuthService);
  private readonly csrf = inject(CsrfTokenService);
  private readonly destroyRef = inject(DestroyRef);
  private pendingActor: string | null = null;
  private lastSentAt = -Infinity;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private inFlight = false;
  private failures = 0;
  private destroyed = false;

  constructor() {
    if (!environment.telemetryEnabled) return;
    const onInteraction = (event: Event) => {
      if (!event.isTrusted || document.visibilityState !== 'visible') return;
      const actor = this.auth.user()?.id;
      if (!actor) return;
      this.pendingActor = actor;
      this.schedule();
    };
    for (const name of ['pointerdown', 'keydown', 'wheel']) {
      document.addEventListener(name, onInteraction, { passive: true });
    }
    this.destroyRef.onDestroy(() => {
      this.destroyed = true;
      if (this.timer !== null) clearTimeout(this.timer);
      for (const name of ['pointerdown', 'keydown', 'wheel']) {
        document.removeEventListener(name, onInteraction);
      }
    });
  }

  private schedule(): void {
    if (this.destroyed || this.inFlight || this.timer !== null || !this.pendingActor) return;
    const delay = Math.max(0, SEND_INTERVAL_MS - (performance.now() - this.lastSentAt));
    if (delay === 0) {
      void this.send();
    } else {
      this.timer = setTimeout(() => {
        this.timer = null;
        void this.send();
      }, delay);
    }
  }

  private async send(): Promise<void> {
    const actor = this.pendingActor;
    this.pendingActor = null;
    if (!actor || this.auth.user()?.id !== actor || this.destroyed) return;
    this.inFlight = true;
    this.lastSentAt = performance.now();
    try {
      const token = await firstValueFrom(this.csrf.getToken());
      if (this.destroyed || this.auth.user()?.id !== actor) return;
      if (!token) throw new Error('No hay token CSRF para registrar la interacción.');
      const response = await fetch(`${environment.apiUrl}/api/telemetry/interaction`, {
        method: 'POST', credentials: 'include', headers: { 'X-CSRF-Token': token },
        signal: AbortSignal.timeout(10000)
      });
      if (response.status !== 204) throw new Error(`HTTP ${response.status}`);
      this.failures = 0;
    } catch (error) {
      this.failures++;
      if (this.failures === 1 || this.failures % 60 === 0) {
        console.error('No se pudo registrar la interacción para usuarios activos.', error);
      }
    } finally {
      this.inFlight = false;
      this.schedule();
    }
  }
}
