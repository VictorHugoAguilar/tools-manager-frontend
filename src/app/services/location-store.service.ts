import { HttpErrorResponse } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { finalize } from 'rxjs';
import { LocationPayload, ToolLocation } from '../models/location.model';
import { ConfirmService } from './confirm.service';
import { ToastService } from './toast.service';
import { ToolApiService } from './tool-api.service';

@Injectable({
  providedIn: 'root'
})
export class LocationStoreService {
  private readonly toolApi = inject(ToolApiService);
  private readonly toastService = inject(ToastService);
  private readonly confirmService = inject(ConfirmService);

  readonly locations = signal<ToolLocation[]>([]);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly saveError = signal<string | null>(null);

  private initialized = false;

  readonly locationNames = computed(() => this.locations().map((location) => location.name));

  ensureLoaded(): void {
    if (this.initialized) {
      return;
    }

    this.initialized = true;
    this.loadLocations();
  }

  reload(): void {
    this.loadLocations();
  }

  saveLocation(payload: LocationPayload, locationId?: string): Promise<ToolLocation> {
    this.saveError.set(null);
    this.saving.set(true);

    const request$ = locationId
      ? this.toolApi.updateLocation(locationId, payload)
      : this.toolApi.createLocation(payload);

    return new Promise((resolve, reject) => {
      request$
        .pipe(finalize(() => this.saving.set(false)))
        .subscribe({
          next: (location) => {
            const nextLocations = locationId
              ? this.locations().map((item) => item.id === location.id ? location : item)
              : [...this.locations(), location];

            this.locations.set(
              [...nextLocations].sort((left, right) => left.name.localeCompare(right.name, 'es'))
            );
            this.toastService.show({
              title: locationId ? 'Ubicacion actualizada' : 'Ubicacion creada',
              message: `${location.name} se guardo correctamente.`,
              tone: 'success'
            });
            resolve(location);
          },
          error: (error: unknown) => {
            const message = this.extractErrorMessage(error);
            this.saveError.set(message);
            this.toastService.show({
              title: 'No se pudo guardar la ubicacion',
              message,
              tone: 'error'
            });
            reject(error);
          }
        });
    });
  }

  deleteLocation(location: ToolLocation): void {
    this.confirmService.confirm({
      title: 'Eliminar ubicacion',
      message: `¿Deseas eliminar "${location.name}"? Las herramientas que ya la usen conservaran el texto, pero dejara de aparecer como opcion nueva.`,
      confirmLabel: 'Eliminar',
      tone: 'danger'
    }).then((confirmed) => {
      if (!confirmed) {
        return;
      }

      this.toolApi.deleteLocation(location.id).subscribe({
        next: () => {
          this.locations.set(this.locations().filter((item) => item.id !== location.id));
          this.toastService.show({
            title: 'Ubicacion eliminada',
            message: `${location.name} se elimino correctamente.`,
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

  private loadLocations(): void {
    this.loading.set(true);

    this.toolApi.getLocations()
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (locations) => {
          this.locations.set(
            [...locations].sort((left, right) => left.name.localeCompare(right.name, 'es'))
          );
        },
        error: (error: unknown) => {
          this.toastService.show({
            title: 'No se pudieron cargar las ubicaciones',
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
