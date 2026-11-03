import { CdkDrag, CdkDragDrop, CdkDropList, CdkDropListGroup, moveItemInArray, transferArrayItem } from '@angular/cdk/drag-drop';
import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import {
  TodoList,
  TodoListAttachment,
  TodoListChildItem,
  TodoListComment,
  TodoListColor,
  TodoListFilters,
  TodoListItem,
  TodoListItemPayload,
  TodoListLabel,
  TodoListNotification,
  TodoListOverview,
  TodoListPriority,
  TodoListRecurrenceFrequency,
  TodoListReminder,
  TodoListSection,
  TodoListUser,
  TodoListView
} from '../../models/todo-list.model';
import { ConfirmService } from '../../services/confirm.service';
import { TodoListApiService } from '../../services/todo-list-api.service';

type TodoListModalKind = 'task' | 'project' | 'label' | 'share' | 'section';
type TodoListDisplay = 'list' | 'board' | 'calendar';
type TodoListFormRelation = 'labelIds' | 'assigneeUserIds';

interface TodoListFormState {
  title: string;
  description: string;
  todoListId: string;
  sectionId: string;
  priority: TodoListPriority;
  isImportant: boolean;
  dueDate: string;
  dueTime: string;
  labelIds: string[];
  assigneeUserIds: string[];
  frequency: TodoListRecurrenceFrequency | '';
  interval: number;
  daysOfWeek: number[];
  unit: 'days' | 'weeks' | 'months' | '';
  startDate: string;
  endDate: string;
}

interface TodoListBoardColumn {
  id: string;
  sectionId: string;
  name: string;
  items: TodoListItem[];
}

