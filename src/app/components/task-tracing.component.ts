import { CommonModule } from '@angular/common';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, DestroyRef, inject, input, OnChanges, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subscription } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from '../services/auth.service';

interface TaskAuditEvent {
  eventId: string;
  action: string;
  actorId: string;
  targetId: string;
  occurredAt: string;
}

@Component({
  selector: 'app-task-tracing',
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (auth.user()?.permissions?.includes('tracing:app')) {
      <section class="task-tracing">
        <h3>Auditoría de la tarea</h3>
        <p>Últimos 25 cambios publicados de la tarea. No incluye comentarios, archivos, subtareas ni recordatorios.
          La auditoría es experimental; si está desactivada, no se registran cambios. Pueden faltar registros
          pendientes o anteriores y la base no separa entornos.</p>
        @if (module() === 'todo') {
          <p>El permiso de trazabilidad permite consultar historiales de tareas privadas de cualquier proyecto.</p>
        }
        <button type="button" [disabled]="loading()" (click)="load()">Consultar auditoría</button>
        @if (loading()) { <p role="status">Consultando auditoría…</p> }
        @if (error()) { <p role="alert">{{ error() }}</p> }
        @if (events(); as records) {
          @if (!records.length) { <p>No hay cambios publicados para mostrar.</p> }
          @else {
            <ul>
              @for (event of records; track event.eventId) {
                <li><time>{{ event.occurredAt | date:'dd/MM/yyyy HH:mm:ss' }}</time> · {{ event.action }} · actor: {{ event.actorId }}</li>
              }
            </ul>
          }
        }
      </section>
    }
  `,
  styles: [`
    .task-tracing { margin: 1rem 0; padding: 1rem; border: 1px solid #d6dce5; border-radius: .75rem; }
    p { font-size: .85rem; line-height: 1.5; } li { margin: .5rem 0; overflow-wrap: anywhere; }
  `]
})
export class TaskTracingComponent implements OnChanges {
  readonly module = input.required<'board' | 'todo'>();
  readonly taskId = input.required<string>();
  protected readonly auth = inject(AuthService);
  private readonly http = inject(HttpClient);
  private readonly destroyRef = inject(DestroyRef);
  private request: Subscription | null = null;
  protected readonly loading = signal(false);
  protected readonly error = signal('');
  protected readonly events = signal<TaskAuditEvent[] | null>(null);

  ngOnChanges(): void {
    this.request?.unsubscribe();
    this.loading.set(false);
    this.error.set('');
    this.events.set(null);
  }

  protected load(): void {
    if (!this.taskId() || this.loading()) return;
    this.loading.set(true);
    this.error.set('');
    this.events.set(null);
    this.request = this.http.get<{ events: TaskAuditEvent[] }>(
      `${environment.apiUrl}/api/tracing/tasks/${this.module()}/${encodeURIComponent(this.taskId())}/history`
    ).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (result) => { this.events.set(result.events); this.loading.set(false); },
      error: (error: unknown) => {
        this.error.set(error instanceof HttpErrorResponse && error.status === 503 &&
          error.error?.code === 'TRACING_INDEX_UNAVAILABLE'
          ? 'No se pudo consultar la auditoría. Comprueba los índices de Firestore.'
          : 'No se pudo consultar la auditoría. Comprueba los permisos y la conexión.');
        this.loading.set(false);
      }
    });
  }
}
