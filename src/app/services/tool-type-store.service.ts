import { HttpErrorResponse } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { finalize } from 'rxjs';
import { ToolType, ToolTypePayload } from '../models/tool-type.model';
import { ConfirmService } from './confirm.service';
import { ToastService } from './toast.service';
import { ToolApiService } from './tool-api.service';

@Injectable({
  providedIn: 'root'
})
export class ToolTypeStoreService {
  private readonly toolApi = inject(ToolApiService);
  private readonly toastService = inject(ToastService);
  private readonly confirmService = inject(ConfirmService);

  readonly toolTypes = signal<ToolType[]>([]);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly saveError = signal<string | null>(null);

  private initialized = false;

  readonly typeNames = computed(() => this.toolTypes().map((item) => item.name));

  ensureLoaded(): void {
    if (this.initialized) {
      return;
    }

    this.initialized = true;
    this.loadToolTypes();
  }

  saveToolType(payload: ToolTypePayload, toolTypeId?: string): Promise<ToolType> {
    this.saveError.set(null);
    this.saving.set(true);

    const request$ = toolTypeId
      ? this.toolApi.updateToolType(toolTypeId, payload)
      : this.toolApi.createToolType(payload);

    return new Promise((resolve, reject) => {
      request$
        .pipe(finalize(() => this.saving.set(false)))
        .subscribe({
          next: (toolType) => {
            const nextToolTypes = toolTypeId
              ? this.toolTypes().map((item) => item.id === toolType.id ? toolType : item)
              : [...this.toolTypes(), toolType];

            this.toolTypes.set(
              [...nextToolTypes].sort((left, right) => left.name.localeCompare(right.name, 'es'))
            );
            this.toastService.show({
              title: toolTypeId ? 'Tipo actualizado' : 'Tipo creado',
              message: `${toolType.name} se guardo correctamente.`,
              tone: 'success'
            });
            resolve(toolType);
          },
          error: (error: unknown) => {
            const message = this.extractErrorMessage(error);
            this.saveError.set(message);
            this.toastService.show({
              title: 'No se pudo guardar el tipo',
              message,
              tone: 'error'
            });
            reject(error);
          }
        });
    });
  }

  deleteToolType(toolType: ToolType): void {
    this.confirmService.confirm({
      title: 'Eliminar tipo',
      message: `¿Deseas eliminar "${toolType.name}"? Las herramientas que ya lo usen conservaran el texto, pero dejara de aparecer como opcion nueva.`,
      confirmLabel: 'Eliminar',
      tone: 'danger'
    }).then((confirmed) => {
      if (!confirmed) {
        return;
      }

      this.toolApi.deleteToolType(toolType.id).subscribe({
        next: () => {
          this.toolTypes.set(this.toolTypes().filter((item) => item.id !== toolType.id));
          this.toastService.show({
            title: 'Tipo eliminado',
            message: `${toolType.name} se elimino correctamente.`,
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

  private loadToolTypes(): void {
    this.loading.set(true);

    this.toolApi.getToolTypes()
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (toolTypes) => {
          this.toolTypes.set(
            [...toolTypes].sort((left, right) => left.name.localeCompare(right.name, 'es'))
          );
        },
        error: (error: unknown) => {
          this.toastService.show({
            title: 'No se pudieron cargar los tipos',
            message: this.extractErrorMessage(error),
            tone: 'error'
          });
        }
      });
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
