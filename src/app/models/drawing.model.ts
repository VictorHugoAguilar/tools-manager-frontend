export type DrawingShapeType = 'rect' | 'ellipse' | 'diamond' | 'line' | 'arrow' | 'text' | 'freehand';
export type DrawingTool = 'select' | 'hand' | 'freehand' | 'eraser';
export type DrawingBackground = 'dots' | 'lines' | 'none' | 'white' | 'cream';

export interface DrawingObject {
  id: string;
  type: DrawingShapeType;
  x: number;
  y: number;
  width?: number;
  height?: number;
  points?: number[];
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  text?: string;
  fontSize?: number;
  rotation?: number;
  opacity?: number;
}

export interface DrawingSnapshot {
  objects: DrawingObject[];
}

export function normalizeDrawingSnapshot(value: unknown): DrawingSnapshot | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const candidate = value as Record<string, unknown>;
  if (Object.keys(candidate).some((key) => key !== 'objects')) return null;
  if (!Object.hasOwn(candidate, 'objects')) {
    return Object.keys(candidate).length === 0 ? { objects: [] } : null;
  }

  const objects = candidate['objects'];
  if (Array.isArray(objects)) return { objects: objects as DrawingObject[] };
  if (objects === null || (typeof objects === 'object' && !Array.isArray(objects))) {
    const entries = Object.entries(objects ?? {});
    if (!entries.length) return { objects: [] };
    entries.sort(([left], [right]) => Number(left) - Number(right));
    if (entries.some(([key], index) => key !== String(index)) ||
        entries.some(([, object]) => !object || typeof object !== 'object' || Array.isArray(object))) {
      return null;
    }
    return { objects: entries.map(([, object]) => object as DrawingObject) };
  }
  return null;
}

export interface DrawingPage {
  id: string;
  documentId: string;
  name: string;
  position: number;
  createdAt: string;
  updatedAt: string;
  version: number;
  schemaVersion: number;
  snapshotId: string;
}

export interface DrawingDocument {
  id: string;
  name: string;
  description: string;
  ownerUserId: string;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  version: number;
  pageCount: number;
  firstPageId: string | null;
  pages?: DrawingPage[];
}

export interface DrawingSnapshotResponse {
  pageId: string;
  version: number;
  schemaVersion: number;
  snapshot: DrawingSnapshot;
  contentHash: string;
}

export interface DrawingPreferences {
  cameraState: { x: number; y: number; zoom: number };
  gridEnabled: boolean;
  snapToGrid: boolean;
  background: DrawingBackground;
}

export interface DrawingAsset {
  id: string;
  documentId: string;
  pageId: string | null;
  originalFileName: string;
  contentType: string;
  sizeBytes: number;
  uploadedByUserId: string;
  createdAt: string;
  isDeleted: boolean;
}
