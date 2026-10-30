export type TaskPriority = 'low' | 'medium' | 'high';
export type TaskColumnColor = 'blue' | 'mint' | 'yellow' | 'rose';

export interface TaskBoardColumn {
  id: string;
  name: string;
  color: TaskColumnColor;
  position: number;
}

export interface TaskBoardLabel {
  id: string;
  name: string;
  color: string;
}

export interface TaskBoardMember {
  id: string;
  firstName: string;
  lastName: string;
  profileImage: string;
}

export interface TaskComment {
  id: string;
  text: string;
  authorId: string;
  authorName: string;
  createdAt: string;
}

export interface TaskAttachment {
  id: string;
  name: string;
  size: number;
  contentType: string;
  path: string;
  url: string;
  uploadedAt: string;
  uploadedById: string;
  uploadedByName: string;
}

export interface TaskHistoryEntry {
  id: string;
  text: string;
  actorId: string;
  actorName: string;
  createdAt: string;
}

export interface TaskBoardTask {
  id: string;
  title: string;
  description: string;
  columnId: string;
  position: number;
  priority: TaskPriority;
  labelIds: string[];
  dueDate: string;
  assigneeId: string;
  createdAt: string;
  updatedAt: string;
  comments: TaskComment[];
  attachments: TaskAttachment[];
  history: TaskHistoryEntry[];
}

export interface TaskBoardSnapshot {
  columns: TaskBoardColumn[];
  tasks: TaskBoardTask[];
  labels: TaskBoardLabel[];
  members: TaskBoardMember[];
}

export type TaskPayload = Pick<
  TaskBoardTask,
  'title' | 'description' | 'columnId' | 'priority' | 'labelIds' | 'dueDate' | 'assigneeId'
>;

export interface TaskBoardFilters {
  search?: string;
  columnId?: string;
  priority?: TaskPriority | '';
  labelId?: string;
  assigneeId?: string;
  dueDate?: string;
  overdue?: boolean;
}
