import Konva from 'konva';
import * as Y from 'yjs';
import {
  DrawingObject,
  DrawingPresenceUser,
  DrawingShapeType,
  DrawingSnapshot,
  DrawingTool
} from '../../models/drawing.model';

type SnapshotListener = (snapshot: DrawingSnapshot) => void;
type SelectionListener = (object: DrawingObject | null) => void;
interface CameraState {
  x: number;
  y: number;
  zoom: number;
}
type CameraListener = (camera: CameraState) => void;
type CursorListener = (cursor: { x: number; y: number } | null) => void;

const DEFAULT_STROKE = '#23345a';
const DEFAULT_FILL = '#f6d768';

function objectFromSharedFields(id: string, fields: Y.Map<unknown>): DrawingObject | null {
  const typeValue = fields.get('type');
  let type: DrawingShapeType;
  switch (typeValue) {
    case 'rect':
    case 'ellipse':
    case 'diamond':
    case 'line':
    case 'arrow':
    case 'text':
    case 'freehand':
      type = typeValue;
      break;
    default:
      return null;
  }
  const x = fields.get('x');
  const y = fields.get('y');
  if (typeof x !== 'number' || !Number.isFinite(x) ||
      typeof y !== 'number' || !Number.isFinite(y)) return null;
  const object: DrawingObject = { id, type, x, y };
  const width = fields.get('width');
  const height = fields.get('height');
  const strokeWidth = fields.get('strokeWidth');
  const fontSize = fields.get('fontSize');
  const rotation = fields.get('rotation');
  const opacity = fields.get('opacity');
  if (typeof width === 'number') object.width = width;
  if (typeof height === 'number') object.height = height;
  if (typeof strokeWidth === 'number') object.strokeWidth = strokeWidth;
  if (typeof fontSize === 'number') object.fontSize = fontSize;
  if (typeof rotation === 'number') object.rotation = rotation;
  if (typeof opacity === 'number') object.opacity = opacity;
  const fill = fields.get('fill');
  const stroke = fields.get('stroke');
  const text = fields.get('text');
  const points = fields.get('points');
  if (typeof fill === 'string') object.fill = fill;
  if (typeof stroke === 'string') object.stroke = stroke;
  if (typeof text === 'string') object.text = text;
  if (Array.isArray(points) && points.every((point) => typeof point === 'number')) {
    object.points = points;
  }
  return object;
}

export class DrawingCanvasAdapter {
  private stage: Konva.Stage | null = null;
  private layer: Konva.Layer | null = null;
  private presenceLayer: Konva.Layer | null = null;
  private transformer: Konva.Transformer | null = null;
  private sharedDocument: Y.Doc | null = null;
  private sharedObjects: Y.Map<Y.Map<unknown>> | null = null;
  private undoManager: Y.UndoManager | null = null;
  private tool: DrawingTool = 'select';
  private activeStroke: Konva.Line | null = null;
  private history: DrawingSnapshot[] = [];
  private redoHistory: DrawingSnapshot[] = [];
  private selectedId: string | null = null;
  private restoring = false;
  private snapshotListener: SnapshotListener | null = null;
  private selectionListener: SelectionListener | null = null;
  private cameraListener: CameraListener | null = null;
  private cursorListener: CursorListener | null = null;
  private snapToGrid = false;
  private readOnly = false;
  private applyingLocalChanges = false;
  private lastCursorUpdate = 0;
  private remotePresence: DrawingPresenceUser[] = [];

  private readonly handleSharedObjectsChanged = (): void => {
    if (this.applyingLocalChanges || !this.sharedObjects) return;
    this.load({
      objects: [...this.sharedObjects.entries()].flatMap(([id, fields]) => {
        const object = objectFromSharedFields(id, fields);
        return object ? [object] : [];
      })
    });
  };

