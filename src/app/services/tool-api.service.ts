import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { Tool, ToolListResponse, ToolPayload } from '../models/tool.model';

@Injectable({
  providedIn: 'root'
})
export class ToolApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/tools';

  getTools(): Observable<Tool[] | ToolListResponse> {
    return this.http.get<Tool[] | ToolListResponse>(this.baseUrl);
  }

  createTool(payload: ToolPayload): Observable<Tool> {
    return this.http.post<Tool>(this.baseUrl, payload);
  }

  updateTool(id: string, payload: ToolPayload): Observable<Tool> {
    return this.http.put<Tool>(`${this.baseUrl}/${id}`, payload);
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
}

