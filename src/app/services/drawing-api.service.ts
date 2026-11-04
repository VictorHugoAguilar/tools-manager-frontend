import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  DrawingAsset,
  DrawingDocument,
  DrawingPage,
  DrawingPreferences,
  DrawingSnapshot,
  DrawingSnapshotResponse
} from '../models/drawing.model';

@Injectable({ providedIn: 'root' })
export class DrawingApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/api/drawing`;

  listDocuments(options: { includeArchived?: boolean; cursor?: string; limit?: number; search?: string } = {}):
    Observable<{ documents: DrawingDocument[]; nextCursor: string | null }> {
    let params = new HttpParams();
    if (options.includeArchived) params = params.set('includeArchived', 'true');
    if (options.cursor) params = params.set('cursor', options.cursor);
    if (options.limit) params = params.set('limit', String(options.limit));
    if (options.search?.trim()) params = params.set('search', options.search.trim());
    return this.http.get<{ documents: DrawingDocument[]; nextCursor: string | null }>(
      `${this.baseUrl}/documents`, { params }
    );
  }

  getDocument(id: string): Observable<{ document: DrawingDocument }> {
    return this.http.get<{ document: DrawingDocument }>(`${this.baseUrl}/documents/${encodeURIComponent(id)}`);
  }

  createDocument(name: string, description: string): Observable<{ document: DrawingDocument }> {
    return this.http.post<{ document: DrawingDocument }>(`${this.baseUrl}/documents`, { name, description });
  }

  updateDocument(id: string, payload: Partial<Pick<DrawingDocument, 'name' | 'description'>>):
    Observable<{ document: DrawingDocument }> {
    return this.http.patch<{ document: DrawingDocument }>(
      `${this.baseUrl}/documents/${encodeURIComponent(id)}`, payload
    );
  }

  deleteDocument(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/documents/${encodeURIComponent(id)}`);
  }

  duplicateDocument(id: string): Observable<{ document: DrawingDocument }> {
    return this.http.post<{ document: DrawingDocument }>(
      `${this.baseUrl}/documents/${encodeURIComponent(id)}/duplicate`, {}
    );
  }

  archiveDocument(id: string): Observable<{ document: DrawingDocument }> {
    return this.http.post<{ document: DrawingDocument }>(
      `${this.baseUrl}/documents/${encodeURIComponent(id)}/archive`, {}
    );
  }

  restoreDocument(id: string): Observable<{ document: DrawingDocument }> {
    return this.http.post<{ document: DrawingDocument }>(
      `${this.baseUrl}/documents/${encodeURIComponent(id)}/restore`, {}
    );
  }

  createPage(documentId: string, name: string): Observable<{ page: DrawingPage }> {
    return this.http.post<{ page: DrawingPage }>(
      `${this.baseUrl}/documents/${encodeURIComponent(documentId)}/pages`, { name }
    );
  }

  updatePage(pageId: string, name: string): Observable<{ page: DrawingPage }> {
    return this.http.patch<{ page: DrawingPage }>(
      `${this.baseUrl}/pages/${encodeURIComponent(pageId)}`, { name }
    );
  }

  deletePage(pageId: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/pages/${encodeURIComponent(pageId)}`);
  }

  duplicatePage(pageId: string): Observable<{ page: DrawingPage }> {
    return this.http.post<{ page: DrawingPage }>(
      `${this.baseUrl}/pages/${encodeURIComponent(pageId)}/duplicate`, {}
    );
  }

  reorderPages(documentId: string, ids: string[]): Observable<{ pages: DrawingPage[] }> {
    return this.http.patch<{ pages: DrawingPage[] }>(
      `${this.baseUrl}/documents/${encodeURIComponent(documentId)}/pages/reorder`, { ids }
    );
  }

  getSnapshot(pageId: string): Observable<DrawingSnapshotResponse> {
    return this.http.get<DrawingSnapshotResponse>(
      `${this.baseUrl}/pages/${encodeURIComponent(pageId)}/snapshot`
    );
  }

  saveSnapshot(pageId: string, expectedVersion: number, snapshot: DrawingSnapshot):
    Observable<{ pageId: string; version: number; schemaVersion: number; contentHash: string; updatedAt: string }> {
    return this.http.put<{ pageId: string; version: number; schemaVersion: number; contentHash: string; updatedAt: string }>(
      `${this.baseUrl}/pages/${encodeURIComponent(pageId)}/snapshot`,
      { schemaVersion: 1, expectedVersion, snapshot }
    );
  }

  getVersions(pageId: string): Observable<{ versions: Array<{ version: number; createdAt: string; contentHash: string }> }> {
    return this.http.get<{ versions: Array<{ version: number; createdAt: string; contentHash: string }> }>(
      `${this.baseUrl}/pages/${encodeURIComponent(pageId)}/versions`
    );
  }

  restoreVersion(pageId: string, version: number): Observable<{ version: number; updatedAt: string }> {
    return this.http.post<{ version: number; updatedAt: string }>(
      `${this.baseUrl}/pages/${encodeURIComponent(pageId)}/versions/${version}/restore`, {}
    );
  }

  getPreferences(pageId: string): Observable<{ preferences: DrawingPreferences }> {
    return this.http.get<{ preferences: DrawingPreferences }>(
      `${this.baseUrl}/pages/${encodeURIComponent(pageId)}/preferences`
    );
  }

  savePreferences(pageId: string, preferences: DrawingPreferences):
    Observable<{ preferences: DrawingPreferences }> {
    return this.http.put<{ preferences: DrawingPreferences }>(
      `${this.baseUrl}/pages/${encodeURIComponent(pageId)}/preferences`, preferences
    );
  }

  uploadAsset(documentId: string, pageId: string, file: File): Observable<{ asset: DrawingAsset }> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('pageId', pageId);
    return this.http.post<{ asset: DrawingAsset }>(
      `${this.baseUrl}/documents/${encodeURIComponent(documentId)}/assets`, formData
    );
  }

  assetUrl(assetId: string): string {
    return `${this.baseUrl}/assets/${encodeURIComponent(assetId)}`;
  }

  deleteAsset(assetId: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/assets/${encodeURIComponent(assetId)}`);
  }
}
