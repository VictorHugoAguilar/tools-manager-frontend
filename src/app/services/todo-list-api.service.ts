import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  TodoList,
  TodoListAttachment,
  TodoListChildItem,
  TodoListComment,
  TodoListFilters,
  TodoListItem,
  TodoListItemPayload,
  TodoListItemsResponse,
  TodoListLabel,
  TodoListNotification,
  TodoListOverview,
  TodoListReminder,
  TodoListSection,
  TodoListUser
} from '../models/todo-list.model';

@Injectable({ providedIn: 'root' })
export class TodoListApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/api/todo-list`;

  loadOverview(timeZone = 'UTC'): Observable<TodoListOverview> {
    return this.http.get<TodoListOverview>(this.baseUrl, { params: { timeZone } });
  }

  listProjects(includeArchived = false): Observable<{ projects: TodoList[] }> {
    return this.http.get<{ projects: TodoList[] }>(`${this.baseUrl}/projects`, {
      params: { includeArchived: String(includeArchived) }
    });
  }

  loadItems(filters: TodoListFilters): Observable<TodoListItemsResponse> {
    let params = new HttpParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params = params.set(key, String(value));
      }
    });
    return this.http.get<TodoListItemsResponse>(`${this.baseUrl}/items`, { params });
  }

  loadProject(id: string): Observable<{ project: TodoList }> {
    return this.http.get<{ project: TodoList }>(`${this.baseUrl}/projects/${encodeURIComponent(id)}`);
  }

  createProject(payload: Pick<TodoList, 'name' | 'description' | 'color'>): Observable<{ project: TodoList }> {
    return this.http.post<{ project: TodoList }>(`${this.baseUrl}/projects`, payload);
  }

  updateProject(id: string, payload: Partial<Pick<TodoList, 'name' | 'description' | 'color'>>): Observable<{ project: TodoList }> {
    return this.http.put<{ project: TodoList }>(`${this.baseUrl}/projects/${encodeURIComponent(id)}`, payload);
  }

  deleteProject(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/projects/${encodeURIComponent(id)}`);
  }

  archiveProject(id: string, isArchived: boolean): Observable<{ project: TodoList }> {
    return this.http.patch<{ project: TodoList }>(`${this.baseUrl}/projects/${encodeURIComponent(id)}/archive`, { isArchived });
  }

  reorderProjects(ids: string[]): Observable<{ projects: TodoList[] }> {
    return this.http.post<{ projects: TodoList[] }>(`${this.baseUrl}/projects/reorder`, { ids });
  }

  loadSections(projectId: string): Observable<{ sections: TodoListSection[] }> {
    return this.http.get<{ sections: TodoListSection[] }>(
      `${this.baseUrl}/projects/${encodeURIComponent(projectId)}/sections`
    );
  }

  createSection(projectId: string, name: string): Observable<{ section: TodoListSection }> {
    return this.http.post<{ section: TodoListSection }>(
      `${this.baseUrl}/projects/${encodeURIComponent(projectId)}/sections`,
      { name }
    );
  }

  updateSection(id: string, name: string): Observable<{ section: TodoListSection }> {
    return this.http.patch<{ section: TodoListSection }>(
      `${this.baseUrl}/sections/${encodeURIComponent(id)}`,
      { name }
    );
  }

  deleteSection(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/sections/${encodeURIComponent(id)}`);
  }

  setSectionPosition(id: string, position: number): Observable<{ sections: TodoListSection[] }> {
    return this.http.patch<{ sections: TodoListSection[] }>(
      `${this.baseUrl}/sections/${encodeURIComponent(id)}/position`,
      { position }
    );
  }

  createItem(payload: TodoListItemPayload): Observable<{ item: TodoListItem }> {
    return this.http.post<{ item: TodoListItem }>(`${this.baseUrl}/items`, payload);
  }

  getItem(id: string): Observable<{ item: TodoListItem }> {
    return this.http.get<{ item: TodoListItem }>(`${this.baseUrl}/items/${encodeURIComponent(id)}`);
  }

  updateItem(id: string, payload: Partial<TodoListItemPayload>): Observable<{ item: TodoListItem }> {
    return this.http.put<{ item: TodoListItem }>(`${this.baseUrl}/items/${encodeURIComponent(id)}`, payload);
  }

  deleteItem(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/items/${encodeURIComponent(id)}`);
  }

  setItemStatus(id: string, status: 'complete' | 'reopen'): Observable<{ item: TodoListItem }> {
    return this.http.patch<{ item: TodoListItem }>(`${this.baseUrl}/items/${encodeURIComponent(id)}/${status}`, {});
  }

  setItemArchive(id: string, isArchived: boolean): Observable<{ item: TodoListItem }> {
    return this.http.patch<{ item: TodoListItem }>(`${this.baseUrl}/items/${encodeURIComponent(id)}/archive`, { isArchived });
  }

  setItemImportant(id: string, isImportant: boolean): Observable<{ item: TodoListItem }> {
    return this.http.patch<{ item: TodoListItem }>(`${this.baseUrl}/items/${encodeURIComponent(id)}/important`, { isImportant });
  }

  setItemPriority(id: string, priority: TodoListItem['priority']): Observable<{ item: TodoListItem }> {
    return this.http.patch<{ item: TodoListItem }>(`${this.baseUrl}/items/${encodeURIComponent(id)}/priority`, { priority });
  }

  moveItem(id: string, todoListId: string, sectionId: string, position?: number): Observable<{ item: TodoListItem }> {
    return this.http.patch<{ item: TodoListItem }>(
      `${this.baseUrl}/items/${encodeURIComponent(id)}/move`,
      { todoListId, sectionId, position }
    );
  }

  setItemPosition(id: string, position: number): Observable<{ item: TodoListItem }> {
    return this.http.patch<{ item: TodoListItem }>(
      `${this.baseUrl}/items/${encodeURIComponent(id)}/position`,
      { position }
    );
  }

  duplicateItem(id: string): Observable<{ item: TodoListItem }> {
    return this.http.post<{ item: TodoListItem }>(`${this.baseUrl}/items/${encodeURIComponent(id)}/duplicate`, {});
  }

  createLabel(name: string, color: TodoListLabel['color']): Observable<{ label: TodoListLabel }> {
    return this.http.post<{ label: TodoListLabel }>(`${this.baseUrl}/labels`, { name, color });
  }

  updateLabel(id: string, payload: Partial<Pick<TodoListLabel, 'name' | 'color'>>): Observable<{ label: TodoListLabel }> {
    return this.http.put<{ label: TodoListLabel }>(`${this.baseUrl}/labels/${encodeURIComponent(id)}`, payload);
  }

  deleteLabel(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/labels/${encodeURIComponent(id)}`);
  }

  createChild(itemId: string, title: string): Observable<{ child: TodoListChildItem }> {
    return this.http.post<{ child: TodoListChildItem }>(
      `${this.baseUrl}/items/${encodeURIComponent(itemId)}/children`,
      { title }
    );
  }

  updateChild(id: string, payload: Partial<Pick<TodoListChildItem, 'title' | 'status' | 'position'>>): Observable<{ child: TodoListChildItem }> {
    return this.http.put<{ child: TodoListChildItem }>(`${this.baseUrl}/children/${encodeURIComponent(id)}`, payload);
  }

  deleteChild(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/children/${encodeURIComponent(id)}`);
  }

  addComment(itemId: string, content: string): Observable<{ comment: TodoListComment }> {
    return this.http.post<{ comment: TodoListComment }>(
      `${this.baseUrl}/items/${encodeURIComponent(itemId)}/comments`,
      { content }
    );
  }

  updateComment(id: string, content: string): Observable<{ comment: TodoListComment }> {
    return this.http.put<{ comment: TodoListComment }>(`${this.baseUrl}/comments/${encodeURIComponent(id)}`, { content });
  }

  deleteComment(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/comments/${encodeURIComponent(id)}`);
  }

  uploadAttachment(itemId: string, file: File): Observable<{ attachment: TodoListAttachment }> {
    const body = new FormData();
    body.append('file', file);
    return this.http.post<{ attachment: TodoListAttachment }>(
      `${this.baseUrl}/items/${encodeURIComponent(itemId)}/attachments`,
      body
    );
  }

  deleteAttachment(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/attachments/${encodeURIComponent(id)}`);
  }

  listReminders(itemId: string): Observable<{ reminders: TodoListReminder[] }> {
    return this.http.get<{ reminders: TodoListReminder[] }>(
      `${this.baseUrl}/items/${encodeURIComponent(itemId)}/reminders`
    );
  }

  createReminder(itemId: string, type: TodoListReminder['type'], reminderDateTime?: string): Observable<{ reminder: TodoListReminder }> {
    return this.http.post<{ reminder: TodoListReminder }>(
      `${this.baseUrl}/items/${encodeURIComponent(itemId)}/reminders`,
      { type, reminderDateTime }
    );
  }

  updateReminder(id: string, reminderDateTime: string): Observable<{ reminder: TodoListReminder }> {
    return this.http.put<{ reminder: TodoListReminder }>(
      `${this.baseUrl}/reminders/${encodeURIComponent(id)}`,
      { reminderDateTime }
    );
  }

  deleteReminder(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/reminders/${encodeURIComponent(id)}`);
  }

  listNotifications(): Observable<{ notifications: TodoListNotification[] }> {
    return this.http.get<{ notifications: TodoListNotification[] }>(`${this.baseUrl}/notifications`);
  }

  markNotificationRead(id: string): Observable<void> {
    return this.http.patch<void>(`${this.baseUrl}/notifications/${encodeURIComponent(id)}/read`, {});
  }

  loadMembers(projectId: string): Observable<{ members: TodoListUser[] }> {
    return this.http.get<{ members: TodoListUser[] }>(
      `${this.baseUrl}/projects/${encodeURIComponent(projectId)}/members`
    );
  }

  addMember(projectId: string, userId: string, role: 'editor' | 'viewer'): Observable<{ member: TodoListUser }> {
    return this.http.post<{ member: TodoListUser }>(
      `${this.baseUrl}/projects/${encodeURIComponent(projectId)}/members`,
      { userId, role }
    );
  }

  removeMember(projectId: string, userId: string): Observable<void> {
    return this.http.delete<void>(
      `${this.baseUrl}/projects/${encodeURIComponent(projectId)}/members/${encodeURIComponent(userId)}`
    );
  }

  listUsers(): Observable<{ users: TodoListUser[] }> {
    return this.http.get<{ users: TodoListUser[] }>(`${this.baseUrl}/users`);
  }
}
