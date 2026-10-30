import { HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AuthUser, UserProfilePayload } from '../models/auth.model';
import { AuthApiService } from './auth-api.service';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly api = inject(AuthApiService);
  private initialization: Promise<AuthUser | null> | null = null;

  readonly user = signal<AuthUser | null>(null);

  initialize(): Promise<AuthUser | null> {
    if (!this.initialization) {
      this.initialization = firstValueFrom(this.api.currentUser())
        .then(({ user }) => {
          this.user.set(user);
          return user;
        })
        .catch((error: unknown) => {
          if (error instanceof HttpErrorResponse && error.status === 401) {
            this.user.set(null);
            return null;
          }
          this.initialization = null;
          throw error;
        });
    }
    return this.initialization;
  }

  async refreshCurrentUser(): Promise<AuthUser | null> {
    try {
      const { user } = await firstValueFrom(this.api.currentUser());
      this.setUser(user);
      return user;
    } catch (error: unknown) {
      if (error instanceof HttpErrorResponse && error.status === 401) {
        this.setUser(null);
        return null;
      }
      throw error;
    }
  }

  async login(email: string, password: string): Promise<AuthUser> {
    const { user } = await firstValueFrom(this.api.login(email, password));
    this.setUser(user);
    return user;
  }

  async register(payload: UserProfilePayload & { email: string; password: string }, image?: File): Promise<AuthUser> {
    const { user } = await firstValueFrom(this.api.register(payload, image));
    this.setUser(user);
    return user;
  }

  async logout(): Promise<void> {
    await firstValueFrom(this.api.logout());
    this.setUser(null);
  }

  setUser(user: AuthUser | null): void {
    this.user.set(user);
    this.initialization = Promise.resolve(user);
  }
}
