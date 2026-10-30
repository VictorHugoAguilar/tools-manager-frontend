import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { CdkDrag, CdkDragDrop, CdkDropList, moveItemInArray } from '@angular/cdk/drag-drop';
import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import {
  TaskBoardColumn,
  TaskBoardLabel,
  TaskBoardMember,
  TaskBoardTask,
  TaskPayload,
  TaskPriority
} from '../../models/task-board.model';
import { ConfirmService } from '../../services/confirm.service';
import { TaskBoardApiService } from '../../services/task-board-api.service';

type BoardView = 'kanban' | 'list';

@Component({
  selector: 'app-task-board-page',
  imports: [CommonModule, FormsModule, CdkDrag, CdkDropList],
  templateUrl: './task-board-page.component.html',
  styleUrl: './task-board-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TaskBoardPageComponent implements OnInit {
  private readonly api = inject(TaskBoardApiService);
  private readonly confirm = inject(ConfirmService);

  protected readonly columns = signal<TaskBoardColumn[]>([]);
  protected readonly tasks = signal<TaskBoardTask[]>([]);
  protected readonly labels = signal<TaskBoardLabel[]>([]);
  protected readonly members = signal<TaskBoardMember[]>([]);
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly loadError = signal('');
  protected readonly saveError = signal('');
  protected readonly filtersOpen = signal(false);
  protected readonly viewMode = signal<BoardView>('kanban');
  protected readonly dialogOpen = signal(false);
  protected readonly selectedTaskId = signal<string | null>(null);
  protected readonly editorOpen = signal(false);
  protected readonly commentDraft = signal('');
  protected readonly commentBusy = signal(false);
  protected readonly attachmentBusy = signal(false);
  protected readonly columnDialogOpen = signal(false);
  protected readonly labelDialogOpen = signal(false);
  protected readonly columnName = signal('');
  protected readonly columnColor = signal<TaskBoardColumn['color']>('blue');
  protected readonly labelName = signal('');
  protected readonly labelColor = signal('#8edfc0');
  protected readonly activeTask = computed(() =>
    this.tasks().find((task) => task.id === this.selectedTaskId()) ?? null
  );
  protected readonly columnDropIds = computed(() => this.columns().map((column) => `tasks-${column.id}`));

  protected searchTerm = '';
  protected filterColumnId = '';
  protected filterLabelId = '';
  protected filterPriority: TaskPriority | '' = '';
  protected filterAssigneeId = '';
  protected filterDueDate = '';
  protected overdueOnly = false;

  protected draft: TaskPayload = this.emptyTask('');

  protected hasActiveFilters(): boolean {
    return Boolean(this.searchTerm.trim() || this.filterColumnId || this.filterLabelId ||
      this.filterPriority || this.filterAssigneeId || this.filterDueDate || this.overdueOnly);
  }

  ngOnInit(): void {
    void this.loadBoard();
  }

  protected async loadBoard(): Promise<void> {
    this.loadError.set('');
    this.loading.set(true);
    try {
      const board = await firstValueFrom(this.api.load());
      this.columns.set(board.columns);
      this.tasks.set(board.tasks);
      this.labels.set(board.labels);
      this.members.set(board.members);
    } catch (error: unknown) {
      this.loadError.set(this.errorMessage(error));
    } finally {
      this.loading.set(false);
    }
  }

  protected visibleTasks(): TaskBoardTask[] {
    const query = this.searchTerm.trim().toLocaleLowerCase();
    const today = this.today();
    return this.tasks().filter((task) => {
      if (query && !`${task.title} ${task.description}`.toLocaleLowerCase().includes(query)) return false;
      if (this.filterColumnId && task.columnId !== this.filterColumnId) return false;
      if (this.filterLabelId && !task.labelIds.includes(this.filterLabelId)) return false;
      if (this.filterPriority && task.priority !== this.filterPriority) return false;
      if (this.filterAssigneeId && task.assigneeId !== this.filterAssigneeId) return false;
      if (this.filterDueDate && task.dueDate !== this.filterDueDate) return false;
      if (this.overdueOnly && (!task.dueDate || task.dueDate >= today || this.isDone(task))) return false;
      return true;
    });
  }

  protected tasksForColumn(columnId: string): TaskBoardTask[] {
    return this.visibleTasks()
      .filter((task) => task.columnId === columnId)
      .sort((left, right) => left.position - right.position);
  }

  protected taskCount(columnId: string): number {
    return this.tasks().filter((task) => task.columnId === columnId).length;
  }

  protected clearFilters(): void {
    this.searchTerm = '';
    this.filterColumnId = '';
    this.filterLabelId = '';
    this.filterPriority = '';
    this.filterAssigneeId = '';
    this.filterDueDate = '';
    this.overdueOnly = false;
  }

  protected openNewTask(columnId = this.columns()[0]?.id ?? ''): void {
    if (!columnId) return;
    this.selectedTaskId.set(null);
    this.draft = this.emptyTask(columnId);
    this.saveError.set('');
    this.editorOpen.set(true);
    this.dialogOpen.set(true);
  }

  protected openTask(task: TaskBoardTask): void {
    this.selectedTaskId.set(task.id);
    this.draft = this.toPayload(task);
    this.saveError.set('');
    this.editorOpen.set(false);
    this.dialogOpen.set(true);
  }

  protected editTask(): void {
    const task = this.activeTask();
    if (!task) return;
    this.draft = this.toPayload(task);
    this.saveError.set('');
    this.editorOpen.set(true);
  }

  protected closeTaskDialog(): void {
    if (this.saving() || this.attachmentBusy() || this.commentBusy()) return;
    this.dialogOpen.set(false);
    this.editorOpen.set(false);
    this.selectedTaskId.set(null);
    this.saveError.set('');
    this.commentDraft.set('');
  }

  protected async saveTask(): Promise<void> {
    if (this.saving()) return;
    this.saving.set(true);
    this.saveError.set('');
    try {
      const selectedId = this.selectedTaskId();
      const result = selectedId
        ? await firstValueFrom(this.api.updateTask(selectedId, this.draft))
        : await firstValueFrom(this.api.createTask(this.draft));
      this.selectedTaskId.set(result.id);
      this.editorOpen.set(false);
      await this.loadBoard();
    } catch (error: unknown) {
      this.saveError.set(this.errorMessage(error));
    } finally {
      this.saving.set(false);
    }
  }

  protected async deleteTask(): Promise<void> {
    const task = this.activeTask();
    if (!task) return;
    const accepted = await this.confirm.confirm({
      title: '¿Eliminar tarea?',
      message: `Se eliminará «${task.title}» y sus archivos adjuntos. Esta acción no se puede deshacer.`,
      confirmLabel: 'Eliminar tarea',
      cancelLabel: 'Cancelar',
      tone: 'danger'
    });
    if (!accepted) return;
    this.saving.set(true);
    this.saveError.set('');
    try {
      await firstValueFrom(this.api.deleteTask(task.id));
      this.saving.set(false);
      this.closeTaskDialog();
      await this.loadBoard();
    } catch (error: unknown) {
      this.saveError.set(this.errorMessage(error));
    } finally {
      this.saving.set(false);
    }
  }

  protected async dropTask(event: CdkDragDrop<TaskBoardTask[]>, columnId: string): Promise<void> {
    if (this.hasActiveFilters()) return;
    const task = event.item.data as TaskBoardTask;
    if (!task) return;
    const sourceColumn = task.columnId;
    const destinationTasks = this.tasksForColumn(columnId);
    let position = Math.min(event.currentIndex, destinationTasks.length);
    if (sourceColumn === columnId && event.previousIndex < event.currentIndex) position = event.currentIndex;
    if (sourceColumn === columnId && event.previousIndex > event.currentIndex) position = event.currentIndex;

    this.saving.set(true);
    try {
      await firstValueFrom(this.api.moveTask(task.id, columnId, position));
      await this.loadBoard();
    } catch (error: unknown) {
      this.loadError.set(this.errorMessage(error));
      await this.loadBoard();
    } finally {
      this.saving.set(false);
    }
  }

  protected async dropColumn(event: CdkDragDrop<TaskBoardColumn[]>): Promise<void> {
    if (event.previousIndex === event.currentIndex) return;
    const reordered = [...this.columns()];
    moveItemInArray(reordered, event.previousIndex, event.currentIndex);
    this.columns.set(reordered.map((column, position) => ({ ...column, position })));
    try {
      const result = await firstValueFrom(this.api.reorderColumns(reordered.map((column) => column.id)));
      this.columns.set(result.columns);
    } catch (error: unknown) {
      this.loadError.set(this.errorMessage(error));
      await this.loadBoard();
    }
  }

  protected openColumnDialog(): void {
    this.columnName.set('');
    this.columnColor.set('blue');
    this.saveError.set('');
    this.columnDialogOpen.set(true);
  }

  protected async createColumn(): Promise<void> {
    this.saving.set(true);
    this.saveError.set('');
    try {
      await firstValueFrom(this.api.createColumn(this.columnName(), this.columnColor()));
      this.columnDialogOpen.set(false);
      await this.loadBoard();
    } catch (error: unknown) {
      this.saveError.set(this.errorMessage(error));
    } finally {
      this.saving.set(false);
    }
  }

  protected async renameColumn(column: TaskBoardColumn): Promise<void> {
    const name = window.prompt('Nombre de la lista', column.name);
    if (name === null || !name.trim()) return;
    try {
      await firstValueFrom(this.api.updateColumn(column.id, { name: name.trim() }));
      await this.loadBoard();
    } catch (error: unknown) {
      this.loadError.set(this.errorMessage(error));
    }
  }

  protected async deleteColumn(column: TaskBoardColumn): Promise<void> {
    const count = this.taskCount(column.id);
    if (count) {
      this.loadError.set(`La lista «${column.name}» contiene tareas. Muévelas o elimínalas antes de borrarla.`);
      return;
    }
    const accepted = await this.confirm.confirm({
      title: '¿Eliminar lista?',
      message: `Se eliminará la lista «${column.name}».`,
      confirmLabel: 'Eliminar lista',
      cancelLabel: 'Cancelar',
      tone: 'danger'
    });
    if (!accepted) return;
    try {
      await firstValueFrom(this.api.deleteColumn(column.id));
      await this.loadBoard();
    } catch (error: unknown) {
      this.loadError.set(this.errorMessage(error));
    }
  }

  protected openLabelDialog(): void {
    this.labelName.set('');
    this.labelColor.set('#8edfc0');
    this.saveError.set('');
    this.labelDialogOpen.set(true);
  }

  protected async createLabel(): Promise<void> {
    this.saving.set(true);
    this.saveError.set('');
    try {
      await firstValueFrom(this.api.createLabel(this.labelName(), this.labelColor()));
      this.labelDialogOpen.set(false);
      await this.loadBoard();
    } catch (error: unknown) {
      this.saveError.set(this.errorMessage(error));
    } finally {
      this.saving.set(false);
    }
  }

  protected async deleteLabel(label: TaskBoardLabel): Promise<void> {
    const accepted = await this.confirm.confirm({
      title: '¿Eliminar etiqueta?',
      message: `Se quitará «${label.name}» del catálogo y de las tareas que la tengan.`,
      confirmLabel: 'Eliminar etiqueta',
      cancelLabel: 'Cancelar',
      tone: 'danger'
    });
    if (!accepted) return;
    try {
      await firstValueFrom(this.api.deleteLabel(label.id));
      await this.loadBoard();
    } catch (error: unknown) {
      this.loadError.set(this.errorMessage(error));
    }
  }

  protected toggleDraftLabel(labelId: string): void {
    const labelIds = this.draft.labelIds.includes(labelId)
      ? this.draft.labelIds.filter((id) => id !== labelId)
      : [...this.draft.labelIds, labelId];
    this.draft = { ...this.draft, labelIds };
  }

  protected async addComment(): Promise<void> {
    const task = this.activeTask();
    const text = this.commentDraft().trim();
    if (!task || !text || this.commentBusy()) return;
    this.commentBusy.set(true);
    this.saveError.set('');
    try {
      await firstValueFrom(this.api.addComment(task.id, text));
      this.commentDraft.set('');
      await this.loadBoard();
    } catch (error: unknown) {
      this.saveError.set(this.errorMessage(error));
    } finally {
      this.commentBusy.set(false);
    }
  }

  protected async onAttachmentSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    const task = this.activeTask();
    if (!file || !task) return;
    if (file.size > 15 * 1024 * 1024) {
      this.saveError.set('El archivo supera el límite de 15 MB.');
      return;
    }
    this.attachmentBusy.set(true);
    this.saveError.set('');
    try {
      await firstValueFrom(this.api.uploadAttachment(task.id, file));
      await this.loadBoard();
    } catch (error: unknown) {
      this.saveError.set(this.errorMessage(error));
    } finally {
      this.attachmentBusy.set(false);
    }
  }

  protected async removeAttachment(attachmentId: string): Promise<void> {
    const task = this.activeTask();
    if (!task) return;
    const accepted = await this.confirm.confirm({
      title: '¿Eliminar archivo?',
      message: 'El archivo adjunto se eliminará permanentemente.',
      confirmLabel: 'Eliminar archivo',
      cancelLabel: 'Cancelar',
      tone: 'danger'
    });
    if (!accepted) return;
    try {
      await firstValueFrom(this.api.deleteAttachment(task.id, attachmentId));
      await this.loadBoard();
    } catch (error: unknown) {
      this.saveError.set(this.errorMessage(error));
    }
  }

  protected taskLabel(labelId: string): TaskBoardLabel | undefined {
    return this.labels().find((label) => label.id === labelId);
  }

  protected member(memberId: string): TaskBoardMember | undefined {
    return this.members().find((item) => item.id === memberId);
  }

  protected memberInitials(member: TaskBoardMember): string {
    return `${member.firstName.charAt(0)}${member.lastName.charAt(0)}`.toUpperCase() || 'U';
  }

  protected dueDateLabel(value: string): string {
    if (!value) return '';
    const [year, month, day] = value.split('-');
    return `${day}/${month}/${year}`;
  }

  protected isOverdue(task: TaskBoardTask): boolean {
    return Boolean(task.dueDate && task.dueDate < this.today() && !this.isDone(task));
  }

  protected openTaskFromKeyboard(event: KeyboardEvent, task: TaskBoardTask): void {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    this.openTask(task);
  }

  protected isDone(task: TaskBoardTask): boolean {
    const column = this.columns().find((item) => item.id === task.columnId);
    return column?.name.toLocaleLowerCase() === 'hecho';
  }

  protected priorityLabel(priority: TaskPriority): string {
    return ({ low: 'Baja', medium: 'Media', high: 'Alta' })[priority];
  }

  protected currentColumnName(columnId: string): string {
    return this.columns().find((column) => column.id === columnId)?.name ?? 'Sin lista';
  }

  protected formatDate(value: string): string {
    if (!value) return '';
    return new Intl.DateTimeFormat('es-ES', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(value));
  }

  protected formatFileSize(size: number): string {
    return size < 1024 * 1024 ? `${Math.max(1, Math.round(size / 1024))} KB` : `${(size / (1024 * 1024)).toFixed(1)} MB`;
  }

  protected setView(mode: BoardView): void {
    this.viewMode.set(mode);
  }

  private emptyTask(columnId: string): TaskPayload {
    return {
      title: '',
      description: '',
      columnId,
      priority: 'medium',
      labelIds: [],
      dueDate: '',
      assigneeId: ''
    };
  }

  private toPayload(task: TaskBoardTask): TaskPayload {
    return {
      title: task.title,
      description: task.description,
      columnId: task.columnId,
      priority: task.priority,
      labelIds: [...task.labelIds],
      dueDate: task.dueDate,
      assigneeId: task.assigneeId
    };
  }

  private today(): string {
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${now.getFullYear()}-${month}-${day}`;
  }

  private errorMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse && typeof error.error?.message === 'string') {
      return error.error.message;
    }
    return error instanceof Error ? error.message : 'No se pudo completar la operación. Inténtalo de nuevo.';
  }
}
