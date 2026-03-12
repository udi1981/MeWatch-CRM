
import React, { useState, useRef, useEffect, useCallback } from 'react';
import api from '../lib/api';

type ChartItem = { label: string; value: number; color?: string };

type Message = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  table?: { headers: string[]; rows: string[][] };
  metrics?: { label: string; value: string; icon?: string; color?: string }[];
  chart?: { type: 'bar' | 'horizontal-bar'; title?: string; data: ChartItem[] };
};

type AIAnalyticsChatProps = {
  onClose: () => void;
};

const QUICK_QUESTIONS = [
  { text: 'סיכום כללי על העסק', icon: '📊' },
  { text: 'מה ההכנסות החודשיות?', icon: '💰' },
  { text: 'מה אחוז הנטישה?', icon: '📉' },
  { text: 'איזה מנוי הכי רווחי?', icon: '🏆' },
  { text: 'מגמת ביטולים ב-3 חודשים אחרונים', icon: '📈' },
  { text: 'כמה מתשלום נכשל חידשו מנוי?', icon: '🔄' },
  { text: 'לקוחות בסיכון - תשלום נכשל', icon: '⚠️' },
  { text: 'השוואת הכנסות חודש נוכחי לקודם', icon: '📅' },
  { text: 'ביטולים לפי סיבה ותוכנית', icon: '❌' },
  { text: 'כמה מנויים בוטלו ב-2025 וכמה חידשו?', icon: '🔁' },
  { text: 'לקוחות ללא טלפון', icon: '📵' },
];

const CHART_COLORS = [
  '#3b82f6', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b',
  '#ef4444', '#ec4899', '#6366f1', '#14b8a6', '#f97316',
];

