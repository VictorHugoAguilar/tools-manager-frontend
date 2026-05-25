import { ChangeDetectionStrategy, Component, HostListener, OnDestroy, computed, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { map } from 'rxjs';
import { toSignal } from '@angular/core/rxjs-interop';
import * as QRCode from 'qrcode';
import { StorageBox, StorageBoxProduct, StorageProductState } from '../../models/storage-box.model';
import { StorageBoxStoreService } from '../../services/storage-box-store.service';

@Component({
  selector: 'app-storage-page',
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './storage-page.component.html',
  styleUrl: './storage-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class StoragePageComponent implements OnDestroy {
  protected readonly store = inject(StorageBoxStoreService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly formBuilder = inject(FormBuilder);

  protected readonly defaultImage = 'assets/no-image.svg';
  protected readonly qrCodes = signal<Record<string, string>>({});
  protected readonly productStates: StorageProductState[] = ['Nuevo', 'Usado'];
  protected readonly selectedBoxImageFile = signal<File | null>(null);
  protected readonly selectedProductImageFile = signal<File | null>(null);
  protected readonly boxImagePreview = signal<string>(this.defaultImage);
  protected readonly productImagePreview = signal<string>(this.defaultImage);
  protected readonly qrPreview = signal<{ image: string; code: string; name: string } | null>(null);
  protected readonly imagePreview = signal<{ image: string; code: string; name: string } | null>(null);

  protected readonly boxIdFromRoute = toSignal(
    this.route.paramMap.pipe(map((params) => params.get('boxId'))),
    { initialValue: null }
  );

  protected readonly expandedBox = computed(() =>
    this.store.boxes().find((box) => box.id === this.boxIdFromRoute()) ?? null
  );

  protected readonly boxForm = this.formBuilder.nonNullable.group({
    code: [''],
    name: ['', [Validators.required, Validators.maxLength(120)]],
    description: ['', [Validators.required, Validators.maxLength(400)]]
  });

  protected readonly productForm = this.formBuilder.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(120)]],
    description: ['', [Validators.required, Validators.maxLength(300)]],
    quantity: [1, [Validators.required, Validators.min(0)]],
    state: ['Nuevo' as StorageProductState, Validators.required]
  });

  constructor() {
    this.store.ensureLoaded();

    effect(() => {
      const boxes = this.store.boxes();

      boxes.forEach((box) => {
        if (this.qrCodes()[box.id]) {
          return;
        }

        void this.generateQrCode(box.id);
      });
    }, { allowSignalWrites: true });

    effect(() => {
      const editingBox = this.store.editingBox();

      if (!this.store.boxModalOpen()) {
        this.selectedBoxImageFile.set(null);
        this.setPreview(this.boxImagePreview, this.defaultImage);
        this.boxForm.reset({
          code: '',
          name: '',
          description: ''
        });
        return;
      }

      if (editingBox) {
        this.selectedBoxImageFile.set(null);
        this.setPreview(this.boxImagePreview, this.getBoxImage(editingBox));
        this.boxForm.reset({
          code: editingBox.code,
          name: editingBox.name,
          description: editingBox.description
        });
        return;
      }

      this.selectedBoxImageFile.set(null);
      this.setPreview(this.boxImagePreview, this.defaultImage);
      this.boxForm.reset({
        code: '',
        name: '',
        description: ''
      });
    }, { allowSignalWrites: true });

    effect(() => {
      const editingProduct = this.store.editingProduct();

      if (!this.store.productModalOpen()) {
        this.selectedProductImageFile.set(null);
        this.setPreview(this.productImagePreview, this.defaultImage);
        this.productForm.reset({
          name: '',
          description: '',
          quantity: 1,
          state: 'Nuevo'
        });
        return;
      }

      if (editingProduct) {
        this.selectedProductImageFile.set(null);
        this.setPreview(this.productImagePreview, this.getProductImage(editingProduct));
        this.productForm.reset({
          name: editingProduct.name,
          description: editingProduct.description,
          quantity: editingProduct.quantity,
          state: editingProduct.state
        });
        return;
      }

      this.selectedProductImageFile.set(null);
      this.setPreview(this.productImagePreview, this.defaultImage);
      this.productForm.reset({
        name: '',
        description: '',
        quantity: 1,
        state: 'Nuevo'
      });
    }, { allowSignalWrites: true });

    effect(() => {
      const activeBoxId = this.boxIdFromRoute();
      const hasMatchingBox = this.store.boxes().some((box) => box.id === activeBoxId);

      if (!activeBoxId || this.store.loading() || hasMatchingBox) {
        return;
      }

      void this.closeExpandedBox();
    });
  }

  @HostListener('document:keydown.escape')
  protected handleEscape(): void {
    if (this.store.productModalOpen()) {
      this.store.closeProductModal();
      return;
    }

    if (this.imagePreview()) {
      this.closeImagePreview();
      return;
    }

    if (this.qrPreview()) {
      this.closeQrPreview();
      return;
    }

    if (this.store.boxModalOpen()) {
      this.store.closeBoxModal();
      return;
    }

    if (this.expandedBox()) {
      void this.closeExpandedBox();
    }
  }

  protected openCreateBoxModal(): void {
    this.store.openCreateBoxModal();
  }

  protected openEditBoxModal(box: StorageBox, event?: Event): void {
    event?.stopPropagation();
    this.store.openEditBoxModal(box);
  }

  protected async submitBox(): Promise<void> {
    if (this.boxForm.invalid) {
      this.boxForm.markAllAsTouched();
      return;
    }

    const raw = this.boxForm.getRawValue();
    const payload = {
      ...(raw.code.trim() ? { code: raw.code.trim() } : {}),
      name: raw.name.trim(),
      description: raw.description.trim(),
      imageUrl: this.store.editingBox()?.imageUrl ?? ''
    };

    const savedBox = await this.store.saveBox(payload, this.selectedBoxImageFile());
    void this.router.navigate(['/almacenamiento', savedBox.id]);
  }

  protected async openBox(box: StorageBox): Promise<void> {
    await this.router.navigate(['/almacenamiento', box.id]);
  }

  protected async closeExpandedBox(): Promise<void> {
    await this.router.navigate(['/almacenamiento']);
  }

  protected openCreateProductModal(box: StorageBox, event?: Event): void {
    event?.stopPropagation();
    this.store.openCreateProductModal(box);
  }

  protected openEditProductModal(box: StorageBox, product: StorageBoxProduct, event?: Event): void {
    event?.stopPropagation();
    this.store.openEditProductModal(box, product);
  }

  protected async submitProduct(): Promise<void> {
    if (this.productForm.invalid) {
      this.productForm.markAllAsTouched();
      return;
    }

    const raw = this.productForm.getRawValue();
    await this.store.saveProduct({
      name: raw.name.trim(),
      description: raw.description.trim(),
      imageUrl: this.store.editingProduct()?.imageUrl ?? '',
      quantity: Number(raw.quantity),
      state: raw.state
    }, this.selectedProductImageFile());
  }

  protected deleteBox(box: StorageBox, event?: Event): void {
    event?.stopPropagation();
    this.store.deleteBox(box);
  }

  protected deleteProduct(box: StorageBox, product: StorageBoxProduct, event?: Event): void {
    event?.stopPropagation();
    this.store.deleteProduct(box, product);
  }

  protected getProductImage(product: StorageBoxProduct): string {
    return product.imageUrl?.trim() ? product.imageUrl : this.defaultImage;
  }

  protected getBoxImage(box: StorageBox): string {
    return box.imageUrl?.trim() ? box.imageUrl : this.defaultImage;
  }

  protected qrCodeFor(boxId: string): string {
    return this.qrCodes()[boxId] || this.defaultImage;
  }

  protected openQrPreview(box: StorageBox, event?: Event): void {
    event?.stopPropagation();
    this.qrPreview.set({
      image: this.qrCodeFor(box.id),
      code: box.code,
      name: box.name
    });
  }

  protected openImagePreview(box: StorageBox, event?: Event): void {
    event?.stopPropagation();
    this.imagePreview.set({
      image: this.getBoxImage(box),
      code: box.code,
      name: box.name
    });
  }

  protected closeQrPreview(): void {
    this.qrPreview.set(null);
  }

  protected closeImagePreview(): void {
    this.imagePreview.set(null);
  }

  protected downloadQrPreview(): void {
    const preview = this.qrPreview();

    if (!preview) {
      return;
    }

    const link = document.createElement('a');
    link.href = preview.image;
    link.download = `${preview.code.toLowerCase()}-qr.png`;
    link.click();
  }

  protected printQrPreview(): void {
    const preview = this.qrPreview();

    if (!preview || typeof window === 'undefined') {
      return;
    }

    const printWindow = window.open('', '_blank', 'width=720,height=840');

    if (!printWindow) {
      return;
    }

    const documentTitle = `QR ${preview.code}`;
    printWindow.document.open();
    printWindow.document.write(`
      <!doctype html>
      <html lang="es">
        <head>
          <meta charset="utf-8">
          <title>${documentTitle}</title>
          <style>
            body {
              margin: 0;
              min-height: 100vh;
              display: grid;
              place-items: center;
              background: #f7f3ea;
              color: #23345a;
              font-family: Arial, sans-serif;
            }
            main {
              width: min(88vw, 520px);
              padding: 32px;
              border: 3px solid #23345a;
              border-radius: 28px;
              background: #fffdf8;
              text-align: center;
            }
            h1 {
              margin: 0 0 24px;
              font-size: 28px;
            }
            .box-name {
              margin: -12px 0 24px;
              color: rgba(35, 52, 90, 0.78);
              font-size: 18px;
              font-weight: 700;
            }
            img {
              width: min(100%, 360px);
              aspect-ratio: 1;
              object-fit: contain;
              padding: 14px;
              border: 3px solid #23345a;
              border-radius: 24px;
              background: #ffffff;
            }
            p {
              margin: 18px 0 0;
              font-size: 16px;
              font-weight: 700;
            }
            @media print {
              body {
                background: #ffffff;
              }
              main {
                box-shadow: none;
              }
            }
          </style>
        </head>
        <body>
          <main>
            <h1>${preview.code}</h1>
            <p class="box-name">${preview.name}</p>
            <img src="${preview.image}" alt="QR de ${preview.code}">
            <p>Escanea este codigo para abrir la caja.</p>
          </main>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.onload = () => {
      printWindow.print();
    };
  }

  protected onBoxImageSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    this.selectedBoxImageFile.set(file);
    this.setPreview(this.boxImagePreview, file ? URL.createObjectURL(file) : this.store.editingBox() ? this.getBoxImage(this.store.editingBox()!) : this.defaultImage);
    input.value = '';
  }

  protected onProductImageSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    this.selectedProductImageFile.set(file);
    this.setPreview(this.productImagePreview, file ? URL.createObjectURL(file) : this.store.editingProduct() ? this.getProductImage(this.store.editingProduct()!) : this.defaultImage);
    input.value = '';
  }

  ngOnDestroy(): void {
    this.revokePreviewIfNeeded(this.boxImagePreview());
    this.revokePreviewIfNeeded(this.productImagePreview());
  }

  protected countProductsByState(box: StorageBox, state: StorageProductState): number {
    return box.products.filter((product) => product.state === state).length;
  }

  protected boxFieldError(fieldName: 'name' | 'description'): string | null {
    const control = this.boxForm.controls[fieldName];

    if (!control.touched || !control.invalid) {
      return null;
    }

    if (control.hasError('required')) {
      return 'Este campo es obligatorio.';
    }

    if (control.hasError('maxlength')) {
      return 'Has superado la longitud permitida.';
    }

    return 'Revisa este campo.';
  }

  protected productFieldError(fieldName: 'name' | 'description' | 'quantity'): string | null {
    const control = this.productForm.controls[fieldName];

    if (!control.touched || !control.invalid) {
      return null;
    }

    if (control.hasError('required')) {
      return 'Este campo es obligatorio.';
    }

    if (control.hasError('maxlength')) {
      return 'Has superado la longitud permitida.';
    }

    if (control.hasError('min')) {
      return 'La cantidad no puede ser negativa.';
    }

    return 'Revisa este campo.';
  }

  private async generateQrCode(boxId: string): Promise<void> {
    try {
      const qrCode = await QRCode.toDataURL(this.buildBoxUrl(boxId), {
        width: 240,
        margin: 1,
        color: {
          dark: '#23345a',
          light: '#0000'
        }
      });

      this.qrCodes.update((current) => ({
        ...current,
        [boxId]: qrCode
      }));
    } catch {
      this.qrCodes.update((current) => ({
        ...current,
        [boxId]: this.defaultImage
      }));
    }
  }

  private buildBoxUrl(boxId: string): string {
    if (typeof window === 'undefined') {
      return `/almacenamiento/${boxId}`;
    }

    return new URL(`/almacenamiento/${boxId}`, window.location.origin).toString();
  }

  private setPreview(target: typeof this.boxImagePreview, nextValue: string): void {
    this.revokePreviewIfNeeded(target());
    target.set(nextValue);
  }

  private revokePreviewIfNeeded(value: string): void {
    if (value.startsWith('blob:')) {
      URL.revokeObjectURL(value);
    }
  }
}
