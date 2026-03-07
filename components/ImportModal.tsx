
import React, { useState } from 'react';
import { Lead, StatusConfig } from '../types';

interface ImportModalProps {
  statuses: StatusConfig[];
  onClose: () => void;
  onImport: (leads: Lead[]) => void;
}

const ImportModal: React.FC<ImportModalProps> = ({ statuses, onClose, onImport }) => {
  const [activeTab, setActiveTab] = useState<'file' | 'sheet'>('file');
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [sheetUrl, setSheetUrl] = useState('');
  const [error, setError] = useState<string | null>(null);

  const cleanString = (str: string) => {
    if (!str) return "";
    return str.trim()
      .normalize('NFC')
      .replace(/[\u200B-\u200D\uFEFF\u202A-\u202E]/g, ""); // Remove BOM and hidden Unicode markers
  };

  const mapStatusTextToId = (text: string): string => {
    const cleanText = cleanString(text);
    if (!cleanText) return 'new';
    
    // Check current status labels
    const statusByLabel = statuses.find(s => cleanString(s.label) === cleanText);
    if (statusByLabel) return statusByLabel.id;
    
    // Fallback mappings for Hebrew variations
    const fallbackMappings: Record<string, string> = {
      'חדש': 'new',
      'בוצע': 'done',
      'סגור': 'done',
      'לא ענה': 'no_answer',
      'חזרה': 'callback',
      'לחזור אליו': 'callback',
      'ביטל': 'cancelled',
      'מבוטל': 'cancelled',
      'סיום': 'done',
      'הושלם': 'done',
      'נסגר': 'done'
    };
    return fallbackMappings[cleanText] || 'new';
  };

  const processCsvData = (text: string) => {
    const cleanText = text.replace(/^\uFEFF/, '').normalize('NFC');
    
    const records: string[][] = [];
    let currentRecord: string[] = [];
    let currentValue = "";
    let inQuotes = false;
    
    for (let i = 0; i < cleanText.length; i++) {
      const char = cleanText[i];
      const nextChar = cleanText[i + 1];
      
      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          currentValue += '"'; 
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        currentRecord.push(currentValue);
        currentValue = "";
      } else if ((char === '\r' || char === '\n') && !inQuotes) {
        if (char === '\r' && nextChar === '\n') i++;
        currentRecord.push(currentValue);
        if (currentRecord.some(v => v.trim() !== "")) {
          records.push(currentRecord);
        }
        currentRecord = [];
        currentValue = "";
      } else {
        currentValue += char;
      }
    }
    
    if (currentValue || currentRecord.length > 0) {
      currentRecord.push(currentValue);
      if (currentRecord.some(v => v.trim() !== "")) {
        records.push(currentRecord);
      }
    }

    if (records.length < 2) {
      setError('לא נמצאו נתונים תקינים. וודא שהקובץ אינו ריק ושיש לו כותרות.');
      setIsUploading(false);
      return;
    }

    const headers = records[0].map(h => cleanString(h));
    
    const findIdx = (targets: string[]) => {
      const cleanedTargets = targets.map(t => cleanString(t));
      // 1. Exact match
      const exactIdx = headers.findIndex(h => cleanedTargets.some(t => h === t));
      if (exactIdx !== -1) return exactIdx;
      // 2. Partial match
      return headers.findIndex(h => cleanedTargets.some(t => h.includes(t)));
    };
    
    const idx = {
      name: findIdx(['שם הלקוח', 'שם', 'name', 'לקוח']),
      phone: findIdx(['טלפון', 'נייד', 'phone', 'mobile']),
      email: findIdx(['אימייל', 'email', 'מייל']),
      status: findIdx(['סטטוס', 'status', 'מצב']),
      notes: findIdx(['הערות', 'notes', 'הערה']),
      endingReason: findIdx(['סיבת סיום', 'ending reason']),
      endDate: findIdx(['תאריך סיום', 'תאריך']),
      subName: findIdx(['שם מנוי', 'מנוי', 'planName']),
      subStatus: findIdx(['סטטוס מנוי', 'wixStatus'])
    };

    const importedLeads: Lead[] = [];
    for (let i = 1; i < records.length; i++) {
      const row = records[i];
      if (!row || row.length === 0) continue;
      
      const name = idx.name !== -1 ? cleanString(row[idx.name] || '') : '';
      const phone = idx.phone !== -1 ? cleanString(row[idx.phone] || '') : '';
      
      if (!name && !phone) continue;

      const lead: Lead = {
        id: `import-${Date.now()}-${i}-${Math.random().toString(36).substr(2, 5)}`,
        name: name || 'לקוח ללא שם',
        phone: phone || '',
        email: idx.email !== -1 && row[idx.email]?.includes('@') ? cleanString(row[idx.email]) : '',
        statusId: mapStatusTextToId(idx.status !== -1 ? row[idx.status] : ''),
        createdAt: new Date().toISOString(),
        notes: idx.notes !== -1 && row[idx.notes] ? [{
          id: `note-${Date.now()}-${i}`,
          text: cleanString(row[idx.notes]),
          timestamp: new Date().toLocaleString('he-IL')
        }] : [],
        dynamicData: {
          endingReason: idx.endingReason !== -1 ? cleanString(row[idx.endingReason] || '') : '',
          cancellationDate: idx.endDate !== -1 ? cleanString(row[idx.endDate] || '') : '',
          planName: idx.subName !== -1 ? cleanString(row[idx.subName] || '') : '',
          wixStatus: idx.subStatus !== -1 ? cleanString(row[idx.subStatus] || '') : ""
        }
      };
      importedLeads.push(lead);
    }
    
    if (importedLeads.length === 0) {
      setError('לא הצלחנו לזהות רשומות תקינות. וודא שקיימות עמודות בשם "שם הלקוח" או "טלפון".');
      setIsUploading(false);
    } else {
      onImport(importedLeads);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    setError(null);
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      processCsvData(text);
    };
    reader.readAsText(file);
  };

  const handleSheetImport = async () => {
    const cleanUrl = sheetUrl.trim();
    if (!cleanUrl.includes('docs.google.com/spreadsheets')) {
      setError('הקישור אינו קישור גוגל שיטס תקין');
      return;
    }

    setIsUploading(true);
    setError(null);
    setProgress(20);

    try {
      const match = cleanUrl.match(/\/d\/(.*?)(\/|#|\?|$)/);
      if (!match) throw new Error('לא הצלחנו לחלץ את מזהה הגיליון מהקישור');
      
      const spreadsheetId = match[1];
      const csvUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:csv`;

      setProgress(50);
      const response = await fetch(csvUrl);
      
      if (!response.ok) throw new Error('הגיליון חסום. וודא שבהגדרות השיתוף בחרת "כל מי שקיבל את הקישור יכול לצפות".');
      
      const text = await response.text();
      if (text.includes('<!DOCTYPE html>') || text.includes('google-signin')) {
        throw new Error('הגיליון אינו ציבורי. אנא שנה את הגדרות השיתוף ל-"כל אחד עם הקישור".');
      }

      setProgress(90);
      setTimeout(() => processCsvData(text), 300);
    } catch (err: any) {
      setError(err.message || 'שגיאה בתקשורת עם שרתי גוגל');
      setIsUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
          <h2 className="text-xl font-bold text-gray-800">ייבוא נתונים</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
            <CloseIcon />
          </button>
        </div>

        <div className="p-1 bg-gray-100 flex m-6 rounded-xl">
          <button 
            onClick={() => { setActiveTab('file'); setError(null); }}
            className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${activeTab === 'file' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
          >
            קובץ CSV / Excel
          </button>
          <button 
            onClick={() => { setActiveTab('sheet'); setError(null); }}
            className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${activeTab === 'sheet' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
          >
            Google Sheets
          </button>
        </div>

        <div className="p-6 pt-0 space-y-6">
          {activeTab === 'file' ? (
            <div className="space-y-4">
              <div className="border-2 border-dashed border-gray-200 rounded-2xl p-8 text-center hover:border-blue-400 transition-colors relative group">
                <input 
                  type="file" 
                  accept=".csv,.xlsx,.xls" 
                  onChange={handleFileChange}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  disabled={isUploading}
                />
                <div className="space-y-3">
                  <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto group-hover:scale-110 transition-transform">
                    <CloudIcon />
                  </div>
                  <div className="text-sm">
                    <p className="font-bold text-gray-700">לחץ להעלאה או גרור לכאן</p>
                    <p className="text-gray-400 mt-1">תומך בפורמט CSV (מומלץ)</p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase mb-2">קישור לגיליון (ציבורי)</label>
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    value={sheetUrl}
                    onChange={(e) => setSheetUrl(e.target.value)}
                    placeholder="https://docs.google.com/spreadsheets/d/..."
                    className="flex-1 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 bg-gray-50"
                  />
                  <button 
                    onClick={handleSheetImport}
                    disabled={!sheetUrl || isUploading}
                    className="bg-blue-600 text-white px-4 rounded-xl font-bold hover:bg-blue-700 disabled:opacity-50 transition-colors"
                  >
                    ייבא
                  </button>
                </div>
                <p className="text-[10px] text-gray-400 mt-2">וודא שהגיליון מוגדר כציבורי ("כל אחד עם הקישור")</p>
              </div>
            </div>
          )}

          {isUploading && (
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-bold text-blue-600">
                <span>מעבד נתונים...</span>
                <span>{progress}%</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2">
                <div className="bg-blue-600 h-2 rounded-full transition-all duration-300" style={{ width: `${progress}%` }}></div>
              </div>
            </div>
          )}

          {error && (
            <div className="p-4 bg-red-50 border border-red-100 rounded-xl flex gap-3 animate-in shake duration-300">
              <div className="text-red-500 shrink-0"><AlertIcon /></div>
              <p className="text-xs text-red-700 font-medium leading-relaxed">{error}</p>
            </div>
          )}
        </div>

        <div className="p-6 bg-gray-50 border-t border-gray-100 flex justify-end gap-3">
          <button onClick={onClose} className="px-6 py-2 text-sm font-bold text-gray-500 hover:text-gray-700 transition-colors">ביטול</button>
        </div>
      </div>
    </div>
  );
};

// Icons
const CloseIcon = () => <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>;
const CloudIcon = () => <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>;
const AlertIcon = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>;

export default ImportModal;
