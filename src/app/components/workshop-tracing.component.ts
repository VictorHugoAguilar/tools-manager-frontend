import { CommonModule } from '@angular/common';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { environment } from '../../environments/environment';
import { WorkshopStorageSnapshot } from '../models/workshop-storage.model';
import { AuthService } from '../services/auth.service';

interface WorkshopAuditEvent {
  eventId: string;
  action: string;
  actorId: string;
  targetId: string;
  occurredAt: string;
}

@Component({
  selector: 'app-workshop-tracing',
  imports: [CommonModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (auth.user()?.permissions?.includes('tracing:app') || auth.user()?.permissions?.includes('monitoring:app')) {
      <section class="workshop-tracing">
        <h2>Seguimiento del almacenamiento del taller</h2>
        @if (auth.user()?.permissions?.includes('monitoring:app')) {
          <p>Las trazas técnicas y las operaciones de escritura se consultan en monitorización por servicio, evento o identificador de traza; no se vinculan automáticamente a un elemento.</p>
          <a routerLink="/monitorizacion">Abrir monitorización y trazas</a>
        }
        @if (auth.user()?.permissions?.includes('tracing:app')) {
          <p>Últimos 25 cambios publicados del elemento elegido. La auditoría es experimental; si está desactivada, los cambios no se registran. Los registros pendientes y anteriores pueden faltar. La base es compartida y no separa entornos.</p>
          <label>Elemento
            <select [value]="selectedId()" (change)="select($any($event.target).value)">
              <option value="">Selecciona un elemento</option>
              @for (option of options(); track option.id) {
                <option [value]="option.id">{{ option.label }}</option>
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
    .workshop-tracing { margin: 1rem; padding: 1rem; border: 1px solid var(--line, #d6dce5); border-radius: .75rem; background: var(--surface-color, white); color: var(--text); }
    h2 { margin: 0 0 .5rem; font-size: .9rem; } p { color: var(--muted); font-size: .78rem; line-height: 1.5; }
    label { display: inline-flex; gap: .5rem; align-items: center; margin: .5rem .5rem .5rem 0; }
    select, button { max-width: 100%; padding: .5rem; }
    li { margin: .5rem 0; overflow-wrap: anywhere; font-size: .78rem; }
    [role="alert"] { color: #a22d36; }
  `]
})
export class WorkshopTracingComponent {
  readonly snapshot = input.required<WorkshopStorageSnapshot>();
  protected readonly auth = inject(AuthService);
  private readonly http = inject(HttpClient);
  private readonly destroyRef = inject(DestroyRef);
  private request: Subscription | null = null;
  protected readonly selectedId = signal('');
  protected readonly loading = signal(false);
  protected readonly error = signal('');
  protected readonly events = signal<WorkshopAuditEvent[] | null>(null);
  protected readonly options = computed(() => {
    const data = this.snapshot();
    const labelled = (kind: string, items: { id: string; name: string }[]) =>
      items.map((item) => ({ id: item.id, label: `${kind}: ${item.name}` }));
    return [
      ...labelled('Estantería', data.shelves),
      ...labelled('Nivel', data.levels),
      ...labelled('Organizador', data.organizers),
      ...labelled('Compartimento', data.compartments),
      ...labelled('Material', data.materials)
    ];
  });

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
    this.request = this.http.get<{ events: WorkshopAuditEvent[] }>(
      `${environment.apiUrl}/api/tracing/workshop/${encodeURIComponent(id)}/history`
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