  initialize(
    container: HTMLDivElement,
    snapshot: DrawingSnapshot,
    onSnapshot: SnapshotListener,
    onSelection: SelectionListener,
    camera: CameraState,
    onCamera: CameraListener,
    onCursor: CursorListener
  ): void {
    this.destroy();
    this.snapshotListener = onSnapshot;
    this.selectionListener = onSelection;
    this.cameraListener = onCamera;
    this.cursorListener = onCursor;
    this.stage = new Konva.Stage({
      container,
      width: Math.max(container.clientWidth, 1),
      height: Math.max(container.clientHeight, 1),
      draggable: false,
      x: camera.x,
      y: camera.y,
      scale: { x: camera.zoom, y: camera.zoom }
    });
    this.layer = new Konva.Layer();
    this.stage.add(this.layer);
    this.presenceLayer = new Konva.Layer({ listening: false });
    this.stage.add(this.presenceLayer);
    this.load(snapshot);
    this.stage.on('click tap', this.handleStageClick);
    this.stage.on('mousedown touchstart', this.startFreehand);
    this.stage.on('mousemove touchmove', this.updateFreehand);
    this.stage.on('mouseup touchend', this.finishFreehand);
    this.stage.on('dragend', this.emitCamera);
    this.stage.on('wheel', this.handleWheel);
    this.stage.on('mousemove touchmove', this.updatePointer);
    this.stage.on('mouseleave touchend', this.clearPointer);
  }

  setCollaborationDocument(document: Y.Doc | null): void {
    if (this.sharedObjects) this.sharedObjects.unobserveDeep(this.handleSharedObjectsChanged);
    this.undoManager?.destroy();
    this.sharedDocument = document;
    this.sharedObjects = document?.getMap<Y.Map<unknown>>('objects') ?? null;
    this.undoManager = this.sharedObjects
      ? new Y.UndoManager(this.sharedObjects, { trackedOrigins: new Set([this]) })
      : null;
    if (!this.sharedObjects) return;
    if (this.sharedObjects.size === 0) {
      if (!this.readOnly) this.writeSnapshotToSharedObjects(this.getSnapshot(), 'drawing-initial');
    } else {
      this.handleSharedObjectsChanged();
    }
    this.sharedObjects.observeDeep(this.handleSharedObjectsChanged);
  }

  setReadOnly(readOnly: boolean): void {
    this.readOnly = readOnly;
    if (readOnly && this.tool !== 'hand') this.tool = 'select';
    this.applyTool();
  }

  setRemotePresence(users: DrawingPresenceUser[]): void {
    this.remotePresence = users;
    this.renderRemotePresence();
  }

  resize(width: number, height: number): void {
    if (!this.stage) return;
    this.stage.size({ width: Math.max(width, 1), height: Math.max(height, 1) });
    this.stage.batchDraw();
  }

  load(snapshot: DrawingSnapshot): void {
    if (!this.layer) return;
    this.restoring = true;
    this.layer.destroyChildren();
    this.selectedId = null;
    for (const object of snapshot.objects) this.layer.add(this.createNode(object));
    this.createTransformer();
    this.applyTool();
    this.layer.batchDraw();
    this.restoring = false;
    this.selectionListener?.(null);
    this.renderRemotePresence();
  }

  replaceSnapshot(snapshot: DrawingSnapshot): void {
    if (this.readOnly) return;
    this.load(snapshot);
    this.emitSnapshot();
  }

  getSnapshot(): DrawingSnapshot {
    return {
      objects: this.layer
        ? this.layer.getChildren((node) => node.getAttr('drawingType') !== 'transformer')
          .map((node) => this.nodeToObject(node))
        : []
    };
  }

  addShape(type: DrawingShapeType, fill = DEFAULT_FILL, text = ''): void {
    if (this.readOnly || !this.stage || !this.layer) return;
    this.recordUndo();
    const center = this.stage.getPointerPosition() ?? {
      x: this.stage.width() / 2,
      y: this.stage.height() / 2
    };
    const world = {
      x: (center.x - this.stage.x()) / this.stage.scaleX(),
      y: (center.y - this.stage.y()) / this.stage.scaleY()
    };
    const object: DrawingObject = {
      id: crypto.randomUUID(),
      type,
      x: world.x - 60,
      y: world.y - 40,
      width: type === 'line' || type === 'arrow' ? 120 : 120,
      height: type === 'line' || type === 'arrow' ? 0 : 80,
      fill,
      stroke: DEFAULT_STROKE,
      strokeWidth: 2,
      ...(type === 'text' ? { text: text || 'Texto', fontSize: 24 } : {})
    };
    const node = this.createNode(object);
    this.layer.add(node);
    this.applyTool();
    if (this.tool === 'select') this.selectNode(node);
    this.layer.batchDraw();
    this.emitSnapshot();
  }

