import { ErrorHandler, inject, Injectable, Injector } from '@angular/core';
import { environment } from '../../environments/environment';
import { TelemetryService } from './telemetry.service';

@Injectable()
export class TelemetryErrorHandler extends ErrorHandler {
  private readonly injector = inject(Injector);

  override handleError(error: unknown): void {
    super.handleError(error);
    if (!environment.telemetryEnabled) return;
    try {
      this.injector.get(TelemetryService).track('frontend.runtime.error');
    } catch (telemetryError) {
      console.error('No se pudo registrar el error de telemetría.', telemetryError);
    }
  }
}
