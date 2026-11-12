import { CommonModule } from '@angular/common';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, DestroyRef, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { environment } from '../../environments/environment';
import { Tool } from '../models/tool.model';
import { AuthService } from '../services/auth.service';

interface ToolAuditEvent {
  eventId: string;
  action: string;
  actorId: string;
  targetId: string;
  occurredAt: string;
}

@Component({
  selector: 'app-tool-tracing',
  imports: [CommonModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (auth.user()?.permissions?.includes('tracing:app') || auth.user()?.permissions?.includes('monitoring:app')) {
      <section class="tool-tracing">
        <h2>Seguimiento de herramientas</h2>
        @if (auth.user()?.permissions?.includes('monitoring:app')) {
          <p>Las trazas técnicas se consultan por identificador de operación y no se vinculan automáticamente a una herramienta.</p>
          <a routerLink="/monitorizacion">Abrir monitorización y trazas</a>
        }
        @if (auth.user()?.permissions?.includes('tracing:app')) {
          <p>Últimos 25 cambios publicados de la herramienta y sus reparaciones. La auditoría es experimental; si está desactivada, los cambios no se registran. Los registros pendientes y anteriores pueden faltar. La base es compartida y no separa entornos.</p>
          <label>Herramienta
            <select [value]="selectedId()" (change)="select($any($event.target).value)">
              <option value="">Selecciona una herramienta</option>
              @for (tool of tools(); track tool.id) {
                <option [value]="tool.id">{{ tool.name }}</option>
              }
            </select>
          </label>
          <button type="button" [disabled]="!selectedId() || loading()" (click)="load()">Consultar historial</button>
          @if (loading()) { <p role="status">Consultando historial…</p> }
          @if (error()) { <p role="alert">{{ error() }}</p> }
          @if (events(); as records) {
            @if (!records.length) { <p>No hay cambios publicados para mostrar.</p> }
            @else {
              <ul>
                @for (event of records; track event.eventId) {
                  <li><time>{{ event.occurredAt | date:'dd/MM/yyyy HH:mm:ss' }}</time> · {{ event.action }} · actor: {{ event.actorId }} · objetivo: {{ event.targetId }}</li>
                }
              </ul>
            }
          }
        }
      </section>
    }
  `,
  styles: [`
    .tool-tracing { margin: 1rem 0; padding: 1rem; border: 1px solid #d6dce5; border-radius: .75rem; background: var(--surface-color, white); }
    h2 { font-size: 1rem; } p { font-size: .85rem; line-height: 1.5; }
    label { display: inline-flex; gap: .5rem; align-items: center; margin: .5rem; }
    select, button { max-width: 100%; padding: .5rem; }
    li { margin: .5rem 0; overflow-wrap: anywhere; }
  `]
})
export class ToolTracingComponent {
  readonly tools = input.required<Tool[]>();
  protected readonly auth = inject(AuthService);
  private readonly http = inject(HttpClient);
  private readonly destroyRef = inject(DestroyRef);
  private request: Subscription | null = null;
  protected readonly selectedId = signal('');
  protected readonly loading = signal(false);
  protected readonly error = signal('');
  protected readonly events = signal<ToolAuditEvent[] | null>(null);

  protected select(id: string): void {
    this.request?.unsubscribe();
    this.selectedId.set(id);
    this.events.set(null);
    this.error.set('');
    this.loading.set(false);
  }

  protected load(): void {
    const id = this.selectedId();
    if (!id || this.loading()) return;
    this.loading.set(true);
    this.error.set('');
    this.events.set(null);
    this.request = this.http.get<{ events: ToolAuditEvent[] }>(
      `${environment.apiUrl}/api/tracing/tools/${encodeURIComponent(id)}/history`
    ).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (result) => { this.events.set(result.events); this.loading.set(false); },
      error: (error: unknown) => {
        this.error.set(error instanceof HttpErrorResponse && error.status === 503 &&
          error.error?.code === 'TRACING_INDEX_UNAVAILABLE'
          ? 'No se pudo consultar el historial. Comprueba los índices de Firestore.'
          : 'No se pudo consultar el historial. Comprueba los permisos y la conexión.');
        this.loading.set(false);
      }
    });
  }
}
