
import React, { useState } from 'react';
import { Task, Lead } from '../types';

interface TasksViewProps {
  tasks: Task[];
  leads: Lead[];
  onAddTask: (task: Omit<Task, 'id' | 'isCompleted'>) => void;
  onToggleTask: (id: string) => void;
  onDeleteTask: (id: string) => void;
  onOpenLead: (leadId: string) => void;
}

const TasksView: React.FC<TasksViewProps> = ({ tasks, leads, onAddTask, onToggleTask, onDeleteTask, onOpenLead }) => {
  const [newTitle, setNewTitle] = useState('');
  const [newDate, setNewDate] = useState('');
  const [selectedLead, setSelectedLead] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle || !newDate) return;
    onAddTask({
      title: newTitle,
      dueDate: new Date(newDate).toISOString(),
      leadId: selectedLead || undefined,
      type: 'general'
    });
    setNewTitle('');
    setNewDate('');
    setSelectedLead('');
  };

  const leadReminders = leads.filter(l => l.reminderAt).map(l => ({
    id: `lead-rem-${l.id}`,
    title: `חזרה ללקוח: ${l.name}`,
    dueDate: l.reminderAt!,
    isCompleted: false,
    leadId: l.id,
    type: 'call' as const
  }));

  const allReminders = [...tasks, ...leadReminders].sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in fade-in duration-500">
      {/* Task Creation */}
      <div className="lg:col-span-1 bg-white p-6 rounded-2xl border border-gray-100 shadow-sm h-fit sticky top-24">
        <h3 className="text-lg font-bold mb-6 text-gray-800 flex items-center gap-2">
          <PlusIcon /> הוספת משימה חדשה
        </h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">מה צריך לעשות?</label>
            <input 
              required
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="למשל: לשלוח הצעת מחיר במייל"
              className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">מתי?</label>
            <input 
              required
              type="datetime-local"
              value={newDate}
              onChange={(e) => setNewDate(e.target.value)}
              className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">שיוך לליד (אופציונלי)</label>
            <select 
              value={selectedLead}
              onChange={(e) => setSelectedLead(e.target.value)}
              className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-blue-500"
            >
              <option value="">בחר ליד...</option>
              {leads.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </div>
          <button 
            type="submit"
            className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-100"
          >
            צור משימה
          </button>
        </form>
      </div>

      {/* Task List */}
      <div className="lg:col-span-2 space-y-6">
        <div className="flex justify-between items-center">
          <h3 className="text-xl font-bold text-gray-800">רשימת משימות ותזכורות</h3>
          <div className="flex gap-2">
            <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-xs font-bold">סה"כ: {allReminders.length}</span>
          </div>
        </div>

        <div className="space-y-4">
          {allReminders.length === 0 ? (
            <div className="bg-white p-12 text-center rounded-2xl border-2 border-dashed border-gray-100">
               <CalendarLargeIcon />
               <p className="text-gray-400 mt-4 italic font-medium">אין משימות או תזכורות קרובות. זמן מצוין למנוחה!</p>
            </div>
          ) : (
            allReminders.map((task) => {
              const isLeadReminder = task.id.startsWith('lead-rem');
              const isPastDue = new Date(task.dueDate) < new Date();
              
              return (
                <div 
                  key={task.id} 
                  className={`bg-white p-5 rounded-2xl border transition-all flex items-center gap-4 ${task.isCompleted ? 'opacity-50 grayscale' : 'shadow-sm hover:shadow-md'} ${isPastDue && !task.isCompleted ? 'border-red-100 bg-red-50/10' : 'border-gray-100'}`}
                >
                  <button 
                    onClick={() => !isLeadReminder && onToggleTask(task.id)}
                    disabled={isLeadReminder}
                    className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${task.isCompleted ? 'bg-green-500 border-green-500 text-white' : 'border-gray-200 hover:border-blue-400'}`}
                  >
                    {task.isCompleted && <CheckIcon />}
                  </button>
                  
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className={`font-bold ${task.isCompleted ? 'line-through text-gray-400' : 'text-gray-800'}`}>{task.title}</p>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${task.type === 'call' ? 'bg-orange-100 text-orange-600' : 'bg-blue-100 text-blue-600'}`}>
                        {task.type === 'call' ? 'שיחה' : 'משימה'}
                      </span>
                    </div>
                    <p className={`text-xs mt-1 ${isPastDue ? 'text-red-500 font-bold' : 'text-gray-500'}`}>
                      {new Date(task.dueDate).toLocaleString('he-IL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                      {isPastDue && " (עבר הזמן!)"}
                    </p>
                  </div>

                  {task.leadId && (
                    <button 
                      onClick={() => onOpenLead(task.leadId!)}
                      className="text-xs bg-gray-50 hover:bg-gray-100 border border-gray-100 px-3 py-1.5 rounded-lg text-gray-600 font-medium transition-colors"
                    >
                      צפייה בליד
                    </button>
                  )}

                  {!isLeadReminder && (
                    <button onClick={() => onDeleteTask(task.id)} className="p-2 text-gray-300 hover:text-red-500 transition-colors">
                      <TrashIcon />
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

const PlusIcon = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>;
const CheckIcon = () => <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>;
const TrashIcon = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>;
const CalendarLargeIcon = () => <svg className="w-16 h-16 text-gray-100 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>;

export default TasksView;
