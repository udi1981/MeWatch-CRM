
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Lead, StatusConfig, Column, Note, Task, LogEntry } from './types';
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
import SystemLogModal from './components/SystemLogModal';
import AIExtractModal from './components/AIExtractModal';

const WIX_SITE_ID = '8fc7cea3-f43b-40cc-82d3-6f4dcfacfb0d';
const WIX_AUTH_TOKEN = 'IST.eyJraWQiOiJQb3pIX2FDMiIsImFsZyI6IlJTMjU2In0.eyJkYXRhIjoie1wiaWRcIjpcIjA2ZGI0MzIzLTkyOTMtNDg5My04NWY5LTkxNjhhMmNhOTIxYVwiLFwiaWRlbnRpdHlcIjp7XCJ0eXBlXCI6XCJhcHBsaWNhdGlvblwiLFwiaWRcIjpcIjAyN2YxMmE0LWU5ZjEtNGVmNC1hNjk1LTBhMzk2NzI0NDFhMlwifSxcInRlbmFudFwiOntcInR5cGVcIjpcImFjY291bnRcIixcImlkXCI6XCI4ZTQ5ZmI2My1lYThjLTRiOTktYWNhZS1lZGIxOGFjNDdkMDRcIn19IiwiaWF0IjoxNzY3Mjg5MzI0fQ.CIkY_ht495vf_81q1iRBlGRQShOK7GPH4lju3bAwCce54UNWPnlMJ73-fLgKzGMAhqQg0JMPTCF2PNPnUdIxpFRrZVv71293a3PYuu05pZD3nILMkHkUKKz7h6IgV07VEjpY9Ne_2xJAkn4TgReoOMSl3IA1qO2F-J9ES4dx1NOFbooCz_pEFg9eoYx2ShNXRLoB1RVg9rh-SVVNP1AD_-tK2H1-KtkQVM66gJzuaD1PlZT2H4y9ptXJvlxKZosJuu1JFWSBQivq9VT2qeM3cGuHKP5gGVp_utzL4NkDhNZDHTaAkbrHe0VHoIu0Rg9nukF-DvKRfBIdrIr8GsPZiA';

