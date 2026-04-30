export interface Technician {
  id: string;
  name: string;
  specialty: string;
  phone: string;
  email: string;
  notes: string;
  active: boolean;
}

export interface TechnicianPayload {
  name: string;
  specialty: string;
  phone: string;
  email: string;
  notes: string;
  active: boolean;
}

export interface TechnicianFormSubmission {
  payload: TechnicianPayload;
  mode: 'create' | 'edit';
}

export interface RepairRecord {
  id: string;
  toolId: string;
  entryDate: string;
  exitDate: string;
  status: string;
  priority: string;
  issue: string;
  description: string;
  technicianId: string;
  technicianName: string;
  cost: number | null;
  observations: string;
}

export interface RepairPayload {
  entryDate: string;
  exitDate: string;
  status: string;
  priority: string;
  issue: string;
  description: string;
  technicianId: string;
  cost: number | null;
  observations: string;
}
