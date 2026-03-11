
import React, { useState, useMemo, useRef, useCallback } from 'react';
import { Lead, StatusConfig, Column } from '../types';

interface LeadTableProps {
  leads: Lead[];
  statuses: StatusConfig[];
  columns: Column[];
  allColumns: Column[];
  visibleColumns: string[];
  matchingOrdersCount?: number;
  onToggleColumn: (colId: string) => void;
  onStatusChange: (leadId: string, statusId: string) => void;
  onLeadClick: (leadId: string) => void;
  onDeleteLead: (leadId: string) => void;
}

// Swipe-to-delete hook
function useSwipeToDelete(onDelete: () => void) {
  const ref = useRef<HTMLTableRowElement>(null);
  const startX = useRef(0);
  const currentX = useRef(0);
  const swiping = useRef(false);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX;
    currentX.current = startX.current;
    swiping.current = true;
  }, []);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (!swiping.current || !ref.current) return;
    currentX.current = e.touches[0].clientX;
    const diff = startX.current - currentX.current; // positive = swipe left
    if (diff > 0) {
      ref.current.style.transform = `translateX(-${Math.min(diff, 100)}px)`;
      ref.current.style.transition = 'none';
    }
  }, []);

  const onTouchEnd = useCallback(() => {
    if (!swiping.current || !ref.current) return;
    swiping.current = false;
    const diff = startX.current - currentX.current;
    if (diff > 80) {
      ref.current.style.transform = 'translateX(-100px)';
      ref.current.style.transition = 'transform 0.2s';
      // Show delete state
    } else {
      ref.current.style.transform = 'translateX(0)';
      ref.current.style.transition = 'transform 0.2s';
    }
  }, []);

  return { ref, onTouchStart, onTouchMove, onTouchEnd };
}

