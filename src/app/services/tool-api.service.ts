import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { Tool, ToolListResponse, ToolPayload } from '../models/tool.model';
import {
  RepairPayload,
  RepairRecord,
  Technician,
  TechnicianPayload
} from '../models/repair.model';
import { LocationPayload, ToolLocation } from '../models/location.model';
import { ToolType, ToolTypePayload } from '../models/tool-type.model';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class ToolApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiUrl + '/api/tools';
  private readonly techniciansUrl = environment.apiUrl + '/api/technicians';
  private readonly locationsUrl = environment.apiUrl + '/api/locations';
  private readonly toolTypesUrl = environment.apiUrl + '/api/tool-types';

  getTools(): Observable<Tool[] | ToolListResponse> {
    return this.http.get<Tool[] | ToolListResponse>(this.baseUrl);
  }

  createTool(payload: ToolPayload): Observable<Tool> {
    return this.http.post<Tool>(this.baseUrl, payload);
  }

  updateTool(id: string, payload: ToolPayload): Observable<Tool> {
    return this.http.put<Tool>(`${this.baseUrl}/${id}`, payload);
  }

  deleteTool(id: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.baseUrl}/${id}`);
  }

  updateState(id: string, state: string): Observable<Tool> {
    return this.http.patch<Tool>(`${this.baseUrl}/${id}/state`, { state });
  }

  uploadImage(id: string, file: File): Observable<{ message: string; tool: Tool }> {
    const formData = new FormData();
    formData.append('image', file);

    return this.http.post<{ message: string; tool: Tool }>(
      `${this.baseUrl}/${id}/image`,
      formData
    );
  }

  deleteImage(id: string): Observable<{ message: string; tool: Tool }> {
    return this.http.delete<{ message: string; tool: Tool }>(`${this.baseUrl}/${id}/image`);
  }

  getToolRepairs(toolId: string): Observable<RepairRecord[]> {
    return this.http.get<RepairRecord[]>(`${this.baseUrl}/${toolId}/repairs`);
  }

  createToolRepair(toolId: string, payload: RepairPayload): Observable<RepairRecord> {
    return this.http.post<RepairRecord>(`${this.baseUrl}/${toolId}/repairs`, payload);
  }

  updateToolRepair(toolId: string, repairId: string, payload: RepairPayload): Observable<RepairRecord> {
    return this.http.put<RepairRecord>(`${this.baseUrl}/${toolId}/repairs/${repairId}`, payload);
  }

  deleteToolRepair(toolId: string, repairId: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${toolId}/repairs/${repairId}`);
  }

  getTechnicians(): Observable<Technician[]> {
    return this.http.get<Technician[]>(this.techniciansUrl);
  }

  createTechnician(payload: TechnicianPayload): Observable<Technician> {
    return this.http.post<Technician>(this.techniciansUrl, payload);
  }

  updateTechnician(id: string, payload: TechnicianPayload): Observable<Technician> {
    return this.http.put<Technician>(`${this.techniciansUrl}/${id}`, payload);
  }

  deleteTechnician(id: string): Observable<void> {
    return this.http.delete<void>(`${this.techniciansUrl}/${id}`);
  }

  getLocations(): Observable<ToolLocation[]> {
    return this.http.get<ToolLocation[]>(this.locationsUrl);
  }

  createLocation(payload: LocationPayload): Observable<ToolLocation> {
    return this.http.post<ToolLocation>(this.locationsUrl, payload);
  }

  updateLocation(id: string, payload: LocationPayload): Observable<ToolLocation> {
    return this.http.put<ToolLocation>(`${this.locationsUrl}/${id}`, payload);
  }

  deleteLocation(id: string): Observable<void> {
    return this.http.delete<void>(`${this.locationsUrl}/${id}`);
  }

  getToolTypes(): Observable<ToolType[]> {
    return this.http.get<ToolType[]>(this.toolTypesUrl);
  }

  createToolType(payload: ToolTypePayload): Observable<ToolType> {
    return this.http.post<ToolType>(this.toolTypesUrl, payload);
  }

  updateToolType(id: string, payload: ToolTypePayload): Observable<ToolType> {
    return this.http.put<ToolType>(`${this.toolTypesUrl}/${id}`, payload);
  }

  deleteToolType(id: string): Observable<void> {
    return this.http.delete<void>(`${this.toolTypesUrl}/${id}`);
  }
}
