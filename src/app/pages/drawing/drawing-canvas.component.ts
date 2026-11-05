import { AfterViewInit, ChangeDetectionStrategy, Component, ElementRef, Input, OnChanges, OnDestroy, SimpleChanges, ViewChild, output } from '@angular/core';
import {
  DrawingObject,
  DrawingPresenceUser,
  DrawingPreferences,
  DrawingShapeType,
  DrawingSnapshot,
  DrawingTool,
  normalizeDrawingSnapshot
} from '../../models/drawing.model';
import * as Y from 'yjs';
import { DrawingCanvasAdapter } from './drawing-canvas-adapter';

@Component({
  selector: 'app-drawing-canvas',
  standalone: true,
  templateUrl: './drawing-canvas.component.html',
  styleUrl: './drawing-canvas.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DrawingCanvasComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input() snapshot: DrawingSnapshot = { objects: [] };
  @Input() pageId = '';
  @Input() background: DrawingPreferences['background'] = 'dots';
  @Input() gridEnabled = true;
  @Input() snapToGrid = false;
  @Input() cameraState: DrawingPreferences['cameraState'] = { x: 0, y: 0, zoom: 1 };
  @Input() readOnly = false;
  @Input() collaborationDocument: Y.Doc | null = null;
  @Input() presenceUsers: DrawingPresenceUser[] = [];
  @ViewChild('canvasHost') private readonly canvasHost!: ElementRef<HTMLDivElement>;

  readonly snapshotChanged = output<DrawingSnapshot>();
  readonly selectionChanged = output<DrawingObject | null>();
  readonly cameraChanged = output<DrawingPreferences['cameraState']>();
  readonly cursorChanged = output<{ x: number; y: number } | null>();
  readonly canvasError = output<string>();
  private readonly adapter = new DrawingCanvasAdapter();
  private resizeObserver: ResizeObserver | null = null;
  private initialized = false;

  ngAfterViewInit(): void {
    const snapshot = normalizeDrawingSnapshot(this.snapshot);
    if (!snapshot) {
      this.canvasError.emit('El contenido de la página no tiene un formato válido.');
    }
    this.adapter.initialize(
      this.canvasHost.nativeElement,
      snapshot ?? { objects: [] },
      (snapshot) => this.snapshotChanged.emit(snapshot),
      (selection) => this.selectionChanged.emit(selection),
      this.cameraState,
      (camera) => this.cameraChanged.emit(camera),
      (cursor) => this.cursorChanged.emit(cursor)
    );
    this.adapter.setSnapToGrid(this.snapToGrid);
    this.adapter.setReadOnly(this.readOnly);
    this.adapter.setCollaborationDocument(this.collaborationDocument);
    this.adapter.setRemotePresence(this.presenceUsers);
    this.initialized = true;
    this.resizeObserver = new ResizeObserver((entries) => {
      const bounds = entries[0]?.contentRect;
      if (bounds) this.adapter.resize(bounds.width, bounds.height);
    });
    this.resizeObserver.observe(this.canvasHost.nativeElement);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['pageId'] && !changes['pageId'].firstChange && this.initialized) {
      const snapshot = normalizeDrawingSnapshot(this.snapshot);
      if (!snapshot) {
        this.canvasError.emit('El contenido de la página no tiene un formato válido.');
        return;
      }
      this.adapter.load(snapshot);
      this.adapter.setCamera(this.cameraState);
    }
    if (changes['snapToGrid'] && this.initialized) {
      this.adapter.setSnapToGrid(this.snapToGrid);
    }
    if (changes['readOnly'] && this.initialized) {
      this.adapter.setReadOnly(this.readOnly);
    }
    if (changes['collaborationDocument'] && this.initialized) {
      this.adapter.setCollaborationDocument(this.collaborationDocument);
    }
    if (changes['presenceUsers'] && this.initialized) {
      this.adapter.setRemotePresence(this.presenceUsers);
    }
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
    this.adapter.destroy();
  }

  setTool(tool: DrawingTool): void {
    this.adapter.setTool(tool);
  }

  loadSnapshot(snapshot: DrawingSnapshot): void {
    const validSnapshot = normalizeDrawingSnapshot(snapshot);
    if (!validSnapshot) {
      this.canvasError.emit('El contenido de la página no tiene un formato válido.');
      return;
    }
    this.adapter.replaceSnapshot(validSnapshot);
  }

  addShape(type: DrawingShapeType, fill?: string, text?: string): void {
    this.adapter.addShape(type, fill, text);
  }

  setZoom(zoom: number): number {
    return this.adapter.setZoom(zoom);
  }

  getZoom(): number {
    return this.adapter.getZoom();
  }

  centerContent(): void {
    this.adapter.centerContent();
  }

  undo(): void {
    this.adapter.undo();
  }

  redo(): void {
    this.adapter.redo();
  }

  get canUndo(): boolean {
    return this.adapter.canUndo;
  }

  get canRedo(): boolean {
    return this.adapter.canRedo;
  }

  updateSelected(changes: Partial<DrawingObject>): void {
    this.adapter.updateSelected(changes);
  }

  deleteSelected(): void {
    this.adapter.deleteSelected();
  }

  exportPng(): string {
    return this.adapter.exportPng();
  }

  handleKeydown(event: KeyboardEvent): void {
    if (this.readOnly) return;
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z') {
      event.preventDefault();
      if (event.shiftKey) {
        this.redo();
      } else {
        this.undo();
      }
    } else if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'y') {
      event.preventDefault();
      this.redo();
    } else if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault();
      this.deleteSelected();
    }
  }

}
