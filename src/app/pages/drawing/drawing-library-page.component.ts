import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { DrawingDocument } from '../../models/drawing.model';
import { ConfirmService } from '../../services/confirm.service';
import { DrawingApiService } from '../../services/drawing-api.service';

@Component({
  selector: 'app-drawing-library-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './drawing-library-page.component.html',
  styleUrl: './drawing-library-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DrawingLibraryPageComponent implements OnInit, OnDestroy {
  private readonly api = inject(DrawingApiService);
  private readonly confirm = inject(ConfirmService);
  private readonly router = inject(Router);

  protected readonly documents = signal<DrawingDocument[]>([]);
  protected readonly loading = signal(true);
  protected readonly loadingMore = signal(false);
  protected readonly saving = signal(false);
  protected readonly error = signal('');
  protected readonly search = signal('');
  protected readonly showArchived = signal(false);
  protected readonly nextCursor = signal<string | null>(null);
  protected readonly dialogOpen = signal(false);
  protected readonly editingDocumentId = signal<string | null>(null);
  protected readonly draftName = signal('');
  protected readonly draftDescription = signal('');
  private loadRequestId = 0;
  private searchTimer: ReturnType<typeof setTimeout> | null = null;
  protected readonly visibleDocuments = computed(() => {
    const query = this.search().trim().toLocaleLowerCase();
    return this.documents().filter((document) =>
      !query || `${document.name} ${document.description}`.toLocaleLowerCase().includes(query)
    );
  });

  ngOnInit(): void {
    void this.loadDocuments();
  }

  ngOnDestroy(): void {
    if (this.searchTimer) clearTimeout(this.searchTimer);
  }

  protected updateSearch(value: string): void {
    this.search.set(value);
    this.nextCursor.set(null);
    if (this.searchTimer) clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => {
      this.searchTimer = null;
      void this.loadDocuments();
    }, 250);
  }

  protected async loadDocuments(): Promise<void> {
    const requestId = ++this.loadRequestId;
    this.error.set('');
    this.loading.set(true);
    try {
      const result = await firstValueFrom(this.api.listDocuments({
        includeArchived: this.showArchived(),
        search: this.search()
      }));
      if (requestId !== this.loadRequestId) return;
      this.documents.set(result.documents);
      this.nextCursor.set(result.nextCursor);
    } catch (error: unknown) {
      if (requestId === this.loadRequestId) {
        this.documents.set([]);
        this.nextCursor.set(null);
        this.error.set(this.errorMessage(error));
      }
    } finally {
      if (requestId === this.loadRequestId) this.loading.set(false);
    }
  }

  protected async loadMore(): Promise<void> {
    const cursor = this.nextCursor();
    if (!cursor || this.loadingMore()) return;
    const requestId = this.loadRequestId;
    this.loadingMore.set(true);
    this.error.set('');
    try {
      const result = await firstValueFrom(this.api.listDocuments({
        includeArchived: this.showArchived(),
        cursor,
        search: this.search()
      }));
      if (requestId !== this.loadRequestId) return;
      this.documents.update((documents) => [...documents, ...result.documents]);
      this.nextCursor.set(result.nextCursor);
    } catch (error: unknown) {
      if (requestId === this.loadRequestId) this.error.set(this.errorMessage(error));
    } finally {
      this.loadingMore.set(false);
    }
  }

  protected toggleArchived(): void {
    this.showArchived.update((value) => !value);
    void this.loadDocuments();
  }

  protected openCreateDialog(): void {
    this.editingDocumentId.set(null);
    this.draftName.set('');
    this.draftDescription.set('');
    this.dialogOpen.set(true);
  }

  protected openRenameDialog(document: DrawingDocument): void {
    this.editingDocumentId.set(document.id);
    this.draftName.set(document.name);
    this.draftDescription.set(document.description);
    this.dialogOpen.set(true);
  }

  protected closeDialog(): void {
    if (!this.saving()) this.dialogOpen.set(false);
  }

  protected async saveDocument(): Promise<void> {
    const name = this.draftName().trim();
    if (!name || this.saving()) return;
    this.error.set('');
    this.saving.set(true);
    try {
      if (this.editingDocumentId()) {
        await firstValueFrom(this.api.updateDocument(this.editingDocumentId()!, {
          name,
          description: this.draftDescription().trim()
        }));
        this.dialogOpen.set(false);
        await this.loadDocuments();
      } else {
        const { document } = await firstValueFrom(
          this.api.createDocument(name, this.draftDescription().trim())
        );
        this.dialogOpen.set(false);
        await this.router.navigate(['/dibujar', document.id]);
      }
    } catch (error: unknown) {
      this.error.set(this.errorMessage(error));
    } finally {
      this.saving.set(false);
    }
  }

  protected async duplicate(document: DrawingDocument): Promise<void> {
    await this.performDocumentAction(() => this.api.duplicateDocument(document.id));
  }

  protected async archive(document: DrawingDocument): Promise<void> {
    const accepted = await this.confirm.confirm({
      title: 'Archivar pizarra',
      message: `¿Quieres archivar «${document.name}»? Podrás restaurarla desde las archivadas.`,
      confirmLabel: 'Archivar'
    });
    if (accepted) await this.performDocumentAction(() => this.api.archiveDocument(document.id));
  }

  protected async restore(document: DrawingDocument): Promise<void> {
    await this.performDocumentAction(() => this.api.restoreDocument(document.id));
  }

  protected async delete(document: DrawingDocument): Promise<void> {
    const accepted = await this.confirm.confirm({
      title: 'Eliminar pizarra',
      message: `¿Quieres eliminar «${document.name}»? La pizarra dejará de aparecer en tu biblioteca.`,
      confirmLabel: 'Eliminar',
      tone: 'danger'
    });
    if (!accepted) return;
    this.error.set('');
    try {
      await firstValueFrom(this.api.deleteDocument(document.id));
      await this.loadDocuments();
    } catch (error: unknown) {
      this.error.set(this.errorMessage(error));
    }
  }

  protected open(document: DrawingDocument): void {
    void this.router.navigate(['/dibujar', document.id]);
  }

  private async performDocumentAction(
    action: () => ReturnType<DrawingApiService['duplicateDocument']>
  ): Promise<void> {
    this.error.set('');
    try {
      await firstValueFrom(action());
      await this.loadDocuments();
    } catch (error: unknown) {
      this.error.set(this.errorMessage(error));
    }
  }

  private errorMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      const message = error.error?.message;
      if (typeof message === 'string') return message;
    }
    return 'No se pudo completar la operación. Inténtalo de nuevo.';
  }
}
