
import React, { useState } from 'react';
import { StatusConfig, Column } from '../types';

interface SettingsModalProps {
  statuses: StatusConfig[];
  columns: Column[];
  onClose: () => void;
  onAddStatus: (status: StatusConfig) => void;
  onRemoveStatus: (id: string) => void;
  onAddColumn: (col: Column) => void;
  onRemoveColumn: (id: string) => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ statuses, columns, onClose, onAddStatus, onRemoveStatus, onAddColumn, onRemoveColumn }) => {
  const [newStatusLabel, setNewStatusLabel] = useState('');
  const [newColLabel, setNewColLabel] = useState('');

  const handleAddStatusSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStatusLabel) return;
    onAddStatus({
      id: Math.random().toString(36).substr(2, 9),
      label: newStatusLabel,
      color: 'bg-gray-500',
      rowColor: 'bg-gray-50',
      order: statuses.length
    });
    setNewStatusLabel('');
  };

  const handleAddColSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newColLabel) return;
    onAddColumn({
      id: Math.random().toString(36).substr(2, 9),
      label: newColLabel,
      type: 'text'
    });
    setNewColLabel('');
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-4xl rounded-3xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden">
        <div className="p-8 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">הגדרות Back Office</h2>
            <p className="text-sm text-gray-500 mt-1">נהל סטטוסים, עמודות ומבנה הנתונים במערכת</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
             <CloseIcon />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-8 grid md:grid-cols-2 gap-12">
          {/* Status Management */}
          <section className="space-y-6">
            <div>
              <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                <TagIcon /> ניהול סטטוסים
              </h3>
              <form onSubmit={handleAddStatusSubmit} className="flex gap-2 mb-6">
                <input 
                  type="text" 
                  value={newStatusLabel}
                  onChange={(e) => setNewStatusLabel(e.target.value)}
                  placeholder="שם סטטוס חדש..."
                  className="flex-1 border border-gray-200 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                />
                <button type="submit" className="bg-green-600 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-green-700">הוסף</button>
              </form>

              <div className="space-y-2">
                {statuses.map(s => (
                  <div key={s.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100 group">
                    <div className="flex items-center gap-3">
                      <div className={`w-4 h-4 rounded-full ${s.color}`}></div>
                      <span className="font-medium text-gray-700">{s.label}</span>
                    </div>
                    {s.id !== 'new' && (
                      <button onClick={() => onRemoveStatus(s.id)} className="text-red-400 hover:text-red-600 p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        מחק
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Column Management */}
          <section className="space-y-6">
            <div>
              <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                <LayoutIcon /> ניהול עמודות
              </h3>
              <form onSubmit={handleAddColSubmit} className="flex gap-2 mb-6">
                <input 
                  type="text" 
                  value={newColLabel}
                  onChange={(e) => setNewColLabel(e.target.value)}
                  placeholder="כותרת עמודה חדשה..."
                  className="flex-1 border border-gray-200 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                />
                <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-blue-700">הוסף</button>
              </form>

              <div className="space-y-2">
                {columns.map(c => (
                  <div key={c.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100 group">
                    <div className="flex items-center gap-3">
                      <div className="bg-blue-100 text-blue-600 p-1.5 rounded">
                        <ColumnIcon />
                      </div>
                      <span className="font-medium text-gray-700">{c.label}</span>
                    </div>
                    <button onClick={() => onRemoveColumn(c.id)} className="text-red-400 hover:text-red-600 p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      מחק
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

const CloseIcon = () => <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" /></svg>;
const TagIcon = () => <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" /></svg>;
const LayoutIcon = () => <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>;
const ColumnIcon = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>;

export default SettingsModal;