@Component({
  selector: 'app-todo-list-page',
  standalone: true,
  imports: [CommonModule, FormsModule, CdkDropListGroup, CdkDropList, CdkDrag],
  templateUrl: './todo-list-page.component.html',
  styleUrl: './todo-list-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TodoListPageComponent implements OnInit, OnDestroy {
  private readonly todoListApi = inject(TodoListApiService);
  private readonly todoListConfirm = inject(ConfirmService);
  private readonly todoListAuth = inject(AuthService);

  protected readonly todoListOverview = signal<TodoListOverview | null>(null);
  protected readonly todoListItems = signal<TodoListItem[]>([]);
  protected readonly todoListProjects = computed(() => this.todoListOverview()?.projects ?? []);
  protected readonly todoListArchivedProjects = signal<TodoList[]>([]);
  protected readonly todoListLabels = computed(() => this.todoListOverview()?.labels ?? []);
  protected readonly todoListUsers = computed(() => this.todoListOverview()?.users ?? []);
  protected readonly todoListFormProjectMembers = signal<TodoListUser[]>([]);
  protected readonly todoListCurrentUserId = computed(() => this.todoListAuth.user()?.id ?? '');
  protected readonly todoListSelectedProject = computed(
    () => [...this.todoListProjects(), ...this.todoListArchivedProjects()]
      .find((project) => project.id === (this.todoListProjectFilter() || this.todoListProjectId())) ?? null
  );
  protected readonly todoListBoardColumns = computed<TodoListBoardColumn[]>(() => {
    const todoListSections = this.todoListSections();
    const todoListColumns = todoListSections.length
      ? todoListSections.map((section) => ({ id: `todoList-column-${section.id}`, sectionId: section.id, name: section.name }))
      : [{ id: 'todoList-column-none', sectionId: '', name: 'Sin sección' }];
    return todoListColumns.map((column) => ({
      ...column,
      items: this.todoListItems()
        .filter((item) => item.sectionId === column.sectionId)
        .sort((left, right) => left.position - right.position)
    }));
  });
  protected readonly todoListShareCandidates = computed(() => {
    const todoListCurrentMembers = new Set([
      this.todoListSelectedProject()?.ownerUserId ?? '',
      ...this.todoListMembers().map((member) => member.id)
    ]);
    return this.todoListUsers().filter((user) => !todoListCurrentMembers.has(user.id));
  });
  protected readonly todoListFormAssignees = computed(() => {
    const projectId = this.todoListForm.todoListId;
    if (!projectId) {
      return this.todoListUsers().filter((user) => user.id === this.todoListCurrentUserId());
    }
    const project = [...this.todoListProjects(), ...this.todoListArchivedProjects()]
      .find((entry) => entry.id === projectId);
    const availableIds = new Set([
      project?.ownerUserId ?? '',
      ...this.todoListFormProjectMembers().map((member) => member.id)
    ]);
    return this.todoListUsers().filter((user) => availableIds.has(user.id));
  });
  protected readonly todoListContextTitle = computed(() => {
    if (this.todoListView() === 'project') return this.todoListSelectedProject()?.name ?? 'Proyecto';
    if (this.todoListProjectFilter()) return this.todoListSelectedProject()?.name ?? 'Proyecto';
    if (this.todoListIsAssignedTasksView()) return 'Asignadas a mí';
    const todoListTitles: Record<TodoListView, string> = {
      inbox: 'Bandeja de entrada',
      today: 'Hoy',
      upcoming: 'Próximas',
      overdue: 'Vencidas',
      important: 'Importantes',
      completed: 'Completadas',
      archived: 'Archivadas',
      project: 'Proyecto',
      all: 'Todas las tareas'
    };
    return todoListTitles[this.todoListView()];
  });
  protected readonly todoListContextEyebrow = computed(() =>
    this.todoListView() === 'project' || this.todoListProjectFilter() ? 'PROYECTO' : 'TU ESPACIO DE TRABAJO'
  );
  protected readonly todoListEmptyTitle = computed(() => {
    if (this.todoListSearch() || this.todoListPriorityFilter() || this.todoListLabelFilter() ||
      this.todoListAssigneeFilter() || this.todoListStatusFilter() || this.todoListImportantFilter() ||
      this.todoListOverdueFilter() || this.todoListNoDueDateFilter() || this.todoListRecurringFilter() ||
      this.todoListDueDateFilter() || this.todoListSectionId() || this.todoListProjectFilter()) {
      return 'No hay tareas con estos filtros';
    }
    return 'Todo en orden';
  });
  protected readonly todoListWeekdays = ['LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB', 'DOM'];
  protected readonly todoListRecurrenceDays = [
    { value: 1, label: 'Lun' },
    { value: 2, label: 'Mar' },
    { value: 3, label: 'Mié' },
    { value: 4, label: 'Jue' },
    { value: 5, label: 'Vie' },
    { value: 6, label: 'Sáb' },
    { value: 0, label: 'Dom' }
  ];

  protected readonly todoListView = signal<TodoListView>('inbox');
  protected readonly todoListDisplay = signal<TodoListDisplay>('list');
  protected readonly todoListProjectId = signal('');
  protected readonly todoListProjectFilter = signal('');
  protected readonly todoListSectionId = signal('');
  protected readonly todoListSections = signal<TodoListSection[]>([]);
  protected readonly todoListFormSections = signal<TodoListSection[]>([]);
  protected readonly todoListSearch = signal('');
  protected readonly todoListPriorityFilter = signal<TodoListPriority | ''>('');
  protected readonly todoListLabelFilter = signal('');
  protected readonly todoListAssigneeFilter = signal('');
  protected readonly todoListStatusFilter = signal<TodoListFilters['status']>('');
  protected readonly todoListImportantFilter = signal<TodoListFilters['important']>('');
  protected readonly todoListOverdueFilter = signal(false);
  protected readonly todoListNoDueDateFilter = signal(false);
  protected readonly todoListRecurringFilter = signal(false);
  protected readonly todoListDueDateFilter = signal('');
  protected readonly todoListSort = signal<TodoListFilters['sort']>('dueDate');
  protected readonly todoListCurrentPage = signal(1);
  protected readonly todoListPages = signal(1);
  protected readonly todoListTotal = signal(0);
  protected readonly todoListCalendarMonth = signal(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  protected readonly todoListSelectedDate = signal('');
  protected readonly todoListLoading = signal(false);
  protected readonly todoListItemsLoading = signal(false);
  protected readonly todoListSaving = signal(false);
  protected readonly todoListError = signal('');
  protected readonly todoListSuccess = signal('');
  protected readonly todoListModalKind = signal<TodoListModalKind | null>(null);
  protected readonly todoListNotificationsOpen = signal(false);
  protected readonly todoListNotifications = signal<TodoListNotification[]>([]);
  protected readonly todoListDetail = signal<TodoListItem | null>(null);
  protected readonly todoListMembers = signal<TodoListUser[]>([]);
  protected readonly todoListEditingItemId = signal('');
  protected readonly todoListOpenTaskActionsId = signal('');
  protected readonly todoListEditingProjectId = signal('');
  protected readonly todoListEditingLabelId = signal('');
  protected readonly todoListEditingSectionId = signal('');
  protected todoListEditingSectionName = '';
  protected readonly todoListShareUserId = signal('');
  protected readonly todoListShareRole = signal<'editor' | 'viewer'>('editor');
  protected readonly todoListEditingChildId = signal('');
  protected readonly todoListEditingCommentId = signal('');
  protected readonly todoListEditingReminderId = signal('');
  protected todoListEditingChildTitle = '';
  protected todoListEditingCommentContent = '';
  protected todoListEditingReminderDateTime = '';
  protected todoListReminderType: TodoListReminder['type'] = 'at_due';
  protected todoListReminderDateTime = '';
  protected todoListQuickTitle = '';
  protected todoListChildTitle = '';
  protected todoListCommentText = '';
  protected todoListSectionName = '';
  protected todoListProjectForm: { name: string; description: string; color: TodoListColor } = {
    name: '',
    description: '',
    color: 'blue'
  };
  protected todoListLabelForm: { name: string; color: TodoListColor } = {
    name: '',
    color: 'mint'
  };
  protected todoListForm: TodoListFormState = this.todoListEmptyForm();
  private todoListSearchTimer?: ReturnType<typeof setTimeout>;
  private todoListNotificationPollTimer?: ReturnType<typeof setInterval>;
  private todoListNotificationsLoading = false;
  private todoListItemsRequestId = 0;

  ngOnInit(): void {
    void this.todoListLoadOverview();
    this.todoListNotificationPollTimer = setInterval(() => {
      void this.todoListLoadNotifications();
    }, 30_000);
  }

  ngOnDestroy(): void {
    if (this.todoListSearchTimer) clearTimeout(this.todoListSearchTimer);
    if (this.todoListNotificationPollTimer) clearInterval(this.todoListNotificationPollTimer);
  }

  protected async todoListLoadOverview(): Promise<void> {
    this.todoListLoading.set(true);
    this.todoListError.set('');
    try {
      const todoListTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
      const [todoListOverview, todoListProjects] = await Promise.all([
        firstValueFrom(this.todoListApi.loadOverview(todoListTimeZone)),
        firstValueFrom(this.todoListApi.listProjects(true))
      ]);
      this.todoListOverview.set(todoListOverview);
      this.todoListArchivedProjects.set(todoListProjects.projects.filter((project) => project.isArchived));
      this.todoListNotifications.set(todoListOverview.notifications);
      await this.todoListLoadItems();
    } catch (error) {
      this.todoListSetRequestError(error);
    } finally {
      this.todoListLoading.set(false);
    }
  }

  protected async todoListLoadItems(append = false, page = 1): Promise<void> {
    if (append && this.todoListItemsLoading()) return;
    const requestId = ++this.todoListItemsRequestId;
    this.todoListItemsLoading.set(true);
    const todoListQueryView = this.todoListDisplay() === 'calendar' ||
      (this.todoListProjectFilter() && this.todoListView() === 'inbox')
      ? 'all'
      : this.todoListView();
    const todoListFilters: TodoListFilters = {
      view: todoListQueryView,
      status: this.todoListStatusFilter(),
      todoListId: this.todoListProjectFilter() || (this.todoListView() === 'project' ? this.todoListProjectId() : ''),
      sectionId: this.todoListView() === 'project' || this.todoListProjectFilter() ? this.todoListSectionId() : '',
      search: this.todoListSearch(),
      priority: this.todoListPriorityFilter(),
      labelId: this.todoListLabelFilter(),
      assigneeUserId: this.todoListAssigneeFilter(),
      important: this.todoListImportantFilter(),
      overdue: this.todoListOverdueFilter() ? 'true' : '',
      noDueDate: this.todoListNoDueDateFilter() ? 'true' : '',
      recurring: this.todoListRecurringFilter() ? 'true' : '',
      dueDate: this.todoListDueDateFilter(),
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
      sort: this.todoListSort(),
      page,
      limit: 100
    };
    try {
      const todoListResponse = await firstValueFrom(this.todoListApi.loadItems(todoListFilters));
      if (requestId !== this.todoListItemsRequestId) return;
      this.todoListItems.update((items) => append ? [...items, ...todoListResponse.items] : todoListResponse.items);
      this.todoListCurrentPage.set(todoListResponse.page);
      this.todoListPages.set(todoListResponse.pages);
      this.todoListTotal.set(todoListResponse.total);
    } catch (error) {
      if (requestId === this.todoListItemsRequestId) this.todoListSetRequestError(error);
    } finally {
      if (requestId === this.todoListItemsRequestId) this.todoListItemsLoading.set(false);
    }
  }

  protected todoListSelectView(todoListView: TodoListView): void {
    this.todoListView.set(todoListView);
    this.todoListProjectFilter.set('');
    this.todoListProjectId.set('');
    this.todoListSectionId.set('');
    this.todoListSections.set([]);
    if (todoListView !== 'project') this.todoListDisplay.set('list');
    void this.todoListLoadItems();
  }

  protected todoListSelectAssignedTasks(): void {
    const currentUserId = this.todoListCurrentUserId();
    if (!currentUserId) return;
    this.todoListView.set('all');
    this.todoListProjectFilter.set('');
    this.todoListProjectId.set('');
    this.todoListSectionId.set('');
    this.todoListSections.set([]);
    this.todoListDisplay.set('list');
    this.todoListAssigneeFilter.set(currentUserId);
    void this.todoListLoadItems();
  }

  protected todoListIsAssignedTasksView(): boolean {
    return this.todoListView() === 'all' && this.todoListAssigneeFilter() === this.todoListCurrentUserId();
  }

  protected todoListSelectProject(todoListProject: TodoList): void {
    this.todoListView.set('project');
    this.todoListProjectFilter.set('');
    this.todoListDisplay.set('list');
    this.todoListProjectId.set(todoListProject.id);
    this.todoListSectionId.set('');
    void this.todoListLoadProjectSections(todoListProject.id);
    void this.todoListLoadItems();
  }

  protected todoListSelectSection(todoListSectionId: string): void {
    this.todoListSectionId.set(todoListSectionId);
    void this.todoListLoadItems();
  }

  protected async todoListUpdateProjectFilter(projectId: string): Promise<void> {
    this.todoListProjectFilter.set(projectId);
    this.todoListView.set('all');
    this.todoListProjectId.set('');
    this.todoListDisplay.set('list');
    this.todoListSectionId.set('');
    if (projectId) {
      this.todoListSections.set([]);
      await this.todoListLoadProjectSections(projectId);
    } else {
      this.todoListSections.set([]);
    }
    void this.todoListLoadItems();
  }

  protected async todoListLoadProjectSections(todoListProjectId: string): Promise<void> {
    try {
      const response = await firstValueFrom(this.todoListApi.loadSections(todoListProjectId));
      if (this.todoListProjectId() === todoListProjectId || this.todoListProjectFilter() === todoListProjectId) {
        this.todoListSections.set(response.sections);
      }
    } catch (error) {
      this.todoListSetRequestError(error);
    }
  }

  protected todoListUpdateSearch(value: string): void {
    this.todoListSearch.set(value);
    if (this.todoListSearchTimer) clearTimeout(this.todoListSearchTimer);
    this.todoListSearchTimer = setTimeout(() => void this.todoListLoadItems(), 250);
  }

  protected todoListUpdatePriority(value: string | number): void {
    const todoListPriority = Number(value);
    this.todoListPriorityFilter.set(
      value === '' || ![1, 2, 3, 4].includes(todoListPriority)
        ? ''
        : todoListPriority === 1 ? 1 : todoListPriority === 2 ? 2 : todoListPriority === 3 ? 3 : 4
    );
    void this.todoListLoadItems();
  }

  protected todoListUpdateAssignee(value: string): void {
    if (this.todoListIsAssignedTasksView() && value !== this.todoListCurrentUserId()) {
      this.todoListView.set('all');
    }
    this.todoListAssigneeFilter.set(value);
    void this.todoListLoadItems();
  }

  protected todoListUpdateStatus(value: TodoListFilters['status']): void {
    this.todoListStatusFilter.set(value);
    void this.todoListLoadItems();
  }

  protected todoListUpdateImportant(value: TodoListFilters['important']): void {
    this.todoListImportantFilter.set(value);
    void this.todoListLoadItems();
  }

  protected todoListUpdateDueDate(value: string): void {
    this.todoListDueDateFilter.set(value);
    void this.todoListLoadItems();
  }

  protected todoListToggleOverdueFilter(): void {
    this.todoListOverdueFilter.update((value) => !value);
    if (this.todoListOverdueFilter()) this.todoListNoDueDateFilter.set(false);
    void this.todoListLoadItems();
  }

  protected todoListToggleNoDueDateFilter(): void {
    this.todoListNoDueDateFilter.update((value) => !value);
    if (this.todoListNoDueDateFilter()) this.todoListOverdueFilter.set(false);
    void this.todoListLoadItems();
  }

  protected todoListToggleRecurringFilter(): void {
    this.todoListRecurringFilter.update((value) => !value);
    void this.todoListLoadItems();
  }

  protected async todoListLoadMore(): Promise<void> {
    if (this.todoListCurrentPage() < this.todoListPages()) {
      await this.todoListLoadItems(true, this.todoListCurrentPage() + 1);
    }
  }

  protected todoListUpdateSort(value: TodoListFilters['sort']): void {
    this.todoListSort.set(value);
    void this.todoListLoadItems();
  }

  protected todoListToggleLabelFilter(todoListLabelId: string): void {
    this.todoListLabelFilter.update((current) => current === todoListLabelId ? '' : todoListLabelId);
    void this.todoListLoadItems();
  }

  protected todoListClearFilters(): void {
    this.todoListSearch.set('');
    this.todoListPriorityFilter.set('');
    this.todoListLabelFilter.set('');
    this.todoListAssigneeFilter.set('');
    this.todoListStatusFilter.set('');
    this.todoListImportantFilter.set('');
    this.todoListOverdueFilter.set(false);
    this.todoListNoDueDateFilter.set(false);
    this.todoListRecurringFilter.set(false);
    this.todoListDueDateFilter.set('');
    this.todoListProjectFilter.set('');
    this.todoListSectionId.set('');
    this.todoListSort.set('dueDate');
    void this.todoListLoadItems();
  }

  protected todoListSetDisplay(todoListDisplay: TodoListDisplay): void {
    if (todoListDisplay === 'board' && this.todoListView() !== 'project') return;
    if (todoListDisplay === 'board') this.todoListSort.set('position');
    this.todoListDisplay.set(todoListDisplay);
    void this.todoListLoadItems();
  }

  protected todoListOpenTaskForm(todoListItem?: TodoListItem | string, todoListSectionId = ''): void {
    if (this.todoListSelectedProject()?.isArchived && this.todoListView() === 'project') {
      this.todoListError.set('Recupera el proyecto antes de añadir o modificar tareas.');
      return;
    }
    this.todoListEditingItemId.set('');
    this.todoListForm = this.todoListEmptyForm();
    this.todoListForm.todoListId = this.todoListProjectFilter() ||
      (this.todoListView() === 'project' ? this.todoListProjectId() : '');
    if (todoListSectionId) this.todoListForm.sectionId = todoListSectionId;
    if (typeof todoListItem === 'object' && todoListItem) {
      this.todoListEditingItemId.set(todoListItem.id);
      this.todoListForm = {
        title: todoListItem.title,
        description: todoListItem.description,
        todoListId: todoListItem.todoListId,
        sectionId: todoListItem.sectionId,
        priority: todoListItem.priority,
        isImportant: todoListItem.isImportant,
        dueDate: todoListItem.dueDate,
        dueTime: todoListItem.dueTime,
        labelIds: [...todoListItem.labelIds],
        assigneeUserIds: [...todoListItem.assigneeUserIds],
        frequency: todoListItem.recurrence?.frequency ?? '',
        interval: todoListItem.recurrence?.interval ?? 1,
        daysOfWeek: [...(todoListItem.recurrence?.daysOfWeek ?? [])],
        unit: todoListItem.recurrence?.unit ?? '',
        startDate: todoListItem.recurrence?.startDate ?? todoListItem.dueDate,
        endDate: todoListItem.recurrence?.endDate ?? ''
      };
    }
    this.todoListModalKind.set('task');
    void this.todoListLoadFormSections();
  }

  protected async todoListLoadFormSections(): Promise<void> {
    const todoListProjectId = this.todoListForm.todoListId;
    this.todoListFormProjectMembers.set([]);
    if (!todoListProjectId) {
      this.todoListFormSections.set([]);
      this.todoListForm.sectionId = '';
      const currentUserId = this.todoListCurrentUserId();
      this.todoListForm.assigneeUserIds = this.todoListForm.assigneeUserIds
        .filter((userId) => userId === currentUserId);
      return;
    }
    try {
      const [response, membersResponse] = await Promise.all([
        firstValueFrom(this.todoListApi.loadSections(todoListProjectId)),
        firstValueFrom(this.todoListApi.loadMembers(todoListProjectId))
      ]);
      if (this.todoListForm.todoListId === todoListProjectId) {
        this.todoListFormSections.set(response.sections);
        this.todoListFormProjectMembers.set(membersResponse.members);
        const availableAssigneeIds = new Set(this.todoListFormAssignees().map((user) => user.id));
        this.todoListForm.assigneeUserIds = this.todoListForm.assigneeUserIds
          .filter((userId) => availableAssigneeIds.has(userId));
        if (!response.sections.some((section) => section.id === this.todoListForm.sectionId)) {
          this.todoListForm.sectionId = '';
        }
      }
    } catch (error) {
      this.todoListSetRequestError(error);
    }
  }

  protected todoListToggleFormId(todoListRelation: TodoListFormRelation, todoListId: string): void {
    const todoListIds = this.todoListForm[todoListRelation];
    this.todoListForm[todoListRelation] = todoListIds.includes(todoListId)
      ? todoListIds.filter((id) => id !== todoListId)
      : [...todoListIds, todoListId];
  }

  protected todoListToggleRecurrenceDay(day: number): void {
    const days = this.todoListForm.daysOfWeek;
    this.todoListForm.daysOfWeek = days.includes(day)
      ? days.filter((currentDay) => currentDay !== day)
      : [...days, day].sort((left, right) => left - right);
  }

  protected async todoListSaveTask(): Promise<void> {
    this.todoListSaving.set(true);
    this.todoListError.set('');
    const todoListPayload: TodoListItemPayload = {
      title: this.todoListForm.title.trim(),
      description: this.todoListForm.description.trim(),
      todoListId: this.todoListForm.todoListId,
      sectionId: this.todoListForm.sectionId,
      priority: this.todoListForm.priority,
      isImportant: this.todoListForm.isImportant,
      dueDate: this.todoListForm.dueDate,
      dueTime: this.todoListForm.dueTime,
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
      labelIds: this.todoListForm.labelIds,
      assigneeUserIds: this.todoListForm.assigneeUserIds,
      recurrence: this.todoListForm.frequency
        ? {
            frequency: this.todoListForm.frequency,
            interval: this.todoListForm.interval,
            daysOfWeek: this.todoListForm.daysOfWeek,
            unit: this.todoListForm.unit,
            startDate: this.todoListForm.startDate,
            endDate: this.todoListForm.endDate,
            isActive: true
          }
        : null
    };
    try {
      if (this.todoListEditingItemId()) {
        await firstValueFrom(this.todoListApi.updateItem(this.todoListEditingItemId(), todoListPayload));
      } else {
        await firstValueFrom(this.todoListApi.createItem(todoListPayload));
      }
      this.todoListModalKind.set(null);
      this.todoListShowSuccess('La tarea se ha guardado.');
      await this.todoListRefreshData();
    } catch (error) {
      this.todoListSetRequestError(error);
    } finally {
      this.todoListSaving.set(false);
    }
  }

  protected async todoListQuickCreate(): Promise<void> {
    const title = this.todoListQuickTitle.trim();
    if (!title) return;
    try {
      await firstValueFrom(this.todoListApi.createItem({
        title,
        todoListId: this.todoListProjectFilter() ||
          (this.todoListView() === 'project' ? this.todoListProjectId() : ''),
        dueDate: this.todoListSelectedDate() ||
          (this.todoListView() === 'today' ? this.todoListLocalDateKey(new Date()) : '')
      }));
      this.todoListQuickTitle = '';
      this.todoListSelectedDate.set('');
      this.todoListShowSuccess('Tarea creada.');
      await this.todoListRefreshData();
    } catch (error) {
      this.todoListSetRequestError(error);
    }
  }

  protected async todoListToggleStatus(todoListItem: TodoListItem): Promise<void> {
    try {
      await firstValueFrom(this.todoListApi.setItemStatus(
        todoListItem.id,
        todoListItem.status === 'completed' ? 'reopen' : 'complete'
      ));
      await this.todoListRefreshData(todoListItem.id);
    } catch (error) {
      this.todoListSetRequestError(error);
    }
  }

  protected async todoListToggleDetailStatus(): Promise<void> {
    const todoListItem = this.todoListDetail();
    if (todoListItem) await this.todoListToggleStatus(todoListItem);
  }

  protected async todoListToggleImportant(todoListItem: TodoListItem): Promise<void> {
    try {
      await firstValueFrom(this.todoListApi.setItemImportant(todoListItem.id, !todoListItem.isImportant));
      await this.todoListRefreshData(todoListItem.id);
    } catch (error) {
      this.todoListSetRequestError(error);
    }
  }

  protected async todoListDeleteItem(todoListItem: TodoListItem): Promise<void> {
    if (!await this.todoListConfirmDelete(
      '¿Eliminar tarea?',
      `Se eliminará «${todoListItem.title}» y sus subtareas, comentarios, recordatorios y archivos. Esta acción no se puede deshacer.`,
      'Eliminar tarea'
    )) return;
    try {
      await firstValueFrom(this.todoListApi.deleteItem(todoListItem.id));
      if (this.todoListDetail()?.id === todoListItem.id) this.todoListDetail.set(null);
      this.todoListShowSuccess('Tarea eliminada.');
      await this.todoListRefreshData();
    } catch (error) {
      this.todoListSetRequestError(error);
    }
  }

  protected async todoListRestoreItem(todoListItem: TodoListItem): Promise<void> {
    try {
      if (todoListItem.isArchived) {
        await firstValueFrom(this.todoListApi.setItemArchive(todoListItem.id, false));
      } else {
        await firstValueFrom(this.todoListApi.setItemStatus(todoListItem.id, 'reopen'));
      }
      await this.todoListRefreshData(todoListItem.id);
    } catch (error) {
      this.todoListSetRequestError(error);
    }
  }

  protected async todoListArchiveItem(todoListItem: TodoListItem): Promise<void> {
    if (!await this.todoListConfirmDelete(
      '¿Archivar tarea?',
      `La tarea «${todoListItem.title}» dejará de aparecer entre las tareas activas. Podrás recuperarla desde Archivadas.`,
      'Archivar tarea'
    )) return;
    try {
      await firstValueFrom(this.todoListApi.setItemArchive(todoListItem.id, true));
      this.todoListShowSuccess('Tarea archivada.');
      await this.todoListRefreshData();
    } catch (error) {
      this.todoListSetRequestError(error);
    }
  }

  protected async todoListDuplicateItem(todoListItem: TodoListItem): Promise<void> {
    try {
      await firstValueFrom(this.todoListApi.duplicateItem(todoListItem.id));
      this.todoListShowSuccess('Tarea duplicada.');
      await this.todoListRefreshData();
    } catch (error) {
      this.todoListSetRequestError(error);
    }
  }

  protected async todoListOpenDetail(todoListItem: TodoListItem | string): Promise<void> {
    this.todoListError.set('');
    try {
      const todoListItemId = typeof todoListItem === 'string' ? todoListItem : todoListItem.id;
      const response = await firstValueFrom(this.todoListApi.getItem(todoListItemId));
      this.todoListSetDetail(response.item);
    } catch (error) {
      this.todoListSetRequestError(error);
    }
  }

  protected todoListCloseDetail(): void {
    this.todoListDetail.set(null);
    this.todoListChildTitle = '';
    this.todoListCommentText = '';
  }

  protected async todoListCreateChild(): Promise<void> {
    const todoListItemId = this.todoListDetail()?.id;
    const todoListTitle = this.todoListChildTitle.trim();
    if (!todoListItemId || !todoListTitle) return;
    try {
      await firstValueFrom(this.todoListApi.createChild(todoListItemId, todoListTitle));
      this.todoListChildTitle = '';
      await this.todoListRefreshData(todoListItemId);
    } catch (error) {
      this.todoListSetRequestError(error);
    }
  }

  protected async todoListToggleChild(todoListChild: TodoListChildItem): Promise<void> {
    const todoListItemId = this.todoListDetail()?.id;
    if (!todoListItemId) return;
    try {
      await firstValueFrom(this.todoListApi.updateChild(todoListChild.id, {
        status: todoListChild.status === 'completed' ? 'pending' : 'completed'
      }));
      await this.todoListRefreshData(todoListItemId);
    } catch (error) {
      this.todoListSetRequestError(error);
    }
  }

  protected todoListStartChildEdit(todoListChild: TodoListChildItem): void {
    this.todoListEditingChildId.set(todoListChild.id);
    this.todoListEditingChildTitle = todoListChild.title;
  }

  protected async todoListSaveChild(todoListChild: TodoListChildItem): Promise<void> {
    const todoListItemId = this.todoListDetail()?.id;
    const title = this.todoListEditingChildTitle.trim();
    if (!todoListItemId || !title) return;
    try {
      await firstValueFrom(this.todoListApi.updateChild(todoListChild.id, { title }));
      this.todoListEditingChildId.set('');
      await this.todoListRefreshData(todoListItemId);
    } catch (error) {
      this.todoListSetRequestError(error);
    }
  }

  protected async todoListMoveChild(todoListChild: TodoListChildItem, direction: -1 | 1): Promise<void> {
    const todoListItemId = this.todoListDetail()?.id;
    const children = [...(this.todoListDetail()?.children ?? [])].sort((a, b) => a.position - b.position);
    const index = children.findIndex((child) => child.id === todoListChild.id);
    const target = children[index + direction];
    if (!todoListItemId || index < 0 || !target) return;
    try {
      await Promise.all([
        firstValueFrom(this.todoListApi.updateChild(todoListChild.id, { position: target.position })),
        firstValueFrom(this.todoListApi.updateChild(target.id, { position: todoListChild.position }))
      ]);
      await this.todoListRefreshData(todoListItemId);
    } catch (error) {
      this.todoListSetRequestError(error);
    }
  }

  protected async todoListDeleteChild(todoListChild: TodoListChildItem): Promise<void> {
    const todoListItemId = this.todoListDetail()?.id;
    if (!todoListItemId || !await this.todoListConfirmDelete(
      '¿Eliminar subtarea?',
      `Se eliminará «${todoListChild.title}». Esta acción no se puede deshacer.`,
      'Eliminar subtarea'
    )) return;
    try {
      await firstValueFrom(this.todoListApi.deleteChild(todoListChild.id));
      await this.todoListRefreshData(todoListItemId);
    } catch (error) {
      this.todoListSetRequestError(error);
    }
  }

  protected async todoListAddComment(): Promise<void> {
    const todoListItemId = this.todoListDetail()?.id;
    const todoListContent = this.todoListCommentText.trim();
    if (!todoListItemId || !todoListContent) return;
    try {
      await firstValueFrom(this.todoListApi.addComment(todoListItemId, todoListContent));
      this.todoListCommentText = '';
      await this.todoListRefreshData(todoListItemId);
    } catch (error) {
      this.todoListSetRequestError(error);
    }
  }

  protected async todoListDeleteComment(todoListComment: TodoListComment): Promise<void> {
    const todoListItemId = this.todoListDetail()?.id;
    if (!todoListItemId || !await this.todoListConfirmDelete(
      '¿Eliminar comentario?',
      'El comentario se eliminará permanentemente.',
      'Eliminar comentario'
    )) return;
    try {
      await firstValueFrom(this.todoListApi.deleteComment(todoListComment.id));
      await this.todoListRefreshData(todoListItemId);
    } catch (error) {
      this.todoListSetRequestError(error);
    }
  }

  protected todoListStartCommentEdit(todoListComment: TodoListComment): void {
    this.todoListEditingCommentId.set(todoListComment.id);
    this.todoListEditingCommentContent = todoListComment.content;
  }

  protected async todoListSaveComment(todoListComment: TodoListComment): Promise<void> {
    const todoListItemId = this.todoListDetail()?.id;
    const content = this.todoListEditingCommentContent.trim();
    if (!todoListItemId || !content) return;
    try {
      await firstValueFrom(this.todoListApi.updateComment(todoListComment.id, content));
      this.todoListEditingCommentId.set('');
      await this.todoListRefreshData(todoListItemId);
    } catch (error) {
      this.todoListSetRequestError(error);
    }
  }

  protected async todoListUploadAttachment(event: Event): Promise<void> {
    const todoListItemId = this.todoListDetail()?.id;
    const target = event.target;
    if (!todoListItemId || !(target instanceof HTMLInputElement) || !target.files?.[0]) return;
    try {
      await firstValueFrom(this.todoListApi.uploadAttachment(todoListItemId, target.files[0]));
      target.value = '';
      await this.todoListRefreshData(todoListItemId);
    } catch (error) {
      this.todoListSetRequestError(error);
    }
  }

  protected async todoListDeleteAttachment(todoListAttachment: TodoListAttachment): Promise<void> {
    const todoListItemId = this.todoListDetail()?.id;
    if (!todoListItemId || !await this.todoListConfirmDelete(
      '¿Eliminar archivo?',
      `Se eliminará «${todoListAttachment.fileName}» permanentemente.`,
      'Eliminar archivo'
    )) return;
    try {
      await firstValueFrom(this.todoListApi.deleteAttachment(todoListAttachment.id));
      await this.todoListRefreshData(todoListItemId);
    } catch (error) {
      this.todoListSetRequestError(error);
    }
  }

  protected async todoListCreateReminder(): Promise<void> {
    const todoListItemId = this.todoListDetail()?.id;
    if (!todoListItemId) return;
    try {
      const dateTime = this.todoListReminderType === 'custom'
        ? this.todoListToIsoDateTime(this.todoListReminderDateTime)
        : undefined;
      await firstValueFrom(this.todoListApi.createReminder(todoListItemId, this.todoListReminderType, dateTime));
      this.todoListReminderDateTime = '';
      this.todoListShowSuccess('Recordatorio programado.');
      await this.todoListRefreshData(todoListItemId);
    } catch (error) {
      this.todoListSetRequestError(error);
    }
  }

  protected todoListStartReminderEdit(todoListReminder: TodoListReminder): void {
    this.todoListEditingReminderId.set(todoListReminder.id);
    this.todoListEditingReminderDateTime = this.todoListToLocalDateTime(todoListReminder.reminderDateTime);
  }

  protected async todoListSaveReminder(todoListReminder: TodoListReminder): Promise<void> {
    const todoListItemId = this.todoListDetail()?.id;
    if (!todoListItemId || !this.todoListEditingReminderDateTime) return;
    try {
      await firstValueFrom(this.todoListApi.updateReminder(
        todoListReminder.id,
        this.todoListToIsoDateTime(this.todoListEditingReminderDateTime)
      ));
      this.todoListEditingReminderId.set('');
      await this.todoListRefreshData(todoListItemId);
    } catch (error) {
      this.todoListSetRequestError(error);
    }
  }

  protected async todoListDeleteReminder(todoListReminder: TodoListReminder): Promise<void> {
    const todoListItemId = this.todoListDetail()?.id;
    if (!todoListItemId || !await this.todoListConfirmDelete(
      '¿Eliminar recordatorio?',
      'El recordatorio se eliminará permanentemente.',
      'Eliminar recordatorio'
    )) return;
    try {
      await firstValueFrom(this.todoListApi.deleteReminder(todoListReminder.id));
      await this.todoListRefreshData(todoListItemId);
    } catch (error) {
      this.todoListSetRequestError(error);
    }
  }

  protected todoListOpenProjectForm(todoListProject?: TodoList): void {
    this.todoListEditingProjectId.set(todoListProject?.id ?? '');
    this.todoListProjectForm = {
      name: todoListProject?.name ?? '',
      description: todoListProject?.description ?? '',
      color: todoListProject?.color ?? 'blue'
    };
    this.todoListModalKind.set('project');
  }

  protected async todoListSaveProject(): Promise<void> {
    this.todoListSaving.set(true);
    try {
      const todoListPayload = {
        name: this.todoListProjectForm.name.trim(),
        description: this.todoListProjectForm.description.trim(),
        color: this.todoListProjectForm.color
      };
      if (this.todoListEditingProjectId()) {
        await firstValueFrom(this.todoListApi.updateProject(this.todoListEditingProjectId(), todoListPayload));
      } else {
        await firstValueFrom(this.todoListApi.createProject(todoListPayload));
      }
      this.todoListModalKind.set(null);
      this.todoListShowSuccess('Proyecto guardado.');
      await this.todoListLoadOverview();
    } catch (error) {
      this.todoListSetRequestError(error);
    } finally {
      this.todoListSaving.set(false);
    }
  }

  protected async todoListArchiveProject(): Promise<void> {
    const todoListProject = this.todoListSelectedProject();
    if (!todoListProject) return;
    const todoListAction = todoListProject.isArchived ? 'recuperar' : 'archivar';
    const todoListAccepted = await this.todoListConfirm.confirm({
      title: `¿${todoListAction === 'archivar' ? 'Archivar' : 'Recuperar'} proyecto?`,
      message: `¿Quieres ${todoListAction} el proyecto «${todoListProject.name}»?`,
      confirmLabel: todoListAction === 'archivar' ? 'Archivar proyecto' : 'Recuperar proyecto',
      cancelLabel: 'Cancelar',
      tone: todoListAction === 'archivar' ? 'danger' : 'primary'
    });
    if (!todoListAccepted) return;
    try {
      await firstValueFrom(this.todoListApi.archiveProject(todoListProject.id, !todoListProject.isArchived));
      if (!todoListProject.isArchived) {
        this.todoListView.set('inbox');
        this.todoListProjectId.set('');
        this.todoListSectionId.set('');
      }
      await this.todoListLoadOverview();
      this.todoListShowSuccess(`Proyecto ${todoListProject.isArchived ? 'recuperado' : 'archivado'}.`);
    } catch (error) {
      this.todoListSetRequestError(error);
    }
  }

  protected async todoListDeleteProject(): Promise<void> {
    const todoListProject = this.todoListSelectedProject();
    if (!todoListProject || !await this.todoListConfirmDelete(
      '¿Eliminar proyecto?',
      `Se eliminará «${todoListProject.name}». El proyecto debe estar vacío y esta acción no se puede deshacer.`,
      'Eliminar proyecto'
    )) return;
    try {
      await firstValueFrom(this.todoListApi.deleteProject(todoListProject.id));
      this.todoListSelectView('inbox');
      await this.todoListLoadOverview();
      this.todoListShowSuccess('Proyecto eliminado.');
    } catch (error) {
      this.todoListSetRequestError(error);
    }
  }

  protected todoListCreateSection(): void {
    if (!this.todoListProjectId()) return;
    this.todoListSectionName = '';
    this.todoListModalKind.set('section');
  }

  protected todoListEditSection(todoListSection: TodoListSection): void {
    this.todoListEditingSectionId.set(todoListSection.id);
    this.todoListEditingSectionName = todoListSection.name;
  }

  protected async todoListSaveSection(todoListSectionId = ''): Promise<void> {
    const todoListEditingId = todoListSectionId || this.todoListEditingSectionId();
    this.todoListSaving.set(true);
    try {
      if (todoListEditingId) {
        await firstValueFrom(this.todoListApi.updateSection(todoListEditingId, this.todoListEditingSectionName.trim()));
        this.todoListEditingSectionId.set('');
        await this.todoListLoadProjectSections(this.todoListProjectId());
      } else {
        await firstValueFrom(this.todoListApi.createSection(this.todoListProjectId(), this.todoListSectionName.trim()));
        this.todoListModalKind.set(null);
        await this.todoListLoadProjectSections(this.todoListProjectId());
        await this.todoListLoadItems();
      }
      this.todoListShowSuccess('Sección guardada.');
    } catch (error) {
      this.todoListSetRequestError(error);
    } finally {
      this.todoListSaving.set(false);
    }
  }

  protected async todoListMoveSection(todoListSection: TodoListSection, position: number): Promise<void> {
    try {
      const response = await firstValueFrom(
        this.todoListApi.setSectionPosition(todoListSection.id, position)
      );
      this.todoListSections.set(response.sections);
    } catch (error) {
      this.todoListSetRequestError(error);
    }
  }

  protected async todoListMoveProject(todoListProject: TodoList, direction: -1 | 1): Promise<void> {
    const currentUserId = this.todoListCurrentUserId();
    const activeOwned = this.todoListProjects()
      .filter((project) => project.ownerUserId === currentUserId)
      .sort((left, right) => left.position - right.position);
    const archivedOwned = this.todoListArchivedProjects()
      .filter((project) => project.ownerUserId === currentUserId)
      .sort((left, right) => left.position - right.position);
    const ownedProjects = todoListProject.isArchived ? archivedOwned : activeOwned;
    const index = ownedProjects.findIndex((project) => project.id === todoListProject.id);
    const target = ownedProjects[index + direction];
    if (!currentUserId || index < 0 || !target) return;
    [ownedProjects[index], ownedProjects[index + direction]] = [target, ownedProjects[index]];
    try {
      const response = await firstValueFrom(this.todoListApi.reorderProjects([
        ...activeOwned.map((project) => project.id),
        ...archivedOwned.map((project) => project.id)
      ]));
      const active = response.projects.filter((project) => !project.isArchived);
      this.todoListArchivedProjects.set(response.projects.filter((project) => project.isArchived));
      this.todoListOverview.update((overview) => overview ? { ...overview, projects: active } : overview);
    } catch (error) {
      this.todoListSetRequestError(error);
    }
  }

  protected async todoListDeleteSection(todoListSection: TodoListSection): Promise<void> {
    if (!await this.todoListConfirmDelete(
      '¿Eliminar sección?',
      `Se eliminará «${todoListSection.name}». La sección debe estar vacía.`,
      'Eliminar sección'
    )) return;
    try {
      await firstValueFrom(this.todoListApi.deleteSection(todoListSection.id));
      if (this.todoListSectionId() === todoListSection.id) this.todoListSectionId.set('');
      await this.todoListLoadProjectSections(this.todoListProjectId());
      await this.todoListLoadItems();
      this.todoListShowSuccess('Sección eliminada.');
    } catch (error) {
      this.todoListSetRequestError(error);
    }
  }

  protected todoListOpenLabelForm(todoListLabel?: TodoListLabel): void {
    this.todoListEditingLabelId.set(todoListLabel?.id ?? '');
    this.todoListLabelForm = {
      name: todoListLabel?.name ?? '',
      color: todoListLabel?.color ?? 'mint'
    };
    this.todoListModalKind.set('label');
  }

  protected async todoListSaveLabel(): Promise<void> {
    this.todoListSaving.set(true);
    try {
      const todoListPayload = {
        name: this.todoListLabelForm.name.trim(),
        color: this.todoListLabelForm.color
      };
      if (this.todoListEditingLabelId()) {
        await firstValueFrom(this.todoListApi.updateLabel(this.todoListEditingLabelId(), todoListPayload));
      } else {
        await firstValueFrom(this.todoListApi.createLabel(todoListPayload.name, todoListPayload.color));
      }
      this.todoListModalKind.set(null);
      this.todoListShowSuccess('Etiqueta guardada.');
      await this.todoListLoadOverview();
    } catch (error) {
      this.todoListSetRequestError(error);
    } finally {
      this.todoListSaving.set(false);
    }
  }

  protected async todoListDeleteLabel(): Promise<void> {
    const todoListLabelId = this.todoListEditingLabelId();
    const todoListLabelName = this.todoListLabels().find((label) => label.id === todoListLabelId)?.name;
    if (!todoListLabelId || !await this.todoListConfirmDelete(
      '¿Eliminar etiqueta?',
      `Se eliminará la etiqueta${todoListLabelName ? ` «${todoListLabelName}»` : ''} de todas las tareas.`,
      'Eliminar etiqueta'
    )) return;
    try {
      await firstValueFrom(this.todoListApi.deleteLabel(todoListLabelId));
      this.todoListModalKind.set(null);
      this.todoListLabelFilter.set('');
      await this.todoListLoadOverview();
      this.todoListShowSuccess('Etiqueta eliminada.');
    } catch (error) {
      this.todoListSetRequestError(error);
    }
  }

  protected todoListOpenShareForm(): void {
    const todoListProject = this.todoListSelectedProject();
    if (!todoListProject) return;
    this.todoListShareUserId.set('');
    this.todoListMembers.set([]);
    this.todoListModalKind.set('share');
    void this.todoListLoadMembers(todoListProject.id);
  }

  private async todoListLoadMembers(todoListProjectId: string): Promise<void> {
    try {
      const response = await firstValueFrom(this.todoListApi.loadMembers(todoListProjectId));
      this.todoListMembers.set(response.members);
    } catch (error) {
      this.todoListSetRequestError(error);
    }
  }

  private todoListConfirmDelete(title: string, message: string, confirmLabel: string): Promise<boolean> {
    return this.todoListConfirm.confirm({
      title,
      message,
      confirmLabel,
      cancelLabel: 'Cancelar',
      tone: 'danger'
    });
  }

  protected async todoListAddMember(): Promise<void> {
    const todoListProject = this.todoListSelectedProject();
    const todoListUserId = this.todoListShareUserId();
    if (!todoListProject || !todoListUserId) return;
    try {
      await firstValueFrom(this.todoListApi.addMember(todoListProject.id, todoListUserId, this.todoListShareRole()));
      this.todoListShareUserId.set('');
      await this.todoListLoadMembers(todoListProject.id);
      this.todoListShowSuccess('Acceso al proyecto actualizado.');
    } catch (error) {
      this.todoListSetRequestError(error);
    }
  }

  protected async todoListRemoveMember(todoListMember: TodoListUser): Promise<void> {
    const todoListProject = this.todoListSelectedProject();
    if (!todoListProject || !await this.todoListConfirm.confirm({
      title: '¿Retirar acceso?',
      message: `Se retirará el acceso de ${todoListMember.firstName} ${todoListMember.lastName} al proyecto «${todoListProject.name}».`,
      confirmLabel: 'Retirar acceso',
      cancelLabel: 'Cancelar',
      tone: 'danger'
    })) return;
    try {
      await firstValueFrom(this.todoListApi.removeMember(todoListProject.id, todoListMember.id));
      await this.todoListLoadMembers(todoListProject.id);
      await this.todoListLoadOverview();
    } catch (error) {
      this.todoListSetRequestError(error);
    }
  }

  protected todoListCloseModal(): void {
    this.todoListModalKind.set(null);
    this.todoListEditingSectionId.set('');
  }

  protected async todoListDrop(event: CdkDragDrop<TodoListItem[]>): Promise<void> {
    const todoListItem = event.item.data;
    const todoListTarget = this.todoListBoardColumns().find((column) => column.id === event.container.id);
    const todoListPrevious = this.todoListBoardColumns().find((column) => column.id === event.previousContainer.id);
    const todoListProjectId = this.todoListProjectId();
    if (!todoListTarget || !todoListPrevious || !todoListProjectId) return;
    try {
      if (event.previousContainer === event.container) {
        moveItemInArray(event.container.data, event.previousIndex, event.currentIndex);
        await firstValueFrom(this.todoListApi.setItemPosition(todoListItem.id, event.currentIndex));
      } else {
        transferArrayItem(event.previousContainer.data, event.container.data, event.previousIndex, event.currentIndex);
        await firstValueFrom(this.todoListApi.moveItem(
          todoListItem.id,
          todoListProjectId,
          todoListTarget.sectionId,
          event.currentIndex
        ));
      }
      await this.todoListLoadItems();
    } catch (error) {
      this.todoListSetRequestError(error);
      await this.todoListLoadItems();
    }
  }

  protected todoListToggleNotifications(): void {
    this.todoListNotificationsOpen.update((open) => !open);
    if (this.todoListNotificationsOpen()) void this.todoListLoadNotifications();
  }

  private async todoListLoadNotifications(): Promise<void> {
    if (this.todoListNotificationsLoading) return;
    this.todoListNotificationsLoading = true;
    try {
      const response = await firstValueFrom(this.todoListApi.listNotifications());
      this.todoListNotifications.set(response.notifications);
      this.todoListOverview.update((overview) => overview ? {
        ...overview,
        counts: {
          ...overview.counts,
          unreadNotifications: response.notifications.filter((notification) => !notification.isRead).length
        }
      } : overview);
    } catch (error) {
      this.todoListSetRequestError(error);
    } finally {
      this.todoListNotificationsLoading = false;
    }
  }

  protected async todoListOpenNotification(todoListNotification: TodoListNotification): Promise<void> {
    try {
      if (!todoListNotification.isRead) {
        await firstValueFrom(this.todoListApi.markNotificationRead(todoListNotification.id));
      }
      this.todoListNotificationsOpen.set(false);
      const todoListResponse = await firstValueFrom(this.todoListApi.getItem(todoListNotification.todoListItemId));
      this.todoListSetDetail(todoListResponse.item);
      await this.todoListLoadOverview();
    } catch (error) {
      this.todoListSetRequestError(error);
    }
  }

  protected todoListChangeMonth(offset: number): void {
    const todoListMonth = this.todoListCalendarMonth();
    this.todoListCalendarMonth.set(new Date(todoListMonth.getFullYear(), todoListMonth.getMonth() + offset, 1));
  }

  protected todoListGoToToday(): void {
    const todoListNow = new Date();
    this.todoListCalendarMonth.set(new Date(todoListNow.getFullYear(), todoListNow.getMonth(), 1));
    this.todoListSelectedDate.set(this.todoListLocalDateKey(todoListNow));
  }

  protected todoListChooseCalendarDate(todoListDate: Date): void {
    this.todoListSelectedDate.set(this.todoListLocalDateKey(todoListDate));
    this.todoListOpenTaskForm('', this.todoListSectionId());
    this.todoListForm.dueDate = this.todoListSelectedDate();
  }

  protected todoListEditCalendarItem(todoListItem: TodoListItem, date: Date): void {
    this.todoListOpenTaskForm(todoListItem);
    this.todoListForm.dueDate = this.todoListLocalDateKey(date);
  }

  protected todoListCalendarDays(): Date[] {
    const todoListMonth = this.todoListCalendarMonth();
    const todoListFirst = new Date(todoListMonth.getFullYear(), todoListMonth.getMonth(), 1);
    const todoListOffset = (todoListFirst.getDay() + 6) % 7;
    const todoListStart = new Date(todoListFirst);
    todoListStart.setDate(todoListFirst.getDate() - todoListOffset);
    return Array.from({ length: 42 }, (_value, index) => {
      const todoListDate = new Date(todoListStart);
      todoListDate.setDate(todoListStart.getDate() + index);
      return todoListDate;
    });
  }

  protected todoListCalendarMonthName(): string {
    return this.todoListCalendarMonth().toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
  }

  protected todoListItemsForDate(todoListDate: Date): TodoListItem[] {
    const todoListDateKey = this.todoListLocalDateKey(todoListDate);
    return this.todoListItems().filter((item) => item.dueDate === todoListDateKey);
  }

  protected todoListFindLabel(todoListLabelId: string): TodoListLabel | undefined {
    return this.todoListLabels().find((label) => label.id === todoListLabelId);
  }

  protected todoListFindUser(userId: string): TodoListUser | undefined {
    return this.todoListUsers().find((user) => user.id === userId);
  }

  protected todoListProjectFilterValue(): string {
    return this.todoListProjectFilter() ||
      (this.todoListView() === 'project' ? this.todoListProjectId() : '');
  }

  protected todoListUserInitials(user: TodoListUser): string {
    return `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`.toLocaleUpperCase();
  }

  protected todoListAssigneeInitials(userId: string): string {
    const user = this.todoListFindUser(userId);
    if (user) return this.todoListUserInitials(user);
    return '?';
  }

  protected todoListAssigneeLabel(userId: string): string {
    const user = this.todoListFindUser(userId);
    return user
      ? `${user.firstName} ${user.lastName}`.trim()
      : 'Responsable asignado';
  }

  protected todoListAssigneeNames(userIds: string[]): string {
    return userIds.map((userId) => this.todoListAssigneeLabel(userId)).join(', ');
  }

  protected todoListToggleTaskActions(itemId: string): void {
    this.todoListOpenTaskActionsId.update((currentId) => currentId === itemId ? '' : itemId);
  }

  protected todoListCloseTaskActions(): void {
    this.todoListOpenTaskActionsId.set('');
  }

  protected todoListCanMoveProject(project: TodoList, direction: -1 | 1): boolean {
    const projects = (project.isArchived ? this.todoListArchivedProjects() : this.todoListProjects())
      .filter((entry) => entry.ownerUserId === this.todoListCurrentUserId())
      .sort((left, right) => left.position - right.position);
    const index = projects.findIndex((entry) => entry.id === project.id);
    return index >= 0 && index + direction >= 0 && index + direction < projects.length;
  }

  protected todoListPriorityName(todoListPriority: TodoListPriority): string {
    const todoListNames: Record<TodoListPriority, string> = {
      1: 'Urgente',
      2: 'Alta',
      3: 'Media',
      4: 'Baja'
    };
    return todoListNames[todoListPriority];
  }

  protected todoListIsOverdue(todoListItem: TodoListItem): boolean {
    const todoListToday = this.todoListLocalDateKey(new Date());
    return Boolean(todoListItem.dueDate && todoListItem.dueDate < todoListToday && todoListItem.status !== 'completed');
  }

  protected todoListFormatDate(todoListDate: string): string {
    if (!todoListDate) return '';
    return new Date(`${todoListDate}T00:00:00`).toLocaleDateString('es-ES', {
      day: 'numeric',
      month: 'short'
    });
  }

  protected todoListTaskDateLabel(todoListDate: string): string {
    if (!todoListDate) return '';
    const todoListToday = this.todoListLocalDateKey(new Date());
    if (todoListDate === todoListToday) return 'Hoy';
    const todoListTomorrowDate = new Date();
    todoListTomorrowDate.setDate(todoListTomorrowDate.getDate() + 1);
    if (todoListDate === this.todoListLocalDateKey(todoListTomorrowDate)) return 'Mañana';
    return this.todoListFormatDate(todoListDate).replace(/\.$/, '');
  }

  protected todoListFormatTimestamp(todoListTimestamp: string): string {
    if (!todoListTimestamp) return '';
    return new Date(todoListTimestamp).toLocaleString('es-ES', {
      dateStyle: 'short',
      timeStyle: 'short'
    });
  }

  protected todoListToLocalDateTime(timestamp: string): string {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) return '';
    const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return localDate.toISOString().slice(0, 16);
  }

  private todoListToIsoDateTime(localDateTime: string): string {
    const date = new Date(localDateTime);
    if (Number.isNaN(date.getTime())) throw new Error('La fecha del recordatorio no es válida.');
    return date.toISOString();
  }

  private async todoListRefreshData(todoListDetailId = ''): Promise<void> {
    await this.todoListLoadOverview();
    if (todoListDetailId && this.todoListDetail()?.id === todoListDetailId) {
      await this.todoListOpenDetail(todoListDetailId);
    }
  }

  private todoListSetDetail(todoListItem: TodoListItem): void {
    const todoListChildren = todoListItem.children ?? [];
    this.todoListDetail.set({
      ...todoListItem,
      childCount: todoListChildren.length,
      completedChildCount: todoListChildren.filter((child) => child.status === 'completed').length
    });
  }

  protected todoListLocalDateKey(todoListDate: Date): string {
    const todoListYear = todoListDate.getFullYear();
    const todoListMonth = String(todoListDate.getMonth() + 1).padStart(2, '0');
    const todoListDay = String(todoListDate.getDate()).padStart(2, '0');
    return `${todoListYear}-${todoListMonth}-${todoListDay}`;
  }

  private todoListEmptyForm(): TodoListFormState {
    return {
      title: '',
      description: '',
      todoListId: '',
      sectionId: '',
      priority: 4,
      isImportant: false,
      dueDate: '',
      dueTime: '',
      labelIds: [],
      assigneeUserIds: [],
      frequency: '',
      interval: 1,
      daysOfWeek: [],
      unit: '',
      startDate: this.todoListLocalDateKey(new Date()),
      endDate: ''
    };
  }

  private todoListShowSuccess(message: string): void {
    this.todoListError.set('');
    this.todoListSuccess.set(message);
    setTimeout(() => this.todoListSuccess.set(''), 3500);
  }

  private todoListSetRequestError(error: unknown): void {
    let todoListMessage = 'No se pudo completar la operación. Inténtalo de nuevo.';
    if (error instanceof HttpErrorResponse) {
      const todoListBody: unknown = error.error;
      if (todoListBody && typeof todoListBody === 'object' && 'message' in todoListBody &&
          typeof todoListBody.message === 'string') {
        todoListMessage = todoListBody.message;
      } else if (error.status === 0) {
        todoListMessage = 'No se pudo conectar con el servidor. Comprueba tu conexión e inténtalo de nuevo.';
      }
    } else if (error instanceof Error && error.message) {
      todoListMessage = error.message;
    }
    this.todoListError.set(todoListMessage);
    this.todoListSuccess.set('');
  }
}
