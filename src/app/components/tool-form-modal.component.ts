import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Tool, ToolFormSubmission } from '../models/tool.model';
import { LocationStoreService } from '../services/location-store.service';
import { ToolTypeStoreService } from '../services/tool-type-store.service';

@Component({
  selector: 'app-tool-form-modal',
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './tool-form-modal.component.html',
  styleUrl: './tool-form-modal.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ToolFormModalComponent {
  readonly visible = input(false);
  readonly tool = input<Tool | null>(null);
  readonly saving = input(false);
  readonly saveError = input<string | null>(null);

  readonly closed = output<void>();
  readonly submitted = output<ToolFormSubmission>();

  private readonly locationStore = inject(LocationStoreService);
  private readonly toolTypeStore = inject(ToolTypeStoreService);
  private readonly formBuilder = new FormBuilder();
  protected readonly selectedFileName = signal<string>('');
  protected readonly validationMessage = signal<string | null>(null);
  protected readonly typeOptions = computed(() => {
    const baseOptions = this.toolTypeStore.typeNames();
    const currentType = this.tool()?.type?.trim() ?? '';

    if (currentType && !baseOptions.includes(currentType)) {
      return [currentType, ...baseOptions];
    }

    return baseOptions;
  });
  protected readonly locationOptions = computed(() => {
    const baseOptions = this.locationStore.locationNames();
    const currentLocation = this.tool()?.location?.trim() ?? '';

    if (currentLocation && !baseOptions.includes(currentLocation)) {
      return [currentLocation, ...baseOptions];
    }

    return baseOptions;
  });

  protected readonly form = this.formBuilder.nonNullable.group({
    name: ['', [Validators.required]],
    type: ['', [Validators.required]],
    category: ['', [Validators.required]],
    description: ['', [Validators.required, Validators.minLength(12)]],
    urlSrc: ['', [Validators.required]],
    state: ['Disponible', [Validators.required]],
    material: ['', [Validators.required]],
    long: [0, [Validators.required, Validators.min(1)]],
    brand: ['', [Validators.required]],
    model: ['', [Validators.required]],
    serialNumber: ['', [Validators.required]],
    location: ['', [Validators.required]]
  });

  protected readonly removeCurrentImage = signal(false);

  constructor() {
    this.locationStore.ensureLoaded();
    this.toolTypeStore.ensureLoaded();

    effect(() => {
      const currentTool = this.tool();

      if (!this.visible()) {
        return;
      }

      if (currentTool) {
        this.form.reset({
          name: currentTool.name,
          type: currentTool.type,
          category: currentTool.category,
          description: currentTool.description,
          urlSrc: currentTool.urlSrc,
          state: currentTool.state,
          material: currentTool.material,
          long: currentTool.long,
          brand: currentTool.brand,
          model: currentTool.model,
          serialNumber: currentTool.serialNumber,
          location: currentTool.location
        });
      } else {
        this.form.reset({
          name: '',
          type: '',
          category: '',
          description: '',
          urlSrc: 'assets/tool-generic.svg',
          state: 'Disponible',
          material: '',
          long: 20,
          brand: '',
          model: '',
          serialNumber: '',
          location: ''
        });
      }

      this.selectedFileName.set('');
      this.removeCurrentImage.set(false);
      this.validationMessage.set(null);
    });

    effect(() => {
      if (!this.visible()) {
        return;
      }

      const currentLocation = this.form.getRawValue().location;
      const options = this.locationOptions();

      if (!currentLocation && options.length > 0) {
        this.form.patchValue({ location: options[0] }, { emitEvent: false });
      }
    });

    effect(() => {
      if (!this.visible()) {
        return;
      }

      const currentType = this.form.getRawValue().type;
      const options = this.typeOptions();

      if (!currentType && options.length > 0) {
        this.form.patchValue({ type: options[0] }, { emitEvent: false });
      }
    });
  }

  protected onFileSelected(event: Event): void {
    const inputElement = event.target as HTMLInputElement;
    const file = inputElement.files?.[0] ?? null;

    this.selectedFileName.set(file?.name ?? '');
  }

  protected toggleRemoveImage(): void {
    this.removeCurrentImage.update((value) => !value);
  }

  protected submit(formElement: HTMLFormElement): void {
    this.validationMessage.set(null);

    if (this.form.getRawValue()['urlSrc'].trim() === '') {
      this.form.get('urlSrc')?.setValue('assets/tool-generic.svg');
    }

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.validationMessage.set(this.getFirstValidationError());
      return;
    }

    const fileInput = formElement.querySelector('input[type="file"]') as HTMLInputElement | null;
    const file = fileInput?.files?.[0] ?? null;

    this.submitted.emit({
      payload: this.form.getRawValue(),
      file,
      removeCurrentImage: this.removeCurrentImage(),
      mode: this.tool() ? 'edit' : 'create'
    });
  }

  protected fieldError(name: keyof ReturnType<typeof this.form.getRawValue>): string | null {
    const control = this.form.get(name);

    if (!control || !control.invalid || !control.touched) {
      return null;
    }

    if (control.errors?.['required']) {
      return 'Este campo es obligatorio.';
    }

    if (control.errors?.['minlength']) {
      return `Debe tener al menos ${control.errors['minlength'].requiredLength} caracteres.`;
    }

    if (control.errors?.['min']) {
      return `Debe ser mayor o igual que ${control.errors['min'].min}.`;
    }

    return 'Valor no valido.';
  }

  private getFirstValidationError(): string {
    const fields: Array<keyof ReturnType<typeof this.form.getRawValue>> = [
      'name',
      'type',
      'category',
      'description',
      'urlSrc',
      'state',
      'material',
      'long',
      'brand',
      'model',
      'serialNumber',
      'location'
    ];

    for (const field of fields) {
      const error = this.fieldError(field);

      if (error) {
        return `${this.getFieldLabel(field)}: ${error}`;
      }
    }

    return 'Revisa los campos obligatorios antes de continuar.';
  }

  private getFieldLabel(field: keyof ReturnType<typeof this.form.getRawValue>): string {
    const labels: Record<keyof ReturnType<typeof this.form.getRawValue>, string> = {
      name: 'Nombre',
      type: 'Tipo',
      category: 'Categoria',
      description: 'Descripcion',
      urlSrc: 'URL de imagen',
      state: 'Estado',
      material: 'Material',
      long: 'Longitud',
      brand: 'Marca',
      model: 'Modelo',
      serialNumber: 'Numero de serie',
      location: 'Ubicacion'
    };

    return labels[field];
  }
}