/** Build a comprehensive text summary from the server's AI analytics data */
const buildDataSummary = (data: any): string => {
  if (!data) return 'אין נתונים זמינים.';

  const { overview, revenue, monthlyRevenue, subscriptionStatus, planDistribution,
    cancellations, renewal, customerSegments, atRiskCustomers, growthMetrics,
    ecommerce, dailyRevenue, weeklyRevenue, lastSync, generatedAt } = data;

  const weekChange = revenue.prev7Days > 0
    ? Math.round(((revenue.last7Days - revenue.prev7Days) / revenue.prev7Days) * 100)
    : 0;
  const monthChange = revenue.lastMonth > 0
    ? Math.round(((revenue.thisMonth - revenue.lastMonth) / revenue.lastMonth) * 100)
    : 0;

  // Total active/canceled from subscriptionStatus
  const activeCount = subscriptionStatus?.find((s: any) => s.status === 'ACTIVE')?.count || 0;
  const totalSubs = subscriptionStatus?.reduce((s: number, r: any) => s + r.count, 0) || 0;
  const churnRate = totalSubs > 0 ? Math.round(((totalSubs - activeCount) / totalSubs) * 100) : 0;

  const sections = [
    `=== דוח אנליטי מלא - MeWatch CRM ===`,
    `נוצר: ${generatedAt} | סנכרון אחרון: ${lastSync || 'לא ידוע'}`,
    ``,
    `--- סיכום כללי ---`,
    `סה"כ לידים/מנויים: ${overview.totalLeads}`,
    `עם טלפון: ${overview.withPhone} | עם אימייל: ${overview.withEmail}`,
    ``,
    `--- הכנסות ---`,
    `היום: ₪${revenue.today.toLocaleString()} | אתמול: ₪${revenue.yesterday.toLocaleString()}`,
    `7 ימים אחרונים: ₪${revenue.last7Days.toLocaleString()} (${weekChange >= 0 ? '+' : ''}${weekChange}% מהשבוע הקודם)`,
    `חודש נוכחי: ₪${revenue.thisMonth.toLocaleString()} | חודש קודם: ₪${revenue.lastMonth.toLocaleString()} (${monthChange >= 0 ? '+' : ''}${monthChange}%)`,
    `שנה נוכחית: ₪${revenue.thisYear.toLocaleString()} | שנה קודמת: ₪${revenue.lastYear.toLocaleString()}`,
    `כל הזמנים: ₪${revenue.allTime.toLocaleString()} | ${revenue.allTimeOrders} הזמנות | החזרים: ₪${revenue.allTimeRefunds.toLocaleString()}`,
    ``,
    `--- מצב מנויים ---`,
    ...(subscriptionStatus || []).map((s: any) => `  ${s.status}: ${s.count} מנויים, הכנסות ₪${s.revenue.toLocaleString()}`),
    `  אחוז נטישה (churn): ${churnRate}% | שימור: ${100 - churnRate}%`,
    ``,
    `--- חלוקה לפי תוכנית ---`,
    ...(planDistribution || []).map((p: any) => `  ${p.plan}: ${p.total} סה"כ, ${p.active} פעילים, הכנסות ₪${p.revenue.toLocaleString()}`),
    ``,
    `--- ביטולים לפי סיבה ---`,
    ...(cancellations?.byReason || []).map((c: any) => `  ${c.reason}: ${c.count}`),
    ``,
    `--- ביטולים לפי חודש (כולל סיבה) ---`,
    ...(cancellations?.byMonth || []).map((c: any) => `  ${c.monthYear} - ${c.reason}: ${c.count}`),
    ``,
    `--- ביטולים לפי תוכנית ---`,
    ...(cancellations?.byPlan || []).map((c: any) => `  ${c.plan} - ${c.reason}: ${c.count}`),
    ``,
    `--- חידוש מנויים (Renewal/Recovery) ---`,
    `סה"כ תשלום נכשל: ${renewal.totalFailed}`,
    `חידשו מנוי: ${renewal.renewed} (${renewal.renewalRate}%)`,
    `לא חידשו (בסיכון): ${renewal.notRenewed}`,
    ``,
    `--- הכנסות חודשיות (24 חודשים) ---`,
    ...(monthlyRevenue || []).map((m: any) => `  ${m.month}: ₪${m.revenue.toLocaleString()} (${m.orders} הזמנות, החזרים ₪${m.refunds.toLocaleString()})`),
    ``,
    `--- הכנסות יומיות (30 ימים אחרונים) ---`,
    ...(dailyRevenue || []).slice(0, 15).map((d: any) => `  ${d.date}: ₪${d.revenue.toLocaleString()}`),
    ``,
    `--- הכנסות שבועיות (12 שבועות) ---`,
    ...(weeklyRevenue || []).map((w: any) => `  שבוע ${w.weekStart}: ₪${w.revenue.toLocaleString()}`),
    ``,
    `--- צמיחה לפי חודש ---`,
    ...(growthMetrics || []).map((g: any) => `  ${g.month}: ${g.newLeads} לידים חדשים, ${g.activeAtCreation} פעילים`),
    ``,
    `--- פלחי לקוחות (tags) ---`,
    ...(customerSegments || []).slice(0, 10).map((s: any) => `  ${s.tags}: ${s.count}`),
    ``,
    `--- eCommerce ---`,
    `הכנסות חנות: ₪${ecommerce?.totalRevenue?.toLocaleString() || 0} | ${ecommerce?.customerCount || 0} לקוחות`,
    ``,
    `--- לקוחות בסיכון (תשלום נכשל, לא חידשו) - ${atRiskCustomers?.length || 0} ---`,
    ...(atRiskCustomers || []).slice(0, 50).map((c: any) =>
      `  ${c.name} | ${c.phone || 'אין טלפון'} | ${c.plan || ''} | ₪${c.totalPaid || 0} | ביטול: ${c.cancelDate || ''} | סיבה: ${c.reason || ''}`
    ),
  ];

  return sections.join('\n');
};

