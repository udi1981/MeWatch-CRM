
import React, { useState, useRef, useEffect } from 'react';
import api from '../lib/api';

export interface ViewCommand {
  columns: string[];        // column IDs to show (empty = keep current)
  statusFilter: string;     // 'all' | 'active' | 'canceled_customer' | etc.
  dateFrom: string;         // YYYY-MM-DD or ''
  dateTo: string;           // YYYY-MM-DD or ''
  searchQuery: string;      // text search or ''
  description: string;      // Hebrew description of the view
}

type GuidedStep = {
  id: string;
  type: 'column-picker';
  title: string;
  description?: string;
  preSelectedColumns?: string[];
};

type GuidedQuestion = {
  id: string;
  icon: string;
  label: string;
  description: string;
  steps: GuidedStep[];
  baseCommand: Omit<ViewCommand, 'columns'> & { columns?: string[] };
};

type GuidedFlowState = {
  questionId: string;
  currentStepIndex: number;
  selectedColumns: string[];
};

interface SmartViewBarProps {
  allColumnIds: string[];
  allColumnLabels: Record<string, string>;
  currentFilter: string;
  onApplyView: (cmd: ViewCommand) => void;
  onReset: () => void;
  activeView: ViewCommand | null;
  leadsCount: number;
  filteredCount: number;
  totalOrders: number;
}

const LOCKED_COLUMNS = ['name', 'phone']; // Always visible
const FIXED_COLUMN_LABELS = ['שם הלקוח', 'טלפון', 'שיחה', 'סטטוס', 'הערות', 'פעולות'];

const EXAMPLE_COMMANDS = [
  'הצג רק תשלום נכשל',
  'מנויים פעילים מהחודש האחרון',
  'בוטל ע"י הלקוח + סיבת ביטול בלבד',
  'הכל מינואר 2026',
  'רק מנויים עם מחיר מעל 25 ש"ח',
  'הצג סטטוס תשלום ותאריך התחלה בלבד',
];

const getDateDaysAgo = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().split('T')[0];
};

const GUIDED_QUESTIONS: GuidedQuestion[] = [
  {
    id: 'mobile-optimize',
    icon: '📱',
    label: 'התאמה למובייל',
    description: 'בחר אילו עמודות להציג במסך קטן',
    steps: [
      {
        id: 'pick-columns',
        type: 'column-picker',
        title: 'בחר עמודות למובייל',
        description: 'העמודות הקבועות (שם, טלפון, שיחה, סטטוס, הערות, פעולות) תמיד מוצגות',
        preSelectedColumns: ['planName', 'lastPaymentStatus', 'startDate'],
      },
    ],
    baseCommand: {
      statusFilter: 'all',
      dateFrom: '',
      dateTo: '',
      searchQuery: '',
      description: '📱 תצוגת מובייל מותאמת',
    },
  },
  {
    id: 'revenue-analysis',
    icon: '💰',
    label: 'ניתוח הכנסות',
    description: 'הצג עמודות פיננסיות בלבד',
    steps: [
      {
        id: 'pick-columns',
        type: 'column-picker',
        title: 'עמודות הכנסות',
        description: 'ניתן לשנות את הבחירה',
        preSelectedColumns: ['planName', 'planPrice', 'totalPaid', 'lastPaymentStatus', 'ecomTotalSpent', 'ecomOrderCount'],
      },
    ],
    baseCommand: {
      statusFilter: 'all',
      dateFrom: '',
      dateTo: '',
      searchQuery: '',
      description: '💰 ניתוח הכנסות — עמודות פיננסיות',
    },
  },
  {
    id: 'cancellations',
    icon: '❌',
    label: 'בוטלו',
    description: 'מנויים שבוטלו + סיבה ותאריך ביטול',
    steps: [],
    baseCommand: {
      columns: ['cancellationReason', 'cancellationDate', 'planName', 'startDate'],
      statusFilter: 'canceled_customer',
      dateFrom: '',
      dateTo: '',
      searchQuery: '',
      description: '❌ מנויים שבוטלו ע"י הלקוח',
    },
  },
  {
    id: 'new-subscribers',
    icon: '🆕',
    label: 'מנויים חדשים',
    description: 'מנויים פעילים מ-30 הימים האחרונים',
    steps: [],
    baseCommand: {
      columns: ['planName', 'planPrice', 'startDate', 'hasActiveSubscription'],
      statusFilter: 'active',
      get dateFrom() { return getDateDaysAgo(30); },
      get dateTo() { return new Date().toISOString().split('T')[0]; },
      searchQuery: '',
      description: '🆕 מנויים חדשים — 30 ימים אחרונים',
    },
  },
];