const LeadTable: React.FC<LeadTableProps> = ({ leads, statuses, columns, allColumns, visibleColumns, matchingOrdersCount, onToggleColumn, onStatusChange, onLeadClick, onDeleteLead }) => {
  // Default sort: newest first by startDate
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' }>({ key: 'startDate', direction: 'desc' });
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [showColumnPicker, setShowColumnPicker] = useState(false);
  const [swipedRowId, setSwipedRowId] = useState<string | null>(null);

  const getStatus = (id: string) => statuses.find(s => s.id === id) || statuses[0];

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const toggleExpand = (leadId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(leadId)) next.delete(leadId);
      else next.add(leadId);
      return next;
    });
  };

  const parseDate = (dateStr: any): number => {
    if (!dateStr) return 0;
    const str = String(dateStr).trim();
    const parts = str.split(/[./-]/);
    if (parts.length === 3) {
      const day = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      let year = parseInt(parts[2], 10);
      if (year < 100) year += 2000;
      const d = new Date(year, month, day);
      return d.getTime() || 0;
    }
    const d = new Date(str);
    return d.getTime() || 0;
  };

  // Check if lead renewed after failed payment
  const hasRenewed = (lead: Lead): boolean | null => {
    const lastPayment = String(lead.dynamicData?.lastPaymentStatus || '').toLowerCase();
    const wixStatus = String(lead.dynamicData?.wixStatus || '');
    const hasActive = String(lead.dynamicData?.hasActiveSubscription || '');

    // Only relevant for leads that had payment issues
    if (lastPayment !== 'failed' && lastPayment !== 'נכשל' && wixStatus !== 'CANCELED') return null;

    // Renewed if has active subscription despite past failure/cancellation
    if (hasActive === 'כן' || wixStatus === 'ACTIVE') return true;
    return false;
  };

  const sortedLeads = useMemo(() => {
    const sorted = [...leads].sort((a, b) => {
      const key = sortConfig.key;
      let valA: any = '';
      let valB: any = '';
      if (key === 'name') { valA = a.name; valB = b.name; }
      else if (key === 'phone') { valA = a.phone; valB = b.phone; }
      else if (key === 'status') { valA = getStatus(a.statusId).label; valB = getStatus(b.statusId).label; }
      else if (key === 'renewed') {
        valA = hasRenewed(a) === true ? 1 : hasRenewed(a) === false ? 0 : -1;
        valB = hasRenewed(b) === true ? 1 : hasRenewed(b) === false ? 0 : -1;
      }
      else { valA = a.dynamicData[key] || ''; valB = b.dynamicData[key] || ''; }

      const isDate = key.toLowerCase().includes('date') || key === 'startDate' || columns.find(c => c.id === key)?.type === 'date';
      if (isDate) {
        const timeA = parseDate(valA);
        const timeB = parseDate(valB);
        if (timeA === timeB) return 0;
        return sortConfig.direction === 'asc' ? timeA - timeB : timeB - timeA;
      }
      if (typeof valA === 'number' && typeof valB === 'number') {
        return sortConfig.direction === 'asc' ? valA - valB : valB - valA;
      }
      const strA = String(valA).toLowerCase();
      const strB = String(valB).toLowerCase();
      if (strA < strB) return sortConfig.direction === 'asc' ? -1 : 1;
      if (strA > strB) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
    return sorted;
  }, [leads, sortConfig, statuses, columns]);

  const getWixUrl = (phone: string) => {
    const baseUrl = "https://manage.wix.com/dashboard/8fc7cea3-f43b-40cc-82d3-6f4dcfacfb0d/contacts?referralInfo=sidebar&viewId=all-items-view&sort=lastActivity.activityDate+desc&selectedColumns=avatar%2Cname%2Cemail%2Cphone%2CmemberStatus%2ClastActivity.activityDate%2Caddress%2Clabels+false%2Csource+false%2Cassignee+false%2Cbirthdate+false%2Clanguage+false%2CcreatedDate+false%2Ccompany+false%2Cposition+false";
    const cleanedPhone = phone.replace(/\D/g, '');
    return `${baseUrl}&searchTerm=${cleanedPhone}`;
  };

  const copyToClipboard = (text: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text);
  };

  const wixStatusHebrew = (status: string) => {
    switch (status) {
      case 'ACTIVE': return 'פעיל';
      case 'CANCELED': return 'בוטל';
      case 'ENDED': return 'הסתיים';
      case 'PAUSED': return 'מושהה';
      default: return status;
    }
  };

  const SortIndicator = ({ columnId }: { columnId: string }) => {
    if (!sortConfig || sortConfig.key !== columnId) return <span className="text-gray-300 mr-0.5 opacity-50 text-[9px]">⇅</span>;
    return <span className="text-blue-600 mr-0.5 font-bold text-[10px]">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>;
  };

  // Swipe handlers for mobile
  const touchStartX = useRef(0);
  const handleTouchStart = (e: React.TouchEvent, leadId: string) => {
    touchStartX.current = e.touches[0].clientX;
  };
  const handleTouchEnd = (e: React.TouchEvent, leadId: string) => {
    const diff = touchStartX.current - e.changedTouches[0].clientX;
    if (diff > 80) {
      setSwipedRowId(leadId);
    } else if (diff < -40) {
      setSwipedRowId(null);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      {/* Column Selector Button */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-gray-100 bg-gray-50/50">
        <span className="text-xs text-gray-500">
          {leads.length} תוצאות
          {matchingOrdersCount ? <span className="text-blue-600 font-bold mr-1"> ({matchingOrdersCount} מנויים)</span> : null}
        </span>
        <div className="relative">
          <button
            onClick={() => setShowColumnPicker(!showColumnPicker)}
            className="flex items-center gap-1 text-xs text-gray-600 hover:text-blue-600 transition-colors px-2 py-1 rounded-md hover:bg-gray-100"
          >
            <ColumnsIcon /> עמודות ({visibleColumns.length}/{allColumns.length})
          </button>
          {showColumnPicker && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setShowColumnPicker(false)} />
              <div className="absolute left-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-xl z-40 w-56 py-2 max-h-80 overflow-y-auto">
                <div className="px-3 py-2 border-b border-gray-100 flex justify-between items-center">
                  <span className="text-xs font-bold text-gray-700">בחר עמודות</span>
                  <div className="flex gap-1">
                    <button onClick={() => { allColumns.forEach(c => { if (!visibleColumns.includes(c.id)) onToggleColumn(c.id); }); }} className="text-[10px] text-blue-600 hover:underline">הכל</button>
                    <span className="text-gray-300">|</span>
                    <button onClick={() => { allColumns.forEach(c => { if (visibleColumns.includes(c.id)) onToggleColumn(c.id); }); }} className="text-[10px] text-red-500 hover:underline">נקה</button>
                  </div>
                </div>
                {allColumns.map(col => (
                  <label key={col.id} className="flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={visibleColumns.includes(col.id)}
                      onChange={() => onToggleColumn(col.id)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-xs text-gray-700">{col.label}</span>
                  </label>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      <div className="overflow-x-auto max-h-[calc(100vh-280px)] overflow-y-auto">
        <table className="w-full text-right border-collapse sticky-header" style={{ tableLayout: 'auto' }}>
          <thead className="sticky top-0 z-20 shadow-sm">
            <tr className="bg-gray-50 border-b border-gray-200">
              {/* Expand arrow */}
              <th className="px-1 py-2.5 text-xs font-bold text-gray-500 w-6 text-center bg-gray-50"></th>
              {/* # */}
              <th className="px-1 py-2.5 text-xs font-bold text-gray-500 w-8 text-center bg-gray-50">#</th>
              {/* === FIXED COLUMNS: Name, Phone, Call, Status, Renewed === */}
              <th
                onClick={() => handleSort('name')}
                className="px-2 py-2.5 text-xs font-bold text-gray-600 bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors select-none whitespace-nowrap"
              >
                <div className="flex items-center">
                  <SortIndicator columnId="name" />
                  שם
                </div>
              </th>
              <th
                onClick={() => handleSort('phone')}
                className="px-2 py-2.5 text-xs font-bold text-gray-600 bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors select-none whitespace-nowrap"
              >
                <div className="flex items-center">
                  <SortIndicator columnId="phone" />
                  טלפון
                </div>
              </th>
              <th className="px-1 py-2.5 text-xs font-bold text-gray-600 bg-gray-50 whitespace-nowrap">חייג</th>
              <th
                onClick={() => handleSort('status')}
                className="px-2 py-2.5 text-xs font-bold text-gray-600 bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors select-none whitespace-nowrap"
              >
                <div className="flex items-center">
                  <SortIndicator columnId="status" />
                  סטטוס
                </div>
              </th>
              <th
                onClick={() => handleSort('renewed')}
                className="px-1 py-2.5 text-xs font-bold text-gray-600 bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors select-none whitespace-nowrap"
                title="האם חידש מנוי?"
              >
                <div className="flex items-center">
                  <SortIndicator columnId="renewed" />
                  חידוש
                </div>
              </th>
              {/* === DYNAMIC COLUMNS === */}
              {columns.map(col => (
                <th
                  key={col.id}
                  onClick={() => handleSort(col.id)}
                  className="px-2 py-2.5 text-xs font-bold text-gray-600 bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors select-none whitespace-nowrap"
                >
                  <div className="flex items-center">
                    <SortIndicator columnId={col.id} />
                    {col.label}
                  </div>
                </th>
              ))}
              <th className="px-2 py-2.5 text-xs font-bold text-gray-600 bg-gray-50 whitespace-nowrap">הערות</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {sortedLeads.map((lead, index) => {
              const status = getStatus(lead.statusId);
              const orderCount = parseInt((lead.dynamicData?.totalOrders || '1').toString()) || 1;
              const isExpanded = expandedRows.has(lead.id);
              const isSwiped = swipedRowId === lead.id;
              const renewed = hasRenewed(lead);
              let orderSummaries: any[] = [];
              if (isExpanded && lead.dynamicData?.allOrders) {
                try { orderSummaries = JSON.parse(lead.dynamicData.allOrders as string); } catch {}
              }

              return (
                <React.Fragment key={lead.id}>
                  <tr
                    className={`hover:brightness-95 transition-all cursor-pointer relative ${status.rowColor}`}
                    onClick={() => isSwiped ? setSwipedRowId(null) : onLeadClick(lead.id)}
                    onTouchStart={(e) => handleTouchStart(e, lead.id)}
                    onTouchEnd={(e) => handleTouchEnd(e, lead.id)}
                    style={{
                      transform: isSwiped ? 'translateX(-80px)' : 'translateX(0)',
                      transition: 'transform 0.2s ease'
                    }}
                  >
                    {/* Expand arrow */}
                    <td className="px-1 py-2 text-center" onClick={(e) => orderCount > 1 ? toggleExpand(lead.id, e) : e.stopPropagation()}>
                      {orderCount > 1 ? (
                        <button className="text-gray-400 hover:text-blue-600 transition-colors text-[11px]">
                          {isExpanded ? '▼' : '▶'}
                        </button>
                      ) : <span className="text-gray-200 text-[10px]">—</span>}
                    </td>
                    {/* Row # */}
                    <td className="px-1 py-2 text-[10px] text-gray-400 text-center font-mono">{index + 1}</td>
                    {/* Name */}
                    <td className="px-2 py-2 text-sm font-semibold text-gray-900 whitespace-nowrap max-w-[140px] truncate">
                      {lead.name}
                    </td>
                    {/* Phone */}
                    <td className="px-2 py-2 text-xs text-gray-700 font-mono whitespace-nowrap" dir="ltr">
                      <div className="flex items-center gap-1">
                        <a
                          href={getWixUrl(lead.phone)}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="text-blue-600 hover:underline"
                        >
                          {lead.phone}
                        </a>
                        <button
                          onClick={(e) => copyToClipboard(lead.phone, e)}
                          className="p-0.5 hover:bg-gray-200 rounded text-gray-400 transition-colors"
                          title="העתק"
                        >
                          <CopyIcon />
                        </button>
                      </div>
                    </td>
                    {/* Call button */}
                    <td className="px-1 py-2" onClick={(e) => e.stopPropagation()}>
                      <a
                        href={`tel:${lead.phone}`}
                        className="inline-flex items-center gap-0.5 text-blue-600 hover:text-blue-800 font-medium text-[10px] border border-blue-200 rounded-lg px-1.5 py-0.5 bg-blue-50/50 transition-colors"
                      >
                        <PhoneIcon /> חייג
                      </a>
                    </td>
                    {/* Status */}
                    <td className="px-1 py-2" onClick={(e) => e.stopPropagation()}>
                      <select
                        value={lead.statusId}
                        onChange={(e) => onStatusChange(lead.id, e.target.value)}
                        className={`text-[10px] font-bold text-white px-1.5 py-0.5 rounded-full cursor-pointer border-none appearance-none text-center shadow-sm ${status.color}`}
                      >
                        {statuses.map(s => (
                          <option key={s.id} value={s.id} className="bg-white text-gray-900">{s.label}</option>
                        ))}
                      </select>
                    </td>
                    {/* Renewed indicator */}
                    <td className="px-1 py-2 text-center whitespace-nowrap">
                      {renewed === true && (
                        <span className="inline-flex items-center text-[10px] text-green-700 bg-green-50 px-1.5 py-0.5 rounded-full font-bold" title="חידש מנוי">
                          ✓ חידש
                        </span>
                      )}
                      {renewed === false && (
                        <span className="inline-flex items-center text-[10px] text-red-600 bg-red-50 px-1.5 py-0.5 rounded-full font-bold" title="לא חידש - צריך להתקשר">
                          ✗ להתקשר
                        </span>
                      )}
                    </td>
                    {/* Dynamic columns */}
                    {columns.map(col => (
                      <td key={col.id} className="px-2 py-2 text-xs text-gray-700 whitespace-nowrap">
                        {col.id === 'totalOrders' && orderCount > 1 ? (
                          <span className="inline-flex items-center gap-0.5 bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded-full text-[10px] font-bold">
                            {lead.dynamicData[col.id] || ''}
                          </span>
                        ) : (lead.dynamicData[col.id] || '')}
                      </td>
                    ))}
                    {/* Notes */}
                    <td className="px-2 py-2 text-[10px] text-gray-500 max-w-[150px] truncate italic">
                      {lead.notes.length > 0 ? lead.notes[0].text : ''}
                    </td>
                  </tr>

                  {/* Swipe delete overlay */}
                  {isSwiped && (
                    <tr className="absolute left-0 top-0 bottom-0" style={{ position: 'relative' }}>
                      <td colSpan={999} className="p-0" style={{ position: 'relative' }}>
                        <button
                          onClick={(e) => { e.stopPropagation(); onDeleteLead(lead.id); setSwipedRowId(null); }}
                          className="absolute left-0 top-0 bottom-0 w-[80px] bg-red-500 text-white font-bold text-xs flex items-center justify-center"
                          style={{ height: '100%' }}
                        >
                          🗑 מחק
                        </button>
                      </td>
                    </tr>
                  )}

                  {/* Expanded sub-rows for multiple orders */}
                  {isExpanded && orderSummaries.length > 0 && orderSummaries.map((os, i) => (
                    <tr key={`${lead.id}-order-${i}`} className="bg-blue-50/40 border-r-4 border-r-blue-300">
                      <td className="px-1 py-1.5"></td>
                      <td className="px-1 py-1.5 text-[10px] text-blue-400 text-center font-mono">{i + 1}/{orderSummaries.length}</td>
                      <td colSpan={5} className="px-2 py-1.5 text-[10px] text-gray-500 italic">
                        {os.status === 'ACTIVE' ? '🟢 פעיל' : os.status === 'CANCELED' ? '🔴 בוטל' : `⚪ ${os.status}`}
                        {os.plan ? ` — ${os.plan}` : ''}
                      </td>
                      {columns.map(col => (
                        <td key={col.id} className="px-2 py-1.5 text-[10px] text-gray-600 whitespace-nowrap">
                          {col.id === 'planName' ? os.plan :
                           col.id === 'wixStatus' ? wixStatusHebrew(os.status) :
                           col.id === 'planPrice' ? (os.price > 0 ? `₪${os.price}` : '') :
                           col.id === 'totalPaid' ? (os.paid > 0 ? `₪${os.paid.toFixed(0)}` : '') :
                           col.id === 'lastPaymentStatus' ? (os.payment === 'PAID' ? 'שולם' : os.payment === 'NOT_PAID' ? 'לא שולם' : os.payment === 'FAILED' ? 'נכשל' : os.payment || '') :
                           col.id === 'cancellationReason' ? (os.cancelReason || '') :
                           col.id === 'startDate' ? (os.start ? new Date(os.start).toLocaleDateString('he-IL') : '') :
                           col.id === 'hasActiveSubscription' ? (os.status === 'ACTIVE' ? 'כן' : 'לא') :
                           col.id === 'totalOrders' ? `${os.cycles} מחזורים` :
                           ''}
                        </td>
                      ))}
                      <td></td>
                    </tr>
                  ))}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      {sortedLeads.length === 0 && (
        <div className="p-12 text-center text-gray-500">
           <EmptyStateIcon />
           <p className="mt-4 font-medium">לא נמצאו מנויים במערכת</p>
        </div>
      )}
    </div>
  );
};

const ColumnsIcon = () => (
  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
  </svg>
);

const CopyIcon = () => (
  <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
  </svg>
);

const PhoneIcon = () => (
  <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20">
    <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
  </svg>
);

const EmptyStateIcon = () => (
  <div className="flex justify-center">
    <svg className="w-16 h-16 text-gray-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  </div>
);

export default LeadTable;
