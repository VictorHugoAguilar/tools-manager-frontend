import { HttpClient, HttpBackend } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, finalize, map, of, shareReplay, tap } from 'rxjs';
import { environment } from '../../environments/environment';

interface CsrfTokenResponse {
  csrfToken: string;
}

@Injectable({ providedIn: 'root' })
export class CsrfTokenService {
  private readonly http = new HttpClient(inject(HttpBackend));
  private readonly endpoint = `${environment.apiUrl}/api/auth/csrf`;
  private token: string | null = null;
  private pendingRequest: Observable<string> | null = null;

  getToken(): Observable<string> {
    if (this.token) return of(this.token);
    if (this.pendingRequest) return this.pendingRequest;

    this.pendingRequest = this.http.get<CsrfTokenResponse>(this.endpoint, { withCredentials: true }).pipe(
      map(({ csrfToken }) => {
        if (typeof csrfToken !== 'string' || csrfToken.length < 32) {
          throw new Error('La API no devolvió un token CSRF válido.');
        }
        return csrfToken;
      }),
      tap((token) => this.token = token),
      finalize(() => this.pendingRequest = null),
      shareReplay({ bufferSize: 1, refCount: false })
    );
    return this.pendingRequest;
  }

  clear(): void {
    this.token = null;
  }
}