const SYSTEM_PROMPT = `אתה עוזר חכם של מערכת CRM. המשתמש מבקש ממך תצוגות שונות של טבלת לידים/מנויים.

העמודות הזמינות (IDs ושמות):
- planName: מנויים (שם התוכנית)
- wixStatus: סטטוס Wix
- hasActiveSubscription: מנוי פעיל?
- planPrice: מחיר מנוי
- totalPaid: סה"כ שולם
- lastPaymentStatus: סטטוס תשלום
- cancellationReason: סיבת ביטול
- cancellationDate: תאריך ביטול
- startDate: תאריך התחלה
- totalOrders: הזמנות
- ecomTotalSpent: רכישות חנות
- ecomOrderCount: הזמנות חנות

פילטרים לפי סטטוס:
- "all": הכל
- "active": מנוי פעיל
- "canceled_customer": בוטל ע"י הלקוח
- "canceled_company": בוטל ע"י החברה
- "payment_failed": תשלום נכשל
- "ended": הסתיים
- "no_phone": ללא טלפון

חוקים:
1. תמיד החזר JSON תקין בלבד
2. אם המשתמש מבקש עמודות ספציפיות, החזר רק אותן ב-columns (לפי ID)
3. אם לא מוזכרות עמודות ספציפיות, החזר מערך ריק (= שמור על הנוכחי)
4. אם יש תאריכים, פרמט: YYYY-MM-DD
5. "description" - תיאור קצר בעברית של מה שהמשתמש רואה
6. אם המשתמש אומר "הכל" או "ברירת מחדל" - החזר statusFilter: "all", columns: [], dateFrom: "", dateTo: ""
7. התאריך היום הוא ${new Date().toLocaleDateString('he-IL')}. השנה הנוכחית: ${new Date().getFullYear()}

מבנה JSON:
{
  "columns": [],
  "statusFilter": "all",
  "dateFrom": "",
  "dateTo": "",
  "searchQuery": "",
  "description": ""
}`;

