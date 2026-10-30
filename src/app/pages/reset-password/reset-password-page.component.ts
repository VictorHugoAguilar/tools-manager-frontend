import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AuthApiService } from '../../services/auth-api.service';

@Component({
  selector: 'app-reset-password-page',
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './reset-password-page.component.html',
  styleUrl: './reset-password-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ResetPasswordPageComponent {
  private readonly api = inject(AuthApiService);
  private readonly route = inject(ActivatedRoute);

  protected readonly token = new URLSearchParams(this.route.snapshot.fragment ?? '')
    .get('token') ?? this.route.snapshot.queryParamMap.get('token') ?? '';
  protected password = '';
  protected confirmPassword = '';
  protected readonly loading = signal(false);
  protected readonly error = signal(
    this.token ? '' : 'El enlace de recuperación no es válido o ha caducado.'
  );
  protected readonly success = signal('');

  protected async submit(): Promise<void> {
    this.error.set('');
    this.success.set('');
    if (!this.token) {
      this.error.set('El enlace de recuperación no es válido o ha caducado.');
      return;
    }
    if (this.password !== this.confirmPassword) {
      this.error.set('Las contraseñas no coinciden.');
      return;
    }
    if (this.password.length < 10 || !/[A-Za-z]/.test(this.password) || !/\d/.test(this.password)) {
      this.error.set('Usa al menos 10 caracteres e incluye letras y números.');
      return;
    }
    if (this.loading()) return;

    this.loading.set(true);
    try {
      const result = await firstValueFrom(this.api.completePasswordReset(this.token, this.password));
      this.success.set(result.message);
      this.password = '';
      this.confirmPassword = '';
    } catch (error: unknown) {
      this.error.set(this.errorMessage(error));
    } finally {
      this.loading.set(false);
    }
  }

  private errorMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse && typeof error.error?.message === 'string') {
      return error.error.message;
    }
    return 'No se pudo restablecer la contraseña. Comprueba el enlace e inténtalo de nuevo.';
  }
}