const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'leads' | 'tasks'>('leads');
  const [leads, setLeads] = useState<Lead[]>(() => {
    const saved = localStorage.getItem('crm_leads');
    return saved ? JSON.parse(saved) : MOCK_LEADS;
  });
  const [tasks, setTasks] = useState<Task[]>([]);
  const [statuses, setStatuses] = useState<StatusConfig[]>(INITIAL_STATUSES);
  const [columns, setColumns] = useState<Column[]>(INITIAL_COLUMNS);
  const [logs, setLogs] = useState<LogEntry[]>(() => {
    const saved = localStorage.getItem('crm_logs');
    return saved ? JSON.parse(saved) : [];
  });
  
  const [searchQuery, setSearchQuery] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAddLeadOpen, setIsAddLeadOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isLogsOpen, setIsLogsOpen] = useState(false);
  const [isAIModalOpen, setIsAIModalOpen] = useState(false);
  const [notifications, setNotifications] = useState<string[]>([]);

  useEffect(() => {
    localStorage.setItem('crm_leads', JSON.stringify(leads));
  }, [leads]);

  useEffect(() => {
    localStorage.setItem('crm_logs', JSON.stringify(logs));
  }, [logs]);

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
    addLog('info', 'מנסה סנכרון מול Wix Pricing Plans API...');
    
    try {
      const response = await fetch('https://www.wixapis.com/pricing-plans/v2/orders/query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Wix-Site-Id': WIX_SITE_ID,
          'Authorization': WIX_AUTH_TOKEN
        },
        body: JSON.stringify({
          query: {
            filter: {
              status: { $in: ['CANCELED', 'OFFLINE_CANCELLED'] }
            }
          }
        })
      });

      if (!response.ok) {
        throw new Error(`Wix error: ${response.status}`);
      }

      const data = await response.json();
      const wixOrders = data.orders || [];
      
      const newLeads: Lead[] = wixOrders
        .filter((order: any) => !leads.some(l => l.id === order.id))
        .map((order: any) => ({
          id: order.id,
          name: `${order.buyer?.firstName || ''} ${order.buyer?.lastName || ''}`.trim() || 'לקוח Wix',
          phone: order.buyer?.phone || '',
          email: order.buyer?.email || '',
          statusId: 'new',
          createdAt: order._createdDate || new Date().toISOString(),
          notes: [],
          dynamicData: {
            planName: order.planName || 'מנוי Wix',
            wixStatus: order.status || 'CANCELED',
            cancellationDate: new Date(order._updatedDate || order._createdDate).toLocaleDateString('he-IL'),
            endingReason: 'סונכרן מ-Wix'
          }
        }));

      if (newLeads.length > 0) {
        setLeads(prev => [...newLeads, ...prev]);
        addLog('success', `הסנכרון הצליח! נוספו ${newLeads.length} לידים.`);
      }
    } catch (error: any) {
      console.error('Wix sync error:', error);
      if (error.message.includes('Failed to fetch')) {
        addLog('error', 'שגיאת CORS מצד Wix', 'הדפדפן חוסם פנייה ישירה. מומלץ להשתמש בייבוא ידני או בשרת מתווך.');
        alert('שימו לב: שרתי Wix חוסמים פנייה ישירה מהדפדפן (CORS). לא ניתן למשוך נתונים אוטומטית ללא שרת מתווך.');
      } else {
        addLog('error', 'שגיאת סנכרון', error.message);
      }
    } finally {
      setIsSyncing(false);
    }
  };

  const handleUpdateLeadStatus = (leadId: string, statusId: string) => {
    setLeads(prev => prev.map(l => l.id === leadId ? { ...l, statusId } : l));
  };
  const handleUpdateLeadReminder = (leadId: string, reminderAt: string | undefined) => {
    setLeads(prev => prev.map(l => l.id === leadId ? { ...l, reminderAt } : l));
  };
  const handleAddNote = (leadId: string, noteText: string) => {
    const newNote: Note = {
      id: Math.random().toString(36).substr(2, 9),
      text: noteText,
      timestamp: new Date().toLocaleString('he-IL')
    };
    setLeads(prev => prev.map(l => l.id === leadId ? { ...l, notes: [newNote, ...l.notes] } : l));
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
    addLog('info', `נוסף ליד חדש: ${newLead.name}`);
    setIsAddLeadOpen(false);
  };
  const handleDeleteLead = (leadId: string) => {
    if (window.confirm('האם אתה בטוח שברצונך למחוק ליד זה?')) {
      setLeads(prev => prev.filter(l => l.id !== leadId));
    }
  };
  const handleAddStatus = (status: StatusConfig) => setStatuses([...statuses, status]);
  const handleRemoveStatus = (statusId: string) => setStatuses(statuses.filter(s => s.id !== statusId));
  const handleAddColumn = (col: Column) => setColumns([...columns, col]);
  const handleRemoveColumn = (colId: string) => setColumns(columns.filter(c => c.id !== colId));

  const filteredLeads = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return leads;
    return leads.filter(lead => 
      lead.name.toLowerCase().includes(q) || 
      lead.phone.includes(q) ||
      (lead.email && lead.email.toLowerCase().includes(q))
    );
  }, [leads, searchQuery]);

  const selectedLead = useMemo(() => leads.find(l => l.id === selectedLeadId), [leads, selectedLeadId]);
  const hasErrors = logs.some(l => l.level === 'error');

  // --- Auth Screen (Registration) ---
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#f1f5f9] flex items-center justify-center p-4 font-sans" dir="rtl">
        <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl p-8 border border-gray-100 flex flex-col relative overflow-hidden">
          {/* Logo / Title Section */}
          <div className="flex flex-col items-center mb-8">
            <div className="w-16 h-16 bg-[#1e40af] rounded-2xl flex items-center justify-center text-white text-3xl font-black mb-4 shadow-xl shadow-blue-100">U</div>
            <h2 className="text-[#1e40af] font-black text-xs uppercase tracking-widest mb-1">Welcome to ULIVER</h2>
            <h1 className="text-2xl font-bold text-gray-800">כניסה למערכת הניהול</h1>
          </div>

          <form onSubmit={(e) => { e.preventDefault(); setIsAuthenticated(true); }} className="space-y-5">
            <div>
              <label className="block text-xs font-bold text-gray-400 mb-2 mr-1">כתובת אימייל</label>
              <input 
                type="email" 
                required 
                placeholder="name@gmail.com" 
                className="w-full px-5 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all font-medium text-gray-700"
              />
            </div>
            
            <button 
              type="submit" 
              className="w-full bg-[#1e40af] hover:bg-[#1e3a8a] text-white font-bold py-4 rounded-2xl shadow-lg shadow-blue-100 transition-all transform active:scale-95 text-lg"
            >
              התחבר עכשיו
            </button>
          </form>

          {/* Moved Terms to the bottom of the white frame */}
          <div className="mt-12 pt-6 border-t border-gray-50 flex justify-center gap-6 text-[10px] font-bold text-gray-300 uppercase tracking-widest">
            <a href="#" className="hover:text-blue-600 transition-colors">Privacy Policy</a>
            <a href="#" className="hover:text-blue-600 transition-colors">Terms of Use</a>
            <a href="#" className="hover:text-blue-600 transition-colors">Contact Support</a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-50 text-gray-900 font-sans" dir="rtl">
      <Sidebar 
        activeTab={activeTab === 'tasks' ? 'dashboard' : activeTab as any}
        onTabChange={(tab) => setActiveTab(tab as any)}
        onSettingsClick={() => setIsSettingsOpen(false)}
        onAddLeadClick={() => setIsAddLeadOpen(true)}
        onImportClick={() => setIsImportOpen(true)}
        onSyncClick={handleWixSync}
        onLogsClick={() => setIsLogsOpen(true)}
        onAIClick={() => setIsAIModalOpen(true)}
        hasErrors={hasErrors}
      />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header 
          reminderCount={leads.filter(l => l.reminderAt && new Date(l.reminderAt) < new Date()).length} 
          notifications={notifications} 
          clearNotifications={() => setNotifications([])}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
        />
        
        <main className="flex-1 overflow-auto p-4 md:p-6 lg:p-8">
          <div className="max-w-[1600px] mx-auto">
             <div className="flex justify-between items-center mb-6">
              <h1 className="text-2xl font-bold text-gray-800">
                {activeTab === 'dashboard' ? 'לוח בקרה' : activeTab === 'tasks' ? 'משימות ותזכורות' : 'ניהול לידים'}
              </h1>
              {activeTab === 'leads' && (
                <div className="flex gap-3">
                  <button 
                    onClick={() => setIsAIModalOpen(true)}
                    className="bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100 px-4 py-2 rounded-lg flex items-center gap-2 transition-all shadow-sm"
                  >
                    <SparklesIcon /> שליפה מאימייל (AI)
                  </button>
                  <button 
                    onClick={handleWixSync}
                    disabled={isSyncing}
                    className={`bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 px-4 py-2 rounded-lg flex items-center gap-2 transition-all shadow-sm ${isSyncing ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <SyncIcon className={isSyncing ? 'animate-spin' : ''} /> {isSyncing ? 'מסנכרן...' : 'סנכרון Wix'}
                  </button>
                  <button onClick={() => setIsAddLeadOpen(true)} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors shadow-lg">
                    <PlusIcon /> ליד חדש
                  </button>
                </div>
              )}
            </div>

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
            ) : (
              <LeadTable 
                leads={filteredLeads}
                statuses={statuses}
                columns={columns}
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
          onClear={() => { setLogs([]); localStorage.removeItem('crm_logs'); }}
        />
      )}

      {isAIModalOpen && (
        <AIExtractModal 
          onClose={() => setIsAIModalOpen(false)}
          onAddLead={(newLead) => {
            handleAddLead(newLead);
            setIsAIModalOpen(false);
            setNotifications(prev => [`ליד חדש חולץ מאימייל: ${newLead.name}`, ...prev]);
          }}
          columns={columns}
        />
      )}
    </div>
  );
};

const PlusIcon = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>;
const SyncIcon = ({ className }: { className?: string }) => <svg className={`w-5 h-5 ${className}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>;
const SparklesIcon = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-7.714 2.143L11 21l-2.286-6.857L1 12l7.714-2.143L11 3z" /></svg>;

export default App;
