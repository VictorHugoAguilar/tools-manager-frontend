import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, OnDestroy, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { AuthApiService } from '../../services/auth-api.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-profile-page',
  imports: [CommonModule, FormsModule],
  templateUrl: './profile-page.component.html',
  styleUrl: './profile-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProfilePageComponent implements OnDestroy {
  private readonly auth = inject(AuthService);
  private readonly api = inject(AuthApiService);

  protected readonly user = this.auth.user;
  protected firstName = this.user()?.firstName ?? '';
  protected lastName = this.user()?.lastName ?? '';
  protected currentPassword = '';
  protected newPassword = '';
  protected confirmPassword = '';
  protected readonly saving = signal(false);
  protected readonly changingPassword = signal(false);
  protected readonly error = signal('');
  protected readonly success = signal('');
  protected readonly passwordError = signal('');
  protected readonly passwordSuccess = signal('');
  protected readonly imageFile = signal<File | null>(null);
  protected readonly previewUrl = signal<string | null>(null);
  protected readonly avatarUploadNotice = signal(
    typeof history !== 'undefined' && typeof history.state?.avatarUploadError === 'string'
      ? history.state.avatarUploadError as string
      : ''
  );

  ngOnDestroy(): void {
    this.clearPreview();
  }

  protected avatarSource(): string {
    return this.previewUrl() || this.user()?.profileImage || '';
  }

  protected initials(): string {
    return `${this.user()?.firstName.charAt(0) || ''}${this.user()?.lastName.charAt(0) || ''}` || 'U';
  }

  protected onImageSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    this.clearPreview();
    this.imageFile.set(file);
    this.previewUrl.set(file ? URL.createObjectURL(file) : null);
    input.value = '';
    this.error.set('');
  }

  protected async saveProfile(): Promise<void> {
    if (this.saving()) return;
    this.error.set('');
    this.success.set('');
    this.saving.set(true);
    try {
      const current = this.user();
      if (!current) throw new Error('No hay una sesión activa.');

      if (this.firstName.trim() !== current.firstName || this.lastName.trim() !== current.lastName) {
        const { user } = await firstValueFrom(this.api.updateProfile({
          firstName: this.firstName.trim(),
          lastName: this.lastName.trim()
        }));
        this.auth.setUser(user);
      }

      const image = this.imageFile();
      if (image) {
        const { user } = await firstValueFrom(this.api.uploadMyAvatar(image));
        this.auth.setUser(user);
        this.imageFile.set(null);
        this.clearPreview();
      }
      this.success.set('Los datos del perfil se han guardado.');
    } catch (error: unknown) {
      this.error.set(this.errorMessage(error));
    } finally {
      this.saving.set(false);
    }
  }

  protected cancelChanges(): void {
    this.firstName = this.user()?.firstName ?? '';
    this.lastName = this.user()?.lastName ?? '';
    this.imageFile.set(null);
    this.clearPreview();
    this.error.set('');
    this.success.set('');
  }

  protected async savePassword(): Promise<void> {
    this.passwordError.set('');
    this.passwordSuccess.set('');
    if (this.newPassword !== this.confirmPassword) {
      this.passwordError.set('Las contraseñas nuevas no coinciden.');
      return;
    }
    if (this.newPassword.length < 10 || !/[A-Za-z]/.test(this.newPassword) || !/\d/.test(this.newPassword)) {
      this.passwordError.set('Usa al menos 10 caracteres e incluye letras y números.');
      return;
    }

    this.changingPassword.set(true);
    try {
      const result = await firstValueFrom(this.api.changePassword(this.currentPassword, this.newPassword));
      this.passwordSuccess.set(result.message);
      this.currentPassword = '';
      this.newPassword = '';
      this.confirmPassword = '';
    } catch (error: unknown) {
      this.passwordError.set(this.errorMessage(error));
    } finally {
      this.changingPassword.set(false);
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
    return error instanceof Error ? error.message : 'No se pudo completar la operación.';
  }
}