  setTool(tool: DrawingTool): void {
    this.tool = this.readOnly && tool !== 'hand' ? 'select' : tool;
    this.activeStroke = null;
    this.applyTool();
  }

  setZoom(zoom: number): number {
    if (!this.stage) return 1;
    const nextZoom = Math.min(4, Math.max(0.1, zoom));
    const center = { x: this.stage.width() / 2, y: this.stage.height() / 2 };
    const worldCenter = {
      x: (center.x - this.stage.x()) / this.stage.scaleX(),
      y: (center.y - this.stage.y()) / this.stage.scaleY()
    };
    this.stage.scale({ x: nextZoom, y: nextZoom });
    this.stage.position({
      x: center.x - worldCenter.x * nextZoom,
      y: center.y - worldCenter.y * nextZoom
    });
    this.stage.batchDraw();
    this.emitCamera();
    return nextZoom;
  }

  setCamera(camera: CameraState): void {
    if (!this.stage) return;
    this.stage.position({ x: camera.x, y: camera.y });
    this.stage.scale({ x: camera.zoom, y: camera.zoom });
    this.stage.batchDraw();
  }

  setSnapToGrid(enabled: boolean): void {
    this.snapToGrid = enabled;
  }

  getZoom(): number {
    return this.stage?.scaleX() ?? 1;
  }

  centerContent(): void {
    if (!this.stage || !this.layer) return;
    const objects = this.getSnapshot().objects;
    if (!objects.length) {
      this.stage.position({ x: 0, y: 0 });
      this.stage.batchDraw();
      this.emitCamera();
      return;
    }
    const rectangles = objects.map((object) => {
      const points = object.type === 'freehand' ? object.points ?? [] : [];
      const pointXs = points.filter((_point, index) => index % 2 === 0);
      const pointYs = points.filter((_point, index) => index % 2 === 1);
      const x = object.type === 'freehand' && pointXs.length
        ? object.x + Math.min(...pointXs)
        : object.x;
      const y = object.type === 'freehand' && pointYs.length
        ? object.y + Math.min(...pointYs)
        : object.y;
      const right = object.type === 'freehand' && pointXs.length
        ? object.x + Math.max(...pointXs)
        : object.x + (object.width ?? 0);
      const bottom = object.type === 'freehand' && pointYs.length
        ? object.y + Math.max(...pointYs)
        : object.y + (object.height ?? 0);
      return { x, y, right, bottom };
    });
    const bounds = rectangles.reduce((current, rect) => ({
      x: Math.min(current.x, rect.x),
      y: Math.min(current.y, rect.y),
      right: Math.max(current.right, rect.right),
      bottom: Math.max(current.bottom, rect.bottom)
    }), {
      x: Number.POSITIVE_INFINITY,
      y: Number.POSITIVE_INFINITY,
      right: Number.NEGATIVE_INFINITY,
      bottom: Number.NEGATIVE_INFINITY
    });
    const contentBounds = {
      x: bounds.x,
      y: bounds.y,
      width: bounds.right - bounds.x,
      height: bounds.bottom - bounds.y
    };
    const margin = 80;
    const zoom = Math.min(
      1.5,
      (this.stage.width() - margin * 2) / Math.max(contentBounds.width, 1),
      (this.stage.height() - margin * 2) / Math.max(contentBounds.height, 1)
    );
    this.stage.scale({ x: zoom, y: zoom });
    this.stage.position({
      x: (this.stage.width() - contentBounds.width * zoom) / 2 - contentBounds.x * zoom,
      y: (this.stage.height() - contentBounds.height * zoom) / 2 - contentBounds.y * zoom
    });
    this.stage.batchDraw();
    this.emitCamera();
  }

  undo(): void {
    if (this.readOnly) return;
    if (this.undoManager) {
      this.undoManager.undo();
      return;
    }
    const previous = this.history.pop();
    if (!previous) return;
    this.redoHistory.push(this.getSnapshot());
    this.load(previous);
    this.emitSnapshot();
  }

  redo(): void {
    if (this.readOnly) return;
    if (this.undoManager) {
      this.undoManager.redo();
      return;
    }
    const next = this.redoHistory.pop();
    if (!next) return;
    this.history.push(this.getSnapshot());
    this.load(next);
    this.emitSnapshot();
  }

