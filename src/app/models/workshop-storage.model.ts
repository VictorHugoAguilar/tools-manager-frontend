export interface WorkshopShelf {
  id: string;
  name: string;
  description: string;
  position: number;
}

export interface WorkshopLevel {
  id: string;
  shelfId: string;
  name: string;
  position: number;
  width?: number | null;
  depth?: number | null;
}

export interface WorkshopOrganizer {
  id: string;
  levelId: string;
  name: string;
  type: string;
  position: number;
  columns: number;
  width?: number | null;
  depth?: number | null;
  description?: string;
  imageUrl?: string;
}

export interface WorkshopCompartment {
  id: string;
  organizerId: string;
  name: string;
  position: number;
  row: number;
  column: number;
  size?: string;
}

export interface WorkshopMaterial {
  id: string;
  compartmentId: string;
  name: string;
  category: string;
  reference?: string;
  diameter?: number | null;
  length?: number | null;
  innerDiameter?: number | null;
  outerDiameter?: number | null;
  material?: string;
  headType?: string;
  threadType?: string;
  quantity?: number | null;
  imageUrl?: string;
  imagePath?: string;
  notes?: string;
}

export interface WorkshopMaterialCategory {
  id: string;
  name: string;
}

export interface WorkshopStorageSnapshot {
  shelves: WorkshopShelf[];
  levels: WorkshopLevel[];
  organizers: WorkshopOrganizer[];
  compartments: WorkshopCompartment[];
  materials: WorkshopMaterial[];
}

export interface WorkshopMaterialSearchResult {
  material: WorkshopMaterial;
  compartment: WorkshopCompartment;
  organizer: WorkshopOrganizer;
  level: WorkshopLevel;
  shelf: WorkshopShelf;
}

export type WorkshopShelfPayload = Omit<WorkshopShelf, 'id'>;
export type WorkshopLevelPayload = Omit<WorkshopLevel, 'id'>;
export type WorkshopOrganizerPayload = Omit<WorkshopOrganizer, 'id'>;
export type WorkshopCompartmentPayload = Omit<WorkshopCompartment, 'id'>;
export type WorkshopMaterialPayload = Omit<WorkshopMaterial, 'id' | 'imagePath'>;
