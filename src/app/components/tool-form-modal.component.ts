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
import { Tool, ToolFormSubmission } from '../models/tool.model';

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

  readonly closed = output<void>();
  readonly submitted = output<ToolFormSubmission>();

  private readonly formBuilder = new FormBuilder();
  protected readonly selectedFileName = signal<string>('');

  protected readonly form = this.formBuilder.nonNullable.group({
    name: ['', [Validators.required]],
    type: ['', [Validators.required]],
    category: ['', [Validators.required]],
    description: ['', [Validators.required, Validators.minLength(12)]],
    urlSrc: ['', [Validators.required]],
    state: ['Disponible', [Validators.required]],
    material: ['', [Validators.required]],
    long: [0, [Validators.required, Validators.min(1)]]
  });

  protected readonly removeCurrentImage = signal(false);

  constructor() {
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
          long: currentTool.long
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
          long: 20
        });
      }

      this.selectedFileName.set('');
      this.removeCurrentImage.set(false);
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
    if (this.form.invalid) {
      this.form.markAllAsTouched();
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
}