  updateSelected(changes: Partial<DrawingObject>): void {
    if (this.readOnly || !this.layer || !this.selectedId) return;
    const node = this.layer.getChildren()
      .find((child): child is Konva.Shape =>
        child instanceof Konva.Shape && child.id() === this.selectedId);
    if (!node) return;
    this.recordUndo();
    if (changes.fill !== undefined) node.setAttr('fill', changes.fill);
    if (changes.stroke !== undefined) node.setAttr('stroke', changes.stroke);
    if (changes.strokeWidth !== undefined) node.setAttr('strokeWidth', changes.strokeWidth);
    if (changes.fontSize !== undefined && node instanceof Konva.Text) node.fontSize(changes.fontSize);
    if (changes.text !== undefined && node instanceof Konva.Text) node.text(changes.text);
    if (changes.opacity !== undefined) node.opacity(changes.opacity);
    this.layer.batchDraw();
    this.emitSnapshot();
    this.selectionListener?.(this.getSnapshot().objects.find((item) => item.id === this.selectedId) ?? null);
  }

  deleteSelected(): void {
    if (this.readOnly || !this.layer || !this.selectedId) return;
    const node = this.layer.getChildren()
      .find((child): child is Konva.Shape =>
        child instanceof Konva.Shape && child.id() === this.selectedId);
    if (!node) return;
    this.recordUndo();
    node.destroy();
    this.selectedId = null;
    this.transformer?.nodes([]);
    this.selectionListener?.(null);
    this.layer.batchDraw();
    this.emitSnapshot();
  }

  exportPng(): string {
    if (!this.stage) throw new Error('El lienzo todavía no está inicializado.');
    this.transformer?.hide();
    this.stage.batchDraw();
    try {
      return this.stage.toDataURL({ pixelRatio: 2 });
    } finally {
      this.transformer?.show();
      this.stage.batchDraw();
    }
  }

  get canUndo(): boolean {
    return this.undoManager ? this.undoManager.undoStack.length > 0 : this.history.length > 0;
  }

  get canRedo(): boolean {
    return this.undoManager ? this.undoManager.redoStack.length > 0 : this.redoHistory.length > 0;
  }

  destroy(): void {
    this.sharedObjects?.unobserveDeep(this.handleSharedObjectsChanged);
    this.undoManager?.destroy();
    this.stage?.off();
    this.stage?.destroy();
    this.stage = null;
    this.layer = null;
    this.presenceLayer = null;
    this.transformer = null;
    this.sharedDocument = null;
    this.sharedObjects = null;
    this.undoManager = null;
    this.activeStroke = null;
    this.history = [];
    this.redoHistory = [];
    this.selectedId = null;
    this.snapshotListener = null;
    this.selectionListener = null;
    this.cameraListener = null;
    this.cursorListener = null;
    this.snapToGrid = false;
    this.readOnly = false;
    this.remotePresence = [];
  }

  private readonly handleStageClick = (event: Konva.KonvaEventObject<MouseEvent | TouchEvent>): void => {
    if (this.readOnly && this.tool !== 'select') return;
    const target = event.target;
    const drawingType = target instanceof Konva.Shape
      ? target.getAttr('drawingType') as DrawingShapeType | undefined
      : undefined;
    if (!drawingType) {
      if (this.tool === 'select') this.selectNode(null);
      return;
    }
    if (this.tool === 'eraser') {
      this.selectNode(target);
      this.deleteSelected();
    } else if (this.tool === 'select') {
      this.selectNode(target);
    }
  };

  private readonly startFreehand = (): void => {
    if (this.readOnly || this.tool !== 'freehand' || !this.stage || !this.layer) return;
    const pointer = this.pointerToWorld();
    if (!pointer) return;
    this.recordUndo();
    this.activeStroke = new Konva.Line({
      id: crypto.randomUUID(),
      drawingType: 'freehand',
      x: pointer.x,
      y: pointer.y,
      points: [0, 0],
      stroke: DEFAULT_STROKE,
      strokeWidth: 3,
      lineCap: 'round',
      lineJoin: 'round',
      tension: 0.25,
      draggable: false
    });
    this.layer.add(this.activeStroke);
  };

