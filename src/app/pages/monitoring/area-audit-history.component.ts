import { CommonModule } from '@angular/common';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, DestroyRef, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { environment } from '../../../environments/environment';

interface AuditEvent {
  eventId: string;
  action: string;
  actorId: string;
  targetId: string;
  occurredAt: string;
}

@Component({
  selector: 'app-area-audit-history',
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="history">
      <h2>Historial de auditoría: {{ title() }}</h2>
      <p>Últimos 25 cambios publicados. La auditoría es experimental y no cubre todas las operaciones;
        pueden faltar registros pendientes, anteriores o realizados con la auditoría desactivada.
        La base es compartida y no separa entornos.</p>
      @if (scope() === 'drawing' || scope() === 'todo') {
        <p>Incluye identificadores y actores de recursos privados de todos los usuarios.</p>
      }
      <button type="button" [disabled]="loading()" (click)="load()" [attr.aria-label]="'Consultar historial de ' + title()">Consultar historial</button>
      @if (loading()) { <p role="status">Consultando historial…</p> }
      @if (error()) { <p role="alert">{{ error() }}</p> }
      @if (events(); as records) {
        @if (!records.length) { <p>No hay cambios publicados para mostrar.</p> }
        @else {
          <ul>@for (event of records; track event.eventId) {
            <li><time>{{ event.occurredAt | date:'dd/MM/yyyy HH:mm:ss' }}</time> · {{ event.action }} · actor: {{ event.actorId }} · objetivo: {{ event.targetId }}</li>
          }</ul>
        }
      }
    </section>
  `,
  styles: [`
    .history { padding: 1rem; color: var(--text); }
    h2 { margin: 0 0 .5rem; font-size: .9rem; }
    p { color: var(--muted); font-size: .78rem; line-height: 1.5; }
    button { min-height: 2.4rem; padding: .5rem .75rem; border: 1.5px solid var(--primary); border-radius: .65rem; background: var(--accent-yellow); color: var(--primary); font-weight: 800; cursor: pointer; }
    button:disabled { opacity: .6; cursor: wait; }
    button:focus-visible { outline: 3px solid #f47d00; outline-offset: 3px; }
    ul { padding-left: 1.2rem; max-height: 18rem; overflow: auto; }
    li { overflow-wrap: anywhere; margin: .5rem 0; font-size: .78rem; }
    [role="alert"] { color: #a22d36; }
  `]
})
export class AreaAuditHistoryComponent {
  readonly scope = input.required<'tools' | 'board' | 'todo' | 'drawing' | 'catalogs' | 'identity'>();
  readonly title = input.required<string>();
  private readonly http = inject(HttpClient);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly events = signal<AuditEvent[] | null>(null);
  protected readonly loading = signal(false);
  protected readonly error = signal('');

  protected load(): void {
    if (this.loading()) return;
    this.loading.set(true);
    this.error.set('');
    this.events.set(null);
    this.http.get<{ events: AuditEvent[] }>(`${environment.apiUrl}/api/monitoring/audit-history/${this.scope()}`)
      .pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: (result) => { this.events.set(result.events); this.loading.set(false); },
        error: (error: unknown) => {
          this.error.set(error instanceof HttpErrorResponse && error.status === 503 &&
            error.error?.code === 'MONITORING_INDEX_UNAVAILABLE'
            ? 'El historial no está disponible. Comprueba los índices de Firestore.'
            : 'No se pudo consultar el historial. Comprueba los permisos y la conexión.');
          this.loading.set(false);
        }
      });
  }
}
