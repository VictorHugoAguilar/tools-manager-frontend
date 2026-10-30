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
import { environment } from '../../environments/environment';

interface AuthResponse {
  user: AuthUser;
}

@Injectable({ providedIn: 'root' })
export class AuthApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiUrl;

  private readonly loginUrl = `${this.baseUrl}/api/auth/login`;
  private readonly passwordResetUrl = `${this.baseUrl}/api/auth/password-reset`;
  private readonly passwordResetCompleteUrl = `${this.baseUrl}/api/auth/password-reset/complete`;
  private readonly registerUrl = `${this.baseUrl}/api/auth/register`;
  private readonly currentUserUrl = `${this.baseUrl}/api/auth/me`;
  private readonly logoutUrl = `${this.baseUrl}/api/auth/logout`;
  private readonly updateProfileUrl = `${this.baseUrl}/api/users/me`;
  private readonly changePasswordUrl = `${this.baseUrl}/api/users/me/password`;
  private readonly uploadAvatarUrl = `${this.baseUrl}/api/users/me/avatar`;
  private readonly listUsersUrl = `${this.baseUrl}/api/admin/users`;
  private readonly getUserUrl = `${this.baseUrl}/api/admin/users`;
  private readonly createUserUrl = `${this.baseUrl}/api/admin/users`;
  private readonly updateUserUrl = `${this.baseUrl}/api/admin/users`;
  private readonly updateUserRoleUrl = `${this.baseUrl}/api/admin/users`;
  private readonly updateUserStatusUrl = `${this.baseUrl}/api/admin/users`;
  private readonly resetUserPasswordUrl = `${this.baseUrl}/api/admin/users`;
  private readonly deleteUserUrl = `${this.baseUrl}/api/admin/users`;
  private readonly uploadUserAvatarUrl = `${this.baseUrl}/api/admin/users`;
  private readonly listRolesUrl = `${this.baseUrl}/api/admin/roles`;
  private readonly listPermissionsUrl = `${this.baseUrl}/api/admin/permissions`;
  private readonly updateRolePermissionsUrl = `${this.baseUrl}/api/admin/roles`;


  login(email: string, password: string): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(this.loginUrl, { email, password });
  }

  requestPasswordReset(email: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(this.passwordResetUrl, { email });
  }

  completePasswordReset(token: string, password: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(this.passwordResetCompleteUrl, { token, password });
  }

  register(payload: UserProfilePayload & { email: string; password: string }, image?: File): Observable<AuthResponse> {
    if (!image) return this.http.post<AuthResponse>(this.registerUrl, payload);

    const formData = new FormData();
    Object.entries(payload).forEach(([key, value]) => formData.append(key, value));
    formData.append('image', image);
    return this.http.post<AuthResponse>(this.registerUrl, formData);
  }

  currentUser(): Observable<AuthResponse> {
    return this.http.get<AuthResponse>(this.currentUserUrl);
  }

  logout(): Observable<void> {
    return this.http.post<void>(this.logoutUrl, {});
  }

  updateProfile(payload: UserProfilePayload): Observable<AuthResponse> {
    return this.http.patch<AuthResponse>(this.updateProfileUrl, payload);
  }

  changePassword(currentPassword: string, newPassword: string): Observable<{ message: string }> {
    return this.http.patch<{ message: string }>(this.changePasswordUrl, { currentPassword, newPassword });
  }

  uploadMyAvatar(image: File): Observable<AuthResponse> {
    const formData = new FormData();
    formData.append('image', image);
    return this.http.post<AuthResponse>(this.uploadAvatarUrl, formData);
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
    return this.http.get<UserListResponse>(this.listUsersUrl, { params });
  }

  getUser(id: string): Observable<AuthResponse> {
    return this.http.get<AuthResponse>(`${this.getUserUrl}/${encodeURIComponent(id)}`);
  }

  createUser(payload: AdminUserPayload): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(this.createUserUrl, payload);
  }

  updateUser(id: string, payload: Partial<UserProfilePayload & { email: string }>): Observable<AuthResponse> {
    return this.http.patch<AuthResponse>(`${this.updateUserUrl}/${encodeURIComponent(id)}`, payload);
  }

  updateUserRole(id: string, roleId: string): Observable<AuthResponse> {
    return this.http.patch<AuthResponse>(`${this.updateUserRoleUrl}/${encodeURIComponent(id)}/role`, { roleId });
  }

  updateUserStatus(id: string, isActive: boolean): Observable<AuthResponse> {
    return this.http.patch<AuthResponse>(`${this.updateUserStatusUrl}/${encodeURIComponent(id)}/status`, { isActive });
  }

  resetUserPassword(id: string, newPassword: string): Observable<void> {
    return this.http.patch<void>(`${this.resetUserPasswordUrl}/${encodeURIComponent(id)}/password`, { newPassword });
  }

  deleteUser(id: string): Observable<void> {
    return this.http.delete<void>(`${this.deleteUserUrl}/${encodeURIComponent(id)}`);
  }

  uploadUserAvatar(id: string, image: File): Observable<AuthResponse> {
    const formData = new FormData();
    formData.append('image', image);
    return this.http.post<AuthResponse>(`${this.uploadUserAvatarUrl}/${encodeURIComponent(id)}/avatar`, formData);
  }

  listRoles(): Observable<{ roles: UserRole[] }> {
    return this.http.get<{ roles: UserRole[] }>(`${this.listRolesUrl}`);
  }

  listPermissions(): Observable<{ permissions: AvailablePermission[] }> {
    return this.http.get<{ permissions: AvailablePermission[] }>(`${this.listPermissionsUrl}`);
  }

  updateRolePermissions(roleId: string, permissions: string[]): Observable<{ role: UserRole }> {
    return this.http.patch<{ role: UserRole }>(
      `${this.updateRolePermissionsUrl}/${encodeURIComponent(roleId)}/permissions`,
      { permissions }
    );
  }
}
