export type StorageProductState = 'Nuevo' | 'Usado';

export interface StorageBoxProduct {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
  quantity: number;
  state: StorageProductState;
}

export interface StorageBox {
  id: string;
  code: string;
  name: string;
  description: string;
  imageUrl: string;
  products: StorageBoxProduct[];
}

export interface StorageBoxPayload {
  code?: string;
  name: string;
  description: string;
  imageUrl?: string;
}

export interface StorageProductPayload {
  name: string;
  description: string;
  imageUrl: string;
  quantity: number;
  state: StorageProductState;
}
