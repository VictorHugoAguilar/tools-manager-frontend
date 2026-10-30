import { HttpErrorResponse, HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, switchMap, tap, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { CsrfTokenService } from '../services/csrf-token.service';

export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const router = inject(Router);
  const auth = inject(AuthService);
  const csrf = inject(CsrfTokenService);
  const changesServerState = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method);
  const publicAuthEndpoint = [
    '/api/auth/login',
    '/api/auth/register',
    '/api/auth/password-reset',
    '/api/auth/password-reset/complete'
  ].some((endpoint) => request.url.includes(endpoint));
  const needsCsrf = changesServerState && !publicAuthEndpoint;
  const authenticatedRequest = request.clone({ withCredentials: true });
  const response$ = needsCsrf
    ? csrf.getToken().pipe(
      switchMap((token) => next(authenticatedRequest.clone({
        headers: authenticatedRequest.headers.set('X-CSRF-Token', token)
      })))
    )
    : next(authenticatedRequest);

  return response$.pipe(
    tap((event) => {
      const sessionChangingEndpoint = [
        '/api/auth/login',
        '/api/auth/register',
        '/api/auth/logout',
        '/api/users/me/password'
      ].some((endpoint) => request.url.includes(endpoint));
      if (event instanceof HttpResponse && sessionChangingEndpoint) csrf.clear();
    }),
    catchError((error: unknown) => {
      if (error instanceof HttpErrorResponse && error.status === 401 && !request.url.includes('/api/auth/me')) {
        auth.setUser(null);
        void router.navigate(['/login'], { queryParams: { returnUrl: router.url } });
      }
      return throwError(() => error);
    })
  );
};
