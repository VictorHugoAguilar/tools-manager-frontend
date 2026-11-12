import { ApplicationConfig, ErrorHandler, provideBrowserGlobalErrorListeners, provideZonelessChangeDetection } from '@angular/core';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { provideCharts, withDefaultRegisterables } from 'ng2-charts';
import { appRoutes } from './app.routes';
import { authInterceptor } from './interceptors/auth.interceptor';
import { telemetryInterceptor } from './interceptors/telemetry.interceptor';
import { TelemetryErrorHandler } from './services/telemetry-error-handler';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    provideAnimations(),
    provideHttpClient(withInterceptors([telemetryInterceptor, authInterceptor])),
    { provide: ErrorHandler, useClass: TelemetryErrorHandler },
    provideCharts(withDefaultRegisterables()),
    provideRouter(appRoutes)
  ]
};
