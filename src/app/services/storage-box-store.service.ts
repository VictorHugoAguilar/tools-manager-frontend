import { HttpErrorResponse } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { finalize, firstValueFrom } from 'rxjs';
import {
  StorageBox,
  StorageBoxPayload,
  StorageBoxProduct,
  StorageProductPayload
} from '../models/storage-box.model';
import { ConfirmService } from './confirm.service';
import { ToastService } from './toast.service';
import { ToolApiService } from './tool-api.service';

@Injectable({
  providedIn: 'root'
})
export class StorageBoxStoreService {
  private readonly toolApi = inject(ToolApiService);
  private readonly toastService = inject(ToastService);
  private readonly confirmService = inject(ConfirmService);

  readonly boxes = signal<StorageBox[]>([]);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly saveError = signal<string | null>(null);
  readonly boxModalOpen = signal(false);
  readonly productModalOpen = signal(false);
  readonly editingBox = signal<StorageBox | null>(null);
  readonly productBox = signal<StorageBox | null>(null);
  readonly editingProduct = signal<StorageBoxProduct | null>(null);

  private initialized = false;

  readonly totalProducts = computed(() =>
    this.boxes().reduce((total, box) => total + box.products.length, 0)
  );

  ensureLoaded(): void {
    if (this.initialized) {
      return;
    }

    this.initialized = true;
    this.loadBoxes();
  }

  reload(): void {
    this.loadBoxes();
  }

  openCreateBoxModal(): void {
    this.saveError.set(null);
    this.editingBox.set(null);
    this.boxModalOpen.set(true);
  }

  openEditBoxModal(box: StorageBox): void {
    this.saveError.set(null);
    this.editingBox.set(box);
    this.boxModalOpen.set(true);
  }

  closeBoxModal(): void {
    this.saveError.set(null);
    this.editingBox.set(null);
    this.boxModalOpen.set(false);
  }

  openCreateProductModal(box: StorageBox): void {
    this.saveError.set(null);
    this.productBox.set(box);
    this.editingProduct.set(null);
    this.productModalOpen.set(true);
  }

  openEditProductModal(box: StorageBox, product: StorageBoxProduct): void {
    this.saveError.set(null);
    this.productBox.set(box);
    this.editingProduct.set(product);
    this.productModalOpen.set(true);
  }

  closeProductModal(): void {
    this.saveError.set(null);
    this.productBox.set(null);
    this.editingProduct.set(null);
    this.productModalOpen.set(false);
  }

  async saveBox(payload: StorageBoxPayload, imageFile?: File | null): Promise<StorageBox> {
    this.saveError.set(null);
    this.saving.set(true);

    const currentEditing = this.editingBox();
    const request$ = currentEditing
      ? this.toolApi.updateStorageBox(currentEditing.id, payload)
      : this.toolApi.createStorageBox(payload);

    try {
      let box = await firstValueFrom(
        request$.pipe(finalize(() => undefined))
      );

      if (imageFile) {
        const uploadResponse = await firstValueFrom(
          this.toolApi.uploadStorageBoxImage(box.id, imageFile)
        );
        box = uploadResponse.box;
      }

      const nextBoxes = currentEditing
        ? this.boxes().map((item) => item.id === box.id ? box : item)
        : [...this.boxes(), box];

      this.boxes.set(this.sortBoxes(nextBoxes));
      this.toastService.show({
        title: currentEditing ? 'Caja actualizada' : 'Caja creada',
        message: `${box.name} se guardo correctamente.`,
        tone: 'success'
      });
      this.closeBoxModal();
      return box;
    } catch (error: unknown) {
      const message = this.extractErrorMessage(error);
      this.saveError.set(message);
      this.toastService.show({
        title: 'No se pudo guardar la caja',
        message,
        tone: 'error'
      });
      throw error;
    } finally {
      this.saving.set(false);
    }
  }

