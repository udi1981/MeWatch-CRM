
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
  customerId?: string;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  email?: string;
  source: 'wix' | 'inquiry' | 'manual' | 'import';
  createdAt: string;
  subscriptionIds: string[];
  inquiryIds: string[];
  tags: string[];
  totalSpent?: number;
  ecomSpent?: number;
  lastActivity?: string;
  wixMemberStatus?: string;
}

export interface Inquiry {
  id: string;
  customerId?: string;
  name: string;
  phone: string;
  email?: string;
  subject: string;
  message: string;
  source: 'wix_form' | 'manual';
  status: 'new' | 'handled' | 'closed';
  createdAt: string;
}

export interface RevenueChannel {
  id: string;
  name: string;
  isAutomatic: boolean;
}

export interface PnLEntry {
  id: string;
  type: 'expense' | 'revenue';
  channelId?: string;
  category: string;
  description: string;
  amount: number;
  date: string;
  source: 'manual' | 'icount' | 'wix';
  invoiceId?: string;
}

export interface AppState {
  leads: Lead[];
  customers: Customer[];
  inquiries: Inquiry[];
  pnlEntries: PnLEntry[];
  revenueChannels: RevenueChannel[];
  statuses: StatusConfig[];
  columns: Column[];
  tasks: Task[];
  logs: LogEntry[];
}
