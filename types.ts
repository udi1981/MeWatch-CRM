
export enum StatusKey {
  DONE = 'done',
  NO_ANSWER = 'no_answer',
  CALLBACK = 'callback',
  CANCELLED = 'cancelled',
  NEW = 'new'
}

export interface StatusConfig {
  id: string;
  label: string;
  color: string;
  rowColor: string;
  order: number;
}

export interface Note {
  id: string;
  text: string;
  timestamp: string;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  dueDate: string;
  isCompleted: boolean;
  leadId?: string;
  type: 'call' | 'action' | 'general';
}

export interface Column {
  id: string;
  label: string;
  type: 'text' | 'number' | 'date';
}

export interface LogEntry {
  id: string;
  timestamp: string;
  level: 'info' | 'error' | 'warning' | 'success';
  message: string;
  details?: string;
}

export interface Lead {
  id: string;
  name: string;
  phone: string;
  email?: string;
  statusId: string;
  createdAt: string;
  notes: Note[];
  dynamicData: Record<string, string | number>;
  reminderAt?: string;
  endingReason?: string;
  subscriptionType?: string;
  subscriptionStatus?: string;
}

export interface AppState {
  leads: Lead[];
  statuses: StatusConfig[];
  columns: Column[];
  tasks: Task[];
  logs: LogEntry[];
}
