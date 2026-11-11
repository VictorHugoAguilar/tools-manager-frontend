import { CommonModule } from '@angular/common';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, DestroyRef, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AuthService } from '../../services/auth.service';
import { environment } from '../../../environments/environment';

interface StorageAuditEvent {
  eventId: string;
  action: string;
  actorId: string;
  targetId: string;
  occurredAt: string;
  boxId?: string;
  categoryId?: string;
}

@Component({
  selector: 'app-storage-audit-history',
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (auth.user()?.permissions?.includes('monitoring:app')) {
      <section class="history">
        <h2>Historial de auditoría</h2>
        <p>Últimos 25 cambios publicados de la base compartida, sin separación por entorno. Los registros pendientes y los anteriores a esta función pueden no aparecer; las lecturas se registran por separado en monitorización. Si la auditoría está desactivada, los cambios no se registran.</p>
        <button type="button" [disabled]="loading()" (click)="load()">Consultar historial</button>
        @if (loading()) { <p role="status">Consultando historial…</p> }
        @if (error()) { <p role="alert">{{ error() }}</p> }
        @if (events(); as records) {
          @if (!records.length) { <p>No hay cambios publicados para mostrar.</p> }
          @else {
            <ul>
              @for (event of records; track event.eventId) {
                <li>
                  <time>{{ event.occurredAt | date:'dd/MM/yyyy HH:mm:ss' }}</time> ·
                  {{ event.action }} · actor: {{ event.actorId }} ·
                  objetivo: {{ event.categoryId || event.targetId }}
                  @if (event.boxId) { · caja: {{ event.boxId }} }
                </li>
              }
            </ul>
          }
        }
      </section>
    }
  `,
  styles: [`.history { margin: 1.5rem 0; padding: 1rem; border: 1px solid #d6dce5; border-radius: .75rem; background: var(--surface-color, white); } .history li { overflow-wrap: anywhere; margin: .5rem 0; }`]
})
export class StorageAuditHistoryComponent {
  readonly scope = input.required<'workshop' | 'boxes'>();
  protected readonly auth = inject(AuthService);
  private readonly http = inject(HttpClient);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly events = signal<StorageAuditEvent[] | null>(null);
  protected readonly loading = signal(false);
  protected readonly error = signal('');

  protected load(): void {
    if (this.loading()) return;
    this.loading.set(true);
    this.error.set('');
    this.events.set(null);
    this.http.get<{ events: StorageAuditEvent[] }>(`${environment.apiUrl}/api/monitoring/storage-history/${this.scope()}`)
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
