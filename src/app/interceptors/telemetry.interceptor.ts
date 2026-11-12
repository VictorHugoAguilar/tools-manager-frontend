import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { environment } from '../../environments/environment';
import { TelemetryService } from '../services/telemetry.service';

export const telemetryInterceptor: HttpInterceptorFn = (request, next) => {
  if (!environment.telemetryEnabled) return next(request);
  const url = new URL(request.url, window.location.origin);
  const api = new URL(environment.apiUrl, window.location.origin);
  if (url.origin !== api.origin || !url.pathname.startsWith('/api/') ||
      url.pathname.startsWith('/api/telemetry/') || typeof crypto.randomUUID !== 'function') {
    return next(request);
  }
  const telemetry = inject(TelemetryService);
  const traceId = crypto.randomUUID();
  const start = performance.now();
  return next(request.clone({ setHeaders: { 'X-Trace-Id': traceId } })).pipe(
    catchError((error: unknown) => {
      try {
        telemetry.track('frontend.api.request.failed', { traceId, durationMs: performance.now() - start });
      } catch (telemetryError) {
        console.error('No se pudo registrar la telemetría de la petición.', telemetryError);
      }
      return throwError(() => error);
    })
  );
};
