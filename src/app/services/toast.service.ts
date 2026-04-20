import { Injectable, signal } from '@angular/core';

export type ToastTone = 'success' | 'info' | 'warning' | 'error';

export interface ToastItem {
  id: string;
  title: string;
  message: string;
  tone: ToastTone;
}

@Injectable({
  providedIn: 'root'
})
export class ToastService {
  readonly toasts = signal<ToastItem[]>([]);

  show(options: Omit<ToastItem, 'id'>): void {
    const toast: ToastItem = {
      id: crypto.randomUUID(),
      ...options
    };

    this.toasts.update((items) => [...items, toast]);

    setTimeout(() => {
      this.dismiss(toast.id);
    }, 3800);
  }

  dismiss(id: string): void {
    this.toasts.update((items) => items.filter((item) => item.id !== id));
  }
}

