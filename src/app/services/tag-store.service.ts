import { HttpErrorResponse } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { finalize, firstValueFrom } from 'rxjs';
import { AppTag, TagPayload } from '../models/tag.model';
import { ConfirmService } from './confirm.service';
import { ToastService } from './toast.service';
import { ToolApiService } from './tool-api.service';

@Injectable({
  providedIn: 'root'
})
export class TagStoreService {
  private readonly toolApi = inject(ToolApiService);
  private readonly toastService = inject(ToastService);
  private readonly confirmService = inject(ConfirmService);

  readonly tags = signal<AppTag[]>([]);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly saveError = signal<string | null>(null);

  private initialized = false;

  readonly tagNames = computed(() => this.tags().map((tag) => tag.name));

  ensureLoaded(): void {
    if (this.initialized) {
      return;
    }

    this.initialized = true;
    this.loadTags();
  }

  saveTag(payload: TagPayload, tagId?: string): Promise<AppTag> {
    this.saveError.set(null);
    this.saving.set(true);

    const request$ = tagId
      ? this.toolApi.updateTag(tagId, payload)
      : this.toolApi.createTag(payload);

    return new Promise((resolve, reject) => {
      request$
        .pipe(finalize(() => this.saving.set(false)))
        .subscribe({
          next: (tag) => {
            this.upsertTag(tag);
            this.toastService.show({
              title: tagId ? 'Tag actualizado' : 'Tag creado',
              message: `${tag.name} se guardo correctamente.`,
              tone: 'success'
            });
            resolve(tag);
          },
          error: (error: unknown) => {
            const message = this.extractErrorMessage(error);
            this.saveError.set(message);
            this.toastService.show({
              title: 'No se pudo guardar el tag',
              message,
              tone: 'error'
            });
            reject(error);
          }
        });
    });
  }

  async ensureTag(name: string): Promise<AppTag | null> {
    const normalizedName = this.normalizeTagName(name);

    if (!normalizedName) {
      return null;
    }

    const existing = this.tags().find((tag) => this.normalizeTagName(tag.name) === normalizedName);

    if (existing) {
      return existing;
    }

    try {
      const tag = await firstValueFrom(this.toolApi.createTag({
        name: name.trim(),
        description: ''
      }));

      this.upsertTag(tag);
      return tag;
    } catch (error: unknown) {
      this.toastService.show({
        title: 'No se pudo crear el tag',
        message: this.extractErrorMessage(error),
        tone: 'error'
      });
      throw error;
    }
  }

  deleteTag(tag: AppTag): void {
    this.confirmService.confirm({
      title: 'Eliminar tag',
      message: `¿Deseas eliminar "${tag.name}"? Los productos que ya lo usen conservaran el texto, pero dejara de aparecer como opcion nueva.`,
      confirmLabel: 'Eliminar',
      tone: 'danger'
    }).then((confirmed) => {
      if (!confirmed) {
        return;
      }

      this.toolApi.deleteTag(tag.id).subscribe({
        next: () => {
          this.tags.set(this.tags().filter((item) => item.id !== tag.id));
          this.toastService.show({
            title: 'Tag eliminado',
            message: `${tag.name} se elimino correctamente.`,
            tone: 'success'
          });
        },
        error: (error: unknown) => {
          this.toastService.show({
            title: 'No se pudo eliminar',
            message: this.extractErrorMessage(error),
            tone: 'error'
          });
        }
      });
    });
  }

  private loadTags(): void {
    this.loading.set(true);

    this.toolApi.getTags()
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (tags) => {
          this.tags.set(this.sortTags(tags));
        },
        error: (error: unknown) => {
          this.toastService.show({
            title: 'No se pudieron cargar los tags',
            message: this.extractErrorMessage(error),
            tone: 'error'
          });
        }
      });
  }

  private upsertTag(tag: AppTag): void {
    const exists = this.tags().some((item) => item.id === tag.id);
    const nextTags = exists
      ? this.tags().map((item) => item.id === tag.id ? tag : item)
      : [...this.tags(), tag];

    this.tags.set(this.sortTags(nextTags));
  }

  private sortTags(tags: AppTag[]): AppTag[] {
    return [...tags].sort((left, right) => left.name.localeCompare(right.name, 'es'));
  }

  private normalizeTagName(value: string): string {
    return value.trim().toLowerCase();
  }

  private extractErrorMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      const responseError = error.error as { message?: string; errors?: string[] } | null;

      if (Array.isArray(responseError?.errors) && responseError.errors.length > 0) {
        return responseError.errors.join(' ');
      }

      if (typeof responseError?.message === 'string' && responseError.message.trim() !== '') {
        return responseError.message;
      }
    }

    if (error instanceof Error && error.message.trim() !== '') {
      return error.message;
    }

    return 'Ha ocurrido un error inesperado.';
  }
}
