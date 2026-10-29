import { HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { WorkshopMaterialCategory } from '../models/workshop-storage.model';
import { ConfirmService } from './confirm.service';
import { ToastService } from './toast.service';
import { WorkshopStorageApiService } from './workshop-storage-api.service';

@Injectable({ providedIn: 'root' })
export class WorkshopMaterialCategoryStoreService {
  private readonly api = inject(WorkshopStorageApiService);
  private readonly confirmService = inject(ConfirmService);
  private readonly toastService = inject(ToastService);

  readonly categories = signal<WorkshopMaterialCategory[]>([]);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly saveError = signal<string | null>(null);

  private initialized = false;

  ensureLoaded(): void {
    if (this.initialized || this.loading()) return;
    this.initialized = true;
    void this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      this.categories.set(await firstValueFrom(this.api.getMaterialCategories()));
      this.initialized = true;
    } catch (error: unknown) {
      this.initialized = false;
      this.error.set(this.errorMessage(error, 'No se pudieron cargar las categorías de materiales.'));
    } finally {
      this.loading.set(false);
    }
  }

  async addCategory(name: string): Promise<boolean> {
    const normalizedName = name.trim().replace(/\s+/g, ' ');
    this.saveError.set(null);

    if (!normalizedName) {
      this.saveError.set('Escribe un nombre para la categoría.');
      return false;
    }

    if (this.categories().some((category) =>
      category.name.localeCompare(normalizedName, 'es', { sensitivity: 'base' }) === 0
    )) {
      this.saveError.set('Ya existe una categoría con ese nombre.');
      return false;
    }

    this.saving.set(true);
    try {
      const category = await firstValueFrom(this.api.createMaterialCategory(normalizedName));
      this.categories.update((categories) =>
        [...categories, category].sort((left, right) =>
          left.name.localeCompare(right.name, 'es', { sensitivity: 'base' })
        )
      );
      this.toastService.show({
        title: 'Categoría añadida',
        message: `«${category.name}» ya está disponible para los materiales.`,
        tone: 'success'
      });
      return true;
    } catch (error: unknown) {
      this.saveError.set(this.errorMessage(error, 'No se pudo añadir la categoría.'));
      return false;
    } finally {
      this.saving.set(false);
    }
  }

  async removeCategory(category: WorkshopMaterialCategory): Promise<void> {
    this.saveError.set(null);
    const confirmed = await this.confirmService.confirm({
      title: '¿Eliminar categoría?',
      message: `«${category.name}» dejará de estar disponible al registrar materiales. Los materiales que ya la usan conservarán su categoría.`,
      confirmLabel: 'Eliminar',
      cancelLabel: 'Rectificar',
      tone: 'danger'
    });

    if (!confirmed) return;

    this.saving.set(true);
    try {
      await firstValueFrom(this.api.deleteMaterialCategory(category.id));
      this.categories.update((categories) => categories.filter((item) => item.id !== category.id));
      this.toastService.show({
        title: 'Categoría eliminada',
        message: `«${category.name}» ya no aparece en las nuevas altas.`,
        tone: 'success'
      });
    } catch (error: unknown) {
      this.saveError.set(this.errorMessage(error, 'No se pudo eliminar la categoría.'));
    } finally {
      this.saving.set(false);
    }
  }

  private errorMessage(error: unknown, fallback: string): string {
    if (error instanceof HttpErrorResponse) {
      return error.error?.message || fallback;
    }
    return error instanceof Error ? error.message : fallback;
  }
}