  async saveProduct(payload: StorageProductPayload, imageFile?: File | null): Promise<StorageBoxProduct> {
    const box = this.productBox();

    if (!box) {
      return Promise.reject(new Error('No storage box selected'));
    }

    this.saveError.set(null);
    this.saving.set(true);

    const currentEditing = this.editingProduct();
    const request$ = currentEditing
      ? this.toolApi.updateStorageProduct(box.id, currentEditing.id, payload)
      : this.toolApi.createStorageProduct(box.id, payload);

    try {
      let product = await firstValueFrom(
        request$.pipe(finalize(() => undefined))
      );

      if (imageFile) {
        const uploadResponse = await firstValueFrom(
          this.toolApi.uploadStorageProductImage(box.id, product.id, imageFile)
        );
        product = uploadResponse.product;
      }

      const nextBoxes = this.boxes().map((item) => {
        if (item.id !== box.id) {
          return item;
        }

        const nextProducts = currentEditing
          ? item.products.map((storedProduct) => storedProduct.id === product.id ? product : storedProduct)
          : [...item.products, product];

        return {
          ...item,
          products: this.sortProducts(nextProducts)
        };
      });

      this.boxes.set(this.sortBoxes(nextBoxes));
      this.toastService.show({
        title: currentEditing ? 'Producto actualizado' : 'Producto añadido',
        message: `${product.name} se guardo correctamente.`,
        tone: 'success'
      });
      this.closeProductModal();
      return product;
    } catch (error: unknown) {
      const message = this.extractErrorMessage(error);
      this.saveError.set(message);
      this.toastService.show({
        title: 'No se pudo guardar el producto',
        message,
        tone: 'error'
      });
      throw error;
    } finally {
      this.saving.set(false);
    }
  }

  deleteBox(box: StorageBox): void {
    this.confirmService.confirm({
      title: 'Eliminar caja',
      message: `¿Deseas eliminar "${box.name}"? Tambien se eliminaran sus productos almacenados.`,
      confirmLabel: 'Eliminar',
      tone: 'danger'
    }).then((confirmed) => {
      if (!confirmed) {
        return;
      }

      this.toolApi.deleteStorageBox(box.id).subscribe({
        next: () => {
          this.boxes.set(this.boxes().filter((item) => item.id !== box.id));
          this.toastService.show({
            title: 'Caja eliminada',
            message: `${box.name} se elimino correctamente.`,
            tone: 'success'
          });
        },
        error: (error: unknown) => {
          this.toastService.show({
            title: 'No se pudo eliminar la caja',
            message: this.extractErrorMessage(error),
            tone: 'error'
          });
        }
      });
    });
  }

  deleteProduct(box: StorageBox, product: StorageBoxProduct): void {
    this.confirmService.confirm({
      title: 'Eliminar producto',
      message: `¿Deseas eliminar "${product.name}" de la caja "${box.name}"?`,
      confirmLabel: 'Eliminar',
      tone: 'danger'
    }).then((confirmed) => {
      if (!confirmed) {
        return;
      }

      this.toolApi.deleteStorageProduct(box.id, product.id).subscribe({
        next: () => {
          this.boxes.set(
            this.sortBoxes(
              this.boxes().map((item) => item.id === box.id
                ? {
                    ...item,
                    products: item.products.filter((storedProduct) => storedProduct.id !== product.id)
                  }
                : item
              )
            )
          );
          this.toastService.show({
            title: 'Producto eliminado',
            message: `${product.name} se elimino correctamente.`,
            tone: 'success'
          });
        },
        error: (error: unknown) => {
          this.toastService.show({
            title: 'No se pudo eliminar el producto',
            message: this.extractErrorMessage(error),
            tone: 'error'
          });
        }
      });
    });
  }

  private loadBoxes(): void {
    this.loading.set(true);

    this.toolApi.getStorageBoxes()
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (boxes) => {
          this.boxes.set(this.sortBoxes(boxes));
        },
        error: (error: unknown) => {
          this.toastService.show({
            title: 'No se pudieron cargar las cajas',
            message: this.extractErrorMessage(error),
            tone: 'error'
          });
        }
      });
  }

  private sortBoxes(boxes: StorageBox[]): StorageBox[] {
    return [...boxes].sort((left, right) =>
      left.code.localeCompare(right.code, 'es', {
        sensitivity: 'base',
        numeric: true
      })
    );
  }

  private sortProducts(products: StorageBoxProduct[]): StorageBoxProduct[] {
    return [...products].sort((left, right) =>
      left.name.localeCompare(right.name, 'es', {
        sensitivity: 'base',
        numeric: true
      })
    );
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
