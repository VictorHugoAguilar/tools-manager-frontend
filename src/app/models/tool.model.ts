export interface Tool {
  id: string;
  name: string;
  type: string;
  category: string;
  description: string;
  urlSrc: string;
  state: string;
  material: string;
  long: number;
  brand: string;
  model: string;
}

export interface ToolPayload {
  name: string;
  type: string;
  category: string;
  description: string;
  urlSrc: string;
  state: string;
  material: string;
  long: number;
  brand: string;
  model: string;
}

export interface ToolFormSubmission {
  payload: ToolPayload;
  file: File | null;
  removeCurrentImage: boolean;
  mode: 'create' | 'edit';
}

export interface ToolListResponse {
  items: Tool[];
  meta: {
    totalItems: number;
    totalPages: number;
    currentPage: number;
    limit: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}