const SYSTEM_PROMPT = `אתה אנליסט עסקי בכיר (Senior Business Analyst) של חברת MeWatch — שירות מנויי שעונים חכמים.

## התפקיד שלך:
- לנתח נתונים כספיים, מנויים, ביטולים, חידושים, ומגמות עסקיות
- לבצע חישובים מורכבים: השוואות תקופות, cross-reference בין קטגוריות, שיעורי שינוי
- לזהות תובנות, בעיות ולהמליץ על פעולות

## כללי תשובה:
1. תמיד ענה בעברית
2. תמיד צטט מספרים מדויקים מהנתונים — אל תמציא
3. כשנשאלת על תקופה ספציפית (למשל "מרץ 2025 עד פברואר 2026"), חשב מהנתונים החודשיים
4. כשנשאלת "כמה חידשו מאלו שבוטלו" — השתמש בנתוני Renewal/Recovery
5. תמיד כלול אחוזים ליד מספרים מוחלטים
6. כשיש מגמה — ציין אם עולה/יורדת ובכמה אחוז

## פורמט תשובה — JSON בלבד:
ענה בפורמט JSON (ללא markdown, ללא \`\`\`):

{
  "answer": "טקסט התשובה עם ניתוח מפורט",
  "metrics": [{"label": "שם המדד", "value": "ערך", "icon": "emoji", "color": "blue|green|red|purple|orange"}],
  "table": {"headers": ["עמודה1", "עמודה2"], "rows": [["שורה1", "ערך1"]]},
  "chart": {"type": "bar|horizontal-bar", "title": "כותרת", "data": [{"label": "קטגוריה", "value": 123, "color": "#hex"}]}
}

## מתי להשתמש בכל פורמט:
- **metrics**: סיכום מהיר — הכנסות, אחוזים, ספירות (2-6 כרטיסים)
- **table**: השוואות, רשימות, נתונים לפי חודש/תוכנית
- **chart**: מגמות, התפלגויות, השוואות ויזואליות
- שלב כמה פורמטים ביחד לתשובה עשירה

## דוגמאות לשאלות מורכבות שאתה חייב לדעת לענות:
- "כמה מנויים בוטלו בין מרץ 2025 לפברואר 2026 וכמה מאלו חידשו?" → סכום ביטולים חודשיים + נתוני renewal
- "מה המגמה של ההכנסות ב-6 חודשים אחרונים?" → טבלה + גרף
- "איזה מנוי הכי רווחי ואיזה הכי מבטל?" → cross-reference plans + cancellations
- "תן לי את ה-10 לקוחות עם הכי הרבה הכנסות שביטלו" → סינון at-risk + מיון

אם אין לך מספיק נתונים לשאלה — אמור "אין לי מספיק נתונים לענות על השאלה הזו" במקום להמציא.`;

