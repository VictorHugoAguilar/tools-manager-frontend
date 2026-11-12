import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { TaskTracingComponent } from './task-tracing.component';

@Component({
  selector: 'app-task-board-tracing',
  imports: [RouterLink, TaskTracingComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (auth.user()?.permissions?.includes('tracing:app') || auth.user()?.permissions?.includes('monitoring:app')) {
      <section class="task-board-tracing">
        <h2>Seguimiento de tareas</h2>
        @if (auth.user()?.permissions?.includes('monitoring:app')) {
          <p>Las trazas técnicas se consultan por identificador de operación y no se vinculan automáticamente a una tarea.</p>
          <a routerLink="/monitorizacion">Abrir monitorización y trazas</a>
        }
        @if (auth.user()?.permissions?.includes('tracing:app')) {
          @if (module() === 'todo') {
            <p>El selector muestra las tareas cargadas en la vista actual, según sus filtros y paginación.</p>
          }
          <label>Tarea
            <select [value]="selectedTaskId()" (change)="select($any($event.target).value)">
              <option value="">Selecciona una tarea</option>
              @for (task of tasks(); track task.id) {
                <option [value]="task.id">{{ task.title }}</option>
              }
            </select>
          </label>
          @if (selectedTaskId(); as taskId) {
            <app-task-tracing [module]="module()" [taskId]="taskId" />
          } @else {
            <p>Selecciona una tarea para consultar su historial de auditoría.</p>
          }
        }
      </section>
    }
  `,
  styles: [`
    .task-board-tracing { margin: 1rem 0; padding: 1rem; border: 1px solid #d6dce5; border-radius: .75rem; background: var(--surface-color, white); }
    h2 { font-size: 1rem; } p { font-size: .85rem; line-height: 1.5; }
    label { display: inline-flex; gap: .5rem; align-items: center; margin: .5rem; }
    select { max-width: 100%; padding: .5rem; }
  `]
})
export class TaskBoardTracingComponent {
  readonly module = input.required<'board' | 'todo'>();
  readonly tasks = input.required<{ id: string; title: string }[]>();
  protected readonly auth = inject(AuthService);
  private readonly selection = signal('');
  protected readonly selectedTaskId = computed(() =>
    this.tasks().some((task) => task.id === this.selection()) ? this.selection() : ''
  );

  protected select(id: string): void {
    this.selection.set(id);
  }
}