const SmartViewBar: React.FC<SmartViewBarProps> = ({
  allColumnIds,
  allColumnLabels,
  currentFilter,
  onApplyView,
  onReset,
  activeView,
  leadsCount,
  filteredCount,
  totalOrders,
}) => {
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [lastMessages, setLastMessages] = useState<{ role: 'user' | 'assistant'; text: string }[]>([]);
  const [showExamples, setShowExamples] = useState(false);
  const [error, setError] = useState('');
  const [guidedFlow, setGuidedFlow] = useState<GuidedFlowState | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Clear guided flow when view is reset
  useEffect(() => {
    if (!activeView) setGuidedFlow(null);
  }, [activeView]);

  const handleSubmit = async (text?: string) => {
    const command = (text || input).trim();
    if (!command || isLoading) return;

    setInput('');
    setError('');
    setShowExamples(false);
    setGuidedFlow(null); // Cancel any active guided flow
    setIsLoading(true);
    setLastMessages(prev => [...prev.slice(-4), { role: 'user', text: command }]);

    // Check for "reset" commands first (no AI needed)
    const resetWords = ['ברירת מחדל', 'איפוס', 'הצג הכל', 'תחזיר הכל', 'רגיל', 'חזור', 'reset'];
    if (resetWords.some(w => command.includes(w))) {
      setIsLoading(false);
      onReset();
      setLastMessages(prev => [...prev, { role: 'assistant', text: '✅ חזרתי לתצוגת ברירת מחדל' }]);
      return;
    }

    try {
      const response = await api.aiSmartFilter(`${SYSTEM_PROMPT}\n\nהבקשה של המשתמש: "${command}"`, '');
      const raw = response.text || '';
      const parsed: ViewCommand = JSON.parse(raw);

      // Validate and apply
      const validCmd: ViewCommand = {
        columns: Array.isArray(parsed.columns) ? parsed.columns.filter(c => allColumnIds.includes(c)) : [],
        statusFilter: parsed.statusFilter || 'all',
        dateFrom: parsed.dateFrom || '',
        dateTo: parsed.dateTo || '',
        searchQuery: parsed.searchQuery || '',
        description: parsed.description || command,
      };

      onApplyView(validCmd);
      setLastMessages(prev => [...prev, { role: 'assistant', text: `✅ ${validCmd.description}` }]);
    } catch (err: any) {
      console.error('Smart view parse error:', err);
      setError('לא הצלחתי להבין את הבקשה. נסה לנסח אחרת.');
      setLastMessages(prev => [...prev, { role: 'assistant', text: '❌ לא הצלחתי להבין. נסה שוב.' }]);
    } finally {
      setIsLoading(false);
    }
  };

  // --- Guided Flow Handlers ---

  const handleStartGuidedFlow = (question: GuidedQuestion) => {
    setShowExamples(false);
    setError('');

    // If no interactive steps, apply immediately
    if (question.steps.length === 0) {
      const cmd: ViewCommand = {
        columns: question.baseCommand.columns || [],
        statusFilter: question.baseCommand.statusFilter,
        dateFrom: question.baseCommand.dateFrom,
        dateTo: question.baseCommand.dateTo,
        searchQuery: question.baseCommand.searchQuery,
        description: question.baseCommand.description,
      };
      onApplyView(cmd);
      setLastMessages(prev => [...prev.slice(-4),
        { role: 'user', text: `${question.icon} ${question.label}` },
        { role: 'assistant', text: `✅ ${cmd.description}` }
      ]);
      return;
    }

    // Start interactive flow
    const firstStep = question.steps[0];
    setGuidedFlow({
      questionId: question.id,
      currentStepIndex: 0,
      selectedColumns: firstStep.type === 'column-picker'
        ? (firstStep.preSelectedColumns || [])
        : [],
    });
  };

  const handleToggleGuidedColumn = (colId: string) => {
    setGuidedFlow(prev => {
      if (!prev) return prev;
      const cols = prev.selectedColumns.includes(colId)
        ? prev.selectedColumns.filter(c => c !== colId)
        : [...prev.selectedColumns, colId];
      return { ...prev, selectedColumns: cols };
    });
  };

  const handleSelectAll = () => {
    setGuidedFlow(prev => prev ? { ...prev, selectedColumns: [...allColumnIds] } : prev);
  };

  const handleClearAll = () => {
    setGuidedFlow(prev => prev ? { ...prev, selectedColumns: [] } : prev);
  };

  const handleResetToRecommended = () => {
    if (!guidedFlow) return;
    const question = GUIDED_QUESTIONS.find(q => q.id === guidedFlow.questionId);
    const step = question?.steps[guidedFlow.currentStepIndex];
    if (step?.type === 'column-picker' && step.preSelectedColumns) {
      setGuidedFlow(prev => prev ? { ...prev, selectedColumns: step.preSelectedColumns! } : prev);
    }
  };

  const handleConfirmGuidedFlow = () => {
    if (!guidedFlow) return;
    const question = GUIDED_QUESTIONS.find(q => q.id === guidedFlow.questionId);
    if (!question) return;

    const cmd: ViewCommand = {
      columns: guidedFlow.selectedColumns,
      statusFilter: question.baseCommand.statusFilter,
      dateFrom: question.baseCommand.dateFrom,
      dateTo: question.baseCommand.dateTo,
      searchQuery: question.baseCommand.searchQuery,
      description: question.baseCommand.description,
    };

    onApplyView(cmd);
    setLastMessages(prev => [...prev.slice(-4),
      { role: 'user', text: `${question.icon} ${question.label}` },
      { role: 'assistant', text: `✅ ${cmd.description} (${cmd.columns.length} עמודות)` }
    ]);
    setGuidedFlow(null);
  };

  const handleCancelGuidedFlow = () => {
    setGuidedFlow(null);
  };

  // --- Render ---

  const activeQuestion = guidedFlow ? GUIDED_QUESTIONS.find(q => q.id === guidedFlow.questionId) : null;
  const activeStep = activeQuestion?.steps[guidedFlow?.currentStepIndex ?? 0];

  return (
    <div className="mb-4">
      {/* Main Chat Bar */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        {/* Input Row */}
        <div className="flex items-center gap-2 px-3 md:px-4 py-2.5">
          {/* AI Icon */}
          <div className="shrink-0 w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center shadow-sm">
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
          </div>

          {/* Input */}
          <div className="flex-1 relative">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
              onFocus={() => !input && setShowExamples(true)}
              placeholder="מה תרצה לראות? למשל: ״רק תשלום נכשל מינואר 2026״"
              className="w-full py-2 px-3 bg-gray-50 rounded-xl text-sm text-gray-800 placeholder-gray-400 border border-gray-100 focus:border-blue-300 focus:ring-1 focus:ring-blue-200 outline-none transition-all"
              disabled={isLoading}
            />
          </div>

          {/* Send / Loading */}
          <button
            onClick={() => handleSubmit()}
            disabled={!input.trim() || isLoading}
            className={`shrink-0 w-8 h-8 rounded-xl flex items-center justify-center transition-all ${
              input.trim() && !isLoading
                ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm'
                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
            }`}
          >
            {isLoading ? (
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            ) : (
              <svg className="w-4 h-4 rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            )}
          </button>

          {/* Info / Stats badge */}
          <div className="hidden md:flex items-center gap-2 shrink-0 border-r border-gray-200 pr-3 mr-1">
            <span className="text-xs text-gray-400 font-medium">
              {filteredCount === leadsCount ? (
                <>{leadsCount.toLocaleString()} לקוחות</>
              ) : (
                <><span className="text-blue-600 font-bold">{filteredCount.toLocaleString()}</span> / {leadsCount.toLocaleString()}</>
              )}
            </span>
            {totalOrders > leadsCount && (
              <span className="text-[10px] text-gray-300">({totalOrders.toLocaleString()} הזמנות)</span>
            )}
          </div>

          {/* Reset button (only when active view) */}
          {activeView && (
            <button
              onClick={onReset}
              className="shrink-0 px-2.5 py-1.5 bg-red-50 text-red-600 hover:bg-red-100 text-xs font-bold rounded-lg transition-colors border border-red-100"
              title="חזור לתצוגת ברירת מחדל"
            >
              איפוס
            </button>
          )}
        </div>

        {/* Active View Indicator */}
        {activeView && (
          <div className="px-4 pb-2.5 pt-0">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1.5 bg-blue-50 text-blue-700 text-xs font-bold px-3 py-1.5 rounded-lg border border-blue-100">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
                {activeView.description}
              </div>
              {activeView.statusFilter !== 'all' && (
                <span className="text-[10px] bg-purple-50 text-purple-600 px-2 py-1 rounded-md border border-purple-100">
                  סינון: {activeView.statusFilter === 'active' ? 'פעיל' :
                          activeView.statusFilter === 'payment_failed' ? 'תשלום נכשל' :
                          activeView.statusFilter === 'canceled_customer' ? 'בוטל ע"י הלקוח' :
                          activeView.statusFilter === 'canceled_company' ? 'בוטל ע"י החברה' :
                          activeView.statusFilter}
                </span>
              )}
              {activeView.columns.length > 0 && (
                <span className="text-[10px] bg-green-50 text-green-600 px-2 py-1 rounded-md border border-green-100">
                  {activeView.columns.length} עמודות
                </span>
              )}
              {(activeView.dateFrom || activeView.dateTo) && (
                <span className="text-[10px] bg-orange-50 text-orange-600 px-2 py-1 rounded-md border border-orange-100">
                  📅 {activeView.dateFrom || '...'} → {activeView.dateTo || 'היום'}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Guided Flow: Column Picker Step */}
        {guidedFlow && activeStep?.type === 'column-picker' && (
          <div className="px-4 pb-3 pt-0">
            <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-xl border border-blue-200 p-4">
              {/* Step Header */}
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h4 className="text-sm font-bold text-gray-800">{activeStep.title}</h4>
                  {activeStep.description && (
                    <p className="text-[11px] text-gray-500 mt-0.5">{activeStep.description}</p>
                  )}
                </div>
                <button onClick={handleCancelGuidedFlow} className="text-gray-400 hover:text-gray-600 p-1">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Locked Columns (always visible) */}
              <div className="mb-2">
                <span className="text-[10px] text-gray-400 font-medium block mb-1">תמיד מוצגות:</span>
                <div className="flex flex-wrap gap-1.5">
                  {FIXED_COLUMN_LABELS.map(label => (
                    <span key={label} className="text-[11px] bg-gray-100 text-gray-400 px-2.5 py-1.5 rounded-lg border border-gray-200 cursor-not-allowed">
                      🔒 {label}
                    </span>
                  ))}
                </div>
              </div>

              {/* Toggleable Dynamic Columns */}
              <div className="mb-3">
                <span className="text-[10px] text-gray-500 font-medium block mb-1">בחר עמודות:</span>
                <div className="flex flex-wrap gap-1.5">
                  {allColumnIds.map(colId => {
                    const isSelected = guidedFlow.selectedColumns.includes(colId);
                    return (
                      <button
                        key={colId}
                        onClick={() => handleToggleGuidedColumn(colId)}
                        className={`text-[11px] px-2.5 py-1.5 rounded-lg border transition-all ${
                          isSelected
                            ? 'bg-blue-100 text-blue-700 border-blue-300 font-medium shadow-sm'
                            : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        {isSelected ? '✓ ' : ''}{allColumnLabels[colId] || colId}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Quick Select Helpers */}
              <div className="flex items-center gap-2 mb-3">
                <button onClick={handleSelectAll} className="text-[10px] text-blue-600 hover:underline">בחר הכל</button>
                <span className="text-gray-300">|</span>
                <button onClick={handleClearAll} className="text-[10px] text-red-500 hover:underline">נקה הכל</button>
                <span className="text-gray-300">|</span>
                <button onClick={handleResetToRecommended} className="text-[10px] text-purple-600 hover:underline">מומלצות</button>
              </div>

              {/* Confirm / Cancel Buttons */}
              <div className="flex items-center gap-2">
                <button
                  onClick={handleConfirmGuidedFlow}
                  disabled={guidedFlow.selectedColumns.length === 0}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold py-2 rounded-xl transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                  אישור ({guidedFlow.selectedColumns.length} עמודות)
                </button>
                <button
                  onClick={handleCancelGuidedFlow}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-600 text-xs font-bold rounded-xl transition-colors"
                >
                  ביטול
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Chat History (last 2 messages) */}
        {lastMessages.length > 0 && !showExamples && !guidedFlow && (
          <div className="px-4 pb-2.5 pt-0">
            <div className="flex items-center gap-2 overflow-x-auto">
              {lastMessages.slice(-2).map((msg, i) => (
                <div
                  key={i}
                  className={`text-xs px-2.5 py-1 rounded-lg shrink-0 max-w-[300px] truncate ${
                    msg.role === 'user'
                      ? 'bg-gray-100 text-gray-600'
                      : 'bg-blue-50 text-blue-700'
                  }`}
                >
                  {msg.role === 'user' ? '👤 ' : ''}{msg.text}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Guided Questions + Example Suggestions (when focused and empty) */}
        {showExamples && !input && !guidedFlow && (
          <div className="px-4 pb-3 pt-0">
            {/* Guided Questions */}
            <div className="flex items-center gap-1 mb-1.5">
              <svg className="w-3 h-3 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
              <span className="text-[10px] text-purple-400 font-medium">שאלות מנחות:</span>
            </div>
            <div className="flex flex-wrap gap-2 mb-3">
              {GUIDED_QUESTIONS.map(q => (
                <button
                  key={q.id}
                  onClick={() => handleStartGuidedFlow(q)}
                  className="flex items-center gap-1.5 text-xs bg-gradient-to-br from-blue-50 to-purple-50 hover:from-blue-100 hover:to-purple-100 text-gray-700 hover:text-blue-700 px-3 py-2 rounded-xl transition-all border border-blue-100 hover:border-blue-300 hover:shadow-sm"
                  title={q.description}
                >
                  <span>{q.icon}</span>
                  <span className="font-medium">{q.label}</span>
                </button>
              ))}
            </div>

            {/* Example Commands */}
            <div className="flex items-center gap-1 mb-1.5">
              <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <span className="text-[10px] text-gray-400 font-medium">דוגמאות:</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {EXAMPLE_COMMANDS.map((cmd, i) => (
                <button
                  key={i}
                  onClick={() => {
                    setInput(cmd);
                    setShowExamples(false);
                    inputRef.current?.focus();
                  }}
                  className="text-xs bg-gray-50 hover:bg-blue-50 text-gray-600 hover:text-blue-600 px-2.5 py-1.5 rounded-lg transition-colors border border-gray-100 hover:border-blue-200"
                >
                  {cmd}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="px-4 pb-2.5 pt-0">
            <span className="text-xs text-red-500">{error}</span>
          </div>
        )}
      </div>

      {/* Click away to close examples */}
      {showExamples && (
        <div className="fixed inset-0 z-[-1]" onClick={() => setShowExamples(false)} />
      )}
    </div>
  );
};

export default SmartViewBar;
