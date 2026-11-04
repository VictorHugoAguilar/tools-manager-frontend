import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, ElementRef, inject, OnDestroy, OnInit, signal, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import {
  DrawingBackground,
  DrawingDocument,
  DrawingObject,
  DrawingPage,
  DrawingPreferences,
  DrawingShapeType,
  DrawingSnapshot,
  DrawingTool,
  normalizeDrawingSnapshot
} from '../../models/drawing.model';
import { ConfirmService } from '../../services/confirm.service';
import { DrawingApiService } from '../../services/drawing-api.service';
import { DrawingCanvasComponent } from './drawing-canvas.component';

type SaveState = 'Guardado' | 'Cambios pendientes' | 'Guardando…' | 'Error al guardar' | 'Sin conexión';

@Component({
  selector: 'app-drawing-editor-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, DrawingCanvasComponent],
  templateUrl: './drawing-editor-page.component.html',
  styleUrl: './drawing-editor-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DrawingEditorPageComponent implements OnInit, OnDestroy {
  private readonly api = inject(DrawingApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly confirm = inject(ConfirmService);
  private autoSaveTimer: ReturnType<typeof setTimeout> | null = null;
  private cameraSaveTimer: ReturnType<typeof setTimeout> | null = null;
  private savePromise: Promise<boolean> | null = null;
  private preferencesSavePromise: Promise<void> | null = null;
  private preferencesRevision = 0;
  private expectedVersion = 0;
  private editRevision = 0;
  private dirty = false;
  private documentId = '';

  @ViewChild(DrawingCanvasComponent) protected canvas?: DrawingCanvasComponent;
  @ViewChild('editorShell') private editorShell?: ElementRef<HTMLElement>;

  protected readonly document = signal<DrawingDocument | null>(null);
  protected readonly pages = signal<DrawingPage[]>([]);
  protected readonly activePageId = signal('');
  protected readonly snapshot = signal<DrawingSnapshot>({ objects: [] });
  protected readonly selectedObject = signal<DrawingObject | null>(null);
  protected readonly preferences = signal<DrawingPreferences>({
    cameraState: { x: 0, y: 0, zoom: 1 },
    gridEnabled: true,
    snapToGrid: false,
    background: 'dots'
  });
  protected readonly loading = signal(true);
  protected readonly loadingPage = signal(false);
  protected readonly saveState = signal<SaveState>('Guardado');
  protected readonly error = signal('');
  protected readonly saveError = signal('');
  protected readonly zoom = signal(100);
  protected readonly activeTool = signal<DrawingTool>('select');
  protected readonly leftPanelOpen = signal(true);
  protected readonly rightPanelOpen = signal(true);
  protected readonly historyOpen = signal(false);
  protected readonly versions = signal<Array<{ version: number; createdAt: string; contentHash: string }>>([]);
  protected readonly textDraft = signal('');
  protected readonly activeFill = signal('#f6d768');
  protected readonly availableColors = ['#f6d768', '#8edfc0', '#9fc9ff', '#ffb5c5', '#cdb4ff', '#fffdf8'];
  protected readonly canDeletePage = computed(() => this.pages().length > 1);

  ngOnInit(): void {
    this.documentId = this.route.snapshot.paramMap.get('documentId') ?? '';
    if (!this.documentId) {
      void this.router.navigate(['/dibujar']);
      return;
    }
    void this.loadDocument();
  }

  ngOnDestroy(): void {
    if (this.autoSaveTimer) clearTimeout(this.autoSaveTimer);
    if (this.cameraSaveTimer) clearTimeout(this.cameraSaveTimer);
    if (this.dirty) void this.persistSnapshot();
    if (this.activePageId()) void this.persistCameraPreferences();
  }

  protected async loadDocument(): Promise<void> {
    this.loading.set(true);
    this.error.set('');
    try {
      const { document } = await firstValueFrom(this.api.getDocument(this.documentId));
      this.document.set(document);
      this.pages.set(document.pages ?? []);
      const firstPageId = document.firstPageId && document.pages?.some((page) => page.id === document.firstPageId)
        ? document.firstPageId
        : document.pages?.[0]?.id ?? '';
      if (!firstPageId) throw new Error('La pizarra no tiene una página disponible.');
      await this.loadPage(firstPageId);
    } catch (error: unknown) {
      this.document.set(null);
      this.error.set(this.errorMessage(error));
    } finally {
      this.loading.set(false);
    }
  }

  protected async selectPage(page: DrawingPage): Promise<void> {
    if (page.id === this.activePageId() || this.loadingPage()) return;
    if (!await this.persistSnapshot()) return;
    await this.persistCameraPreferences();
    await this.loadPage(page.id);
  }

  protected onSnapshotChanged(snapshot: DrawingSnapshot): void {
    this.snapshot.set(snapshot);
    this.editRevision += 1;
    this.dirty = true;
    this.saveState.set('Cambios pendientes');
    this.scheduleAutoSave();
  }

  protected onSelectionChanged(object: DrawingObject | null): void {
    this.selectedObject.set(object);
    this.textDraft.set(object?.text ?? '');
    if (object?.fill && object.fill !== 'transparent') this.activeFill.set(object.fill);
  }

  protected onCanvasError(message: string): void {
    this.error.set(message);
  }

  protected onCameraChanged(cameraState: DrawingPreferences['cameraState']): void {
    this.preferences.update((current) => ({ ...current, cameraState }));
    this.preferencesRevision += 1;
    this.zoom.set(Math.round(cameraState.zoom * 100));
    if (this.cameraSaveTimer) clearTimeout(this.cameraSaveTimer);
    this.cameraSaveTimer = setTimeout(() => {
      this.cameraSaveTimer = null;
      void this.persistCameraPreferences();
    }, 850);
  }

  protected chooseTool(tool: DrawingTool): void {
    this.activeTool.set(tool);
    this.canvas?.setTool(tool);
  }

  protected addShape(type: DrawingShapeType): void {
    const fill = type === 'line' || type === 'arrow' ? 'transparent' : this.activeFill();
    this.canvas?.addShape(type, fill, type === 'text' ? this.textDraft() : '');
    this.activeTool.set('select');
    this.canvas?.setTool('select');
  }

  protected selectedColor(): string {
    return this.selectedObject()?.fill ?? this.activeFill();
  }

  protected setActiveFill(fill: string): void {
    if (this.selectedObject()) this.setSelectedFill(fill);
    else this.activeFill.set(fill);
  }

  protected setSelectedFill(fill: string): void {
    this.canvas?.updateSelected({ fill });
  }

  protected setSelectedStroke(stroke: string): void {
    this.canvas?.updateSelected({ stroke });
  }

  protected setSelectedStrokeWidth(value: string): void {
    const strokeWidth = Number(value);
    if (Number.isFinite(strokeWidth)) this.canvas?.updateSelected({ strokeWidth });
  }

  protected setSelectedOpacity(value: string): void {
    const opacity = Number(value);
    if (Number.isFinite(opacity)) this.canvas?.updateSelected({ opacity });
  }

  protected setFontSize(value: string | number): void {
    const fontSize = Number(value);
    if (Number.isFinite(fontSize)) this.canvas?.updateSelected({ fontSize });
  }

  protected setStrokeWidthFromEvent(event: Event): void {
    const input = event.target;
    if (input instanceof HTMLInputElement) this.setSelectedStrokeWidth(input.value);
  }

  protected setOpacityFromEvent(event: Event): void {
    const input = event.target;
    if (input instanceof HTMLInputElement) this.setSelectedOpacity(input.value);
  }

  protected setZoomFromEvent(event: Event): void {
    const input = event.target;
    if (input instanceof HTMLInputElement) this.changeZoom(input.value);
  }

  protected updateSelectedText(value: string): void {
    this.textDraft.set(value);
    this.canvas?.updateSelected({ text: value });
  }

  protected changeZoom(value: string): void {
    const zoom = Number(value);
    if (!Number.isFinite(zoom)) return;
    this.zoom.set(Math.round((this.canvas?.setZoom(zoom / 100) ?? zoom / 100) * 100));
  }

  protected setZoomBy(delta: number): void {
    const current = this.canvas?.getZoom() ?? 1;
    this.changeZoom(String(Math.round(Math.min(4, Math.max(0.1, current + delta)) * 100)));
  }

  protected centerContent(): void {
    this.canvas?.centerContent();
    this.zoom.set(Math.round((this.canvas?.getZoom() ?? 1) * 100));
  }

  protected async toggleFullscreen(): Promise<void> {
    const element = this.editorShell?.nativeElement;
    if (!element) return;
    try {
      if (window.document.fullscreenElement === element) await window.document.exitFullscreen();
      else await element.requestFullscreen();
    } catch (error: unknown) {
      this.error.set(this.errorMessage(error));
    }
  }

  protected async createPage(): Promise<void> {
    const name = window.prompt('Nombre de la nueva página', `Página ${this.pages().length + 1}`)?.trim();
    if (!name) return;
    if (!await this.persistSnapshot()) return;
    await this.persistCameraPreferences();
    try {
      const { page } = await firstValueFrom(this.api.createPage(this.documentId, name));
      this.pages.update((pages) => [...pages, page].sort((a, b) => a.position - b.position));
      await this.loadPage(page.id);
    } catch (error: unknown) {
      this.error.set(this.errorMessage(error));
    }
  }

  protected async renamePage(page: DrawingPage): Promise<void> {
    const name = window.prompt('Nombre de la página', page.name)?.trim();
    if (!name || name === page.name) return;
    try {
      const { page: updated } = await firstValueFrom(this.api.updatePage(page.id, name));
      this.pages.update((pages) => pages.map((item) => item.id === updated.id ? updated : item));
    } catch (error: unknown) {
      this.error.set(this.errorMessage(error));
    }
  }

  protected async duplicatePage(page: DrawingPage): Promise<void> {
    if (!await this.persistSnapshot()) return;
    await this.persistCameraPreferences();
    try {
      const { page: duplicate } = await firstValueFrom(this.api.duplicatePage(page.id));
      this.pages.update((pages) => [...pages, duplicate].sort((a, b) => a.position - b.position));
      await this.loadPage(duplicate.id);
    } catch (error: unknown) {
      this.error.set(this.errorMessage(error));
    }
  }

  protected async deletePage(page: DrawingPage): Promise<void> {
    if (!this.canDeletePage()) return;
    const accepted = await this.confirm.confirm({
      title: 'Eliminar página',
      message: `¿Quieres eliminar la página «${page.name}»?`,
      confirmLabel: 'Eliminar',
      tone: 'danger'
    });
    if (!accepted) return;
    if (page.id === this.activePageId() && !await this.persistSnapshot()) return;
    await this.persistCameraPreferences();
    try {
      await firstValueFrom(this.api.deletePage(page.id));
      const remaining = this.pages().filter((item) => item.id !== page.id);
      this.pages.set(remaining);
      if (page.id === this.activePageId()) await this.loadPage(remaining[0].id);
    } catch (error: unknown) {
      this.error.set(this.errorMessage(error));
    }
  }

  protected async renameDocument(): Promise<void> {
    const current = this.document();
    if (!current) return;
    const name = window.prompt('Nombre de la pizarra', current.name)?.trim();
    if (!name || name === current.name) return;
    try {
      const { document } = await firstValueFrom(this.api.updateDocument(current.id, { name }));
      this.document.set({ ...current, ...document });
    } catch (error: unknown) {
      this.error.set(this.errorMessage(error));
    }
  }

  protected async toggleGrid(): Promise<void> {
    await this.updatePreferences({ gridEnabled: !this.preferences().gridEnabled });
  }

  protected async toggleSnapToGrid(): Promise<void> {
    await this.updatePreferences({ snapToGrid: !this.preferences().snapToGrid });
  }

  protected async changeBackground(background: DrawingBackground): Promise<void> {
    await this.updatePreferences({ background });
  }

  protected async saveNow(): Promise<void> {
    await this.persistSnapshot();
  }

  protected undo(): void {
    this.canvas?.undo();
  }

  protected redo(): void {
    this.canvas?.redo();
  }

  protected async openHistory(): Promise<void> {
    const pageId = this.activePageId();
    if (!pageId) return;
    try {
      const { versions } = await firstValueFrom(this.api.getVersions(pageId));
      this.versions.set(versions);
      this.historyOpen.set(true);
    } catch (error: unknown) {
      this.error.set(this.errorMessage(error));
    }
  }

  protected async restoreVersion(version: number): Promise<void> {
    const accepted = await this.confirm.confirm({
      title: 'Restaurar versión',
      message: `Se creará una nueva versión con el contenido de la versión ${version}.`,
      confirmLabel: 'Restaurar'
    });
    if (!accepted || !await this.persistSnapshot()) return;
    try {
      const result = await firstValueFrom(this.api.restoreVersion(this.activePageId(), version));
      this.expectedVersion = result.version;
      const response = await firstValueFrom(this.api.getSnapshot(this.activePageId()));
      const restoredSnapshot = normalizeDrawingSnapshot(response.snapshot);
      if (!restoredSnapshot) throw new Error('La versión guardada no tiene un formato válido.');
      this.snapshot.set(restoredSnapshot);
      this.canvas?.loadSnapshot(restoredSnapshot);
      this.dirty = false;
      this.saveState.set('Guardado');
      this.historyOpen.set(false);
    } catch (error: unknown) {
      this.error.set(this.errorMessage(error));
    }
  }

  protected exportJson(): void {
    const current = this.document();
    if (!current) return;
    this.downloadFile(
      `${this.fileName(current.name)}.json`,
      JSON.stringify({ schemaVersion: 1, name: current.name, snapshot: this.snapshot() }, null, 2),
      'application/json'
    );
  }

  protected exportPng(): void {
    try {
      const dataUrl = this.canvas?.exportPng();
      if (!dataUrl) return;
      const link = window.document.createElement('a');
      link.href = dataUrl;
      link.download = `${this.fileName(this.document()?.name ?? 'dibujo')}.png`;
      link.click();
    } catch (error: unknown) {
      this.error.set(this.errorMessage(error));
    }
  }

  protected async importJson(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    try {
      if (file.size > 750 * 1024) throw new Error('El archivo supera el límite de 750 KB.');
      const parsed: unknown = JSON.parse(await file.text());
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('El archivo no contiene un documento válido.');
      }
      const candidate = parsed as Record<string, unknown>;
      const importedSnapshot = normalizeDrawingSnapshot(candidate['snapshot']);
      if (candidate['schemaVersion'] !== 1 || !importedSnapshot) {
        throw new Error('La versión o el contenido del archivo no es compatible.');
      }
      const accepted = await this.confirm.confirm({
        title: 'Importar contenido',
        message: 'El contenido actual de esta página será reemplazado.',
        confirmLabel: 'Importar',
        tone: 'danger'
      });
      if (!accepted || !await this.persistSnapshot()) return;
      const response = await firstValueFrom(this.api.saveSnapshot(
        this.activePageId(), this.expectedVersion, importedSnapshot
      ));
      this.expectedVersion = response.version;
      this.snapshot.set(importedSnapshot);
      this.canvas?.loadSnapshot(importedSnapshot);
      this.dirty = false;
      this.saveState.set('Guardado');
    } catch (error: unknown) {
      this.error.set(this.errorMessage(error));
    } finally {
      input.value = '';
    }
  }

  async canLeave(): Promise<boolean> {
    while (this.dirty) {
      if (!await this.persistSnapshot()) break;
    }
    if (!this.dirty) {
      await this.persistCameraPreferences();
      return true;
    }
    return this.confirm.confirm({
      title: 'Cambios sin guardar',
      message: 'No se pudieron guardar los cambios. Si sales ahora, podrías perder el trabajo reciente.',
      confirmLabel: 'Salir sin guardar',
      tone: 'danger'
    });
  }

  private async loadPage(pageId: string): Promise<void> {
    this.loadingPage.set(true);
    this.saveError.set('');
    this.error.set('');
    try {
      const [snapshotResponse, preferencesResponse] = await Promise.all([
        firstValueFrom(this.api.getSnapshot(pageId)),
        firstValueFrom(this.api.getPreferences(pageId))
      ]);
      const drawingSnapshot = normalizeDrawingSnapshot(snapshotResponse.snapshot);
      if (!drawingSnapshot) {
        throw new Error('El contenido guardado de esta página no tiene un formato válido.');
      }
      this.expectedVersion = snapshotResponse.version;
      this.snapshot.set(drawingSnapshot);
      this.preferences.set(preferencesResponse.preferences);
      this.preferencesRevision += 1;
      this.activePageId.set(pageId);
      this.selectedObject.set(null);
      this.zoom.set(Math.round(preferencesResponse.preferences.cameraState.zoom * 100));
      this.dirty = false;
      this.saveState.set('Guardado');
      this.error.set('');
    } catch (error: unknown) {
      this.error.set(this.errorMessage(error));
    } finally {
      this.loadingPage.set(false);
    }
  }

  private scheduleAutoSave(): void {
    if (this.autoSaveTimer) clearTimeout(this.autoSaveTimer);
    this.autoSaveTimer = setTimeout(() => {
      this.autoSaveTimer = null;
      void this.persistSnapshot();
    }, 850);
  }

  private async persistSnapshot(): Promise<boolean> {
    if (this.autoSaveTimer) {
      clearTimeout(this.autoSaveTimer);
      this.autoSaveTimer = null;
    }
    if (!this.dirty) return true;
    if (this.savePromise) {
      const saved = await this.savePromise;
      return saved && (this.dirty ? this.persistSnapshot() : true);
    }
    const pageId = this.activePageId();
    if (!pageId) return false;
    const revision = this.editRevision;
    const snapshot = this.snapshot();
    const expectedVersion = this.expectedVersion;
    this.saveState.set('Guardando…');
    const operation = (async () => {
      try {
        const result = await firstValueFrom(this.api.saveSnapshot(pageId, expectedVersion, snapshot));
        this.expectedVersion = result.version;
        this.saveError.set('');
        this.dirty = revision !== this.editRevision;
        this.saveState.set(this.dirty ? 'Cambios pendientes' : 'Guardado');
        if (this.dirty) this.scheduleAutoSave();
        return true;
      } catch (error: unknown) {
        this.saveState.set(error instanceof HttpErrorResponse && error.status === 0
          ? 'Sin conexión'
          : 'Error al guardar');
        this.saveError.set(this.errorMessage(error));
        return false;
      } finally {
        this.savePromise = null;
      }
    })();
    this.savePromise = operation;
    return operation;
  }

  private async updatePreferences(changes: Partial<DrawingPreferences>): Promise<void> {
    const pageId = this.activePageId();
    if (!pageId) return;
    this.preferences.update((current) => ({ ...current, ...changes }));
    this.preferencesRevision += 1;
    await this.persistPreferences(pageId);
  }

  private async persistPreferences(pageId: string): Promise<void> {
    while (this.preferencesSavePromise) await this.preferencesSavePromise;
    if (pageId !== this.activePageId()) return;
    const revision = this.preferencesRevision;
    try {
      const operation = firstValueFrom(this.api.savePreferences(pageId, this.preferences()))
        .then(({ preferences }) => {
          if (pageId === this.activePageId() && revision === this.preferencesRevision) {
            this.preferences.set(preferences);
          }
        })
        .catch((error: unknown) => {
          this.error.set(this.errorMessage(error));
        });
      this.preferencesSavePromise = operation;
      await operation;
    } catch (error: unknown) {
      this.error.set(this.errorMessage(error));
    } finally {
      this.preferencesSavePromise = null;
    }
    if (pageId === this.activePageId() && revision !== this.preferencesRevision) {
      await this.persistPreferences(pageId);
    }
  }

  private async persistCameraPreferences(): Promise<void> {
    if (this.cameraSaveTimer) {
      clearTimeout(this.cameraSaveTimer);
      this.cameraSaveTimer = null;
    }
    const pageId = this.activePageId();
    if (!pageId) return;
    await this.persistPreferences(pageId);
  }

  private downloadFile(name: string, content: string, type: string): void {
    const url = URL.createObjectURL(new Blob([content], { type }));
    const link = window.document.createElement('a');
    link.href = url;
    link.download = name;
    link.click();
    URL.revokeObjectURL(url);
  }

  private fileName(value: string): string {
    return value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-|-$/g, '').slice(0, 80) || 'dibujo';
  }

  private errorMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      const message = error.error?.message;
      if (typeof message === 'string') return message;
    }
    if (error instanceof Error) return error.message;
    return 'No se pudo completar la operación. Inténtalo de nuevo.';
  }
}
