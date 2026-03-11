
import React, { useState } from 'react';
import { Column, Lead } from '../types';
import api from '../lib/api';

interface AIExtractModalProps {
  onClose: () => void;
  onAddLead: (lead: Partial<Lead>) => void;
  columns: Column[];
}

const AIExtractModal: React.FC<AIExtractModalProps> = ({ onClose, onAddLead, columns }) => {
  const [text, setText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleExtract = async () => {
    if (!text.trim()) return;
    
    setIsProcessing(true);
    setError(null);

    try {
      const colDescriptions = columns.map(col => `${col.id}: ${col.label}`).join(', ');
      const prompt = `Extract lead information from the following text (it could be an email, a website notification, or a message).
Text: "${text}"

Return JSON with: name (required), phone, email, dynamicData (object with keys: ${colDescriptions})`;

      const response = await api.aiExtract(prompt, 'Extract lead contact info from text. Return JSON with name, phone, email, dynamicData fields.');
      const extractedData = JSON.parse(response.text || '{}');
      if (!extractedData.name) {
        throw new Error('לא הצלחנו לזהות שם של ליד בטקסט שסופק.');
      }

      onAddLead({
        name: extractedData.name,
        phone: extractedData.phone || '',
        email: extractedData.email || '',
        dynamicData: extractedData.dynamicData || {}
      });
    } catch (err: any) {
      console.error('AI Extraction error:', err);
      setError(err.message || 'שגיאה בעיבוד הטקסט באמצעות הבינה המלאכותית.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-xl rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-purple-50/30">
          <div className="flex items-center gap-2">
            <SparklesIcon className="text-purple-600" />
            <h2 className="text-xl font-bold text-gray-800">שליפת ליד מאימייל / אתר (AI)</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
            <CloseIcon />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <p className="text-sm text-gray-600">
            הדבק כאן את גוף האימייל או הודעת ה-Contact Form מהאתר שלך. הבינה המלאכותית תחלץ עבורך את השם, הטלפון וכל פרט רלוונטי אחר באופן אוטומטי.
          </p>
          
          <textarea 
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="הדבק כאן טקסט..."
            className="w-full h-48 border border-gray-200 rounded-2xl p-4 text-sm focus:ring-2 focus:ring-purple-500 bg-gray-50 outline-none"
            disabled={isProcessing}
          />

          {error && (
            <div className="p-3 bg-red-50 border border-red-100 rounded-xl text-xs text-red-600 font-medium">
              {error}
            </div>
          )}

          <div className="flex gap-3">
            <button 
              onClick={handleExtract}
              disabled={!text.trim() || isProcessing}
              className={`flex-1 bg-purple-600 text-white py-3 rounded-xl font-bold hover:bg-purple-700 transition-all shadow-lg shadow-purple-100 flex items-center justify-center gap-2 ${isProcessing ? 'opacity-70 cursor-not-allowed' : ''}`}
            >
              {isProcessing ? <LoadingIcon className="animate-spin" /> : <SparklesIcon />}
              {isProcessing ? 'מעבד נתונים...' : 'שלח לעיבוד AI'}
            </button>
            <button 
              onClick={onClose}
              className="px-6 py-3 border border-gray-200 rounded-xl font-bold text-gray-500 hover:bg-gray-50 transition-colors"
            >
              ביטול
            </button>
          </div>
        </div>
        
        <div className="p-4 bg-purple-50 text-[10px] text-purple-700 flex items-center gap-2">
           <InfoIcon className="w-3 h-3" />
           הנתונים נשלחים לעיבוד באמצעות Google Gemini 3 Flash. המידע אינו נשמר מחוץ לדפדפן שלך.
        </div>
      </div>
    </div>
  );
};

const CloseIcon = () => <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>;
const SparklesIcon = ({ className }: { className?: string }) => <svg className={className || "w-5 h-5"} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-7.714 2.143L11 21l-2.286-6.857L1 12l7.714-2.143L11 3z" /></svg>;
const LoadingIcon = ({ className }: { className?: string }) => <svg className={className || "w-5 h-5"} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>;
const InfoIcon = ({ className }: { className?: string }) => <svg className={className || "w-5 h-5"} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;

export default AIExtractModal;
