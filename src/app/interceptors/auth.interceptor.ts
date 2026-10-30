import { DOCUMENT } from '@angular/common';
import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';

function csrfToken(document: Document): string {
  const value = document.cookie.split(';')
    .map((cookie) => cookie.trim())
    .find((cookie) => cookie.startsWith('tm_csrf='))
    ?.slice('tm_csrf='.length);
  if (!value) return '';
  try {
    return decodeURIComponent(value);
  } catch {
    return '';
  }
}

export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const document = inject(DOCUMENT);
  const router = inject(Router);
  const auth = inject(AuthService);
  const token = csrfToken(document);
  const headers = token ? request.headers.set('X-CSRF-Token', token) : request.headers;
  const authenticatedRequest = request.clone({ withCredentials: true, headers });

  return next(authenticatedRequest).pipe(
    catchError((error: unknown) => {
      const publicAuthEndpoint = [
        '/api/auth/login',
        '/api/auth/register',
        '/api/auth/me'
      ].some((endpoint) => request.url.includes(endpoint));
      if (error instanceof HttpErrorResponse && error.status === 401 && !publicAuthEndpoint) {
        auth.setUser(null);
        void router.navigate(['/login'], { queryParams: { returnUrl: router.url } });
      }
      return throwError(() => error);
    })
  );
};
