
import React, { useState, useMemo } from 'react';
import { Inquiry, Customer } from '../types';

interface InquiriesViewProps {
  inquiries: Inquiry[];
  customers: Customer[];
  onStatusChange: (id: string, status: Inquiry['status']) => void;
  onAddInquiry: () => void;
  onOpenCustomer?: (id: string) => void;
}

const STATUS_OPTIONS: { value: Inquiry['status']; label: string; color: string; bg: string }[] = [
  { value: 'new', label: 'חדש', color: 'text-blue-700', bg: 'bg-blue-100' },
  { value: 'handled', label: 'טופל', color: 'text-green-700', bg: 'bg-green-100' },
  { value: 'closed', label: 'סגור', color: 'text-gray-600', bg: 'bg-gray-100' },
];

const InquiriesView: React.FC<InquiriesViewProps> = ({ inquiries, customers, onStatusChange, onAddInquiry, onOpenCustomer }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | Inquiry['status']>('all');
  const [sourceFilter, setSourceFilter] = useState<'all' | 'wix_form' | 'manual'>('all');
  const [selectedInquiryId, setSelectedInquiryId] = useState<string | null>(null);

  const customerMap = useMemo(() => {
    const map = new Map<string, Customer>();
    for (const c of customers) map.set(c.id, c);
    return map;
  }, [customers]);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { all: inquiries.length };
    for (const s of STATUS_OPTIONS) {
      counts[s.value] = inquiries.filter(i => i.status === s.value).length;
    }
    return counts;
  }, [inquiries]);

  const filtered = useMemo(() => {
    let result = [...inquiries];
    if (statusFilter !== 'all') result = result.filter(i => i.status === statusFilter);
    if (sourceFilter !== 'all') result = result.filter(i => i.source === sourceFilter);
    const q = searchQuery.toLowerCase().trim();
    if (q) {
      result = result.filter(i =>
        i.name.toLowerCase().includes(q) ||
        i.phone.includes(q) ||
        (i.email && i.email.toLowerCase().includes(q)) ||
        i.subject.toLowerCase().includes(q) ||
        i.message.toLowerCase().includes(q)
      );
    }
    result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return result;
  }, [inquiries, statusFilter, sourceFilter, searchQuery]);

  const selectedInquiry = useMemo(() =>
    inquiries.find(i => i.id === selectedInquiryId),
    [inquiries, selectedInquiryId]
  );

  const selectedCustomer = useMemo(() =>
    selectedInquiry?.customerId ? customerMap.get(selectedInquiry.customerId) : undefined,
    [selectedInquiry, customerMap]
  );

  if (inquiries.length === 0) {
    return (
      <div className="space-y-6">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center">
          <div className="w-16 h-16 bg-green-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">אין פניות עדיין</h2>
          <p className="text-gray-500 max-w-md mx-auto">
            פניות מטפסי Wix ייטענו אוטומטית בסנכרון הבא.
            ניתן גם להוסיף פניות ידנית.
          </p>
          <div className="flex gap-3 justify-center mt-4">
            <button onClick={onAddInquiry} className="bg-green-600 text-white px-4 py-2.5 rounded-xl text-sm font-bold hover:bg-green-700 transition-colors flex items-center gap-2">
              <PlusIcon /> הוסף פנייה ידנית
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="סה״כ פניות" value={inquiries.length} color="blue" />
        <StatCard label="חדשות" value={statusCounts.new || 0} color="amber" />
        <StatCard label="טופלו" value={statusCounts.handled || 0} color="green" />
        <StatCard label="נסגרו" value={statusCounts.closed || 0} color="gray" />
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-3 items-start md:items-center">
        <div className="relative flex-1 w-full">
          <SearchIcon />
          <input
            type="text"
            placeholder="חיפוש לפי שם, טלפון, אימייל, נושא..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pr-10 pl-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-green-500 outline-none"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {[{ value: 'all', label: 'הכל' }, ...STATUS_OPTIONS.map(s => ({ value: s.value, label: s.label }))].map(opt => (
            <button key={opt.value} onClick={() => setStatusFilter(opt.value as any)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${statusFilter === opt.value ? 'bg-green-600 text-white border-green-600' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'}`}>
              {opt.label} ({statusCounts[opt.value] || 0})
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <button onClick={() => setSourceFilter(sourceFilter === 'wix_form' ? 'all' : 'wix_form')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${sourceFilter === 'wix_form' ? 'bg-purple-600 text-white border-purple-600' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'}`}>
            Wix
          </button>
          <button onClick={() => setSourceFilter(sourceFilter === 'manual' ? 'all' : 'manual')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${sourceFilter === 'manual' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'}`}>
            ידני
          </button>
        </div>
        <button onClick={onAddInquiry} className="bg-green-600 text-white px-4 py-2.5 rounded-xl text-xs font-bold hover:bg-green-700 transition-colors flex items-center gap-2 whitespace-nowrap">
          <PlusIcon /> פנייה חדשה
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-4 py-2.5 border-b border-gray-100">
          <span className="text-sm text-gray-500 font-medium">{filtered.length} פניות</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-gray-500 text-xs">
                <th className="px-3 py-2.5 text-right font-medium">#</th>
                <th className="px-3 py-2.5 text-right font-medium">תאריך</th>
                <th className="px-3 py-2.5 text-right font-medium">שם</th>
                <th className="px-3 py-2.5 text-right font-medium">טלפון</th>
                <th className="px-3 py-2.5 text-right font-medium">אימייל</th>
                <th className="px-3 py-2.5 text-right font-medium">נושא</th>
                <th className="px-3 py-2.5 text-right font-medium">הודעה</th>
                <th className="px-3 py-2.5 text-right font-medium">סטטוס</th>
                <th className="px-3 py-2.5 text-right font-medium">לקוח</th>
                <th className="px-3 py-2.5 text-right font-medium">מקור</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((inquiry, idx) => {
                const customer = inquiry.customerId ? customerMap.get(inquiry.customerId) : undefined;
                const hasSubscription = customer ? customer.subscriptionIds.length > 0 : false;
                const statusOpt = STATUS_OPTIONS.find(s => s.value === inquiry.status) || STATUS_OPTIONS[0];
                return (
                  <tr key={inquiry.id}
                    onClick={() => setSelectedInquiryId(inquiry.id)}
                    className={`border-t border-gray-50 hover:bg-green-50/50 cursor-pointer transition-colors ${selectedInquiryId === inquiry.id ? 'bg-green-50' : ''}`}>
                    <td className="px-3 py-2.5 text-gray-400">{idx + 1}</td>
                    <td className="px-3 py-2.5 text-gray-600 text-xs whitespace-nowrap">
                      {new Date(inquiry.createdAt).toLocaleDateString('he-IL')}
                    </td>
                    <td className="px-3 py-2.5 font-medium text-gray-800">{inquiry.name || '—'}</td>
                    <td className="px-3 py-2.5 text-gray-600 font-mono text-xs" dir="ltr">{inquiry.phone || '—'}</td>
                    <td className="px-3 py-2.5 text-gray-600 text-xs max-w-[150px] truncate">{inquiry.email || '—'}</td>
                    <td className="px-3 py-2.5 text-gray-700 text-xs max-w-[120px] truncate">{inquiry.subject || '—'}</td>
                    <td className="px-3 py-2.5 text-gray-500 text-xs max-w-[200px] truncate">{inquiry.message || '—'}</td>
                    <td className="px-3 py-2.5">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${statusOpt.bg} ${statusOpt.color}`}>
                        {statusOpt.label}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      {customer ? (
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-gray-700 font-medium truncate max-w-[80px]">{customer.name}</span>
                          {hasSubscription && (
                            <span className="bg-green-100 text-green-700 px-1 py-0.5 rounded text-[9px] font-bold">מנוי</span>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-300 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                        inquiry.source === 'wix_form' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                      }`}>
                        {inquiry.source === 'wix_form' ? 'Wix' : 'ידני'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <div className="p-8 text-center text-gray-400 text-sm">לא נמצאו פניות בסינון זה</div>
        )}
      </div>

      {/* Inquiry Detail Modal */}
      {selectedInquiry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setSelectedInquiryId(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] overflow-auto m-4" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
                  <InboxIcon />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-800">{selectedInquiry.name || 'פנייה'}</h2>
                  <p className="text-xs text-gray-500">{new Date(selectedInquiry.createdAt).toLocaleString('he-IL')}</p>
                </div>
              </div>
              <button onClick={() => setSelectedInquiryId(null)} className="p-2 hover:bg-gray-100 rounded-lg">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="p-6 space-y-4">
              {/* Contact info */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-50 rounded-xl p-3">
                  <div className="text-[10px] font-bold text-gray-400 mb-0.5">טלפון</div>
                  <div className="text-sm font-medium text-gray-800" dir="ltr">{selectedInquiry.phone || '—'}</div>
                </div>
                <div className="bg-gray-50 rounded-xl p-3">
                  <div className="text-[10px] font-bold text-gray-400 mb-0.5">אימייל</div>
                  <div className="text-sm font-medium text-gray-800 truncate">{selectedInquiry.email || '—'}</div>
                </div>
              </div>

              {selectedInquiry.subject && (
                <div>
                  <div className="text-xs font-bold text-gray-500 mb-1">נושא</div>
                  <div className="text-sm text-gray-800 font-medium">{selectedInquiry.subject}</div>
                </div>
              )}

              {selectedInquiry.message && (
                <div>
                  <div className="text-xs font-bold text-gray-500 mb-1">הודעה</div>
                  <div className="bg-gray-50 rounded-xl p-4 text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                    {selectedInquiry.message}
                  </div>
                </div>
              )}

              {selectedCustomer && (
                <div className="bg-blue-50 rounded-xl p-4">
                  <div className="text-xs font-bold text-blue-500 mb-2">לקוח מקושר</div>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-blue-800">{selectedCustomer.name}</div>
                      <div className="text-xs text-blue-600">
                        {selectedCustomer.subscriptionIds.length > 0 && (
                          <span className="bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-bold ml-2">מנוי קיים</span>
                        )}
                        {selectedCustomer.email || selectedCustomer.phone}
                      </div>
                    </div>
                    {onOpenCustomer && (
                      <button onClick={() => { setSelectedInquiryId(null); onOpenCustomer(selectedCustomer.id); }}
                        className="text-xs text-blue-600 hover:text-blue-700 font-bold">
                        צפה בלקוח →
                      </button>
                    )}
                  </div>
                </div>
              )}

              <div>
                <div className="text-xs font-bold text-gray-500 mb-2">שנה סטטוס</div>
                <div className="flex gap-2">
                  {STATUS_OPTIONS.map(opt => (
                    <button key={opt.value}
                      onClick={() => onStatusChange(selectedInquiry.id, opt.value)}
                      className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all ${
                        selectedInquiry.status === opt.value
                          ? `${opt.bg} ${opt.color} border-current shadow-sm`
                          : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
                      }`}>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2 text-xs text-gray-400">
                <span>מקור:</span>
                <span className={`px-1.5 py-0.5 rounded font-bold ${
                  selectedInquiry.source === 'wix_form' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                }`}>
                  {selectedInquiry.source === 'wix_form' ? 'טופס Wix' : 'הזנה ידנית'}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const StatCard = ({ label, value, color }: { label: string; value: number; color: string }) => {
  const colors: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-700',
    amber: 'bg-amber-50 text-amber-700',
    green: 'bg-green-50 text-green-700',
    gray: 'bg-gray-50 text-gray-600',
  };
  return (
    <div className={`${colors[color] || colors.blue} rounded-xl p-4 text-center`}>
      <div className="text-2xl font-black">{value}</div>
      <div className="text-xs font-bold opacity-70 mt-0.5">{label}</div>
    </div>
  );
};

const SearchIcon = () => (
  <svg className="w-4 h-4 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
  </svg>
);

const PlusIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
  </svg>
);

const InboxIcon = () => (
  <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
  </svg>
);

export default InquiriesView;
