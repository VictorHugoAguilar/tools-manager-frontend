import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  TaskAttachment,
  TaskBoardColumn,
  TaskBoardFilters,
  TaskBoardLabel,
  TaskBoardSnapshot,
  TaskBoardTask,
  TaskPayload
} from '../models/task-board.model';

@Injectable({ providedIn: 'root' })
export class TaskBoardApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/api/task-board`;

  load(filters: TaskBoardFilters = {}): Observable<TaskBoardSnapshot> {
    let params = new HttpParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== '' && value !== false) {
        params = params.set(key, String(value));
      }
    });
    return this.http.get<TaskBoardSnapshot>(this.baseUrl, { params });
  }

  createColumn(name: string, color: TaskBoardColumn['color']): Observable<TaskBoardColumn> {
    return this.http.post<TaskBoardColumn>(`${this.baseUrl}/columns`, { name, color });
  }

  updateColumn(id: string, changes: Partial<Pick<TaskBoardColumn, 'name' | 'color'>>): Observable<TaskBoardColumn> {
    return this.http.patch<TaskBoardColumn>(`${this.baseUrl}/columns/${encodeURIComponent(id)}`, changes);
  }

  deleteColumn(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/columns/${encodeURIComponent(id)}`);
  }

  reorderColumns(ids: string[]): Observable<{ columns: TaskBoardColumn[] }> {
    return this.http.put<{ columns: TaskBoardColumn[] }>(`${this.baseUrl}/columns/reorder`, { ids });
  }

  createTask(payload: TaskPayload): Observable<TaskBoardTask> {
    return this.http.post<TaskBoardTask>(`${this.baseUrl}/tasks`, payload);
  }

  updateTask(id: string, payload: TaskPayload): Observable<TaskBoardTask> {
    return this.http.patch<TaskBoardTask>(`${this.baseUrl}/tasks/${encodeURIComponent(id)}`, payload);
  }

  moveTask(id: string, columnId: string, position: number): Observable<TaskBoardTask> {
    return this.http.post<TaskBoardTask>(`${this.baseUrl}/tasks/${encodeURIComponent(id)}/move`, {
      columnId,
      position
    });
  }

  deleteTask(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/tasks/${encodeURIComponent(id)}`);
  }

  createLabel(name: string, color: string): Observable<TaskBoardLabel> {
    return this.http.post<TaskBoardLabel>(`${this.baseUrl}/labels`, { name, color });
  }

  deleteLabel(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/labels/${encodeURIComponent(id)}`);
  }

  addComment(taskId: string, text: string): Observable<TaskBoardTask['comments'][number]> {
    return this.http.post<TaskBoardTask['comments'][number]>(
      `${this.baseUrl}/tasks/${encodeURIComponent(taskId)}/comments`,
      { text }
    );
  }

  uploadAttachment(taskId: string, file: File): Observable<TaskAttachment> {
    const body = new FormData();
    body.append('file', file);
    return this.http.post<TaskAttachment>(
      `${this.baseUrl}/tasks/${encodeURIComponent(taskId)}/attachments`,
      body
    );
  }

  deleteAttachment(taskId: string, attachmentId: string): Observable<void> {
    return this.http.delete<void>(
      `${this.baseUrl}/tasks/${encodeURIComponent(taskId)}/attachments/${encodeURIComponent(attachmentId)}`
    );
  }
}
