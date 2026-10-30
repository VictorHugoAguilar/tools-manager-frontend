import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import {
  WorkshopCompartment,
  WorkshopCompartmentPayload,
  WorkshopLevel,
  WorkshopLevelPayload,
  WorkshopMaterial,
  WorkshopMaterialCategory,
  WorkshopMaterialPayload,
  WorkshopMaterialSearchResult,
  WorkshopOrganizer,
  WorkshopOrganizerPayload,
  WorkshopShelf,
  WorkshopShelfPayload,
  WorkshopStorageSnapshot
} from '../models/workshop-storage.model';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class WorkshopStorageApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiUrl + '/api/workshop-storage';

  load(): Observable<WorkshopStorageSnapshot> {
    return this.http.get<WorkshopStorageSnapshot>(this.baseUrl);
  }

  search(query: string): Observable<WorkshopMaterialSearchResult[]> {
    const params = new HttpParams().set('q', query);
    return this.http.get<WorkshopMaterialSearchResult[]>(`${this.baseUrl}/search`, { params });
  }

  getMaterialCategories(): Observable<WorkshopMaterialCategory[]> {
    return this.http.get<WorkshopMaterialCategory[]>(`${this.baseUrl}/categories`);
  }

  createMaterialCategory(name: string): Observable<WorkshopMaterialCategory> {
    return this.http.post<WorkshopMaterialCategory>(`${this.baseUrl}/categories`, { name });
  }

  deleteMaterialCategory(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/categories/${id}`);
  }

  createShelf(payload: WorkshopShelfPayload): Observable<WorkshopShelf> {
    return this.http.post<WorkshopShelf>(`${this.baseUrl}/shelves`, payload);
  }

  updateShelf(id: string, payload: WorkshopShelfPayload): Observable<WorkshopShelf> {
    return this.http.put<WorkshopShelf>(`${this.baseUrl}/shelves/${id}`, payload);
  }

  deleteShelf(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/shelves/${id}`);
  }

  createLevel(payload: WorkshopLevelPayload): Observable<WorkshopLevel> {
    return this.http.post<WorkshopLevel>(`${this.baseUrl}/levels`, payload);
  }

  updateLevel(id: string, payload: WorkshopLevelPayload): Observable<WorkshopLevel> {
    return this.http.put<WorkshopLevel>(`${this.baseUrl}/levels/${id}`, payload);
  }

  deleteLevel(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/levels/${id}`);
  }

  createOrganizer(payload: WorkshopOrganizerPayload): Observable<WorkshopOrganizer> {
    return this.http.post<WorkshopOrganizer>(`${this.baseUrl}/organizers`, payload);
  }

  updateOrganizer(id: string, payload: WorkshopOrganizerPayload): Observable<WorkshopOrganizer> {
    return this.http.put<WorkshopOrganizer>(`${this.baseUrl}/organizers/${id}`, payload);
  }

  deleteOrganizer(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/organizers/${id}`);
  }

  createCompartment(payload: WorkshopCompartmentPayload): Observable<WorkshopCompartment> {
    return this.http.post<WorkshopCompartment>(`${this.baseUrl}/compartments`, payload);
  }

  updateCompartment(id: string, payload: WorkshopCompartmentPayload): Observable<WorkshopCompartment> {
    return this.http.put<WorkshopCompartment>(`${this.baseUrl}/compartments/${id}`, payload);
  }

  deleteCompartment(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/compartments/${id}`);
  }

  createMaterial(payload: WorkshopMaterialPayload): Observable<WorkshopMaterial> {
    return this.http.post<WorkshopMaterial>(`${this.baseUrl}/materials`, payload);
  }

  updateMaterial(id: string, payload: WorkshopMaterialPayload): Observable<WorkshopMaterial> {
    return this.http.put<WorkshopMaterial>(`${this.baseUrl}/materials/${id}`, payload);
  }

  deleteMaterial(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/materials/${id}`);
  }

  uploadMaterialImage(id: string, image: File): Observable<{ material: WorkshopMaterial }> {
    const formData = new FormData();
    formData.append('image', image);
    return this.http.post<{ material: WorkshopMaterial }>(
      `${this.baseUrl}/materials/${id}/image`,
      formData
    );
  }
}
