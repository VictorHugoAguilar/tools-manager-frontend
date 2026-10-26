export interface ShelfConfig {
  rows: number;
  columns: number;
}

export type ShelfConfigPayload = ShelfConfig;

export const DEFAULT_SHELF_CONFIG: ShelfConfig = {
  rows: 5,
  columns: 6
};

