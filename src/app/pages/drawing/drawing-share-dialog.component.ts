import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, Input, OnDestroy, OnInit, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import {
  DrawingDocument,
  DrawingInvitation,
  DrawingPermission,
  DrawingRole,
  DrawingShareLink,
  DrawingUserSearchResult
} from '../../models/drawing.model';
import { DrawingApiService } from '../../services/drawing-api.service';

@Component({
  selector: 'app-drawing-share-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './drawing-share-dialog.component.html',
  styleUrl: './drawing-share-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DrawingShareDialogComponent implements OnInit, OnDestroy {
  @Input({ required: true }) document!: DrawingDocument;

  private readonly api = inject(DrawingApiService);
  private searchTimer: ReturnType<typeof setTimeout> | null = null;

  readonly closed = output<void>();
  protected readonly permissions = signal<DrawingPermission[]>([]);
  protected readonly invitations = signal<DrawingInvitation[]>([]);
  protected readonly search = signal('');
  protected readonly users = signal<DrawingUserSearchResult[]>([]);
  protected readonly invitationRole = signal<Exclude<DrawingRole, 'Owner'>>('Editor');
  protected readonly shareLink = signal<DrawingShareLink | null>(null);
  protected readonly generatedLink = signal('');
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly error = signal('');
  protected readonly message = signal('');

  ngOnInit(): void {
    void this.load();
  }

  ngOnDestroy(): void {
    if (this.searchTimer) clearTimeout(this.searchTimer);
  }

  protected async load(): Promise<void> {
    this.loading.set(true);
    this.error.set('');
    try {
      const [permissionResult, invitationResult, linkResult] = await Promise.all([
        firstValueFrom(this.api.listPermissions(this.document.id)),
        firstValueFrom(this.api.listDocumentInvitations(this.document.id)),
        firstValueFrom(this.api.getShareLink(this.document.id))
      ]);
      this.permissions.set(permissionResult.permissions);
      this.invitations.set(invitationResult.invitations);
      this.shareLink.set(linkResult.link);
    } catch (error: unknown) {
      this.error.set(this.errorMessage(error));
    } finally {
      this.loading.set(false);
    }
  }

  protected updateSearch(value: string): void {
    this.search.set(value);
    this.users.set([]);
    if (this.searchTimer) clearTimeout(this.searchTimer);
    const query = value.trim();
    if (query.length < 2) return;
    this.searchTimer = setTimeout(() => {
      this.searchTimer = null;
      void this.searchUsers(query);
    }, 250);
  }

  protected async invite(user: DrawingUserSearchResult): Promise<void> {
    if (this.saving()) return;
    this.saving.set(true);
    this.error.set('');
    this.message.set('');
    try {
      await firstValueFrom(this.api.createInvitation(this.document.id, user.id, this.invitationRole()));
      this.message.set(`Invitación enviada a ${user.firstName} ${user.lastName}.`);
      this.search.set('');
      this.users.set([]);
      await this.load();
    } catch (error: unknown) {
      this.error.set(this.errorMessage(error));
    } finally {
      this.saving.set(false);
    }
  }

  protected async changeRole(permission: DrawingPermission, role: Exclude<DrawingRole, 'Owner'>): Promise<void> {
    if (!permission.id || permission.role === role || this.saving()) return;
    this.saving.set(true);
    this.error.set('');
    try {
      await firstValueFrom(this.api.updatePermission(permission.id, role));
      await this.load();
    } catch (error: unknown) {
      this.error.set(this.errorMessage(error));
    } finally {
      this.saving.set(false);
    }
  }

  protected async revokePermission(permission: DrawingPermission): Promise<void> {
    if (!permission.id || this.saving()) return;
    this.saving.set(true);
    this.error.set('');
    try {
      await firstValueFrom(this.api.revokePermission(permission.id));
      await this.load();
    } catch (error: unknown) {
      this.error.set(this.errorMessage(error));
    } finally {
      this.saving.set(false);
    }
  }

  protected async cancelInvitation(invitation: DrawingInvitation): Promise<void> {
    if (this.saving()) return;
    this.saving.set(true);
    this.error.set('');
    try {
      await firstValueFrom(this.api.cancelInvitation(invitation.id));
      await this.load();
    } catch (error: unknown) {
      this.error.set(this.errorMessage(error));
    } finally {
      this.saving.set(false);
    }
  }

  protected async createShareLink(): Promise<void> {
    if (this.saving()) return;
    this.saving.set(true);
    this.error.set('');
    this.message.set('');
    try {
      const { link, token } = await firstValueFrom(this.api.createShareLink(this.document.id));
      this.shareLink.set(link);
      this.generatedLink.set(`${window.location.origin}/dibujar/shared/${encodeURIComponent(token)}`);
      this.message.set('Enlace de solo lectura creado. Cópialo ahora; no se volverá a mostrar.');
    } catch (error: unknown) {
      this.error.set(this.errorMessage(error));
    } finally {
      this.saving.set(false);
    }
  }

  protected async revokeShareLink(): Promise<void> {
    if (this.saving()) return;
    this.saving.set(true);
    this.error.set('');
    try {
      await firstValueFrom(this.api.revokeShareLink(this.document.id));
      this.shareLink.set({ id: '', documentId: this.document.id, permission: 'Viewer', isActive: false, expiresAt: null });
      this.generatedLink.set('');
      this.api.clearShareToken(this.document.id);
    } catch (error: unknown) {
      this.error.set(this.errorMessage(error));
    } finally {
      this.saving.set(false);
    }
  }

  protected async copyLink(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.generatedLink());
      this.message.set('Enlace copiado.');
    } catch {
      this.error.set('No se pudo copiar automáticamente. Selecciona y copia el enlace.');
    }
  }

  private async searchUsers(query: string): Promise<void> {
    this.error.set('');
    try {
      const { users } = await firstValueFrom(this.api.searchUsers(query));
      if (query === this.search().trim()) this.users.set(users);
    } catch (error: unknown) {
      this.error.set(this.errorMessage(error));
    }
  }

  private errorMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      const message = error.error?.message;
      if (typeof message === 'string') return message;
    }
    if (error instanceof Error) return error.message;
    return 'No se pudo completar la operación. Inténtalo de nuevo.';
  }
}
