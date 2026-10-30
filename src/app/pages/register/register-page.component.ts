import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, OnDestroy, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AuthApiService } from '../../services/auth-api.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-register-page',
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './register-page.component.html',
  styleUrl: './register-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RegisterPageComponent implements OnDestroy {
  private readonly auth = inject(AuthService);
  private readonly authApi = inject(AuthApiService);
  private readonly router = inject(Router);

  protected firstName = '';
  protected lastName = '';
  protected email = '';
  protected password = '';
  protected confirmPassword = '';
  protected readonly showPassword = signal(false);
  protected readonly loading = signal(false);
  protected readonly error = signal('');
  protected readonly imageFile = signal<File | null>(null);
  protected readonly previewUrl = signal<string | null>(null);

  ngOnDestroy(): void {
    this.clearPreview();
  }

  protected onImageSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    this.clearPreview();
    this.imageFile.set(file);
    this.previewUrl.set(file ? URL.createObjectURL(file) : null);
    input.value = '';
  }

  protected async submit(formValid: boolean | null): Promise<void> {
    this.error.set('');
    if (!formValid) return;
    if (this.password !== this.confirmPassword) {
      this.error.set('Las contraseñas no coinciden.');
      return;
    }
    if (!/[A-Za-z]/.test(this.password) || !/\d/.test(this.password)) {
      this.error.set('La contraseña debe incluir letras y números.');
      return;
    }

    this.loading.set(true);
    try {
      await this.auth.register({
        firstName: this.firstName,
        lastName: this.lastName,
        email: this.email,
        password: this.password
      });

      const image = this.imageFile();
      if (image) {
        try {
          const { user } = await firstValueFrom(this.authApi.uploadMyAvatar(image));
          this.auth.setUser(user);
        } catch {
          await this.router.navigate(['/mi-perfil'], {
            state: { avatarUploadError: 'La cuenta se creó, pero no se pudo guardar la foto. Puedes intentarlo de nuevo en Mi perfil.' }
          });
          return;
        }
      }
      await this.router.navigateByUrl('/tablero');
    } catch (error: unknown) {
      this.error.set(this.errorMessage(error));
    } finally {
      this.loading.set(false);
    }
  }

  private clearPreview(): void {
    const url = this.previewUrl();
    if (url) URL.revokeObjectURL(url);
    this.previewUrl.set(null);
  }

  private errorMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse && typeof error.error?.message === 'string') {
      return error.error.message;
    }
    return 'No se pudo crear la cuenta. Comprueba la conexión e inténtalo de nuevo.';
  }
}
