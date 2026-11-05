import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  DrawingAsset,
  DrawingInvitation,
  DrawingDocument,
  DrawingPage,
  DrawingPermission,
  DrawingPreferences,
  DrawingRole,
  DrawingShareLink,
  DrawingSnapshot,
  DrawingSnapshotResponse,
  DrawingUserSearchResult
} from '../models/drawing.model';

@Injectable({ providedIn: 'root' })
export class DrawingApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/api/drawing`;
  private activeDocumentId: string | null = null;

  setActiveDocument(documentId: string | null): void {
    this.activeDocumentId = documentId;
  }

  listDocuments(options: {
    includeArchived?: boolean;
    cursor?: string;
    limit?: number;
    search?: string;
    scope?: 'owned' | 'shared';
  } = {}):
    Observable<{ documents: DrawingDocument[]; nextCursor: string | null }> {
    let params = new HttpParams();
    if (options.includeArchived) params = params.set('includeArchived', 'true');
    if (options.cursor) params = params.set('cursor', options.cursor);
    if (options.limit) params = params.set('limit', String(options.limit));
    if (options.search?.trim()) params = params.set('search', options.search.trim());
    if (options.scope) params = params.set('scope', options.scope);
    return this.http.get<{ documents: DrawingDocument[]; nextCursor: string | null }>(
      `${this.baseUrl}/documents`, { params }
    );
  }

  getDocument(id: string): Observable<{ document: DrawingDocument }> {
    this.activeDocumentId = id;
    return this.http.get<{ document: DrawingDocument }>(
      `${this.baseUrl}/documents/${encodeURIComponent(id)}`,
      { headers: this.shareHeaders(id) }
    );
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
      `${this.baseUrl}/pages/${encodeURIComponent(pageId)}/snapshot`,
      { headers: this.shareHeaders() }
    );
  }

  saveSnapshot(pageId: string, expectedVersion: number, snapshot: DrawingSnapshot):
    Observable<{ pageId: string; version: number; schemaVersion: number; contentHash: string; updatedAt: string }> {
    return this.http.put<{ pageId: string; version: number; schemaVersion: number; contentHash: string; updatedAt: string }>(
      `${this.baseUrl}/pages/${encodeURIComponent(pageId)}/snapshot`,
      { schemaVersion: 1, expectedVersion, snapshot }
    );
  }

  getVersions(pageId: string): Observable<{ versions: { version: number; createdAt: string; contentHash: string }[] }> {
    return this.http.get<{ versions: { version: number; createdAt: string; contentHash: string }[] }>(
      `${this.baseUrl}/pages/${encodeURIComponent(pageId)}/versions`,
      { headers: this.shareHeaders() }
    );
  }

  getVersion(pageId: string, version: number): Observable<DrawingSnapshotResponse> {
    return this.http.get<DrawingSnapshotResponse>(
      `${this.baseUrl}/pages/${encodeURIComponent(pageId)}/versions/${version}`,
      { headers: this.shareHeaders() }
    );
  }

  restoreVersion(pageId: string, version: number): Observable<{ version: number; updatedAt: string }> {
    return this.http.post<{ version: number; updatedAt: string }>(
      `${this.baseUrl}/pages/${encodeURIComponent(pageId)}/versions/${version}/restore`, {}
    );
  }

  getPreferences(pageId: string): Observable<{ preferences: DrawingPreferences }> {
    return this.http.get<{ preferences: DrawingPreferences }>(
      `${this.baseUrl}/pages/${encodeURIComponent(pageId)}/preferences`,
      { headers: this.shareHeaders() }
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

  searchUsers(query: string): Observable<{ users: DrawingUserSearchResult[] }> {
    const params = new HttpParams().set('q', query);
    return this.http.get<{ users: DrawingUserSearchResult[] }>(`${this.baseUrl}/users/search`, { params });
  }

  listPermissions(documentId: string): Observable<{ permissions: DrawingPermission[] }> {
    return this.http.get<{ permissions: DrawingPermission[] }>(
      `${this.baseUrl}/documents/${encodeURIComponent(documentId)}/permissions`
    );
  }

  createInvitation(documentId: string, userId: string, role: Exclude<DrawingRole, 'Owner'>):
    Observable<{ invitation: DrawingInvitation }> {
    return this.http.post<{ invitation: DrawingInvitation }>(
      `${this.baseUrl}/documents/${encodeURIComponent(documentId)}/invitations`, { userId, role }
    );
  }

  listDocumentInvitations(documentId: string): Observable<{ invitations: DrawingInvitation[] }> {
    return this.http.get<{ invitations: DrawingInvitation[] }>(
      `${this.baseUrl}/documents/${encodeURIComponent(documentId)}/invitations`
    );
  }

  listReceivedInvitations(): Observable<{ invitations: DrawingInvitation[] }> {
    return this.http.get<{ invitations: DrawingInvitation[] }>(`${this.baseUrl}/invitations`);
  }

  acceptInvitation(id: string): Observable<{ invitation: DrawingInvitation }> {
    return this.http.post<{ invitation: DrawingInvitation }>(
      `${this.baseUrl}/invitations/${encodeURIComponent(id)}/accept`, {}
    );
  }

  declineInvitation(id: string): Observable<{ invitation: DrawingInvitation }> {
    return this.http.post<{ invitation: DrawingInvitation }>(
      `${this.baseUrl}/invitations/${encodeURIComponent(id)}/decline`, {}
    );
  }

  cancelInvitation(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/invitations/${encodeURIComponent(id)}`);
  }

  updatePermission(id: string, role: Exclude<DrawingRole, 'Owner'>):
    Observable<{ permission: DrawingPermission }> {
    return this.http.patch<{ permission: DrawingPermission }>(
      `${this.baseUrl}/permissions/${encodeURIComponent(id)}`, { role }
    );
  }

  revokePermission(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/permissions/${encodeURIComponent(id)}`);
  }

  getShareLink(documentId: string): Observable<{ link: DrawingShareLink }> {
    return this.http.get<{ link: DrawingShareLink }>(
      `${this.baseUrl}/documents/${encodeURIComponent(documentId)}/share-link`
    );
  }

  createShareLink(documentId: string, expiresAt?: string):
    Observable<{ link: DrawingShareLink; token: string }> {
    return this.http.post<{ link: DrawingShareLink; token: string }>(
      `${this.baseUrl}/documents/${encodeURIComponent(documentId)}/share-link`,
      expiresAt ? { expiresAt } : {}
    );
  }

  revokeShareLink(documentId: string): Observable<void> {
    return this.http.delete<void>(
      `${this.baseUrl}/documents/${encodeURIComponent(documentId)}/share-link`
    );
  }

  resolveShareLink(token: string): Observable<{
    documentId: string;
    documentName: string;
    ownerUserId: string;
    role: 'Viewer';
  }> {
    return this.http.post<{
      documentId: string;
      documentName: string;
      ownerUserId: string;
      role: 'Viewer';
    }>(`${this.baseUrl}/share-links/resolve`, { token }).pipe(
      tap(({ documentId }) => {
        sessionStorage.setItem(this.shareTokenKey(documentId), token);
        this.activeDocumentId = documentId;
      })
    );
  }

  clearShareToken(documentId: string): void {
    sessionStorage.removeItem(this.shareTokenKey(documentId));
  }

  createCollaborationSession(documentId: string, pageId: string):
    Observable<{ session: { token: string; expiresAt: number; roomName: string; role: DrawingRole } }> {
    this.activeDocumentId = documentId;
    return this.http.post<{
      session: { token: string; expiresAt: number; roomName: string; role: DrawingRole };
    }>(
      `${this.baseUrl}/documents/${encodeURIComponent(documentId)}/collaboration-session`,
      { pageId },
      { headers: this.shareHeaders(documentId) }
    );
  }

  private shareHeaders(documentId = this.activeDocumentId): HttpHeaders {
    const token = documentId ? sessionStorage.getItem(this.shareTokenKey(documentId)) : null;
    return token ? new HttpHeaders({ 'X-Drawing-Share-Token': token }) : new HttpHeaders();
  }

  private shareTokenKey(documentId: string): string {
    return `drawing-share-token:${documentId}`;
  }
}
