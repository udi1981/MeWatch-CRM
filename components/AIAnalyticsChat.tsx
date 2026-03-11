
import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI } from '@google/genai';
import { Lead } from '../types';
import { computeFinancialMetrics } from '../lib/analytics';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  table?: { headers: string[]; rows: string[][] };
  metrics?: { label: string; value: string }[];
}

interface AIAnalyticsChatProps {
  leads: Lead[];
  onClose: () => void;
}

const QUICK_QUESTIONS = [
  'סיכום כללי על העסק',
  'מה ההכנסות החודשיות?',
  'מה אחוז הנטישה?',
  'איזה מנוי הכי רווחי?',
  'מגמת ביטולים ב-3 חודשים אחרונים',
  'כמה הכנסות מהחנות?',
  'מנויים שצריך להתקשר אליהם',
  'לקוחות עם תשלום נכשל',
  'אחוז ביטולים לפי סיבה',
  'לקוחות ללא טלפון',
];

const buildDataSummary = (leads: Lead[]): string => {
  const total = leads.length;
  const withPhone = leads.filter(l => l.phone).length;
  const withEmail = leads.filter(l => l.email).length;
  const withSim = leads.filter(l => l.dynamicData?.simNumber).length;
  const fm = computeFinancialMetrics(leads);

  const byStatus: Record<string, number> = {};
  const byReason: Record<string, number> = {};
  const byPlan: Record<string, number> = {};
  const byWixStatus: Record<string, number> = {};

  for (const l of leads) {
    const s = l.statusId || 'unknown';
    byStatus[s] = (byStatus[s] || 0) + 1;

    const reason = (l.dynamicData?.cancellationReason || '').toString();
    if (reason) byReason[reason] = (byReason[reason] || 0) + 1;

    const plan = (l.dynamicData?.planName || '').toString();
    if (plan) byPlan[plan] = (byPlan[plan] || 0) + 1;

    const ws = (l.dynamicData?.wixStatus || '').toString();
    if (ws) byWixStatus[ws] = (byWixStatus[ws] || 0) + 1;
  }

  // Build sample lists for common queries (limit to 50 per category)
  const paymentFailed = leads.filter(l => (l.dynamicData?.cancellationReason || '').toString() === 'תשלום נכשל').slice(0, 50);
  const canceledByCustomer = leads.filter(l => (l.dynamicData?.cancellationReason || '').toString() === 'בוטל ע"י הלקוח').slice(0, 50);
  const canceledByCompany = leads.filter(l => (l.dynamicData?.cancellationReason || '').toString() === 'בוטל ע"י החברה').slice(0, 50);
  const noPhone = leads.filter(l => !l.phone).slice(0, 50);

  const formatLead = (l: Lead) => `${l.name} | ${l.phone || 'אין טלפון'} | ${l.email || 'אין'} | ${l.dynamicData?.planName || ''} | ₪${l.dynamicData?.totalPaid || 0} | ${l.dynamicData?.cancellationReason || 'פעיל'}`;

  const revenueByPlanStr = fm.revenueByPlan.map(([plan, data]) =>
    `  ${plan}: הכנסות ₪${data.revenue.toLocaleString()}, ${data.active} פעילים מתוך ${data.count} לקוחות`
  ).join('\n');

  const revenueByMonthStr = fm.revenueByMonth.map(([month, rev]) =>
    `  ${month}: ₪${rev.toLocaleString()}`
  ).join('\n');

  const cancelsByMonthStr = fm.cancelsByMonth.map(([month, count]) =>
    `  ${month}: ${count} ביטולים`
  ).join('\n');

  const paymentStatusStr = Object.entries(fm.paymentStatusBreakdown)
    .map(([status, count]) => `  ${status}: ${count}`)
    .join('\n');

  return `
=== דוח עסקי מלא - מערכת CRM ===

--- סיכום כללי ---
סה"כ לקוחות: ${total}
עם טלפון: ${withPhone}, ללא טלפון: ${total - withPhone}
עם אימייל: ${withEmail}, ללא אימייל: ${total - withEmail}
עם מספר סים: ${withSim}, ללא מספר סים: ${total - withSim}

--- נתונים כספיים ---
הכנסות כוללות (מנויים + חנות): ₪${fm.combinedRevenue.toLocaleString()}
הכנסות ממנויים: ₪${fm.totalRevenue.toLocaleString()}
הכנסות מחנות (eCommerce): ₪${fm.ecomRevenue.toLocaleString()}
הכנסה חודשית פעילה (MRR): ₪${fm.monthlyActiveRevenue.toLocaleString()}
הכנסה ממוצעת ללקוח: ₪${fm.avgRevenuePerCustomer.toLocaleString()}
סה"כ הזמנות: ${fm.totalOrdersCount}

--- מצב מנויים ---
מנויים פעילים: ${fm.activeCount}
ביטולים: ${fm.canceledCount}
תשלום נכשל: ${fm.paymentFailedCount}
החזרים (refunds): ${fm.refundedCount}
אחוז נטישה (churn): ${fm.churnRate}%
אחוז שימור (retention): ${fm.retentionRate}%

--- הכנסות לפי מנוי ---
${revenueByPlanStr || '  אין נתונים'}

--- הכנסות לפי חודש (12 חודשים אחרונים) ---
${revenueByMonthStr || '  אין נתונים'}

--- ביטולים לפי חודש (6 חודשים אחרונים) ---
${cancelsByMonthStr || '  אין נתונים'}

--- סטטוס תשלומים ---
${paymentStatusStr || '  אין נתונים'}

--- חלוקה לפי סטטוס Wix ---
${JSON.stringify(byWixStatus)}

--- חלוקה לפי סיבת ביטול ---
${JSON.stringify(byReason)}

--- חלוקה לפי מנוי (כמות) ---
${JSON.stringify(byPlan)}

--- חלוקה לפי סטטוס CRM ---
${JSON.stringify(byStatus)}

--- דוגמאות לקוחות - תשלום נכשל (${paymentFailed.length} מתוך ${byReason['תשלום נכשל'] || 0}) ---
${paymentFailed.map(formatLead).join('\n')}

--- דוגמאות - בוטל ע"י הלקוח (${canceledByCustomer.length} מתוך ${byReason['בוטל ע"י הלקוח'] || 0}) ---
${canceledByCustomer.map(formatLead).join('\n')}

--- דוגמאות - בוטל ע"י החברה (${canceledByCompany.length} מתוך ${byReason['בוטל ע"י החברה'] || 0}) ---
${canceledByCompany.map(formatLead).join('\n')}

--- ללא טלפון (${noPhone.length} מתוך ${total - withPhone}) ---
${noPhone.map(formatLead).join('\n')}
`.trim();
};

