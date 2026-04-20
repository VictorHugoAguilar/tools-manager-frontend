import { Injectable, signal } from '@angular/core';

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'danger' | 'primary';
}

export interface ConfirmState extends Required<ConfirmOptions> {
  visible: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class ConfirmService {
  readonly state = signal<ConfirmState>({
    visible: false,
    title: '',
    message: '',
    confirmLabel: 'Confirmar',
    cancelLabel: 'Cancelar',
    tone: 'primary'
  });

  private resolver: ((value: boolean) => void) | null = null;

  confirm(options: ConfirmOptions): Promise<boolean> {
    return new Promise((resolve) => {
      this.resolver = resolve;
      this.state.set({
        visible: true,
        title: options.title,
        message: options.message,
        confirmLabel: options.confirmLabel ?? 'Confirmar',
        cancelLabel: options.cancelLabel ?? 'Cancelar',
        tone: options.tone ?? 'primary'
      });
    });
  }

  resolve(value: boolean): void {
    this.resolver?.(value);
    this.resolver = null;
    this.state.update((current) => ({
      ...current,
      visible: false
    }));
  }
}

