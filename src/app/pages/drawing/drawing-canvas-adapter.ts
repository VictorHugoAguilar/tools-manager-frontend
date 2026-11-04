import Konva from 'konva';
import { DrawingObject, DrawingShapeType, DrawingSnapshot, DrawingTool } from '../../models/drawing.model';

type SnapshotListener = (snapshot: DrawingSnapshot) => void;
type SelectionListener = (object: DrawingObject | null) => void;
type CameraState = { x: number; y: number; zoom: number };
type CameraListener = (camera: CameraState) => void;

const DEFAULT_STROKE = '#23345a';
const DEFAULT_FILL = '#f6d768';

export class DrawingCanvasAdapter {
  private stage: Konva.Stage | null = null;
  private layer: Konva.Layer | null = null;
  private transformer: Konva.Transformer | null = null;
  private tool: DrawingTool = 'select';
  private activeStroke: Konva.Line | null = null;
  private history: DrawingSnapshot[] = [];
  private redoHistory: DrawingSnapshot[] = [];
  private selectedId: string | null = null;
  private restoring = false;
  private snapshotListener: SnapshotListener | null = null;
  private selectionListener: SelectionListener | null = null;
  private cameraListener: CameraListener | null = null;
  private snapToGrid = false;

  initialize(
    container: HTMLDivElement,
    snapshot: DrawingSnapshot,
    onSnapshot: SnapshotListener,
    onSelection: SelectionListener,
    camera: CameraState,
    onCamera: CameraListener
  ): void {
    this.destroy();
    this.snapshotListener = onSnapshot;
    this.selectionListener = onSelection;
    this.cameraListener = onCamera;
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
    this.load(snapshot);
    this.stage.on('click tap', this.handleStageClick);
    this.stage.on('mousedown touchstart', this.startFreehand);
    this.stage.on('mousemove touchmove', this.updateFreehand);
    this.stage.on('mouseup touchend', this.finishFreehand);
    this.stage.on('dragend', this.emitCamera);
    this.stage.on('wheel', this.handleWheel);
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
    if (!this.stage || !this.layer) return;
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
    this.tool = tool;
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
    const previous = this.history.pop();
    if (!previous) return;
    this.redoHistory.push(this.getSnapshot());
    this.load(previous);
    this.emitSnapshot();
  }

  redo(): void {
    const next = this.redoHistory.pop();
    if (!next) return;
    this.history.push(this.getSnapshot());
    this.load(next);
    this.emitSnapshot();
  }

  updateSelected(changes: Partial<DrawingObject>): void {
    if (!this.layer || !this.selectedId) return;
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
    if (!this.layer || !this.selectedId) return;
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
    return this.history.length > 0;
  }

  get canRedo(): boolean {
    return this.redoHistory.length > 0;
  }

  destroy(): void {
    this.stage?.off();
    this.stage?.destroy();
    this.stage = null;
    this.layer = null;
    this.transformer = null;
    this.activeStroke = null;
    this.history = [];
    this.redoHistory = [];
    this.selectedId = null;
    this.snapshotListener = null;
    this.selectionListener = null;
    this.cameraListener = null;
    this.snapToGrid = false;
  }

  private readonly handleStageClick = (event: Konva.KonvaEventObject<MouseEvent | TouchEvent>): void => {
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
    if (this.tool !== 'freehand' || !this.stage || !this.layer) return;
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
      draggable: true
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
        node.draggable(this.tool === 'select');
        node.listening(this.tool !== 'hand' && this.tool !== 'freehand');
      });
    this.transformer?.visible(this.tool === 'select');
    this.stage.container().style.cursor = isHand ? 'grab' :
      this.tool === 'freehand' ? 'crosshair' : this.tool === 'eraser' ? 'cell' : 'default';
    this.layer.batchDraw();
  }

  private recordUndo(): void {
    if (this.restoring || !this.layer) return;
    this.history.push(this.getSnapshot());
    if (this.history.length > 80) this.history.shift();
    this.redoHistory = [];
  }

  private emitSnapshot(): void {
    if (this.restoring) return;
    this.snapshotListener?.(this.getSnapshot());
  }
}
