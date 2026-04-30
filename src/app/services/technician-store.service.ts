import { HttpErrorResponse } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { finalize } from 'rxjs';
import { Technician, TechnicianFormSubmission } from '../models/repair.model';
import { ConfirmService } from './confirm.service';
import { ToastService } from './toast.service';
import { ToolApiService } from './tool-api.service';

@Injectable({
  providedIn: 'root'
})
export class TechnicianStoreService {
  private readonly toolApi = inject(ToolApiService);
  private readonly toastService = inject(ToastService);
  private readonly confirmService = inject(ConfirmService);

  readonly technicians = signal<Technician[]>([]);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly modalOpen = signal(false);
  readonly editingTechnician = signal<Technician | null>(null);
  readonly saveError = signal<string | null>(null);

  private initialized = false;

  readonly activeTechnicians = computed(() =>
    this.technicians().filter((technician) => technician.active)
  );

  ensureLoaded(): void {
    if (this.initialized) {
      return;
    }

    this.initialized = true;
    this.loadTechnicians();
  }

  reload(): void {
    this.loadTechnicians();
  }

  openCreateModal(): void {
    this.saveError.set(null);
    this.editingTechnician.set(null);
    this.modalOpen.set(true);
  }

  openEditModal(technician: Technician): void {
    this.saveError.set(null);
    this.editingTechnician.set(technician);
    this.modalOpen.set(true);
  }

  closeModal(): void {
    this.saveError.set(null);
    this.editingTechnician.set(null);
    this.modalOpen.set(false);
  }

  saveTechnician(submission: TechnicianFormSubmission): void {
    this.saveError.set(null);
    this.saving.set(true);

    const currentEditing = this.editingTechnician();
    const request$ = submission.mode === 'edit' && currentEditing
      ? this.toolApi.updateTechnician(currentEditing.id, submission.payload)
      : this.toolApi.createTechnician(submission.payload);

    request$
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: (technician) => {
          const nextTechnicians = submission.mode === 'edit'
            ? this.technicians().map((item) => item.id === technician.id ? technician : item)
            : [...this.technicians(), technician];

          this.technicians.set(
            [...nextTechnicians].sort((left, right) => left.name.localeCompare(right.name, 'es'))
          );
          this.saveError.set(null);
          this.toastService.show({
            title: submission.mode === 'edit' ? 'Tecnico actualizado' : 'Tecnico creado',
            message: `${technician.name} se guardo correctamente.`,
            tone: 'success'
          });
          this.closeModal();
        },
        error: (error: unknown) => {
          const message = this.extractErrorMessage(error);
          this.saveError.set(message);
          this.toastService.show({
            title: 'No se pudo guardar el tecnico',
            message,
            tone: 'error'
          });
        }
      });
  }

  deleteTechnician(technician: Technician): void {
    this.confirmService.confirm({
      title: 'Eliminar tecnico',
      message: `¿Deseas eliminar a "${technician.name}"? Los historicos ya guardados conservaran su nombre, pero no podra volver a seleccionarse.`,
      confirmLabel: 'Eliminar',
      tone: 'danger'
    }).then((confirmed) => {
      if (!confirmed) {
        return;
      }

      this.toolApi.deleteTechnician(technician.id).subscribe({
        next: () => {
          this.technicians.set(this.technicians().filter((item) => item.id !== technician.id));
          this.toastService.show({
            title: 'Tecnico eliminado',
            message: `${technician.name} se elimino correctamente.`,
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

  private loadTechnicians(): void {
    this.loading.set(true);

    this.toolApi.getTechnicians()
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (technicians) => {
          this.technicians.set(
            [...technicians].sort((left, right) => left.name.localeCompare(right.name, 'es'))
          );
        },
        error: (error: unknown) => {
          this.toastService.show({
            title: 'No se pudieron cargar los tecnicos',
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
