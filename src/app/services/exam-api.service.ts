import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from '../../environments/environment';

export interface ExamSection { id: string; name: string; count: number }
export interface ExamQuestion {
  id: string; section: string; category: string; topic: string; question: string;
  options: { id: string; text: string }[];
  correctOptionId?: string; explanation?: string;
}
export interface Exam {
  id: string; section: string; minutes: number; status: 'active' | 'finished';
  startedAt: number; deadlineAt: number; finishedAt?: number; durationSeconds?: number;
  questions: ExamQuestion[]; answers?: Record<string, string>;
  correct?: number; incorrect?: number; unanswered?: number;
}
export interface ExamHistory {
  id: string; section: string; startedAt: number; correct: number; incorrect: number;
  unanswered: number; durationSeconds: number;
}

@Injectable({ providedIn: 'root' })
export class ExamApiService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/api/exams`;
  sections() { return this.http.get<ExamSection[]>(`${this.url}/sections`); }
  history() { return this.http.get<ExamHistory[]>(`${this.url}/history`); }
  start(section: string, minutes: number) {
    return this.http.post<Exam>(`${this.url}/exams`, { section, minutes });
  }
  exam(id: string) { return this.http.get<Exam>(`${this.url}/exams/${encodeURIComponent(id)}`); }
  answer(id: string, questionId: string, optionId: string) {
    return this.http.put<Exam>(`${this.url}/exams/${encodeURIComponent(id)}/answer`, { questionId, optionId });
  }
  finish(id: string) { return this.http.post<Exam>(`${this.url}/exams/${encodeURIComponent(id)}/finish`, {}); }
  import(file: File) {
    const body = new FormData();
    body.append('file', file);
    return this.http.post<{ imported: number }>(`${this.url}/import`, body);
  }
  importInitial() { return this.http.post<{ imported: number }>(`${this.url}/import-initial`, {}); }
}