const AIAnalyticsChat: React.FC<AIAnalyticsChatProps> = ({ leads, onClose }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      text: text.trim(),
    };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const dataSummary = buildDataSummary(leads);

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `אתה אנליסט עסקי (Business Analyst) מומחה של מערכת CRM לניהול מנויים ומכירות. ענה תמיד בעברית.

התפקיד שלך:
- לנתח נתונים כספיים: הכנסות, MRR, מגמות, רווחיות לפי מנוי
- לנתח נטישה (churn): אחוזי ביטול, סיבות, מגמות חודשיות, חיזוי
- לנתח ביצועי מנויים: איזה מנוי הכי רווחי, איזה בסיכון
- לנתח בריאות תשלומים: תשלומים נכשלים, החזרים, חובות
- לתת תובנות עסקיות ולהמליץ על פעולות
- לחשב ערך חיי לקוח (CLV) ומדדים עסקיים

להלן כל הנתונים העסקיים העדכניים:

${dataSummary}

השאלה של המשתמש: "${text.trim()}"

ענה בפורמט JSON בלבד עם המבנה הבא:
{
  "answer": "תשובה טקסטואלית מפורטת בעברית עם תובנות ניתוח עסקי",
  "metrics": [{"label": "שם המדד", "value": "ערך"}],
  "table": {"headers": ["עמודה1", "עמודה2"], "rows": [["ערך1", "ערך2"]]}
}

הכללים:
- תמיד כלול "answer" עם תשובה ברורה ומפורטת
- כלול "metrics" כשיש מספרים חשובים — הכנסות, אחוזים, מגמות
- כלול "table" כשמציגים השוואות, רשימות או דוחות
- אם מבקשים רשימת לקוחות, כלול שם, טלפון, מנוי, סכום ששילם, סיבת ביטול
- היה מדויק עם המספרים - השתמש בנתונים האמיתיים בלבד
- כשמדברים על מגמות, השווה בין חודשים וציין עלייה/ירידה באחוזים
- תמיד הוסף המלצה עסקית כשרלוונטי`,
        config: {
          responseMimeType: "application/json",
        }
      });

      // Sanitize control characters that Gemini sometimes includes in JSON strings
      const raw = (response.text || '{}').replace(/[\x00-\x1F\x7F]/g, (ch: string) => ch === '\n' || ch === '\r' || ch === '\t' ? ch : '');
      const parsed = JSON.parse(raw);

      const aiMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        text: parsed.answer || 'לא הצלחתי לעבד את השאלה.',
        table: parsed.table,
        metrics: parsed.metrics,
      };
      setMessages(prev => [...prev, aiMsg]);
    } catch (err: any) {
      console.error('AI Analytics error:', err);
      const errorMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        text: `שגיאה: ${err.message || 'לא הצלחתי לעבד את השאלה'}`,
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end md:items-center justify-center">
      <div className="bg-white w-full max-w-2xl h-[85vh] md:h-[75vh] md:rounded-3xl rounded-t-3xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom duration-300">
        {/* Header */}
        <div className="p-4 border-b border-gray-100 bg-gradient-to-l from-blue-50 to-purple-50 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
              <BotIcon className="text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-800">אנליסט עסקי AI</h2>
              <p className="text-xs text-gray-400">{leads.length} לקוחות · הכנסות, מנויים, נטישה ועוד</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/80 rounded-full transition-colors">
            <CloseIcon />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center px-4">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-100 to-purple-100 rounded-2xl flex items-center justify-center mb-4">
                <BotIcon className="w-8 h-8 text-blue-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-700 mb-2">אנליסט עסקי חכם</h3>
              <p className="text-sm text-gray-400 mb-6">הכנסות, מנויים, נטישה, רווחיות — שאל אותי כל שאלה עסקית</p>
              <div className="flex flex-wrap gap-2 justify-center">
                {QUICK_QUESTIONS.map((q) => (
                  <button
                    key={q}
                    onClick={() => sendMessage(q)}
                    className="px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-blue-50 hover:border-blue-200 hover:text-blue-700 transition-all shadow-sm"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-start' : 'justify-end'}`}>
              <div className={`max-w-[85%] ${msg.role === 'user' ? 'bg-blue-600 text-white rounded-2xl rounded-br-md' : 'bg-gray-100 text-gray-800 rounded-2xl rounded-bl-md'} p-4 shadow-sm`}>
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.text}</p>

                {/* Metrics cards */}
                {msg.metrics && msg.metrics.length > 0 && (
                  <div className="grid grid-cols-2 gap-2 mt-3">
                    {msg.metrics.map((m, i) => (
                      <div key={i} className="bg-white/90 rounded-xl p-3 text-center border border-gray-200/50">
                        <div className="text-lg font-black text-blue-600">{m.value}</div>
                        <div className="text-[10px] font-medium text-gray-500 mt-0.5">{m.label}</div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Data table */}
                {msg.table && msg.table.headers && msg.table.rows && (
                  <div className="mt-3 overflow-x-auto">
                    <table className="w-full text-xs border-collapse">
                      <thead>
                        <tr>
                          {msg.table.headers.map((h, i) => (
                            <th key={i} className="bg-white/80 text-gray-600 font-bold px-3 py-2 text-right border-b border-gray-200">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {msg.table.rows.map((row, ri) => (
                          <tr key={ri} className="hover:bg-white/50">
                            {row.map((cell, ci) => (
                              <td key={ci} className="px-3 py-1.5 border-b border-gray-100 text-right">{cell}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex justify-end">
              <div className="bg-gray-100 rounded-2xl rounded-bl-md p-4 shadow-sm">
                <div className="flex items-center gap-2 text-gray-400">
                  <LoadingDots />
                  <span className="text-xs">מנתח נתונים...</span>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Quick questions after first message */}
        {messages.length > 0 && !isLoading && (
          <div className="px-4 pb-2 flex gap-2 overflow-x-auto shrink-0">
            {QUICK_QUESTIONS.slice(0, 3).map((q) => (
              <button
                key={q}
                onClick={() => sendMessage(q)}
                className="px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-full text-xs text-gray-500 hover:bg-blue-50 hover:text-blue-600 transition-all whitespace-nowrap shrink-0"
              >
                {q}
              </button>
            ))}
          </div>
        )}

        {/* Input */}
        <div className="p-4 border-t border-gray-100 bg-gray-50/50 shrink-0">
          <div className="flex gap-2">
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && sendMessage(input)}
              placeholder="שאל שאלה על הנתונים..."
              className="flex-1 px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              disabled={isLoading}
            />
            <button
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || isLoading}
              className="px-4 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-blue-100"
            >
              <SendIcon />
            </button>
          </div>
          <p className="text-[10px] text-gray-300 mt-2 text-center">מופעל על ידי Google Gemini 2.5 Flash · Business Analyst</p>
        </div>
      </div>
    </div>
  );
};

const CloseIcon = () => <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>;
const BotIcon = ({ className }: { className?: string }) => <svg className={className || "w-5 h-5"} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>;
const SendIcon = () => <svg className="w-5 h-5 rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>;
const LoadingDots = () => (
  <div className="flex gap-1">
    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
  </div>
);

export default AIAnalyticsChat;
