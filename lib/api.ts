import type { Lead, Customer, Inquiry, LogEntry } from '../types';

const json = (r: Response) => r.ok ? r.json() : r.json().then(e => { throw new Error(e.error || 'API error'); });

const api = {
  // Auth
  login: (email: string) => fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) }).then(json),
  me: () => fetch('/api/auth/me').then(r => r.ok ? r.json() : null),

  // Leads
  getLeads: (): Promise<Lead[]> => fetch('/api/leads').then(json),
  addLead: (lead: Partial<Lead>) => fetch('/api/leads', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(lead) }).then(json),
  updateLead: (id: string, data: Partial<Lead>) => fetch(`/api/leads/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }).then(json),
  deleteLead: (id: string) => fetch(`/api/leads/${id}`, { method: 'DELETE' }).then(json),

  // Customers
  getCustomers: (): Promise<Customer[]> => fetch('/api/customers').then(json),
  upsertCustomer: (customer: Customer) => fetch('/api/customers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(customer) }).then(json),

  // Inquiries
  getInquiries: (): Promise<Inquiry[]> => fetch('/api/inquiries').then(json),
  addInquiry: (inq: Partial<Inquiry>) => fetch('/api/inquiries', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(inq) }).then(json),
  updateInquiryStatus: (id: string, status: string) => fetch(`/api/inquiries/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) }).then(json),

  // Logs
  getLogs: (): Promise<LogEntry[]> => fetch('/api/logs').then(json),
  addLog: (level: string, message: string, details?: string) => fetch('/api/logs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ level, message, details }) }),
  clearLogs: () => fetch('/api/logs', { method: 'DELETE' }).then(json),

  // Wix sync
  syncWix: () => fetch('/api/wix/sync', { method: 'POST' }).then(json),

  // AI
  aiAnalytics: (prompt: string, systemInstruction: string) => fetch('/api/ai', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt, systemInstruction, type: 'analytics' }) }).then(json),
  aiExtract: (prompt: string, systemInstruction: string) => fetch('/api/ai', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt, systemInstruction, type: 'extract' }) }).then(json),
  aiSmartFilter: (prompt: string, systemInstruction: string) => fetch('/api/ai', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt, systemInstruction, type: 'smart-filter' }) }).then(json),
};

export default api;
