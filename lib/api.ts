import type { Lead, Customer, Inquiry, LogEntry } from '../types';

const json = (r: Response) => r.ok ? r.json() : r.json().then(e => { throw new Error(e.error || 'API error'); });

const api = {
  // Auth
  login: (email: string, password: string, rememberMe = true) => fetch('/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password, rememberMe }) }).then(json),
  me: () => fetch('/api/auth').then(r => r.ok ? r.json() : null),

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

  // Dashboard
  getDashboardData: () => fetch('/api/dashboard').then(json),
  getAnalyticsSummary: () => fetch('/api/dashboard?mode=ai-summary').then(json),

  // Wix sync
  syncWix: () => fetch('/api/wix/sync', { method: 'POST' }).then(json),

  // Email
  sendEmail: (to: string, subject: string, html: string) => fetch('/api/email', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ to, subject, html }) }).then(json),
  sendCampaign: (data: any) => fetch('/api/email', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...data, action: 'campaign' }) }).then(json),
  sendTestCampaign: (data: any) => fetch('/api/email', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...data, action: 'preview' }) }).then(json),
  getEmailPreview: (data: any) => fetch('/api/email', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...data, action: 'previewHtml' }) }).then(json),
  toggleEmailSubscription: (id: string, emailUnsubscribed: boolean) => fetch('/api/customers', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, emailUnsubscribed }) }).then(json),

  // Campaigns
  getCampaigns: () => fetch('/api/campaigns').then(json),
  saveCampaign: (data: any) => fetch('/api/campaigns', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }).then(json),
  deleteCampaign: (id: string) => fetch('/api/campaigns', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) }).then(json),

  // Site Management
  syncSite: (type = 'all') => fetch(`/api/wix/sync?type=site-${type}`, { method: 'POST' }).then(json),
  getSiteProducts: () => fetch('/api/wix/sync?data=products').then(json),
  getSiteCollections: () => fetch('/api/wix/sync?data=collections').then(json),
  getSiteBlog: () => fetch('/api/wix/sync?data=blog').then(json),
  getSiteCoupons: () => fetch('/api/wix/sync?data=coupons').then(json),
  getSiteSocial: () => fetch('/api/wix/sync?data=social').then(json),
  getSiteStats: () => fetch('/api/wix/sync?data=stats').then(json),
  saveSocialLink: (data: any) => fetch('/api/wix/sync?action=save-social', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }).then(json),
  saveProduct: (data: any) => fetch('/api/wix/sync?action=save-product', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }).then(json),
  deleteProduct: (id: string) => fetch('/api/wix/sync?action=delete-product', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) }).then(json),
  saveBlogPost: (data: any) => fetch('/api/wix/sync?action=save-blog-post', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }).then(json),

  // AI
  aiAnalytics: (prompt: string, systemInstruction: string) => fetch('/api/ai', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt, systemInstruction, type: 'analytics' }) }).then(json),
  aiExtract: (prompt: string, systemInstruction: string) => fetch('/api/ai', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt, systemInstruction, type: 'extract' }) }).then(json),
  aiSmartFilter: (prompt: string, systemInstruction: string) => fetch('/api/ai', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt, systemInstruction, type: 'smart-filter' }) }).then(json),
};

export default api;
