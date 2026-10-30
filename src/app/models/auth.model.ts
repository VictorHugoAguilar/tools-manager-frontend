export interface AuthUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  profileImage: string;
  roleId: string;
  roleName: string;
  isActive: boolean;
  permissions: string[];
}

export interface UserListItem extends Omit<AuthUser, 'permissions'> {
  createdAt: string;
}

export interface UserListResponse {
  users: UserListItem[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export interface UserRole {
  id: string;
  name: string;
  permissions: string[];
}

export interface AvailablePermission {
  id: string;
  description: string;
}

export interface UserProfilePayload {
  firstName: string;
  lastName: string;
}

export interface AdminUserPayload extends UserProfilePayload {
  email: string;
  roleId: string;
  isActive: boolean;
  password?: string;
}
