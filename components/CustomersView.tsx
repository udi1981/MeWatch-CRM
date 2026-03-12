
import React, { useState, useMemo } from 'react';
import { Customer, Lead, Inquiry } from '../types';
import api from '../lib/api';

interface CustomersViewProps {
  customers: Customer[];
  leads: Lead[];
  inquiries: Inquiry[];
  onOpenLead: (id: string) => void;
  onRefreshCustomers?: () => void;
}

const SEGMENTS = [
  { id: 'all', label: 'הכל', color: 'blue' },
  { id: 'paying', label: 'משלמים', color: 'green' },
  { id: 'subscriber', label: 'מנויים', color: 'indigo' },
  { id: 'cancelled', label: 'ביטלו שירות', color: 'red' },
  { id: 'payment_failed', label: 'תשלום נכשל', color: 'orange' },
  { id: 'ecom_buyer', label: 'קנו בחנות', color: 'purple' },
  { id: 'member', label: 'חברי אתר', color: 'teal' },
  { id: 'email_subscriber', label: 'רשימת תפוצה', color: 'pink' },
  { id: 'contact_only', label: 'אנשי קשר בלבד', color: 'gray' },
] as const;

const CustomersView: React.FC<CustomersViewProps> = ({ customers, leads, inquiries, onOpenLead, onRefreshCustomers }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSegment, setActiveSegment] = useState<string>('all');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState<'name' | 'totalSpent' | 'createdAt'>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  // Compute enriched customer data
  const enrichedCustomers = useMemo(() => {
    return customers.map(customer => {
      const linkedLeads = leads.filter(l => customer.subscriptionIds.includes(l.id));
      const activeSubscriptions = linkedLeads.filter(l => l.dynamicData?.hasActiveSubscription === 'כן').length;
      // Use cached totalSpent from sync if available, otherwise compute from leads
      let totalSpent = customer.totalSpent || 0;
      if (totalSpent === 0 && linkedLeads.length > 0) {
        const totalPaid = linkedLeads.reduce((sum, l) => {
          const val = (l.dynamicData?.totalPaid || '').toString().replace('₪', '').replace(/,/g, '');
          return sum + (parseFloat(val) || 0);
        }, 0);
        const ecomTotal = linkedLeads.reduce((sum, l) => {
          const val = (l.dynamicData?.ecomTotalSpent || '').toString().replace('₪', '').replace(/,/g, '');
          return sum + (parseFloat(val) || 0);
        }, 0);
        totalSpent = totalPaid + ecomTotal;
      }
      return {
        ...customer,
        subscriptionCount: customer.subscriptionIds.length,
        activeSubscriptions,
        totalSpent,
        linkedLeads,
      };
    });
  }, [customers, leads]);

  // Segment counts
  const segmentCounts = useMemo(() => {
    const counts: Record<string, number> = { all: customers.length };
    for (const seg of SEGMENTS) {
      if (seg.id !== 'all') {
        counts[seg.id] = customers.filter(c => (c.tags || []).includes(seg.id)).length;
      }
    }
    return counts;
  }, [customers]);

  const filtered = useMemo(() => {
    let result = enrichedCustomers;

    // Segment filter
    if (activeSegment !== 'all') {
      result = result.filter(c => (c.tags || []).includes(activeSegment));
    }

    // Search
    const q = searchQuery.toLowerCase().trim();
    if (q) {
      result = result.filter(c =>
        c.name.toLowerCase().includes(q) ||
        c.phone.includes(q) ||
        (c.email && c.email.toLowerCase().includes(q))
      );
    }

    // Sort
    result = [...result].sort((a, b) => {
      let cmp = 0;
      if (sortBy === 'name') cmp = a.name.localeCompare(b.name, 'he');
      else if (sortBy === 'totalSpent') cmp = (a.totalSpent || 0) - (b.totalSpent || 0);
      else if (sortBy === 'createdAt') cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      return sortDir === 'desc' ? -cmp : cmp;
    });

    return result;
  }, [enrichedCustomers, searchQuery, activeSegment, sortBy, sortDir]);

  const selectedCustomer = useMemo(() =>
    enrichedCustomers.find(c => c.id === selectedCustomerId),
    [enrichedCustomers, selectedCustomerId]
  );

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map(c => c.id)));
    }
  };

  const toggleSort = (col: 'name' | 'totalSpent' | 'createdAt') => {
    if (sortBy === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortBy(col); setSortDir('asc'); }
  };

  const handleExportCSV = () => {
    const rows = (selectedIds.size > 0 ? filtered.filter(c => selectedIds.has(c.id)) : filtered);
    const header = 'שם,טלפון,אימייל,תגיות,מנויים,פעילים,סה"כ שולם,מקור';
    const csv = [header, ...rows.map(c =>
      `"${c.name}","${c.phone}","${c.email || ''}","${(c.tags || []).join('; ')}",${c.subscriptionCount},${c.activeSubscriptions},₪${(c.totalSpent || 0).toFixed(0)},${c.source}`
    )].join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `customers_${activeSegment}_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (customers.length === 0) {
    return (
      <div className="space-y-6">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center">
          <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">אין לקוחות עדיין</h2>
          <p className="text-gray-500 max-w-md mx-auto">
            כל 6,000+ אנשי הקשר מ-Wix ייטענו אוטומטית בסנכרון הבא.
            כל איש קשר יקבל תגיות שיווקיות: משלם, ביטל, קנה בחנות ועוד.
          </p>
          <p className="text-sm text-gray-400 mt-3">לחץ על "סנכרון Wix" בתפריט הצד כדי להתחיל.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatCard label="סה״כ לקוחות" value={customers.length} color="blue" />
        <StatCard label="מנויים משלמים" value={segmentCounts.paying || 0} color="green" />
        <StatCard label="ביטלו שירות" value={segmentCounts.cancelled || 0} color="red" />
        <StatCard label="קונים בחנות" value={segmentCounts.ecom_buyer || 0} color="purple" />
        <StatCard label="אנשי קשר בלבד" value={segmentCounts.contact_only || 0} color="gray" />
      </div>

      {/* Marketing Segments - pill buttons */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-3">
        <div className="flex items-center gap-2 mb-2">
          <TagIcon />
          <span className="text-xs font-bold text-gray-500">חתך שיווקי:</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {SEGMENTS.map(seg => (
            <button
              key={seg.id}
              onClick={() => setActiveSegment(seg.id)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${
                activeSegment === seg.id
                  ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                  : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
              }`}
            >
              {seg.label}
              <span className={`mr-1 ${activeSegment === seg.id ? 'text-blue-200' : 'text-gray-400'}`}>
                ({segmentCounts[seg.id] || 0})
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Search + Actions */}
      <div className="flex flex-col md:flex-row gap-3 items-start md:items-center">
        <div className="relative flex-1 w-full">
          <SearchIcon />
          <input
            type="text"
            placeholder="חיפוש לפי שם, טלפון או אימייל..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pr-10 pl-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none"
          />
        </div>
        <button onClick={handleExportCSV} className="bg-blue-600 text-white px-4 py-2.5 rounded-xl text-xs font-bold hover:bg-blue-700 transition-colors flex items-center gap-2">
          <DownloadIcon /> ייצוא CSV ({selectedIds.size > 0 ? `${selectedIds.size} נבחרו` : `${filtered.length}`})
        </button>
      </div>

      {/* Mass actions bar */}
      {selectedIds.size > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-2.5 flex items-center gap-3 text-sm">
          <span className="font-bold text-blue-700">{selectedIds.size} לקוחות נבחרו</span>
          <button onClick={handleExportCSV} className="bg-white text-blue-700 border border-blue-300 px-3 py-1 rounded-lg hover:bg-blue-100 transition-colors font-medium text-xs">
            ייצוא CSV
          </button>
          <button onClick={() => setSelectedIds(new Set())} className="text-blue-500 hover:text-blue-700 text-xs font-medium mr-auto">
            ביטול בחירה
          </button>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-4 py-2.5 border-b border-gray-100 flex items-center justify-between">
          <span className="text-sm text-gray-500 font-medium">{filtered.length} לקוחות</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-gray-500 text-xs">
                <th className="px-3 py-2.5 text-right w-10">
                  <input type="checkbox" checked={selectedIds.size === filtered.length && filtered.length > 0} onChange={toggleAll} className="rounded" />
                </th>
                <th className="px-3 py-2.5 text-right font-medium">#</th>
                <th className="px-3 py-2.5 text-right font-medium cursor-pointer hover:text-gray-700" onClick={() => toggleSort('name')}>
                  שם {sortBy === 'name' && (sortDir === 'asc' ? '↑' : '↓')}
                </th>
                <th className="px-3 py-2.5 text-right font-medium">טלפון</th>
                <th className="px-3 py-2.5 text-right font-medium">אימייל</th>
                <th className="px-3 py-2.5 text-right font-medium text-center">דיוור</th>
                <th className="px-3 py-2.5 text-right font-medium">תגיות</th>
                <th className="px-3 py-2.5 text-right font-medium">מנויים</th>
                <th className="px-3 py-2.5 text-right font-medium cursor-pointer hover:text-gray-700" onClick={() => toggleSort('totalSpent')}>
                  סה״כ שולם {sortBy === 'totalSpent' && (sortDir === 'asc' ? '↑' : '↓')}
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((customer, idx) => (
                <tr key={customer.id}
                  onClick={() => setSelectedCustomerId(customer.id)}
                  className={`border-t border-gray-50 hover:bg-blue-50/50 cursor-pointer transition-colors ${selectedCustomerId === customer.id ? 'bg-blue-50' : ''}`}>
                  <td className="px-3 py-2.5" onClick={e => { e.stopPropagation(); toggleSelect(customer.id); }}>
                    <input type="checkbox" checked={selectedIds.has(customer.id)} onChange={() => toggleSelect(customer.id)} className="rounded" />
                  </td>
                  <td className="px-3 py-2.5 text-gray-400">{idx + 1}</td>
                  <td className="px-3 py-2.5 font-medium text-gray-800">{customer.name}</td>
                  <td className="px-3 py-2.5 text-gray-600 font-mono text-xs" dir="ltr">{customer.phone || '—'}</td>
                  <td className="px-3 py-2.5 text-gray-600 text-xs max-w-[180px] truncate">{customer.email || '—'}</td>
                  <td className="px-3 py-2.5 text-center">
                    {customer.email ? (
                      customer.emailUnsubscribed ? (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-600">הוסר</span>
                      ) : (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-green-100 text-green-600">פעיל</span>
                      )
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex flex-wrap gap-1">
                      {(customer.tags || []).slice(0, 3).map(tag => (
                        <span key={tag} className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${tagStyle(tag)}`}>
                          {tagLabel(tag)}
                        </span>
                      ))}
                      {(customer.tags || []).length > 3 && (
                        <span className="text-[10px] text-gray-400">+{(customer.tags || []).length - 3}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    {customer.subscriptionCount > 0 ? (
                      <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${customer.activeSubscriptions > 0 ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                        {customer.subscriptionCount}
                      </span>
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 font-bold text-gray-800">
                    {(customer.totalSpent || 0) > 0 ? `₪${(customer.totalSpent || 0).toLocaleString('he-IL', { maximumFractionDigits: 0 })}` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <div className="p-8 text-center text-gray-400 text-sm">לא נמצאו לקוחות בחתך זה</div>
        )}
      </div>

      {/* Customer Detail Panel */}
      {selectedCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setSelectedCustomerId(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] overflow-auto m-4" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-gray-800">{selectedCustomer.name}</h2>
                <p className="text-sm text-gray-500">{selectedCustomer.email || 'ללא אימייל'} · {selectedCustomer.phone || 'ללא טלפון'}</p>
              </div>
              <button onClick={() => setSelectedCustomerId(null)} className="p-2 hover:bg-gray-100 rounded-lg">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="p-6 space-y-4">
              {/* Tags */}
              <div className="flex flex-wrap gap-1.5">
                {(selectedCustomer.tags || []).map(tag => (
                  <span key={tag} className={`px-2 py-1 rounded-lg text-xs font-bold ${tagStyle(tag)}`}>
                    {tagLabel(tag)}
                  </span>
                ))}
                {(selectedCustomer.tags || []).length === 0 && (
                  <span className="text-xs text-gray-400">ללא תגיות</span>
                )}
              </div>

              {/* Email Subscription Toggle */}
              {selectedCustomer.email && (
                <div className="flex items-center justify-between bg-gray-50 rounded-xl p-3">
                  <div>
                    <div className="text-sm font-medium text-gray-700">קבלת דיוור במייל</div>
                    <div className="text-xs text-gray-400">
                      {selectedCustomer.emailUnsubscribed
                        ? `הוסר${selectedCustomer.unsubscribedAt ? ' ב-' + new Date(selectedCustomer.unsubscribedAt).toLocaleDateString('he-IL') : ''}${selectedCustomer.unsubscribeSource === 'link' ? ' (לחץ על הסרה)' : selectedCustomer.unsubscribeSource === 'manual' ? ' (ידני)' : ''}`
                        : 'מקבל/ת הודעות שיווקיות'}
                    </div>
                  </div>
                  <button
                    onClick={async () => {
                      const newVal = !selectedCustomer.emailUnsubscribed;
                      await api.toggleEmailSubscription(selectedCustomer.id, newVal);
                      onRefreshCustomers?.();
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      selectedCustomer.emailUnsubscribed
                        ? 'bg-green-100 text-green-700 hover:bg-green-200'
                        : 'bg-red-100 text-red-700 hover:bg-red-200'
                    }`}
                  >
                    {selectedCustomer.emailUnsubscribed ? 'הפעל מחדש' : 'הסר מדיוור'}
                  </button>
                </div>
              )}

              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="bg-blue-50 rounded-xl p-3">
                  <div className="text-2xl font-black text-blue-700">{selectedCustomer.subscriptionCount}</div>
                  <div className="text-[10px] font-bold text-blue-500 mt-0.5">מנויים</div>
                </div>
                <div className="bg-green-50 rounded-xl p-3">
                  <div className="text-2xl font-black text-green-700">{selectedCustomer.activeSubscriptions}</div>
                  <div className="text-[10px] font-bold text-green-500 mt-0.5">פעילים</div>
                </div>
                <div className="bg-amber-50 rounded-xl p-3">
                  <div className="text-xl font-black text-amber-700">₪{(selectedCustomer.totalSpent || 0).toLocaleString('he-IL', { maximumFractionDigits: 0 })}</div>
                  <div className="text-[10px] font-bold text-amber-500 mt-0.5">סה״כ שולם</div>
                </div>
              </div>

              {selectedCustomer.linkedLeads.length > 0 && (
                <div>
                  <h3 className="text-sm font-bold text-gray-700 mb-2">מנויים מקושרים</h3>
                  <div className="space-y-2">
                    {selectedCustomer.linkedLeads.map(lead => (
                      <div key={lead.id}
                        onClick={() => { setSelectedCustomerId(null); onOpenLead(lead.id); }}
                        className="bg-gray-50 rounded-xl p-3 flex items-center justify-between cursor-pointer hover:bg-gray-100 transition-colors">
                        <div>
                          <div className="font-medium text-sm text-gray-800">{lead.dynamicData?.planName || 'מנוי'}</div>
                          <div className="text-xs text-gray-500">
                            {lead.dynamicData?.hasActiveSubscription === 'כן'
                              ? <span className="text-green-600 font-bold">פעיל</span>
                              : <span className="text-red-500">{lead.dynamicData?.cancellationReason || 'לא פעיל'}</span>
                            }
                            {lead.dynamicData?.planPrice && ` · ${lead.dynamicData.planPrice}`}
                          </div>
                        </div>
                        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Customer Inquiries */}
              {(() => {
                const custInquiries = inquiries.filter(inq =>
                  inq.customerId === selectedCustomer.id ||
                  (inq.email && selectedCustomer.email && inq.email.toLowerCase() === selectedCustomer.email.toLowerCase()) ||
                  (inq.phone && selectedCustomer.phone && inq.phone.replace(/[^0-9]/g, '') === selectedCustomer.phone.replace(/[^0-9]/g, ''))
                );
                return custInquiries.length > 0 ? (
                  <div>
                    <h3 className="text-sm font-bold text-gray-700 mb-2">📩 פניות ({custInquiries.length})</h3>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {custInquiries.map(inq => (
                        <div key={inq.id} className="bg-purple-50 rounded-xl p-3">
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-medium text-sm text-purple-800">{inq.subject || 'פנייה'}</span>
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${inq.status === 'new' ? 'bg-blue-100 text-blue-600' : inq.status === 'handled' ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-600'}`}>
                              {inq.status === 'new' ? 'חדש' : inq.status === 'handled' ? 'טופל' : 'סגור'}
                            </span>
                          </div>
                          {inq.message && <p className="text-xs text-gray-600 line-clamp-2">{inq.message}</p>}
                          <p className="text-[10px] text-gray-400 mt-1">{new Date(inq.createdAt).toLocaleDateString('he-IL')}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null;
              })()}

              {selectedCustomer.subscriptionCount === 0 && (
                <div className="text-center py-4">
                  <p className="text-sm text-gray-400">איש קשר ללא מנויים</p>
                  <p className="text-xs text-gray-300 mt-1">ניתן לשלוח אימייל או SMS שיווקי</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Tag label mapping
const tagLabel = (tag: string): string => {
  const labels: Record<string, string> = {
    subscriber: 'מנוי',
    paying: 'משלם',
    cancelled: 'ביטל',
    payment_failed: 'תשלום נכשל',
    ecom_buyer: 'קנה בחנות',
    member: 'חבר אתר',
    email_subscriber: 'תפוצה',
    sms_subscriber: 'SMS',
    contact_only: 'איש קשר',
  };
  return labels[tag] || tag;
};

// Tag style mapping
const tagStyle = (tag: string): string => {
  const styles: Record<string, string> = {
    subscriber: 'bg-indigo-100 text-indigo-700',
    paying: 'bg-green-100 text-green-700',
    cancelled: 'bg-red-100 text-red-700',
    payment_failed: 'bg-orange-100 text-orange-700',
    ecom_buyer: 'bg-purple-100 text-purple-700',
    member: 'bg-teal-100 text-teal-700',
    email_subscriber: 'bg-pink-100 text-pink-700',
    sms_subscriber: 'bg-yellow-100 text-yellow-800',
    contact_only: 'bg-gray-100 text-gray-600',
  };
  return styles[tag] || 'bg-gray-100 text-gray-600';
};

// Stat card component
const StatCard = ({ label, value, color }: { label: string; value: number; color: string }) => {
  const colors: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-700',
    green: 'bg-green-50 text-green-700',
    red: 'bg-red-50 text-red-600',
    purple: 'bg-purple-50 text-purple-700',
    gray: 'bg-gray-50 text-gray-600',
  };
  return (
    <div className={`${colors[color] || colors.blue} rounded-xl p-4 text-center`}>
      <div className="text-2xl font-black">{value.toLocaleString('he-IL')}</div>
      <div className="text-xs font-bold opacity-70 mt-0.5">{label}</div>
    </div>
  );
};

// Icons
const SearchIcon = () => (
  <svg className="w-4 h-4 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
  </svg>
);

const DownloadIcon = () => (
  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
  </svg>
);

const TagIcon = () => (
  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
  </svg>
);

export default CustomersView;
