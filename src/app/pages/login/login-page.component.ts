import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { AuthApiService } from '../../services/auth-api.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login-page',
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './login-page.component.html',
  styleUrl: './login-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LoginPageComponent {
  private readonly auth = inject(AuthService);
  private readonly api = inject(AuthApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected email = '';
  protected password = '';
  protected readonly passwordResetMode = signal(false);
  protected readonly showPassword = signal(false);
  protected readonly loading = signal(false);
  protected readonly resetLoading = signal(false);
  protected readonly error = signal('');
  protected readonly resetError = signal('');
  protected readonly resetMessage = signal('');

  constructor() {
    if (this.route.snapshot.queryParamMap.get('sessionCheck') === 'failed') {
      this.error.set('No se pudo comprobar la sesión. Verifica la conexión y vuelve a intentarlo.');
    }
  }

  protected async submit(): Promise<void> {
    if (this.loading()) return;
    this.error.set('');
    this.loading.set(true);
    try {
      await this.auth.login(this.email, this.password);
      const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
      const target = returnUrl?.startsWith('/') && !returnUrl.startsWith('//') ? returnUrl : '/tablero';
      await this.router.navigateByUrl(target);
    } catch (error: unknown) {
      this.error.set(this.errorMessage(error));
    } finally {
      this.loading.set(false);
    }
  }

  protected openPasswordReset(): void {
    this.passwordResetMode.set(true);
    this.error.set('');
    this.resetError.set('');
    this.resetMessage.set('');
  }

  protected closePasswordReset(): void {
    this.passwordResetMode.set(false);
    this.resetError.set('');
    this.resetMessage.set('');
  }

  protected async requestPasswordReset(): Promise<void> {
    if (this.resetLoading()) return;
    this.resetError.set('');
    this.resetMessage.set('');
    this.resetLoading.set(true);
    try {
      const result = await firstValueFrom(this.api.requestPasswordReset(this.email));
      this.resetMessage.set(result.message);
    } catch (error: unknown) {
      this.resetError.set(this.errorMessage(error));
    } finally {
      this.resetLoading.set(false);
    }
  }

  private errorMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse && typeof error.error?.message === 'string') {
      return error.error.message;
    }
    return 'No se pudo completar la operación. Comprueba tu conexión e inténtalo de nuevo.';
  }
}
