
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Lead, StatusConfig, Column, Note, Task, LogEntry, Customer, Inquiry } from './types';
import { INITIAL_STATUSES, INITIAL_COLUMNS, MOCK_LEADS } from './constants';
import LeadTable from './components/LeadTable';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import LeadDetailModal from './components/LeadDetailModal';
import SettingsModal from './components/SettingsModal';
import AddLeadModal from './components/AddLeadModal';
import ImportModal from './components/ImportModal';
import Dashboard from './components/Dashboard';
import TasksView from './components/TasksView';
import CustomersView from './components/CustomersView';
import InquiriesView from './components/InquiriesView';
import AddInquiryModal from './components/AddInquiryModal';
import PnLView from './components/PnLView';
import SystemLogModal from './components/SystemLogModal';
import AIExtractModal from './components/AIExtractModal';
import AIAnalyticsChat from './components/AIAnalyticsChat';
import MarketingView from './components/MarketingView';
import SiteManagement from './components/SiteManagement';
import SendEmailModal from './components/SendEmailModal';
import SmartViewBar, { ViewCommand } from './components/SmartViewBar';
import api from './lib/api';

// Wix status filter options
const WIX_FILTER_OPTIONS = [
  { value: 'all', label: 'הכל' },
  { value: 'active', label: 'מנוי פעיל' },
  { value: 'canceled_customer', label: 'בוטל ע"י הלקוח' },
  { value: 'canceled_company', label: 'בוטל ע"י החברה' },
  { value: 'payment_failed', label: 'תשלום נכשל' },
  { value: 'ended', label: 'הסתיים' },
  { value: 'no_phone', label: 'ללא טלפון' },
];

