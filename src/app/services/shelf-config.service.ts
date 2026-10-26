import { HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { finalize, firstValueFrom } from 'rxjs';
import {
  DEFAULT_SHELF_CONFIG,
  ShelfConfig,
  ShelfConfigPayload
} from '../models/shelf-config.model';
import { ToolApiService } from './tool-api.service';

@Injectable({
  providedIn: 'root'
})
export class ShelfConfigService {
  private readonly toolApi = inject(ToolApiService);

  readonly currentConfig = signal<ShelfConfig>({ ...DEFAULT_SHELF_CONFIG });
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);

  private initialized = false;

  ensureLoaded(): void {
    if (this.initialized) {
      return;
    }

    this.initialized = true;
    void this.loadConfig();
  }

  async saveConfig(payload: ShelfConfigPayload): Promise<ShelfConfig> {
    this.error.set(null);
    this.saving.set(true);

    try {
      const config = await firstValueFrom(
        this.toolApi.updateShelfConfig(payload).pipe(
          finalize(() => this.saving.set(false))
        )
      );

      this.currentConfig.set({ ...config });
      this.initialized = true;
      return config;
    } catch (error: unknown) {
      this.error.set(this.extractErrorMessage(error));
      throw error;
    }
  }

  private async loadConfig(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);

    try {
      const config = await firstValueFrom(
        this.toolApi.getShelfConfig().pipe(
          finalize(() => this.loading.set(false))
        )
      );

      this.currentConfig.set({ ...config });
    } catch (error: unknown) {
      this.currentConfig.set({ ...DEFAULT_SHELF_CONFIG });
      this.error.set(this.extractErrorMessage(error));
    }
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

