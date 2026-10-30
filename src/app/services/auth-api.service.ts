import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import {
  AdminUserPayload,
  AvailablePermission,
  AuthUser,
  UserListResponse,
  UserProfilePayload,
  UserRole
} from '../models/auth.model';

interface AuthResponse {
  user: AuthUser;
}

@Injectable({ providedIn: 'root' })
export class AuthApiService {
  private readonly http = inject(HttpClient);

  login(email: string, password: string): Observable<AuthResponse> {
    return this.http.post<AuthResponse>('/api/auth/login', { email, password });
  }

  requestPasswordReset(email: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>('/api/auth/password-reset', { email });
  }

  completePasswordReset(token: string, password: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>('/api/auth/password-reset/complete', { token, password });
  }

  register(payload: UserProfilePayload & { email: string; password: string }): Observable<AuthResponse> {
    return this.http.post<AuthResponse>('/api/auth/register', payload);
  }

  currentUser(): Observable<AuthResponse> {
    return this.http.get<AuthResponse>('/api/auth/me');
  }

  logout(): Observable<void> {
    return this.http.post<void>('/api/auth/logout', {});
  }

  updateProfile(payload: UserProfilePayload): Observable<AuthResponse> {
    return this.http.patch<AuthResponse>('/api/users/me', payload);
  }

  changePassword(currentPassword: string, newPassword: string): Observable<{ message: string }> {
    return this.http.patch<{ message: string }>('/api/users/me/password', { currentPassword, newPassword });
  }

  uploadMyAvatar(image: File): Observable<AuthResponse> {
    const formData = new FormData();
    formData.append('image', image);
    return this.http.post<AuthResponse>('/api/users/me/avatar', formData);
  }

  listUsers(filters: {
    search?: string;
    role?: string;
    status?: string;
    page?: number;
    limit?: number;
    sort?: string;
    order?: string;
  }): Observable<UserListResponse> {
    let params = new HttpParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== '') params = params.set(key, String(value));
    });
    return this.http.get<UserListResponse>('/api/admin/users', { params });
  }

  getUser(id: string): Observable<AuthResponse> {
    return this.http.get<AuthResponse>(`/api/admin/users/${encodeURIComponent(id)}`);
  }

  createUser(payload: AdminUserPayload): Observable<AuthResponse> {
    return this.http.post<AuthResponse>('/api/admin/users', payload);
  }

  updateUser(id: string, payload: Partial<UserProfilePayload & { email: string }>): Observable<AuthResponse> {
    return this.http.patch<AuthResponse>(`/api/admin/users/${encodeURIComponent(id)}`, payload);
  }

  updateUserRole(id: string, roleId: string): Observable<AuthResponse> {
    return this.http.patch<AuthResponse>(`/api/admin/users/${encodeURIComponent(id)}/role`, { roleId });
  }

  updateUserStatus(id: string, isActive: boolean): Observable<AuthResponse> {
    return this.http.patch<AuthResponse>(`/api/admin/users/${encodeURIComponent(id)}/status`, { isActive });
  }

  resetUserPassword(id: string, newPassword: string): Observable<void> {
    return this.http.patch<void>(`/api/admin/users/${encodeURIComponent(id)}/password`, { newPassword });
  }

  deleteUser(id: string): Observable<void> {
    return this.http.delete<void>(`/api/admin/users/${encodeURIComponent(id)}`);
  }

  uploadUserAvatar(id: string, image: File): Observable<AuthResponse> {
    const formData = new FormData();
    formData.append('image', image);
    return this.http.post<AuthResponse>(`/api/admin/users/${encodeURIComponent(id)}/avatar`, formData);
  }

  listRoles(): Observable<{ roles: UserRole[] }> {
    return this.http.get<{ roles: UserRole[] }>('/api/admin/roles');
  }

  listPermissions(): Observable<{ permissions: AvailablePermission[] }> {
    return this.http.get<{ permissions: AvailablePermission[] }>('/api/admin/permissions');
  }

  updateRolePermissions(roleId: string, permissions: string[]): Observable<{ role: UserRole }> {
    return this.http.patch<{ role: UserRole }>(
      `/api/admin/roles/${encodeURIComponent(roleId)}/permissions`,
      { permissions }
    );
  }
}