const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loginError, setLoginError] = useState('');
  const [activeTab, setActiveTab] = useState<'dashboard' | 'leads' | 'customers' | 'inquiries' | 'pnl' | 'tasks' | 'marketing' | 'site'>('leads');
  const [emailModalTarget, setEmailModalTarget] = useState<{ email: string; name: string } | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [statuses, setStatuses] = useState<StatusConfig[]>(INITIAL_STATUSES);
  const [columns, setColumns] = useState<Column[]>(INITIAL_COLUMNS);
  const [logs, setLogs] = useState<LogEntry[]>([]);

  const [searchQuery, setSearchQuery] = useState('');
  const [wixStatusFilter, setWixStatusFilter] = useState('all');
  const [isSyncing, setIsSyncing] = useState(false);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAddLeadOpen, setIsAddLeadOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isLogsOpen, setIsLogsOpen] = useState(false);
  const [isAIModalOpen, setIsAIModalOpen] = useState(false);
  const [isAnalyticsChatOpen, setIsAnalyticsChatOpen] = useState(false);
  const [isAddInquiryOpen, setIsAddInquiryOpen] = useState(false);
  const [notifications, setNotifications] = useState<string[]>([]);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState<string[]>(() => {
    const saved = localStorage.getItem('crm_visible_columns');
    return saved ? JSON.parse(saved) : INITIAL_COLUMNS.map(c => c.id);
  });
  const [dateRange, setDateRange] = useState<{ from: string; to: string }>({ from: '', to: '' });
  const [activeSmartView, setActiveSmartView] = useState<ViewCommand | null>(null);

  // Check auth on mount
  useEffect(() => {
    api.me().then(data => {
      if (data?.ok) setIsAuthenticated(true);
    }).finally(() => setAuthLoading(false));
  }, []);

  // Load data from API when authenticated
  useEffect(() => {
    if (!isAuthenticated) return;
    Promise.all([
      api.getLeads().then(setLeads).catch(() => {}),
      api.getCustomers().then(setCustomers).catch(() => {}),
      api.getInquiries().then(setInquiries).catch(() => {}),
      api.getLogs().then(setLogs).catch(() => {}),
    ]);
  }, [isAuthenticated]);

  // Save visibleColumns to localStorage (UI preference only)
  useEffect(() => {
    localStorage.setItem('crm_visible_columns', JSON.stringify(visibleColumns));
  }, [visibleColumns]);

  const addLog = useCallback((level: LogEntry['level'], message: string, details?: string) => {
    const newLog: LogEntry = {
      id: Math.random().toString(36).substr(2, 9),
      timestamp: new Date().toLocaleString('he-IL'),
      level,
      message,
      details
    };
    setLogs(prev => [newLog, ...prev].slice(0, 100));
  }, []);

  const handleWixSync = async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    addLog('info', 'מתחיל סנכרון מלא מול Wix...');

    try {
      const result = await api.syncWix();
      if (result.ok) {
        addLog('success', `סנכרון הושלם! ${result.stats?.leads || 0} מנויים, ${result.stats?.customers || 0} לקוחות.`);
        // Reload all data from DB
        const [newLeads, newCustomers, newInquiries, newLogs] = await Promise.all([
          api.getLeads(), api.getCustomers(), api.getInquiries(), api.getLogs()
        ]);
        setLeads(newLeads);
        setCustomers(newCustomers);
        setInquiries(newInquiries);
        setLogs(newLogs);
      } else {
        addLog('error', 'שגיאת סנכרון', result.error);
      }
    } catch (error: any) {
      console.error('Wix sync error:', error);
      addLog('error', 'שגיאת סנכרון', error.message);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleUpdateLeadStatus = (leadId: string, statusId: string) => {
    setLeads(prev => prev.map(l => l.id === leadId ? { ...l, statusId } : l));
    api.updateLead(leadId, { statusId } as any).catch(() => {});
  };
  const handleUpdateLeadReminder = (leadId: string, reminderAt: string | undefined) => {
    setLeads(prev => prev.map(l => l.id === leadId ? { ...l, reminderAt } : l));
    api.updateLead(leadId, { reminderAt } as any).catch(() => {});
  };
  const handleAddNote = (leadId: string, noteText: string) => {
    const newNote: Note = {
      id: Math.random().toString(36).substr(2, 9),
      text: noteText,
      timestamp: new Date().toLocaleString('he-IL')
    };
    setLeads(prev => {
      const updated = prev.map(l => l.id === leadId ? { ...l, notes: [newNote, ...l.notes] } : l);
      const lead = updated.find(l => l.id === leadId);
      if (lead) api.updateLead(leadId, { notes: lead.notes } as any).catch(() => {});
      return updated;
    });
  };
  const handleAddTask = (task: Omit<Task, 'id' | 'isCompleted'>) => {
    const newTask: Task = { ...task, id: Math.random().toString(36).substr(2, 9), isCompleted: false };
    setTasks([newTask, ...tasks]);
  };
  const toggleTaskCompletion = (taskId: string) => {
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, isCompleted: !t.isCompleted } : t));
  };
  const deleteTask = (taskId: string) => {
    setTasks(prev => prev.filter(t => t.id !== taskId));
  };
  const handleAddLead = (newLeadData: Partial<Lead>) => {
    const newLead: Lead = {
      id: Math.random().toString(36).substr(2, 9),
      name: newLeadData.name || 'לקוח חדש',
      phone: newLeadData.phone || '',
      email: newLeadData.email || '',
      statusId: 'new',
      createdAt: new Date().toISOString(),
      notes: [],
      dynamicData: newLeadData.dynamicData || {},
    };
    setLeads([newLead, ...leads]);
    api.addLead(newLead).catch(() => {});
    addLog('info', `נוסף מנוי חדש: ${newLead.name}`);
    setIsAddLeadOpen(false);
  };
  const handleDeleteLead = (leadId: string) => {
    if (window.confirm('האם אתה בטוח שברצונך למחוק מנוי זה?')) {
      setLeads(prev => prev.filter(l => l.id !== leadId));
      api.deleteLead(leadId).catch(() => {});
    }
  };
  const handleInquiryStatusChange = (id: string, status: Inquiry['status']) => {
    setInquiries(prev => prev.map(i => i.id === id ? { ...i, status } : i));
    api.updateInquiryStatus(id, status).catch(() => {});
  };
  const handleAddInquiry = (data: { name: string; phone: string; email: string; subject: string; message: string; customerId?: string }) => {
    const newInquiry: Inquiry = {
      id: Math.random().toString(36).substr(2, 9),
      customerId: data.customerId,
      name: data.name,
      phone: data.phone,
      email: data.email,
      subject: data.subject,
      message: data.message,
      source: 'manual',
      status: 'new',
      createdAt: new Date().toISOString(),
    };
    setInquiries(prev => [newInquiry, ...prev]);
    api.addInquiry(newInquiry).catch(() => {});
    // Link to customer if matched
    if (data.customerId) {
      setCustomers(prev => prev.map(c =>
        c.id === data.customerId && !c.inquiryIds.includes(newInquiry.id)
          ? { ...c, inquiryIds: [...c.inquiryIds, newInquiry.id] }
          : c
      ));
    }
  };
  const handleAddStatus = (status: StatusConfig) => setStatuses([...statuses, status]);
  const handleRemoveStatus = (statusId: string) => setStatuses(statuses.filter(s => s.id !== statusId));
  const handleAddColumn = (col: Column) => setColumns([...columns, col]);
  const handleRemoveColumn = (colId: string) => setColumns(columns.filter(c => c.id !== colId));

  // Smart View handlers
  const handleApplySmartView = useCallback((cmd: ViewCommand) => {
    setActiveSmartView(cmd);
    // Apply status filter
    if (cmd.statusFilter && cmd.statusFilter !== 'all') {
      setWixStatusFilter(cmd.statusFilter);
    } else if (cmd.statusFilter === 'all') {
      setWixStatusFilter('all');
    }
    // Apply date range
    if (cmd.dateFrom || cmd.dateTo) {
      setDateRange({ from: cmd.dateFrom, to: cmd.dateTo });
    }
    // Apply search query
    if (cmd.searchQuery) {
      setSearchQuery(cmd.searchQuery);
    }
    // Apply column visibility (only if AI specified columns)
    if (cmd.columns.length > 0) {
      setVisibleColumns(cmd.columns);
    }
  }, []);

  const handleResetSmartView = useCallback(() => {
    setActiveSmartView(null);
    setWixStatusFilter('all');
    setDateRange({ from: '', to: '' });
    setSearchQuery('');
    setVisibleColumns(INITIAL_COLUMNS.map(c => c.id));
  }, []);

  // Column labels map for SmartViewBar
  const columnLabelsMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const c of columns) map[c.id] = c.label;
    return map;
  }, [columns]);

  const filteredLeads = useMemo(() => {
    let result = leads;

    // Apply Wix status filter
    if (wixStatusFilter !== 'all') {
      result = result.filter(lead => {
        const reason = (lead.dynamicData?.cancellationReason || lead.dynamicData?.endingReason || '').toString();
        const wixStatus = (lead.dynamicData?.wixStatus || '').toString();
        const hasActive = lead.dynamicData?.hasActiveSubscription === 'כן';

        switch (wixStatusFilter) {
          case 'active': return hasActive || wixStatus === 'ACTIVE';
          case 'canceled_customer': return reason === 'בוטל ע"י הלקוח';
          case 'canceled_company': return reason === 'בוטל ע"י החברה';
          case 'payment_failed': return reason === 'תשלום נכשל';
          case 'ended': return reason === 'הסתיים' || wixStatus === 'ENDED';
          case 'no_phone': return !lead.phone;
          default: return true;
        }
      });
    }

    // Apply date range filter
    if (dateRange.from || dateRange.to) {
      const parseDMY = (str: string) => {
        if (!str) return null;
        const parts = str.split('.');
        if (parts.length !== 3) return null;
        return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
      };
      const parseISO = (str: string) => {
        if (!str) return null;
        const d = new Date(str);
        return isNaN(d.getTime()) ? null : new Date(d.getFullYear(), d.getMonth(), d.getDate());
      };
      // Parse YYYY-MM-DD as local time (not UTC) to avoid timezone offset issues
      const parseYMD = (s: string) => {
        const [y, m, d] = s.split('-').map(Number);
        return new Date(y, m - 1, d);
      };
      const from = dateRange.from ? parseYMD(dateRange.from) : null;
      const to = dateRange.to ? parseYMD(dateRange.to) : null;

      const inRange = (d: Date | null) => {
        if (!d) return false;
        if (from && d < from) return false;
        if (to && d > to) return false;
        return true;
      };

      // Map cancellation status filter to order-level cancel reasons
      const cancelStatusMap: Record<string, string[]> = {
        'payment_failed': ['תשלום נכשל', 'PAYMENT_FAILURE'],
        'canceled_customer': ['בוטל ע"י הלקוח', 'OWNER_ACTION'],
        'canceled_company': ['בוטל ע"י החברה', 'CANCELED_BY_OWNER'],
      };
      const useCancelDate = wixStatusFilter in cancelStatusMap;

      result = result.filter(lead => {
        if (useCancelDate) {
          // For canceled/failed: scan ALL individual orders for matching cancel reason + date
          try {
            const allOrders = JSON.parse(lead.dynamicData?.allOrders || '[]');
            const matchReasons = cancelStatusMap[wixStatusFilter] || [];
            return allOrders.some((o: any) => {
              const reasonMatch = matchReasons.includes(o.cancelReason) || matchReasons.includes(o.cancel);
              if (!reasonMatch) return false;
              const orderCancelDate = parseISO(o.cancelDate);
              return inRange(orderCancelDate);
            });
          } catch {
            // Fallback to lead-level date
            const cancelDate = parseDMY((lead.dynamicData?.cancellationDate || '').toString());
            return inRange(cancelDate);
          }
        }
        // For active/all: check startDate
        const startDate = parseDMY((lead.dynamicData?.startDate || '').toString());
        const cancelDate = parseDMY((lead.dynamicData?.cancellationDate || '').toString());
        return inRange(startDate) || inRange(cancelDate);
      });
    }

    // Apply search query
    const q = searchQuery.toLowerCase().trim();
    if (q) {
      result = result.filter(lead =>
        lead.name.toLowerCase().includes(q) ||
        lead.phone.includes(q) ||
        (lead.email && lead.email.toLowerCase().includes(q))
      );
    }

    // Special sort for payment_failed: newest failed first, with non-renewed on top
    if (wixStatusFilter === 'payment_failed') {
      result.sort((a, b) => {
        const aHasActive = a.dynamicData?.hasActiveSubscription === 'כן' || a.dynamicData?.wixStatus === 'ACTIVE';
        const bHasActive = b.dynamicData?.hasActiveSubscription === 'כן' || b.dynamicData?.wixStatus === 'ACTIVE';
        // Non-renewed (need to call) first
        if (!aHasActive && bHasActive) return -1;
        if (aHasActive && !bHasActive) return 1;
        // Then by cancellation date, newest first
        const dateA = a.dynamicData?.cancellationDate ? new Date(String(a.dynamicData.cancellationDate).split('.').reverse().join('-')).getTime() || 0 : 0;
        const dateB = b.dynamicData?.cancellationDate ? new Date(String(b.dynamicData.cancellationDate).split('.').reverse().join('-')).getTime() || 0 : 0;
        return dateB - dateA;
      });
    }

    return result;
  }, [leads, searchQuery, wixStatusFilter, dateRange]);

  // Count matching individual orders (for display when filtered by canceled/failed + date range)
  const matchingOrdersCount = useMemo(() => {
    const cancelStatusMap: Record<string, string[]> = {
      'payment_failed': ['תשלום נכשל', 'PAYMENT_FAILURE'],
      'canceled_customer': ['בוטל ע"י הלקוח', 'MEMBER_ACTION'],
      'canceled_company': ['בוטל ע"י החברה', 'OWNER_ACTION'],
    };
    if (!(wixStatusFilter in cancelStatusMap) || (!dateRange.from && !dateRange.to)) return 0;

    const parseYMD = (s: string) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
    const parseISO = (str: string) => { if (!str) return null; const d = new Date(str); return isNaN(d.getTime()) ? null : new Date(d.getFullYear(), d.getMonth(), d.getDate()); };
    const from = dateRange.from ? parseYMD(dateRange.from) : null;
    const to = dateRange.to ? parseYMD(dateRange.to) : null;
    const inRange = (d: Date | null) => { if (!d) return false; if (from && d < from) return false; if (to && d > to) return false; return true; };
    const matchReasons = cancelStatusMap[wixStatusFilter];

    let count = 0;
    filteredLeads.forEach(lead => {
      try {
        const allOrders = JSON.parse(lead.dynamicData?.allOrders || '[]');
        allOrders.forEach((o: any) => {
          if ((matchReasons.includes(o.cancelReason) || matchReasons.includes(o.cancel)) && inRange(parseISO(o.cancelDate))) {
            count++;
          }
        });
      } catch {}
    });
    return count;
  }, [filteredLeads, wixStatusFilter, dateRange]);

  const selectedLead = useMemo(() => leads.find(l => l.id === selectedLeadId), [leads, selectedLeadId]);
  const hasErrors = logs.some(l => l.level === 'error');

  // --- Loading ---
  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#f1f5f9] flex items-center justify-center" dir="rtl">
        <div className="text-gray-400 text-lg font-medium">טוען...</div>
      </div>
    );
  }

  // --- Auth Screen ---
  if (!isAuthenticated) {
    const handleLogin = async (e: React.FormEvent) => {
      e.preventDefault();
      setLoginError('');
      try {
        const result = await api.login(loginEmail, loginPassword, rememberMe);
        if (result.ok) {
          setIsAuthenticated(true);
        } else {
          setLoginError(result.error || 'שגיאה בהתחברות');
        }
      } catch (err: any) {
        setLoginError(err.message || 'שגיאה בהתחברות');
      }
    };

    return (
      <div className="min-h-screen bg-[#f1f5f9] flex items-center justify-center p-4 font-sans" dir="rtl">
        <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl p-8 border border-gray-100 flex flex-col relative overflow-hidden">
          <div className="flex flex-col items-center mb-8">
            <div className="w-16 h-16 bg-[#1e40af] rounded-2xl flex items-center justify-center text-white text-3xl font-black mb-4 shadow-xl shadow-blue-100">M</div>
            <h2 className="text-[#1e40af] font-black text-xs uppercase tracking-widest mb-1">MeWatch CRM</h2>
            <h1 className="text-2xl font-bold text-gray-800">כניסה למערכת הניהול</h1>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-xs font-bold text-gray-400 mb-2 mr-1">כתובת אימייל</label>
              <input
                type="email"
                required
                value={loginEmail}
                onChange={e => setLoginEmail(e.target.value)}
                placeholder="name@gmail.com"
                className="w-full px-5 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all font-medium text-gray-700"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-400 mb-2 mr-1">סיסמה</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={loginPassword}
                  onChange={e => setLoginPassword(e.target.value)}
                  placeholder="הכנס סיסמה"
                  className="w-full px-5 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all font-medium text-gray-700 pl-14"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-sm font-bold px-2 py-1"
                >
                  {showPassword ? '🙈' : '👁️'}
                </button>
              </div>
            </div>
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={e => setRememberMe(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-500 font-medium">זכור אותי במכשיר הזה</span>
            </label>
            {loginError && <p className="text-red-500 text-sm text-center font-medium">{loginError}</p>}
            <button
              type="submit"
              className="w-full bg-[#1e40af] hover:bg-[#1e3a8a] text-white font-bold py-4 rounded-2xl shadow-lg shadow-blue-100 transition-all transform active:scale-95 text-lg"
            >
              התחבר עכשיו
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-50 text-gray-900 font-sans" dir="rtl">
      <Sidebar
        activeTab={activeTab}
        onTabChange={(tab) => { setActiveTab(tab as any); setIsMobileMenuOpen(false); }}
        onSettingsClick={() => setIsSettingsOpen(false)}
        onAddLeadClick={() => setIsAddLeadOpen(true)}
        onImportClick={() => setIsImportOpen(true)}
        onSyncClick={() => { handleWixSync(); setIsMobileMenuOpen(false); }}
        onLogsClick={() => setIsLogsOpen(true)}
        onAIClick={() => setIsAIModalOpen(true)}
        onAnalyticsClick={() => setIsAnalyticsChatOpen(true)}
        hasErrors={hasErrors}
      />

      {/* Mobile Slide-out Menu */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setIsMobileMenuOpen(false)} />
          <aside className="absolute right-0 top-0 h-full w-72 bg-slate-900 text-white flex flex-col animate-in slide-in-from-right duration-200 shadow-2xl">
            <div className="p-5 flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center font-bold">L</div>
                <span className="font-bold text-lg">Smart CRM</span>
              </div>
              <button onClick={() => setIsMobileMenuOpen(false)} className="p-1 hover:bg-slate-800 rounded-lg">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <nav className="p-4 space-y-1">
              {[
                { key: 'dashboard', label: 'לוח בקרה', icon: <MobileHomeIcon /> },
                { key: 'leads', label: 'מנויים', icon: <MobileSubscriptionIcon /> },
                { key: 'customers', label: 'לקוחות', icon: <MobileUsersIcon /> },
                { key: 'inquiries', label: 'פניות', icon: <MobileInboxIcon /> },
                { key: 'marketing', label: 'שיווק', icon: <MobileMarketingIcon /> },
                { key: 'pnl', label: 'P&L', icon: <MobilePnLIcon /> },
                { key: 'tasks', label: 'משימות', icon: <MobileCalendarIcon /> },
                { key: 'site', label: 'ניהול אתר', icon: <MobileGlobeIcon /> },
              ].map(item => (
                <button key={item.key} onClick={() => { setActiveTab(item.key as any); setIsMobileMenuOpen(false); }}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-right transition-colors ${activeTab === item.key ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-800'}`}>
                  {item.icon}<span className="font-medium">{item.label}</span>
                </button>
              ))}
            </nav>
            <div className="p-4 space-y-1 border-t border-slate-800">
              <button onClick={() => { handleWixSync(); setIsMobileMenuOpen(false); }} className="w-full flex items-center gap-3 px-4 py-3 text-sm text-slate-300 hover:bg-slate-800 rounded-xl">
                <SyncIcon className={isSyncing ? 'animate-spin' : ''} /> {isSyncing ? 'מסנכרן...' : 'סנכרון Wix'}
              </button>
              <button onClick={() => { setIsAnalyticsChatOpen(true); setIsMobileMenuOpen(false); }} className="w-full flex items-center gap-3 px-4 py-3 text-sm text-blue-300 hover:bg-slate-800 rounded-xl font-bold">
                <MobileAnalyticsIcon /> בוט אנליטיקה (AI)
              </button>
              <button onClick={() => { setIsAIModalOpen(true); setIsMobileMenuOpen(false); }} className="w-full flex items-center gap-3 px-4 py-3 text-sm text-purple-300 hover:bg-slate-800 rounded-xl font-bold">
                <SparklesIcon /> שליפה מאימייל (AI)
              </button>
              <button onClick={() => { setIsLogsOpen(true); setIsMobileMenuOpen(false); }} className="w-full flex items-center gap-3 px-4 py-3 text-sm text-slate-300 hover:bg-slate-800 rounded-xl relative">
                <MobileTerminalIcon /> לוג שגיאות
                {hasErrors && <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />}
              </button>
              <button onClick={() => { setIsSettingsOpen(true); setIsMobileMenuOpen(false); }} className="w-full flex items-center gap-3 px-4 py-3 text-sm text-slate-300 hover:bg-slate-800 rounded-xl">
                <MobileSettingsIcon /> הגדרות
              </button>
            </div>
          </aside>
        </div>
      )}

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile Top Bar */}
        <div className="md:hidden flex items-center justify-between px-4 py-3 bg-white border-b border-gray-100 shrink-0">
          <button onClick={() => setIsMobileMenuOpen(true)} className="p-2 hover:bg-gray-100 rounded-lg">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
          </button>
          <h1 className="text-lg font-bold text-gray-800">
            {activeTab === 'dashboard' ? 'לוח בקרה' : activeTab === 'tasks' ? 'משימות' : activeTab === 'customers' ? 'לקוחות' : activeTab === 'inquiries' ? 'פניות' : activeTab === 'pnl' ? 'P&L' : activeTab === 'marketing' ? 'שיווק' : activeTab === 'site' ? 'ניהול אתר' : 'מנויים'}
          </h1>
          <div className="flex gap-1">
            {activeTab === 'leads' && (
              <button onClick={handleWixSync} disabled={isSyncing} className="p-2 hover:bg-gray-100 rounded-lg">
                <SyncIcon className={`w-5 h-5 ${isSyncing ? 'animate-spin text-blue-500' : 'text-gray-600'}`} />
              </button>
            )}
            {activeTab === 'leads' && (
              <button onClick={() => setIsAddLeadOpen(true)} className="p-2 bg-blue-600 text-white rounded-lg">
                <PlusIcon />
              </button>
            )}
          </div>
        </div>

        <div className="hidden md:block">
          <Header
            reminderCount={leads.filter(l => l.reminderAt && new Date(l.reminderAt) < new Date()).length}
            notifications={notifications}
            clearNotifications={() => setNotifications([])}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
          />
        </div>

        <main className="flex-1 overflow-auto p-3 md:p-6 lg:p-8 pb-20 md:pb-8">
          <div className="max-w-[1600px] mx-auto">
             {/* Desktop Header — non-leads pages */}
             {activeTab !== 'leads' && (
               <div className="hidden md:flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold text-gray-800">
                  {activeTab === 'dashboard' ? 'לוח בקרה' : activeTab === 'tasks' ? 'משימות ותזכורות' : activeTab === 'customers' ? 'ניהול לקוחות' : activeTab === 'inquiries' ? 'פניות מהאתר' : activeTab === 'pnl' ? 'P&L — רווח והפסד' : activeTab === 'marketing' ? 'ניהול קמפיינים ודיוורים' : activeTab === 'site' ? 'ניהול אתר' : ''}
                </h1>
              </div>
             )}

            {/* === LEADS PAGE: Smart View Chat + Action Buttons + Filters === */}
            {activeTab === 'leads' && (
              <div className="space-y-3 mb-4">
                {/* Top Row: Title + Action Buttons */}
                <div className="hidden md:flex justify-between items-center">
                  <h1 className="text-2xl font-bold text-gray-800">ניהול מנויים</h1>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setIsAIModalOpen(true)}
                      className="bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100 px-3 py-1.5 rounded-lg flex items-center gap-2 transition-all shadow-sm text-sm"
                    >
                      <SparklesIcon /> שליפה מאימייל
                    </button>
                    <button
                      onClick={handleWixSync}
                      disabled={isSyncing}
                      className={`bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 px-3 py-1.5 rounded-lg flex items-center gap-2 transition-all shadow-sm text-sm ${isSyncing ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      <SyncIcon className={isSyncing ? 'animate-spin' : ''} /> {isSyncing ? 'מסנכרן...' : 'סנכרון Wix'}
                    </button>
                    <button onClick={() => setIsAddLeadOpen(true)} className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg flex items-center gap-2 transition-colors shadow-lg text-sm">
                      <PlusIcon /> מנוי חדש
                    </button>
                  </div>
                </div>

                {/* Smart View Chat Bar */}
                <SmartViewBar
                  allColumnIds={columns.map(c => c.id)}
                  allColumnLabels={columnLabelsMap}
                  currentFilter={wixStatusFilter}
                  onApplyView={handleApplySmartView}
                  onReset={handleResetSmartView}
                  activeView={activeSmartView}
                  leadsCount={leads.length}
                  filteredCount={filteredLeads.length}
                  totalOrders={leads.reduce((sum, l) => sum + (parseInt((l.dynamicData?.totalOrders || '1').toString()) || 1), 0)}
                />

                {/* Quick Filter Chips (compact row) */}
                <div className="flex items-center gap-1.5 flex-wrap overflow-x-auto">
                  <span className="text-xs font-medium text-gray-400 shrink-0">סינון מהיר:</span>
                  {WIX_FILTER_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => { setWixStatusFilter(opt.value); if (activeSmartView) setActiveSmartView(null); }}
                      className={`px-2.5 py-1 rounded-full text-[11px] font-bold transition-all border ${
                        wixStatusFilter === opt.value
                          ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                          : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      {opt.label}
                      {opt.value !== 'all' && (
                        <span className="mr-0.5 opacity-70">
                          ({leads.filter(l => {
                            const reason = (l.dynamicData?.cancellationReason || l.dynamicData?.endingReason || '').toString();
                            const wixStatus = (l.dynamicData?.wixStatus || '').toString();
                            const hasActive = l.dynamicData?.hasActiveSubscription === 'כן';
                            switch (opt.value) {
                              case 'active': return hasActive || wixStatus === 'ACTIVE';
                              case 'canceled_customer': return reason === 'בוטל ע"י הלקוח';
                              case 'canceled_company': return reason === 'בוטל ע"י החברה';
                              case 'payment_failed': return reason === 'תשלום נכשל';
                              case 'ended': return reason === 'הסתיים' || wixStatus === 'ENDED';
                              case 'no_phone': return !l.phone;
                              default: return true;
                            }
                          }).length})
                        </span>
                      )}
                    </button>
                  ))}
                  {/* Date presets inline */}
                  <span className="text-gray-300 mx-1">|</span>
                  {[
                    { label: 'החודש', from: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0], to: '' },
                    { label: '3 חודשים', from: new Date(new Date().setMonth(new Date().getMonth() - 3)).toISOString().split('T')[0], to: '' },
                    { label: 'שנה', from: new Date(new Date().setFullYear(new Date().getFullYear() - 1)).toISOString().split('T')[0], to: '' },
                  ].map(preset => (
                    <button
                      key={preset.label}
                      onClick={() => { setDateRange({ from: preset.from, to: preset.to }); if (activeSmartView) setActiveSmartView(null); }}
                      className={`px-2 py-1 rounded-md text-[11px] font-medium transition-all border ${
                        dateRange.from === preset.from && dateRange.to === preset.to
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      📅 {preset.label}
                    </button>
                  ))}
                  {(dateRange.from || dateRange.to) && (
                    <button onClick={() => setDateRange({ from: '', to: '' })} className="text-[11px] text-red-500 hover:text-red-700 font-medium">
                      ✕
                    </button>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'dashboard' ? (
              <Dashboard leads={leads} statuses={statuses} />
            ) : activeTab === 'tasks' ? (
              <TasksView
                tasks={tasks}
                leads={leads}
                onAddTask={handleAddTask}
                onToggleTask={toggleTaskCompletion}
                onDeleteTask={deleteTask}
                onOpenLead={(id) => { setSelectedLeadId(id); setActiveTab('leads'); }}
              />
            ) : activeTab === 'customers' ? (
              <CustomersView customers={customers} leads={leads} onOpenLead={(id) => { setSelectedLeadId(id); setActiveTab('leads'); }} onRefreshCustomers={() => api.getCustomers().then(setCustomers).catch(() => {})} />
            ) : activeTab === 'inquiries' ? (
              <InquiriesView
                inquiries={inquiries}
                customers={customers}
                onStatusChange={handleInquiryStatusChange}
                onAddInquiry={() => setIsAddInquiryOpen(true)}
                onOpenCustomer={(id) => { setActiveTab('customers'); }}
              />
            ) : activeTab === 'pnl' ? (
              <PnLView />
            ) : activeTab === 'marketing' ? (
              <MarketingView leads={leads} />
            ) : activeTab === 'site' ? (
              <SiteManagement />
            ) : (
              <LeadTable
                leads={filteredLeads}
                statuses={statuses}
                columns={columns.filter(c => visibleColumns.includes(c.id))}
                allColumns={columns}
                visibleColumns={visibleColumns}
                matchingOrdersCount={matchingOrdersCount}
                onToggleColumn={(colId) => setVisibleColumns(prev => prev.includes(colId) ? prev.filter(c => c !== colId) : [...prev, colId])}
                onStatusChange={handleUpdateLeadStatus}
                onLeadClick={(id) => setSelectedLeadId(id)}
                onDeleteLead={handleDeleteLead}
              />
            )}
          </div>
        </main>
      </div>

      {selectedLead && (
        <LeadDetailModal 
          lead={selectedLead}
          statuses={statuses}
          onClose={() => setSelectedLeadId(null)}
          onAddNote={(text) => handleAddNote(selectedLead.id, text)}
          onStatusChange={(statusId) => handleUpdateLeadStatus(selectedLead.id, statusId)}
          onUpdateReminder={(date) => handleUpdateLeadReminder(selectedLead.id, date)}
        />
      )}

      {isSettingsOpen && (
        <SettingsModal 
          statuses={statuses}
          columns={columns}
          onClose={() => setIsSettingsOpen(false)}
          onAddStatus={handleAddStatus}
          onRemoveStatus={handleRemoveStatus}
          onAddColumn={handleAddColumn}
          onRemoveColumn={handleRemoveColumn}
        />
      )}

      {isAddLeadOpen && (
        <AddLeadModal onClose={() => setIsAddLeadOpen(false)} onAdd={handleAddLead} columns={columns} />
      )}

      {isImportOpen && (
        <ImportModal 
          statuses={statuses}
          onClose={() => setIsImportOpen(false)}
          onImport={(importedLeads) => {
            setLeads(prev => [...importedLeads, ...prev]);
            addLog('success', `ייבוא אקסל הושלם. נוספו ${importedLeads.length} רשומות.`);
            setIsImportOpen(false);
          }}
        />
      )}

      {isLogsOpen && (
        <SystemLogModal 
          logs={logs}
          onClose={() => setIsLogsOpen(false)}
          onClear={() => { setLogs([]); api.clearLogs().catch(() => {}); }}
        />
      )}

      {isAIModalOpen && (
        <AIExtractModal
          onClose={() => setIsAIModalOpen(false)}
          onAddLead={(newLead) => {
            handleAddLead(newLead);
            setIsAIModalOpen(false);
            setNotifications(prev => [`מנוי חדש חולץ מאימייל: ${newLead.name}`, ...prev]);
          }}
          columns={columns}
        />
      )}

      {isAnalyticsChatOpen && (
        <AIAnalyticsChat
          onClose={() => setIsAnalyticsChatOpen(false)}
        />
      )}

      <AddInquiryModal
        isOpen={isAddInquiryOpen}
        onClose={() => setIsAddInquiryOpen(false)}
        onSubmit={handleAddInquiry}
        customers={customers}
      />

      {/* Email Modal */}
      {emailModalTarget && (
        <SendEmailModal
          to={emailModalTarget.email}
          name={emailModalTarget.name}
          onClose={() => setEmailModalTarget(null)}
        />
      )}

      {/* Mobile Bottom Nav */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex justify-around py-2 px-1 z-30 safe-area-bottom">
        {[
          { key: 'dashboard', label: 'בקרה', icon: <MobileHomeIcon /> },
          { key: 'leads', label: 'מנויים', icon: <MobileSubscriptionIcon /> },
          { key: 'marketing', label: 'שיווק', icon: <MobileMarketingIcon /> },
          { key: 'customers', label: 'לקוחות', icon: <MobileUsersIcon /> },
        ].map(item => (
          <button key={item.key} onClick={() => setActiveTab(item.key as any)}
            className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-colors min-w-[52px] ${activeTab === item.key ? 'text-blue-600' : 'text-gray-400'}`}>
            {item.icon}
            <span className="text-[10px] font-bold">{item.label}</span>
          </button>
        ))}
        <button onClick={() => setIsAnalyticsChatOpen(true)}
          className="flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl text-purple-500 min-w-[52px]">
          <MobileAnalyticsIcon />
          <span className="text-[10px] font-bold">AI</span>
        </button>
      </div>
    </div>
  );
};

const PlusIcon = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>;
const SyncIcon = ({ className }: { className?: string }) => <svg className={`w-5 h-5 ${className || ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>;
const SparklesIcon = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-7.714 2.143L11 21l-2.286-6.857L1 12l7.714-2.143L11 3z" /></svg>;
const MobileHomeIcon = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>;
const MobileUsersIcon = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>;
const MobileCalendarIcon = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>;
const MobileSubscriptionIcon = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" /></svg>;
const MobileInboxIcon = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" /></svg>;
const MobilePnLIcon = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>;
const MobileMarketingIcon = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>;
const MobileAnalyticsIcon = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>;
const MobileGlobeIcon = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" /></svg>;
const MobileTerminalIcon = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>;
const MobileSettingsIcon = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>;

export default App;
