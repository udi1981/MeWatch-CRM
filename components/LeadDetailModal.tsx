
import React, { useState, useRef } from 'react';
import { Lead, StatusConfig } from '../types';

interface LeadDetailModalProps {
  lead: Lead;
  statuses: StatusConfig[];
  onClose: () => void;
  onAddNote: (text: string) => void;
  onStatusChange: (statusId: string) => void;
  onUpdateReminder: (date: string | undefined) => void;
}

const LeadDetailModal: React.FC<LeadDetailModalProps> = ({ lead, statuses, onClose, onAddNote, onStatusChange, onUpdateReminder }) => {
  const [noteText, setNoteText] = useState('');
  const [showReminderPicker, setShowReminderPicker] = useState(false);
  const [tempReminderDate, setTempReminderDate] = useState<string>('');
  const dateInputRef = useRef<HTMLInputElement>(null);

  const getWixUrl = (phone: string) => {
    const baseUrl = "https://manage.wix.com/dashboard/8fc7cea3-f43b-40cc-82d3-6f4dcfacfb0d/contacts?referralInfo=sidebar&viewId=all-items-view&sort=lastActivity.activityDate+desc&selectedColumns=avatar%2Cname%2Cemail%2Cphone%2CmemberStatus%2ClastActivity.activityDate%2Caddress%2Clabels+false%2Csource+false%2Cassignee+false%2Cbirthdate+false%2Clanguage+false%2CcreatedDate+false%2Ccompany+false%2Cposition+false";
    const cleanedPhone = phone.replace(/\D/g, '');
    return `${baseUrl}&searchTerm=${cleanedPhone}`;
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const handleSubmitNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteText.trim()) return;
    onAddNote(noteText);
    setNoteText('');
  };

  const handleQuickReminder = (hours: number) => {
    if (hours === 0) return;
    const date = new Date();
    date.setHours(date.getHours() + hours);
    onUpdateReminder(date.toISOString());
    setShowReminderPicker(false);
  };

  const handleTomorrowMorning = () => {
    const date = new Date();
    date.setDate(date.getDate() + 1);
    date.setHours(9, 0, 0, 0);
    onUpdateReminder(date.toISOString());
    setShowReminderPicker(false);
  };

  const handleCustomReminderConfirm = () => {
    if (tempReminderDate) {
      onUpdateReminder(new Date(tempReminderDate).toISOString());
      setShowReminderPicker(false);
      setTempReminderDate('');
    }
  };

  const status = statuses.find(s => s.id === lead.statusId) || statuses[0];

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-hidden">
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh] animate-in zoom-in duration-200">
        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/30 rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className={`w-4 h-4 rounded-full ${status.color} shadow-sm`}></div>
            <h2 className="text-xl font-bold text-gray-800">{lead.name}</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
            <CloseIcon />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          {/* Info & Reminder Actions */}
          <div className="flex flex-col md:flex-row justify-between items-start gap-4">
            <div className="grid grid-cols-2 gap-6 flex-1">
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase mb-1">טלפון</p>
                <div className="flex items-center gap-3">
                  <a href={getWixUrl(lead.phone)} target="_blank" rel="noopener noreferrer" className="text-blue-600 font-bold text-lg hover:underline" dir="ltr">{lead.phone}</a>
                  <button 
                    onClick={() => copyToClipboard(lead.phone)}
                    className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 transition-colors"
                    title="העתק מספר"
                  >
                    <CopyIcon />
                  </button>
                </div>
              </div>
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase mb-1">סטטוס</p>
                <select 
                  value={lead.statusId}
                  onChange={(e) => onStatusChange(e.target.value)}
                  className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white shadow-sm focus:ring-2 focus:ring-blue-500 w-full"
                >
                  {statuses.map(s => (
                    <option key={s.id} value={s.id}>{s.label}</option>
                  ))}
                </select>
              </div>
            </div>
            
            <div className="w-full md:w-auto relative">
              <p className="text-xs font-bold text-gray-400 uppercase mb-1">תזכורת להמשך טיפול</p>
              <div className="flex gap-2">
                {lead.reminderAt ? (
                  <div className="flex items-center gap-2 bg-orange-50 border border-orange-100 px-3 py-1.5 rounded-lg">
                    <span className="text-xs font-bold text-orange-700">{new Date(lead.reminderAt).toLocaleString('he-IL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'})}</span>
                    <button onClick={() => onUpdateReminder(undefined)} className="text-orange-400 hover:text-orange-600 transition-colors"><CloseIcon className="w-3 h-3" /></button>
                  </div>
                ) : (
                  <button 
                    onClick={() => setShowReminderPicker(!showReminderPicker)}
                    className="flex items-center gap-2 bg-blue-50 border border-blue-100 px-3 py-1.5 rounded-lg text-blue-600 text-xs font-bold hover:bg-blue-100 transition-colors"
                  >
                    <ClockIcon /> קבע תזכורת
                  </button>
                )}
              </div>
              
              {showReminderPicker && (
                <div className="absolute left-0 mt-2 w-64 bg-white border border-gray-200 rounded-xl shadow-2xl z-[60] p-4 space-y-4 animate-in fade-in slide-in-from-top-2">
                   <div className="space-y-2">
                     <label className="block text-[10px] font-bold text-gray-400 uppercase">תזכורת מהירה:</label>
                     <select 
                        onChange={(e) => handleQuickReminder(parseInt(e.target.value))}
                        defaultValue="0"
                        className="w-full text-xs border border-gray-200 rounded-lg p-2 bg-gray-50 focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer"
                     >
                        <option value="0" disabled>בחר זמן (שעות)...</option>
                        {[...Array(24)].map((_, i) => (
                          <option key={i+1} value={i+1}>בעוד {i+1} {i === 0 ? 'שעה' : 'שעות'}</option>
                        ))}
                     </select>
                     <button onClick={handleTomorrowMorning} className="w-full text-[11px] bg-blue-50 hover:bg-blue-100 p-2 rounded-lg font-bold text-blue-700 border border-blue-100 transition-colors text-center">מחר בבוקר (09:00)</button>
                   </div>
                   
                   <div className="relative border-t border-gray-100 pt-3">
                     <label className="block text-[10px] font-bold text-gray-400 mb-1">בחירה חופשית:</label>
                     <div className="space-y-2">
                       <div className="relative">
                         <input 
                           type="datetime-local" 
                           value={tempReminderDate}
                           className="w-full text-xs border border-gray-200 rounded-lg p-2 bg-white focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer text-gray-700 h-10"
                           onChange={(e) => setTempReminderDate(e.target.value)}
                           onClick={(e) => {
                             try { (e.target as any).showPicker(); } catch(err) {}
                           }}
                         />
                         <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-blue-500">
                           <CalendarIconSmall />
                         </div>
                         {!tempReminderDate && (
                           <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-xs text-gray-400">
                             לחץ לבחירת זמן מדויק
                           </div>
                         )}
                       </div>
                       <button 
                         onClick={handleCustomReminderConfirm}
                         disabled={!tempReminderDate}
                         className="w-full text-[11px] bg-slate-900 text-white p-2 rounded-lg font-bold hover:bg-slate-800 transition-colors text-center disabled:opacity-30 disabled:cursor-not-allowed"
                       >
                         אישור
                       </button>
                     </div>
                   </div>
                   <button onClick={() => setShowReminderPicker(false)} className="text-[10px] text-gray-400 w-full text-center hover:text-gray-600 transition-colors">סגור</button>
                </div>
              )}
            </div>
          </div>

          {/* Notes Section */}
          <div className="space-y-4">
            <h3 className="font-bold text-gray-800 flex items-center gap-2">
              <NoteIcon /> הערות והיסטוריה
            </h3>
            
            <form onSubmit={handleSubmitNote} className="space-y-3">
              <textarea 
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                placeholder="הוסף הערה חדשה (למשל: 'דיברנו, ביקש שנחזור בשבוע הבא')..."
                className="w-full border border-gray-200 rounded-xl p-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50/30 transition-all"
                rows={3}
              />
              <div className="flex justify-end">
                <button 
                  type="submit"
                  disabled={!noteText.trim()}
                  className="bg-slate-900 text-white px-6 py-2 rounded-xl text-sm font-bold hover:bg-slate-800 disabled:opacity-50 transition-all shadow-lg"
                >
                  שמור הערה
                </button>
              </div>
            </form>

            <div className="space-y-3 pt-2">
              {lead.notes.length === 0 ? (
                <div className="text-center py-10 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-100">
                  <p className="text-gray-400 text-sm italic">אין עדיין הערות לליד זה</p>
                </div>
              ) : (
                lead.notes.map(note => (
                  <div key={note.id} className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm hover:border-blue-100 transition-colors relative group">
                    <p className="text-sm text-gray-700 leading-relaxed font-medium">{note.text}</p>
                    <div className="flex items-center gap-2 mt-3">
                      <div className="w-1.5 h-1.5 bg-blue-400 rounded-full"></div>
                      <p className="text-[10px] text-gray-400 font-mono tracking-tight">{note.timestamp}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const CopyIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
  </svg>
);

const CloseIcon = ({ className }: { className?: string }) => <svg className={className || "w-6 h-6"} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>;
const NoteIcon = () => <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" /></svg>;
const ClockIcon = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
const CalendarIconSmall = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>;

export default LeadDetailModal;
