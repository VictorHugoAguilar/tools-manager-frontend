import {
  ChangeDetectionStrategy,
  Component,
  effect,
  input,
  output,
  signal
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Technician, TechnicianFormSubmission } from '../models/repair.model';

@Component({
  selector: 'app-technician-form-modal',
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './technician-form-modal.component.html',
  styleUrl: './technician-form-modal.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TechnicianFormModalComponent {
  readonly visible = input(false);
  readonly technician = input<Technician | null>(null);
  readonly saving = input(false);
  readonly saveError = input<string | null>(null);

  readonly closed = output<void>();
  readonly submitted = output<TechnicianFormSubmission>();

  private readonly formBuilder = new FormBuilder();
  protected readonly validationMessage = signal<string | null>(null);

  protected readonly form = this.formBuilder.nonNullable.group({
    name: ['', [Validators.required]],
    specialty: ['', [Validators.required]],
    phone: [''],
    email: ['', [Validators.email]],
    notes: [''],
    active: [true, [Validators.required]]
  });

  constructor() {
    effect(() => {
      if (!this.visible()) {
        return;
      }

      const currentTechnician = this.technician();

      if (currentTechnician) {
        this.form.reset({
          name: currentTechnician.name,
          specialty: currentTechnician.specialty,
          phone: currentTechnician.phone,
          email: currentTechnician.email,
          notes: currentTechnician.notes,
          active: currentTechnician.active
        });
      } else {
        this.form.reset({
          name: '',
          specialty: '',
          phone: '',
          email: '',
          notes: '',
          active: true
        });
      }

      this.validationMessage.set(null);
    });
  }

  protected submit(): void {
    this.validationMessage.set(null);

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.validationMessage.set(this.getFirstValidationError());
      return;
    }

    this.submitted.emit({
      payload: this.form.getRawValue(),
      mode: this.technician() ? 'edit' : 'create'
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

    if (control.errors?.['email']) {
      return 'Introduce un correo valido.';
    }

    return 'Valor no valido.';
  }

  private getFirstValidationError(): string {
    const fields: Array<keyof ReturnType<typeof this.form.getRawValue>> = [
      'name',
      'specialty',
      'email'
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
      specialty: 'Especialidad',
      phone: 'Telefono',
      email: 'Correo',
      notes: 'Notas',
      active: 'Estado'
    };

    return labels[field];
  }
}
