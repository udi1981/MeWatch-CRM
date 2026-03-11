
import React, { useState, useMemo } from 'react';
import { Customer } from '../types';

interface AddInquiryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { name: string; phone: string; email: string; subject: string; message: string; customerId?: string }) => void;
  customers: Customer[];
}

const AddInquiryModal: React.FC<AddInquiryModalProps> = ({ isOpen, onClose, onSubmit, customers }) => {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');

  const matchedCustomer = useMemo(() => {
    if (!email && !phone) return undefined;
    return customers.find(c => {
      if (email && c.email && c.email.toLowerCase() === email.toLowerCase()) return true;
      if (phone && c.phone) {
        const cleanInput = phone.replace(/[^0-9]/g, '');
        const cleanCust = c.phone.replace(/[^0-9]/g, '');
        if (cleanInput.length >= 7 && cleanCust === cleanInput) return true;
      }
      return false;
    });
  }, [email, phone, customers]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() && !phone.trim() && !email.trim()) return;
    onSubmit({
      name: name.trim(),
      phone: phone.trim(),
      email: email.trim(),
      subject: subject.trim(),
      message: message.trim(),
      customerId: matchedCustomer?.id,
    });
    setName(''); setPhone(''); setEmail(''); setSubject(''); setMessage('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[85vh] overflow-auto m-4" onClick={e => e.stopPropagation()}>
        <div className="p-6 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-800">פנייה חדשה</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1">שם *</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-green-500 outline-none"
              placeholder="שם הפונה" required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1">טלפון</label>
              <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} dir="ltr"
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-green-500 outline-none"
                placeholder="050-1234567" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1">אימייל</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} dir="ltr"
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-green-500 outline-none"
                placeholder="email@example.com" />
            </div>
          </div>

          {/* Matched customer indicator */}
          {matchedCustomer && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex items-center gap-2">
              <svg className="w-4 h-4 text-blue-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="text-xs">
                <span className="font-bold text-blue-700">לקוח מזוהה: </span>
                <span className="text-blue-600">{matchedCustomer.name}</span>
                {matchedCustomer.subscriptionIds.length > 0 && (
                  <span className="bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-bold mr-2 text-[10px]">מנוי קיים</span>
                )}
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1">נושא</label>
            <input type="text" value={subject} onChange={e => setSubject(e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-green-500 outline-none"
              placeholder="נושא הפנייה" />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1">הודעה</label>
            <textarea value={message} onChange={e => setMessage(e.target.value)} rows={4}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-green-500 outline-none resize-none"
              placeholder="תוכן הפנייה..." />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="submit" className="flex-1 bg-green-600 text-white py-2.5 rounded-xl text-sm font-bold hover:bg-green-700 transition-colors">
              שמור פנייה
            </button>
            <button type="button" onClick={onClose} className="px-6 py-2.5 bg-gray-100 text-gray-600 rounded-xl text-sm font-bold hover:bg-gray-200 transition-colors">
              ביטול
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddInquiryModal;
