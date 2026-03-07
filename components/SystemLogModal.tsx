
import React from 'react';
import { LogEntry } from '../types';

interface SystemLogModalProps {
  logs: LogEntry[];
  onClose: () => void;
  onClear: () => void;
}

const SystemLogModal: React.FC<SystemLogModalProps> = ({ logs, onClose, onClear }) => {
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-3xl rounded-3xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden animate-in zoom-in duration-200">
        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
          <div>
            <h2 className="text-xl font-bold text-gray-800">יומן פעילות ומערכת</h2>
            <p className="text-xs text-gray-500 mt-1">תיעוד טכני של פעולות סנכרון, ייבוא ושגיאות</p>
          </div>
          <div className="flex gap-2">
             <button onClick={onClear} className="text-xs text-red-500 hover:bg-red-50 px-3 py-1.5 rounded-lg transition-colors">נקה יומן</button>
             <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
               <CloseIcon />
             </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 bg-slate-950 font-mono text-xs">
          {logs.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-slate-500 italic">
              אין פעילות מתועדת כרגע...
            </div>
          ) : (
            <div className="space-y-3">
              {logs.map(log => (
                <div key={log.id} className="border-l-2 border-slate-800 pl-4 py-1">
                  <div className="flex items-start gap-3">
                    <span className="text-slate-500 shrink-0">[{log.timestamp}]</span>
                    <span className={`font-bold uppercase shrink-0 ${
                      log.level === 'error' ? 'text-red-400' : 
                      log.level === 'warning' ? 'text-orange-400' : 
                      log.level === 'success' ? 'text-emerald-400' : 'text-blue-400'
                    }`}>
                      {log.level}:
                    </span>
                    <span className="text-slate-200">{log.message}</span>
                  </div>
                  {log.details && (
                    <div className="mt-1 ml-[165px] text-slate-500 italic leading-relaxed">
                      &gt; {log.details}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-4 bg-gray-50 border-t border-gray-100 flex justify-end text-[10px] text-gray-400">
          מציג 100 פעולות אחרונות • המידע נשמר מקומית בדפדפן
        </div>
      </div>
    </div>
  );
};

const CloseIcon = () => <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>;

export default SystemLogModal;
