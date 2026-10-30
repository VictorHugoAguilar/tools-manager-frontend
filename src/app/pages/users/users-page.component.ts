import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, OnDestroy, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { AdminUserPayload, AuthUser, AvailablePermission, UserListItem, UserRole } from '../../models/auth.model';
import { AuthApiService } from '../../services/auth-api.service';
import { AuthService } from '../../services/auth.service';
import { ConfirmService } from '../../services/confirm.service';

@Component({
  selector: 'app-users-page',
  imports: [CommonModule, FormsModule],
  templateUrl: './users-page.component.html',
  styleUrl: './users-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class UsersPageComponent implements OnDestroy {
  private readonly api = inject(AuthApiService);
  private readonly auth = inject(AuthService);
  private readonly confirm = inject(ConfirmService);

  protected readonly currentUser = this.auth.user;
  protected readonly users = signal<UserListItem[]>([]);
  protected readonly roles = signal<UserRole[]>([]);
  protected readonly permissions = signal<AvailablePermission[]>([]);
  protected readonly total = signal(0);
  protected readonly page = signal(1);
  protected readonly pages = signal(1);
  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly error = signal('');
  protected readonly saveError = signal('');
  protected readonly modalOpen = signal(false);
  protected readonly editingUser = signal<UserListItem | null>(null);
  protected readonly selectedPermissionRole = signal('');
  protected readonly selectedPermissions = signal<string[]>([]);
  protected readonly savingPermissions = signal(false);
  protected readonly permissionMessage = signal('');
  protected readonly selectedImage = signal<File | null>(null);
  protected readonly imagePreviewUrl = signal<string | null>(null);

  protected search = '';
  protected roleFilter = '';
  protected statusFilter = '';
  protected sortField = 'createdAt';
  protected sortOrder = 'desc';
  protected draft: AdminUserPayload = this.emptyDraft();

  constructor() {
    void this.load();
  }

  ngOnDestroy(): void {
    this.clearImagePreview();
  }

  protected async load(): Promise<void> {
    this.error.set('');
    this.loading.set(true);
    try {
      const [roleResponse, permissionResponse] = await Promise.all([
        firstValueFrom(this.api.listRoles()),
        firstValueFrom(this.api.listPermissions())
      ]);
      this.roles.set(roleResponse.roles);
      this.permissions.set(permissionResponse.permissions);
      if (!this.selectedPermissionRole() && roleResponse.roles.length) {
        this.selectPermissionRole(roleResponse.roles.find((role) => role.id === 'user')?.id ?? roleResponse.roles[0].id);
      }
      await this.loadUsers(1);
    } catch (error: unknown) {
      this.error.set(this.errorMessage(error));
    } finally {
      this.loading.set(false);
    }
  }

  protected async loadUsers(page = this.page()): Promise<void> {
    this.error.set('');
    this.loading.set(true);
    try {
      const result = await firstValueFrom(this.api.listUsers({
        search: this.search.trim(),
        role: this.roleFilter,
        status: this.statusFilter,
        page,
        limit: 10,
        sort: this.sortField,
        order: this.sortOrder
      }));
      this.users.set(result.users);
      this.total.set(result.total);
      this.page.set(result.page);
      this.pages.set(Math.max(1, result.pages));
    } catch (error: unknown) {
      this.error.set(this.errorMessage(error));
    } finally {
      this.loading.set(false);
    }
  }

  protected toggleSort(field: string): void {
    if (this.sortField === field) this.sortOrder = this.sortOrder === 'asc' ? 'desc' : 'asc';
    else {
      this.sortField = field;
      this.sortOrder = 'asc';
    }
    void this.loadUsers(1);
  }

  protected openCreate(): void {
    this.editingUser.set(null);
    this.draft = this.emptyDraft();
    this.selectedImage.set(null);
    this.clearImagePreview();
    this.saveError.set('');
    this.modalOpen.set(true);
  }

  protected openEdit(user: UserListItem): void {
    this.editingUser.set(user);
    this.draft = {
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      roleId: user.roleId,
      isActive: user.isActive,
      password: ''
    };
    this.selectedImage.set(null);
    this.clearImagePreview();
    this.saveError.set('');
    this.modalOpen.set(true);
  }

  protected onImageSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    this.clearImagePreview();
    this.selectedImage.set(file);
    this.imagePreviewUrl.set(file ? URL.createObjectURL(file) : null);
    input.value = '';
  }

  protected async saveUser(): Promise<void> {
    this.saveError.set('');
    this.saving.set(true);
    try {
      const image = this.selectedImage();
      const original = this.editingUser();
      if (original && this.draft.password &&
        (!/[A-Za-z]/.test(this.draft.password) || !/\d/.test(this.draft.password))) {
        this.saveError.set('La nueva contraseña debe incluir letras y números.');
        return;
      }

      if (!original) {
        if (!this.draft.password) {
          this.saveError.set('Define una contraseña inicial para la cuenta.');
          return;
        }
        if (!/[A-Za-z]/.test(this.draft.password) || !/\d/.test(this.draft.password)) {
          this.saveError.set('La contraseña inicial debe incluir letras y números.');
          return;
        }
        const { user } = await firstValueFrom(this.api.createUser(this.draft));
        if (image) {
          try {
            await firstValueFrom(this.api.uploadUserAvatar(user.id, image));
          } catch (error: unknown) {
            const uploadError = `El usuario se creó, pero no se pudo guardar su foto: ${this.errorMessage(error)}`;
            this.modalOpen.set(false);
            await this.loadUsers(1);
            this.error.set(uploadError);
            return;
          }
        }
      } else {
        const profileChanges: { firstName?: string; lastName?: string; email?: string } = {};
        if (this.draft.firstName !== original.firstName) profileChanges.firstName = this.draft.firstName;
        if (this.draft.lastName !== original.lastName) profileChanges.lastName = this.draft.lastName;
        if (this.draft.email !== original.email) profileChanges.email = this.draft.email;
        if (Object.keys(profileChanges).length) {
          await firstValueFrom(this.api.updateUser(original.id, profileChanges));
        }
        if (this.draft.roleId !== original.roleId) {
          await firstValueFrom(this.api.updateUserRole(original.id, this.draft.roleId));
        }
        if (this.draft.isActive !== original.isActive) {
          await firstValueFrom(this.api.updateUserStatus(original.id, this.draft.isActive));
        }
        if (image) await firstValueFrom(this.api.uploadUserAvatar(original.id, image));
        if (this.draft.password) {
          await firstValueFrom(this.api.resetUserPassword(original.id, this.draft.password));
        }
      }

      this.modalOpen.set(false);
      this.selectedImage.set(null);
      this.clearImagePreview();
      await this.loadUsers(this.page());
    } catch (error: unknown) {
      this.saveError.set(this.errorMessage(error));
      await this.loadUsers(this.page());
    } finally {
      this.saving.set(false);
    }
  }

  protected async toggleStatus(user: UserListItem): Promise<void> {
    const isActive = !user.isActive;
    const confirmed = await this.confirm.confirm({
      title: isActive ? '¿Activar usuario?' : '¿Desactivar usuario?',
      message: `Vas a ${isActive ? 'activar' : 'desactivar'} la cuenta de ${user.firstName} ${user.lastName}.`,
      confirmLabel: isActive ? 'Activar' : 'Desactivar',
      cancelLabel: 'Cancelar',
      tone: isActive ? 'primary' : 'danger'
    });
    if (!confirmed) return;
    try {
      await firstValueFrom(this.api.updateUserStatus(user.id, isActive));
      await this.loadUsers(this.page());
    } catch (error: unknown) {
      this.error.set(this.errorMessage(error));
    }
  }

  protected async deleteUser(user: UserListItem): Promise<void> {
    const confirmed = await this.confirm.confirm({
      title: '¿Eliminar usuario?',
      message: `Se eliminará la cuenta de ${user.firstName} ${user.lastName} (${user.email}). Esta acción no se puede deshacer.`,
      confirmLabel: 'Eliminar',
      cancelLabel: 'Rectificar',
      tone: 'danger'
    });
    if (!confirmed) return;
    try {
      await firstValueFrom(this.api.deleteUser(user.id));
      await this.loadUsers(Math.min(this.page(), Math.max(1, Math.ceil((this.total() - 1) / 10))));
    } catch (error: unknown) {
      this.error.set(this.errorMessage(error));
    }
  }

  protected selectPermissionRole(roleId: string): void {
    this.selectedPermissionRole.set(roleId);
    const role = this.roles().find((item) => item.id === roleId);
    this.selectedPermissions.set(role ? [...role.permissions] : []);
    this.permissionMessage.set('');
  }

  protected hasPermission(permissionId: string): boolean {
    return this.selectedPermissions().includes(permissionId);
  }

  protected togglePermission(permissionId: string): void {
    if (this.selectedPermissionRole() === 'admin' &&
      ['app:access', 'users:manage', 'roles:manage'].includes(permissionId)) return;
    this.selectedPermissions.update((current) =>
      current.includes(permissionId)
        ? current.filter((value) => value !== permissionId)
        : [...current, permissionId]
    );
  }

  protected async savePermissions(): Promise<void> {
    this.permissionMessage.set('');
    this.savingPermissions.set(true);
    try {
      const { role } = await firstValueFrom(this.api.updateRolePermissions(
        this.selectedPermissionRole(),
        this.selectedPermissions()
      ));
      this.roles.update((current) => current.map((item) => item.id === role.id ? role : item));
      this.permissionMessage.set('Los permisos del rol se han actualizado.');
    } catch (error: unknown) {
      this.permissionMessage.set(this.errorMessage(error));
    } finally {
      this.savingPermissions.set(false);
    }
  }

  protected roleName(roleId: string): string {
    return this.roles().find((role) => role.id === roleId)?.name ?? roleId;
  }

  protected initials(user: Pick<AuthUser, 'firstName' | 'lastName'>): string {
    return `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`.toUpperCase() || 'U';
  }

  protected isCurrentUser(user: UserListItem): boolean {
    return user.id === this.currentUser()?.id;
  }

  protected editingSelf(): boolean {
    const user = this.editingUser();
    return user ? this.isCurrentUser(user) : false;
  }

  protected closeModal(): void {
    if (this.saving()) return;
    this.modalOpen.set(false);
    this.selectedImage.set(null);
    this.clearImagePreview();
  }

  private emptyDraft(): AdminUserPayload {
    return { firstName: '', lastName: '', email: '', roleId: 'user', isActive: true, password: '' };
  }

  private clearImagePreview(): void {
    const previewUrl = this.imagePreviewUrl();
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    this.imagePreviewUrl.set(null);
  }

  private errorMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse && typeof error.error?.message === 'string') {
      return error.error.message;
    }
    return 'No se pudo completar la operación. Inténtalo de nuevo.';
  }
}