const AIAnalyticsChat: React.FC<AIAnalyticsChatProps> = ({ onClose }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [dataStatus, setDataStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [analyticsData, setAnalyticsData] = useState<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Fetch analytics data on mount
  useEffect(() => {
    fetchAnalyticsData();
  }, []);

  const fetchAnalyticsData = useCallback(async () => {
    setDataStatus('loading');
    try {
      const data = await api.getAnalyticsSummary();
      setAnalyticsData(data);
      setDataStatus('ready');
    } catch (err) {
      console.error('Failed to fetch analytics:', err);
      setDataStatus('error');
    }
  }, []);

  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;

    const userMsg: Message = { id: Date.now().toString(), role: 'user', text: text.trim() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      // Auto-refresh data before each query for freshness
      let currentData = analyticsData;
      try {
        const freshData = await api.getAnalyticsSummary();
        setAnalyticsData(freshData);
        currentData = freshData;
      } catch { /* use cached data if refresh fails */ }

      const dataSummary = buildDataSummary(currentData);
      const prompt = `${dataSummary}\n\nהשאלה של המשתמש: "${text.trim()}"`;
      const response = await api.aiAnalytics(prompt, SYSTEM_PROMPT);

      // Parse JSON response
      let raw = (response.text || '{}');
      raw = raw.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '');
      raw = raw.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
      raw = raw.trim();

      let parsed: any;
      try {
        parsed = JSON.parse(raw);
      } catch {
        const jsonMatch = raw.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          try { parsed = JSON.parse(jsonMatch[0]); } catch { parsed = { answer: raw }; }
        } else {
          parsed = { answer: raw || 'לא הצלחתי לעבד את השאלה.' };
        }
      }

      const aiMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        text: parsed.answer || 'לא הצלחתי לעבד את השאלה.',
        table: parsed.table?.headers?.length ? parsed.table : undefined,
        metrics: parsed.metrics?.length ? parsed.metrics : undefined,
        chart: parsed.chart?.data?.length ? parsed.chart : undefined,
      };
      setMessages(prev => [...prev, aiMsg]);
    } catch (err: any) {
      console.error('AI Analytics error:', err);
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        text: `לא הצלחתי לעבד את השאלה. נסה שוב.\n(${err.message || 'שגיאת תקשורת'})`,
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-stretch justify-center">
      <div className="bg-white w-full h-full md:m-4 md:rounded-2xl md:max-w-5xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 border-b border-gray-100 bg-gradient-to-l from-blue-600 to-purple-700 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
              <BotIcon className="text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">אנליסט עסקי AI</h2>
              <p className="text-xs text-white/70">
                {dataStatus === 'loading' ? 'טוען נתונים...' :
                  dataStatus === 'ready' ? `${analyticsData?.overview?.totalLeads || 0} מנויים · נתונים בזמן אמת` :
                    dataStatus === 'error' ? 'שגיאה בטעינת נתונים' : 'מאתחל...'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={fetchAnalyticsData} className="p-2 hover:bg-white/20 rounded-full transition-colors" title="רענון נתונים">
              <RefreshIcon className={dataStatus === 'loading' ? 'animate-spin' : ''} />
            </button>
            <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-full transition-colors">
              <CloseIcon />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center px-4">
              <div className="w-20 h-20 bg-gradient-to-br from-blue-100 to-purple-100 rounded-3xl flex items-center justify-center mb-5">
                <BotIcon className="w-10 h-10 text-blue-600" />
              </div>
              <h3 className="text-xl font-black text-gray-800 mb-2">שאל אותי כל שאלה עסקית</h3>
              <p className="text-sm text-gray-400 mb-6 max-w-md">
                אני מנתח נתונים בזמן אמת מהשרת — הכנסות, מנויים, ביטולים, חידושים, מגמות ועוד.
                שאל שאלות פשוטות או מורכבות.
              </p>
              <div className="flex flex-wrap gap-2 justify-center max-w-2xl">
                {QUICK_QUESTIONS.map((q) => (
                  <button
                    key={q.text}
                    onClick={() => sendMessage(q.text)}
                    className="px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 transition-all shadow-sm flex items-center gap-1.5"
                  >
                    <span>{q.icon}</span>
                    <span>{q.text}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-start' : 'justify-end'}`}>
              <div className={`max-w-[90%] md:max-w-[80%] ${msg.role === 'user'
                ? 'bg-blue-600 text-white rounded-2xl rounded-br-md'
                : 'bg-gray-50 text-gray-800 rounded-2xl rounded-bl-md border border-gray-200'
                } p-4 shadow-sm`}>
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.text}</p>

                {/* Metrics cards */}
                {msg.metrics && msg.metrics.length > 0 && (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-3">
                    {msg.metrics.map((m, i) => {
                      const colorMap: Record<string, string> = {
                        blue: 'bg-blue-50 border-blue-200 text-blue-700',
                        green: 'bg-green-50 border-green-200 text-green-700',
                        red: 'bg-red-50 border-red-200 text-red-700',
                        purple: 'bg-purple-50 border-purple-200 text-purple-700',
                        orange: 'bg-orange-50 border-orange-200 text-orange-700',
                      };
                      const cls = colorMap[m.color || ''] || 'bg-white border-gray-200 text-blue-700';
                      return (
                        <div key={i} className={`rounded-xl p-3 text-center border ${cls}`}>
                          {m.icon && <div className="text-xl mb-1">{m.icon}</div>}
                          <div className="text-lg font-black">{m.value}</div>
                          <div className="text-[10px] font-medium opacity-70 mt-0.5">{m.label}</div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* CSS Bar Chart */}
                {msg.chart && msg.chart.data && msg.chart.data.length > 0 && (
                  <div className="mt-4 bg-white rounded-xl p-4 border border-gray-200">
                    {msg.chart.title && <div className="text-sm font-bold text-gray-700 mb-3">{msg.chart.title}</div>}
                    {msg.chart.type === 'horizontal-bar' ? (
                      <div className="space-y-2">
                        {msg.chart.data.map((item, i) => {
                          const maxVal = Math.max(...msg.chart!.data.map(d => d.value));
                          const pct = maxVal > 0 ? (item.value / maxVal) * 100 : 0;
                          return (
                            <div key={i}>
                              <div className="flex justify-between text-xs text-gray-600 mb-1">
                                <span>{item.label}</span>
                                <span className="font-bold">{item.value.toLocaleString()}</span>
                              </div>
                              <div className="h-6 bg-gray-100 rounded-full overflow-hidden">
                                <div
                                  className="h-full rounded-full transition-all duration-700"
                                  style={{
                                    width: `${Math.max(pct, 2)}%`,
                                    backgroundColor: item.color || CHART_COLORS[i % CHART_COLORS.length],
                                  }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="flex items-end gap-1 h-40">
                        {msg.chart.data.map((item, i) => {
                          const maxVal = Math.max(...msg.chart!.data.map(d => d.value));
                          const pct = maxVal > 0 ? (item.value / maxVal) * 100 : 0;
                          return (
                            <div key={i} className="flex-1 flex flex-col items-center gap-1">
                              <span className="text-[9px] font-bold text-gray-600">{item.value.toLocaleString()}</span>
                              <div className="w-full flex-1 flex items-end">
                                <div
                                  className="w-full rounded-t-md transition-all duration-700"
                                  style={{
                                    height: `${Math.max(pct, 3)}%`,
                                    backgroundColor: item.color || CHART_COLORS[i % CHART_COLORS.length],
                                  }}
                                />
                              </div>
                              <span className="text-[8px] text-gray-500 truncate w-full text-center">{item.label}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* Data table */}
                {msg.table && msg.table.headers && msg.table.rows && (
                  <div className="mt-3 overflow-x-auto bg-white rounded-xl border border-gray-200">
                    <table className="w-full text-xs border-collapse">
                      <thead>
                        <tr>
                          {msg.table.headers.map((h, i) => (
                            <th key={i} className="bg-gray-50 text-gray-700 font-bold px-3 py-2.5 text-right border-b border-gray-200 whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {msg.table.rows.map((row, ri) => (
                          <tr key={ri} className={ri % 2 === 0 ? '' : 'bg-gray-50/50'}>
                            {row.map((cell, ci) => (
                              <td key={ci} className="px-3 py-2 border-b border-gray-100 text-right whitespace-nowrap">{cell}</td>
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
              <div className="bg-gray-50 border border-gray-200 rounded-2xl rounded-bl-md p-4 shadow-sm">
                <div className="flex items-center gap-3 text-gray-500">
                  <LoadingDots />
                  <span className="text-xs">מרענן נתונים ומנתח...</span>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Quick questions after first message */}
        {messages.length > 0 && !isLoading && (
          <div className="px-4 pb-2 flex gap-2 overflow-x-auto shrink-0">
            {QUICK_QUESTIONS.slice(0, 4).map((q) => (
              <button
                key={q.text}
                onClick={() => sendMessage(q.text)}
                className="px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-full text-xs text-gray-500 hover:bg-blue-50 hover:text-blue-600 transition-all whitespace-nowrap shrink-0"
              >
                {q.icon} {q.text}
              </button>
            ))}
          </div>
        )}

        {/* Input */}
        <div className="p-4 border-t border-gray-100 bg-gray-50/50 shrink-0">
          <div className="flex gap-2 max-w-3xl mx-auto">
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
              className="px-5 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-blue-200"
            >
              <SendIcon />
            </button>
          </div>
          <p className="text-[10px] text-gray-300 mt-2 text-center">
            נתונים מעודכנים אוטומטית בכל שאילתה · Gemini 2.5 Flash
          </p>
        </div>
      </div>
    </div>
  );
};

const CloseIcon = () => <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>;
const BotIcon = ({ className }: { className?: string }) => <svg className={className || "w-5 h-5"} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>;
const SendIcon = () => <svg className="w-5 h-5 rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>;
const RefreshIcon = ({ className }: { className?: string }) => <svg className={`w-5 h-5 text-white ${className || ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>;
const LoadingDots = () => (
  <div className="flex gap-1">
    <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
    <span className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
    <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
  </div>
);

export default AIAnalyticsChat;
