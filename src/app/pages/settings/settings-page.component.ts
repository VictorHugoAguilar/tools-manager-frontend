import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TechnicianFormModalComponent } from '../../components/technician-form-modal.component';
import { ToolLocation } from '../../models/location.model';
import { ToolType } from '../../models/tool-type.model';
import { LocationStoreService } from '../../services/location-store.service';
import { TechnicianStoreService } from '../../services/technician-store.service';
import { ToolTypeStoreService } from '../../services/tool-type-store.service';
import { PropertiesStorageService } from '../../services/properties-storage.service';

@Component({
  selector: 'app-settings-page',
  imports: [CommonModule, ReactiveFormsModule, TechnicianFormModalComponent],
  templateUrl: './settings-page.component.html',
  styleUrl: './settings-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SettingsPageComponent {
  private readonly formBuilder = new FormBuilder();
  protected readonly locationStore = inject(LocationStoreService);
  protected readonly technicianStore = inject(TechnicianStoreService);
  protected readonly toolTypeStore = inject(ToolTypeStoreService);
  protected readonly propertiesStorage = inject(PropertiesStorageService);

  protected readonly showTechniciansAccessInMenu = signal(this.getShowTecnicosInitialValue());
  protected readonly showArreglosAccessInMenu = signal(this.getShowArreglosInitialValue());

  protected readonly compactMode = signal(false);
  protected readonly reducedAnimations = signal(false);
  protected readonly showDemoFallback = signal(true);
  protected readonly editingLocation = signal<ToolLocation | null>(null);
  protected readonly editingToolType = signal<ToolType | null>(null);
  protected readonly locations = computed(() => this.locationStore.locations());
  protected readonly toolTypes = computed(() => this.toolTypeStore.toolTypes());
  protected readonly technicians = computed(() => this.technicianStore.technicians());
  protected readonly technicianTotals = computed(() => ({
    total: this.technicianStore.technicians().length,
    active: this.technicianStore.activeTechnicians().length
  }));

  protected readonly locationForm = this.formBuilder.nonNullable.group({
    name: ['', [Validators.required]],
    description: ['']
  });
  protected readonly toolTypeForm = this.formBuilder.nonNullable.group({
    name: ['', [Validators.required]],
    description: ['']
  });

  constructor() {
    this.locationStore.ensureLoaded();
    this.technicianStore.ensureLoaded();
    this.toolTypeStore.ensureLoaded();

    effect(() => {
      this.propertiesStorage.setValueOfLocalStorageByKey('show-access-to-technicians-menu', this.showTechniciansAccessInMenu());
    });

    effect(() => {
      this.propertiesStorage.setValueOfLocalStorageByKey('show-access-to-arrangements-menu', this.showArreglosAccessInMenu());
    });
  }

  protected startCreateLocation(): void {
    this.editingLocation.set(null);
    this.locationForm.reset({
      name: '',
      description: ''
    });
  }

  protected startEditLocation(location: ToolLocation): void {
    this.editingLocation.set(location);
    this.locationForm.reset({
      name: location.name,
      description: location.description
    });
  }

  protected cancelLocationEdit(): void {
    this.startCreateLocation();
  }

  protected saveLocation(): void {
    if (this.locationForm.invalid) {
      this.locationForm.markAllAsTouched();
      return;
    }

    const editing = this.editingLocation();

    this.locationStore.saveLocation(
      this.locationForm.getRawValue(),
      editing?.id
    ).then(() => {
      this.startCreateLocation();
    }).catch(() => {
      return;
    });
  }

  protected startCreateToolType(): void {
    this.editingToolType.set(null);
    this.toolTypeForm.reset({
      name: '',
      description: ''
    });
  }

  protected startEditToolType(toolType: ToolType): void {
    this.editingToolType.set(toolType);
    this.toolTypeForm.reset({
      name: toolType.name,
      description: toolType.description
    });
  }

  protected cancelToolTypeEdit(): void {
    this.startCreateToolType();
  }

  protected saveToolType(): void {
    if (this.toolTypeForm.invalid) {
      this.toolTypeForm.markAllAsTouched();
      return;
    }

    const editing = this.editingToolType();

    this.toolTypeStore.saveToolType(
      this.toolTypeForm.getRawValue(),
      editing?.id
    ).then(() => {
      this.startCreateToolType();
    }).catch(() => {
      return;
    });
  }

  protected locationFieldError(name: 'name' | 'description'): string | null {
    const control = this.locationForm.get(name);

    if (!control || !control.invalid || !control.touched) {
      return null;
    }

    if (control.errors?.['required']) {
      return 'Este campo es obligatorio.';
    }

    return 'Valor no valido.';
  }

  protected toolTypeFieldError(name: 'name' | 'description'): string | null {
    const control = this.toolTypeForm.get(name);

    if (!control || !control.invalid || !control.touched) {
      return null;
    }

    if (control.errors?.['required']) {
      return 'Este campo es obligatorio.';
    }

    return 'Valor no valido.';
  }

  protected technicianStateLabel(active: boolean): string {
    return active ? 'Activo' : 'Inactivo';
  }

  private getShowTecnicosInitialValue(): boolean {
    return this.propertiesStorage.getValueOfLocalStorageByKey('show-access-to-technicians-menu');
  }

  private getShowArreglosInitialValue(): boolean {
    return this.propertiesStorage.getValueOfLocalStorageByKey('show-access-to-arrangements-menu');
  }

}