  private readonly updateFreehand = (): void => {
    if (!this.activeStroke) return;
    const pointer = this.pointerToWorld();
    if (!pointer) return;
    const points = this.activeStroke.points();
    this.activeStroke.points([...points, pointer.x - this.activeStroke.x(), pointer.y - this.activeStroke.y()]);
    this.layer?.batchDraw();
  };

  private readonly finishFreehand = (): void => {
    if (!this.activeStroke) return;
    this.activeStroke = null;
    this.emitSnapshot();
  };

  private readonly handleWheel = (event: Konva.KonvaEventObject<WheelEvent>): void => {
    if (!this.stage) return;
    event.evt.preventDefault();
    const pointer = this.stage.getPointerPosition();
    if (!pointer) return;
    const oldZoom = this.stage.scaleX();
    const scaleBy = 1.08;
    const nextZoom = Math.min(4, Math.max(0.1, event.evt.deltaY > 0 ? oldZoom / scaleBy : oldZoom * scaleBy));
    const point = {
      x: (pointer.x - this.stage.x()) / oldZoom,
      y: (pointer.y - this.stage.y()) / oldZoom
    };
    this.stage.scale({ x: nextZoom, y: nextZoom });
    this.stage.position({
      x: pointer.x - point.x * nextZoom,
      y: pointer.y - point.y * nextZoom
    });
    this.stage.batchDraw();
    this.emitCamera();
  };

  private readonly updatePointer = (): void => {
    const now = Date.now();
    if (now - this.lastCursorUpdate < 50) return;
    this.lastCursorUpdate = now;
    this.cursorListener?.(this.pointerToWorld());
  };

  private readonly clearPointer = (): void => {
    this.cursorListener?.(null);
  };

  private readonly emitCamera = (): void => {
    if (!this.stage) return;
    this.cameraListener?.({
      x: this.stage.x(),
      y: this.stage.y(),
      zoom: this.stage.scaleX()
    });
  };

  private pointerToWorld(): { x: number; y: number } | null {
    if (!this.stage) return null;
    const pointer = this.stage.getPointerPosition();
    if (!pointer) return null;
    return {
      x: (pointer.x - this.stage.x()) / this.stage.scaleX(),
      y: (pointer.y - this.stage.y()) / this.stage.scaleY()
    };
  }

  private createNode(object: DrawingObject): Konva.Shape {
    const common = {
      id: object.id,
      drawingType: object.type,
      x: object.x,
      y: object.y,
      fill: object.fill ?? 'transparent',
      stroke: object.stroke ?? DEFAULT_STROKE,
      strokeWidth: object.strokeWidth ?? 2,
      opacity: object.opacity ?? 1,
      rotation: object.rotation ?? 0,
      draggable: !this.readOnly
    };
    let node: Konva.Shape;
    switch (object.type) {
      case 'ellipse':
        node = new Konva.Ellipse({
          ...common,
          x: object.x + (object.width ?? 120) / 2,
          y: object.y + (object.height ?? 80) / 2,
          radiusX: (object.width ?? 120) / 2,
          radiusY: (object.height ?? 80) / 2
        });
        break;
      case 'diamond':
        node = new Konva.Line({
          ...common,
          x: object.x + (object.width ?? 120) / 2,
          y: object.y + (object.height ?? 80) / 2,
          points: [0, -(object.height ?? 80) / 2, (object.width ?? 120) / 2, 0,
            0, (object.height ?? 80) / 2, -(object.width ?? 120) / 2, 0],
          closed: true
        });
        break;
      case 'line':
      case 'arrow': {
        const points = [0, 0, object.width ?? 120, object.height ?? 0];
        node = object.type === 'arrow'
          ? new Konva.Arrow({ ...common, points, pointerLength: 10, pointerWidth: 10 })
          : new Konva.Line({ ...common, points });
        node.fillEnabled(false);
        break;
      }
      case 'text':
        node = new Konva.Text({
          ...common,
          text: object.text ?? 'Texto',
          fontSize: object.fontSize ?? 24,
          width: object.width ?? 180,
          height: object.height,
          padding: 8,
          wrap: 'word'
        });
        break;
      case 'freehand':
        node = new Konva.Line({
          ...common,
          points: object.points ?? [],
          lineCap: 'round',
          lineJoin: 'round',
          tension: 0.25
        });
        node.fillEnabled(false);
        break;
      case 'rect':
      default:
        node = new Konva.Rect({
          ...common,
          width: object.width ?? 120,
          height: object.height ?? 80,
          cornerRadius: 8
        });
    }
    node.on('click tap', (event) => {
      event.cancelBubble = true;
      if (this.tool === 'eraser') {
        this.selectNode(node);
        this.deleteSelected();
      } else if (this.tool === 'select') {
        this.selectNode(node);
      }
    });
    node.on('dragstart', () => this.recordUndo());
    node.on('dragend', () => {
      if (this.snapToGrid) {
        node.position({
          x: Math.round(node.x() / 15) * 15,
          y: Math.round(node.y() / 15) * 15
        });
      }
      this.handleNodeChanged(node);
    });
    node.on('transformend', () => this.handleNodeChanged(node));
    return node;
  }

