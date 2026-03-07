
import React, { useState } from 'react';
import { Column, Lead } from '../types';

interface AddLeadModalProps {
  onClose: () => void;
  onAdd: (data: Partial<Lead>) => void;
  columns: Column[];
}

const AddLeadModal: React.FC<AddLeadModalProps> = ({ onClose, onAdd, columns }) => {
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
  });
  const [dynamicData, setDynamicData] = useState<Record<string, string>>({});

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onAdd({
      ...formData,
      dynamicData
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-xl">
        <div className="p-6 border-b border-gray-100 flex justify-between items-center">
          <h2 className="text-xl font-bold">הוספת ליד ידני</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full"><CloseIcon /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">שם מלא</label>
              <input required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full border border-gray-200 rounded-lg p-2" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">טלפון</label>
              <input required value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} className="w-full border border-gray-200 rounded-lg p-2" dir="ltr" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">אימייל</label>
              <input type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="w-full border border-gray-200 rounded-lg p-2" dir="ltr" />
            </div>
          </div>

          <div className="pt-4 border-t border-gray-100">
            <h3 className="text-sm font-bold text-gray-500 mb-4">עמודות מותאמות אישית</h3>
            <div className="grid grid-cols-2 gap-4">
              {columns.map(col => (
                <div key={col.id}>
                  <label className="block text-xs font-medium text-gray-600 mb-1">{col.label}</label>
                  <input 
                    value={dynamicData[col.id] || ''} 
                    onChange={e => setDynamicData({...dynamicData, [col.id]: e.target.value})}
                    className="w-full border border-gray-200 rounded-lg p-2 text-sm" 
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="pt-6 flex gap-3">
             <button type="submit" className="flex-1 bg-blue-600 text-white py-2 rounded-lg font-bold hover:bg-blue-700 transition-colors">צור ליד</button>
             <button type="button" onClick={onClose} className="flex-1 border border-gray-200 py-2 rounded-lg font-bold hover:bg-gray-50 transition-colors">ביטול</button>
          </div>
        </form>
      </div>
    </div>
  );
};

const CloseIcon = () => <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" /></svg>;

export default AddLeadModal;
