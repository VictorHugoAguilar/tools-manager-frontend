export type TodoListPriority = 1 | 2 | 3 | 4;
export type TodoListColor = 'blue' | 'mint' | 'yellow' | 'rose' | 'purple' | 'coral';
export type TodoListView = 'inbox' | 'today' | 'upcoming' | 'overdue' | 'important' | 'completed' | 'archived' | 'project' | 'all';
export type TodoListRecurrenceFrequency = 'daily' | 'weekdays' | 'weekly' | 'biweekly' | 'monthly' | 'yearly' | 'custom';

export interface TodoList {
  id: string;
  name: string;
  description: string;
  color: TodoListColor;
  ownerUserId: string;
  position: number;
  isArchived: boolean;
  pendingCount?: number;
  sections?: TodoListSection[];
}

export interface TodoListSection {
  id: string;
  todoListId: string;
  name: string;
  position: number;
}

export interface TodoListItem {
  id: string;
  title: string;
  description: string;
  todoListId: string;
  sectionId: string;
  status: 'pending' | 'completed';
  priority: TodoListPriority;
  isImportant: boolean;
  dueDate: string;
  dueTime: string;
  timeZone: string;
  recurrenceId: string;
  createdByUserId: string;
  ownerUserId: string;
  isArchived: boolean;
  position: number;
  createdAt: string;
  updatedAt: string;
  labelIds: string[];
  assigneeUserIds: string[];
  childCount: number;
  completedChildCount: number;
  projectName?: string;
  children?: TodoListChildItem[];
  comments?: TodoListComment[];
  attachments?: TodoListAttachment[];
  recurrence?: TodoListRecurrence | null;
  reminders?: TodoListReminder[];
  activities?: TodoListActivity[];
}

export interface TodoListLabel {
  id: string;
  name: string;
  color: TodoListColor;
}

export interface TodoListUser {
  id: string;
  firstName: string;
  lastName: string;
  profileImage: string;
  role?: 'owner' | 'editor' | 'viewer';
}

export interface TodoListChildItem {
  id: string;
  todoListItemId: string;
  title: string;
  status: 'pending' | 'completed';
  position: number;
  createdAt: string;
  completedAt: string;
}

export interface TodoListComment {
  id: string;
  todoListItemId: string;
  userId: string;
  content: string;
  authorName: string;
  createdAt: string;
  updatedAt: string;
}

export interface TodoListAttachment {
  id: string;
  todoListItemId: string;
  fileName: string;
  storagePath: string;
  contentType: string;
  size: number;
  url: string;
  uploadedByUserId: string;
  createdAt: string;
}

export interface TodoListRecurrence {
  frequency: TodoListRecurrenceFrequency;
  interval: number;
  daysOfWeek: number[];
  unit: 'days' | 'weeks' | 'months' | '';
  startDate: string;
  endDate: string;
  isActive: boolean;
}

export interface TodoListReminder {
  id: string;
  todoListItemId: string;
  userId: string;
  reminderDateTime: string;
  type: 'at_due' | 'before_15m' | 'before_1h' | 'before_1d' | 'custom';
  status: 'scheduled' | 'processing' | 'triggered' | 'cancelled';
}

export interface TodoListActivity {
  id: string;
  userId: string;
  userName: string;
  action: string;
  createdAt: string;
}

export interface TodoListNotification {
  id: string;
  reminderId?: string;
  type?: 'task_reminder';
  todoListItemId: string;
  title: string;
  message: string;
  createdAt: string;
  isRead: boolean;
}

export interface TodoListOverview {
  projects: TodoList[];
  labels: TodoListLabel[];
  users: TodoListUser[];
  counts: {
    inbox: number;
    today: number;
    upcoming: number;
    overdue: number;
    important: number;
    completed: number;
    archived: number;
    total: number;
    unreadNotifications: number;
    assignedToMe?: number;
  };
  notifications: TodoListNotification[];
}

export interface TodoListItemPayload {
  title: string;
  description?: string;
  todoListId?: string;
  sectionId?: string;
  priority?: TodoListPriority;
  isImportant?: boolean;
  dueDate?: string;
  dueTime?: string;
  timeZone?: string;
  labelIds?: string[];
  assigneeUserIds?: string[];
  recurrence?: TodoListRecurrence | null;
}

export interface TodoListFilters {
  view?: TodoListView;
  status?: 'pending' | 'completed' | '';
  todoListId?: string;
  sectionId?: string;
  search?: string;
  priority?: TodoListPriority | '';
  labelId?: string;
  assigneeUserId?: string;
  important?: 'true' | 'false' | '';
  overdue?: 'true' | '';
  noDueDate?: 'true' | '';
  recurring?: 'true' | '';
  dueDate?: string;
  timeZone?: string;
  sort?: 'dueDate' | 'priority' | 'createdAt' | 'updatedAt' | 'position';
  order?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

export interface TodoListItemsResponse {
  items: TodoListItem[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}