  private nodeToObject(node: Konva.Node): DrawingObject {
    const type = node.getAttr('drawingType') as DrawingShapeType;
    const object: DrawingObject = {
      id: node.id(),
      type,
      x: node.x(),
      y: node.y(),
      fill: typeof node.getAttr('fill') === 'string' ? node.getAttr('fill') as string : 'transparent',
      stroke: typeof node.getAttr('stroke') === 'string' ? node.getAttr('stroke') as string : DEFAULT_STROKE,
      strokeWidth: Number(node.getAttr('strokeWidth')) || 0,
      rotation: node.rotation(),
      opacity: node.opacity()
    };
    if (node instanceof Konva.Rect || node instanceof Konva.Text) {
      object.width = node.width() * node.scaleX();
      object.height = node.height() * node.scaleY();
    } else if (node instanceof Konva.Ellipse) {
      object.width = node.radiusX() * 2;
      object.height = node.radiusY() * 2;
      object.x -= object.width / 2;
      object.y -= object.height / 2;
    } else if (node instanceof Konva.Line) {
      const points = node.points();
      if (type === 'diamond') {
        const bounds = node.getClientRect({ skipTransform: true });
        object.width = bounds.width;
        object.height = bounds.height;
        object.x -= object.width / 2;
        object.y -= object.height / 2;
      } else if (type === 'freehand') {
        object.points = points;
      } else {
        object.width = points[2] ?? 0;
        object.height = points[3] ?? 0;
      }
    }
    if (node instanceof Konva.Text) {
      object.text = node.text();
      object.fontSize = node.fontSize();
    }
    return object;
  }

  private handleNodeChanged(node: Konva.Node): void {
    if (this.readOnly) return;
    if (node.scaleX() !== 1 || node.scaleY() !== 1) {
      if (node instanceof Konva.Rect || node instanceof Konva.Text) {
        node.width(node.width() * node.scaleX());
        node.height(node.height() * node.scaleY());
      } else if (node instanceof Konva.Ellipse) {
        node.radiusX(node.radiusX() * node.scaleX());
        node.radiusY(node.radiusY() * node.scaleY());
      } else if (node instanceof Konva.Line) {
        node.points(node.points().map((point, index) =>
          point * (index % 2 === 0 ? node.scaleX() : node.scaleY())
        ));
      }
      node.scale({ x: 1, y: 1 });
    }
    this.emitSnapshot();
    this.selectionListener?.(this.nodeToObject(node));
    this.layer?.batchDraw();
  }

  private selectNode(node: Konva.Node | null): void {
    if (!this.layer || !this.transformer) return;
    const target = node?.getAttr('drawingType') ? node : null;
    this.selectedId = target?.id() ?? null;
    this.transformer.nodes(target ? [target] : []);
    this.selectionListener?.(target ? this.nodeToObject(target) : null);
    this.layer.batchDraw();
  }

  private createTransformer(): void {
    if (!this.layer) return;
    this.transformer = new Konva.Transformer({
      drawingType: 'transformer',
      rotateEnabled: true,
      flipEnabled: false,
      boundBoxFunc: (oldBox, newBox) =>
        newBox.width < 1 || newBox.height < 1 ? oldBox : newBox
    });
    this.transformer.on('transformstart', () => this.recordUndo());
    this.transformer.on('transformend', () => {
      this.transformer?.nodes().forEach((node) => this.handleNodeChanged(node));
    });
    this.layer.add(this.transformer);
  }

  private applyTool(): void {
    if (!this.stage || !this.layer) return;
    const isHand = this.tool === 'hand';
    this.stage.draggable(isHand);
    this.layer.getChildren((node) => node.getAttr('drawingType') !== 'transformer')
      .forEach((node) => {
        node.draggable(!this.readOnly && this.tool === 'select');
        node.listening(this.tool !== 'hand' && this.tool !== 'freehand');
      });
    this.transformer?.visible(!this.readOnly && this.tool === 'select');
    if (this.readOnly) this.transformer?.nodes([]);
    this.stage.container().style.cursor = isHand ? 'grab' :
      this.tool === 'freehand' ? 'crosshair' : this.tool === 'eraser' ? 'cell' : 'default';
    this.layer.batchDraw();
  }

  private recordUndo(): void {
    if (this.restoring || !this.layer || this.undoManager) return;
    this.history.push(this.getSnapshot());
    if (this.history.length > 80) this.history.shift();
    this.redoHistory = [];
  }

  private emitSnapshot(): void {
    if (this.restoring) return;
    const snapshot = this.getSnapshot();
    this.snapshotListener?.(snapshot);
    if (this.sharedObjects) this.writeSnapshotToSharedObjects(snapshot);
  }

  private writeSnapshotToSharedObjects(snapshot: DrawingSnapshot, origin: unknown = this): void {
    if (!this.sharedDocument || !this.sharedObjects) return;
    this.applyingLocalChanges = true;
    try {
      this.sharedDocument.transact(() => {
        const remainingIds = new Set(snapshot.objects.map((object) => object.id));
        for (const [id, sharedObject] of this.sharedObjects!.entries()) {
          if (!remainingIds.has(id)) this.sharedObjects!.delete(id);
          else {
            const object = snapshot.objects.find((item) => item.id === id);
            if (!object) continue;
            const values = Object.fromEntries(
              Object.entries(object).filter(([key]) => key !== 'id')
            );
            for (const key of [...sharedObject.keys()]) {
              if (!Object.hasOwn(values, key)) sharedObject.delete(key);
            }
            for (const [key, value] of Object.entries(values)) {
              if (!Object.hasOwn(sharedObject.toJSON(), key) ||
                JSON.stringify(sharedObject.get(key)) !== JSON.stringify(value)) {
                sharedObject.set(key, value);
              }
            }
          }
        }
        for (const object of snapshot.objects) {
          if (this.sharedObjects!.has(object.id)) continue;
          const sharedObject = new Y.Map<unknown>();
          for (const [key, value] of Object.entries(object)) {
            if (key !== 'id') sharedObject.set(key, value);
          }
          this.sharedObjects!.set(object.id, sharedObject);
        }
      }, origin);
    } finally {
      this.applyingLocalChanges = false;
    }
  }

  private renderRemotePresence(): void {
    if (!this.presenceLayer) return;
    this.presenceLayer.destroyChildren();
    for (const user of this.remotePresence) {
      for (const id of user.selectedIds) {
        const node = this.layer?.findOne(`#${id}`);
        if (!node || !this.stage) continue;
        const bounds = node.getClientRect({ relativeTo: this.stage });
        this.presenceLayer.add(new Konva.Rect({
          x: bounds.x,
          y: bounds.y,
          width: bounds.width,
          height: bounds.height,
          stroke: user.color,
          strokeWidth: 2,
          dash: [6, 4],
          listening: false
        }));
      }
      if (!user.cursor) continue;
      this.presenceLayer.add(new Konva.Circle({
        x: user.cursor.x,
        y: user.cursor.y,
        radius: 5,
        fill: user.color,
        stroke: '#ffffff',
        strokeWidth: 1.5,
        listening: false
      }));
      const label = new Konva.Label({
        x: user.cursor.x + 10,
        y: user.cursor.y + 8,
        listening: false
      });
      label.add(new Konva.Tag({ fill: user.color, cornerRadius: 4 }));
      label.add(new Konva.Text({
        text: user.name,
        fontSize: 12,
        fill: '#ffffff',
        padding: 4
      }));
      this.presenceLayer.add(label);
    }
    this.presenceLayer.batchDraw();
  }
}
