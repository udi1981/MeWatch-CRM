
import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
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

/** Hook to detect mobile viewport */
const useIsMobile = (breakpoint = 768) => {
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < breakpoint);
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpoint - 1}px)`);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    setIsMobile(mq.matches);
    return () => mq.removeEventListener('change', handler);
  }, [breakpoint]);
  return isMobile;
};

const LeadTable: React.FC<LeadTableProps> = ({ leads, statuses, columns, allColumns, visibleColumns, matchingOrdersCount, onToggleColumn, onStatusChange, onLeadClick, onDeleteLead }) => {
  const isMobile = useIsMobile();
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' }>({ key: 'startDate', direction: 'desc' });
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [showColumnPicker, setShowColumnPicker] = useState(false);
  const [swipedRowId, setSwipedRowId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const getStatus = (id: string) => statuses.find(s => s.id === id) || statuses[0];

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
    setSortConfig({ key, direction });
  };

  const toggleExpand = (leadId: string) => {
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
      return new Date(year, month, day).getTime() || 0;
    }
    return new Date(str).getTime() || 0;
  };

  const hasRenewed = (lead: Lead): boolean | null => {
    const lastPayment = String(lead.dynamicData?.lastPaymentStatus || '').toLowerCase();
    const wixStatus = String(lead.dynamicData?.wixStatus || '');
    const hasActive = String(lead.dynamicData?.hasActiveSubscription || '');
    if (lastPayment !== 'failed' && lastPayment !== 'נכשל' && wixStatus !== 'CANCELED') return null;
    if (hasActive === 'כן' || wixStatus === 'ACTIVE') return true;
    return false;
  };

  const sortedLeads = useMemo(() => {
    return [...leads].sort((a, b) => {
      const key = sortConfig.key;
      let valA: any = '', valB: any = '';
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
        const tA = parseDate(valA), tB = parseDate(valB);
        return sortConfig.direction === 'asc' ? tA - tB : tB - tA;
      }
      if (typeof valA === 'number' && typeof valB === 'number') {
        return sortConfig.direction === 'asc' ? valA - valB : valB - valA;
      }
      const sA = String(valA).toLowerCase(), sB = String(valB).toLowerCase();
      if (sA < sB) return sortConfig.direction === 'asc' ? -1 : 1;
      if (sA > sB) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [leads, sortConfig, statuses, columns]);

  const getWixUrl = (phone: string) => {
    const base = "https://manage.wix.com/dashboard/8fc7cea3-f43b-40cc-82d3-6f4dcfacfb0d/contacts?referralInfo=sidebar&viewId=all-items-view&sort=lastActivity.activityDate+desc";
    return `${base}&searchTerm=${phone.replace(/\D/g, '')}`;
  };

  const getWhatsAppUrl = (phone: string) => {
    const clean = phone.replace(/\D/g, '');
    const intl = clean.startsWith('0') ? '972' + clean.slice(1) : clean;
    return `https://wa.me/${intl}`;
  };

  const copyToClipboard = (text: string, e: React.MouseEvent | React.TouchEvent) => {
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

  // ─── Swipe handlers for mobile ───
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const handleTouchStart = (e: React.TouchEvent, leadId: string) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };
  const handleTouchEnd = (e: React.TouchEvent, leadId: string) => {
    const dx = touchStartX.current - e.changedTouches[0].clientX;
    const dy = Math.abs(touchStartY.current - e.changedTouches[0].clientY);
    if (dy > 30) return; // vertical scroll, ignore
    if (dx > 60) {
      setSwipedRowId(leadId);
      setConfirmDeleteId(null);
    } else if (dx < -40) {
      setSwipedRowId(null);
    }
  };

  const SortIndicator = ({ columnId }: { columnId: string }) => {
    if (!sortConfig || sortConfig.key !== columnId) return <span className="text-gray-300 mr-0.5 opacity-50 text-[9px]">&#8645;</span>;
    return <span className="text-blue-600 mr-0.5 font-bold text-[10px]">{sortConfig.direction === 'asc' ? '\u2191' : '\u2193'}</span>;
  };

  // ═══════════════════════════════════════════
  //  MOBILE VIEW — Hybrid Card List
  // ═══════════════════════════════════════════
  if (isMobile) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {/* Header bar */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100 bg-gray-50/50">
          <span className="text-xs text-gray-500 font-medium">
            {leads.length} מנויים
            {matchingOrdersCount ? <span className="text-blue-600 font-bold mr-1"> ({matchingOrdersCount})</span> : null}
          </span>
          <div className="flex items-center gap-1.5">
            {/* Sort dropdown — all columns */}
            <select
              value={sortConfig.key}
              onChange={(e) => setSortConfig({ key: e.target.value, direction: sortConfig.direction })}
              className="text-[10px] text-gray-600 bg-gray-100 px-2 py-1 rounded-lg border-none outline-none max-w-[120px]"
            >
              <option value="name">שם</option>
              <option value="phone">טלפון</option>
              <option value="status">סטטוס</option>
              <option value="renewed">חידוש</option>
              {visibleColumns.map(colId => {
                const col = allColumns.find(c => c.id === colId);
                if (!col || ['name','phone','status','renewed'].includes(colId)) return null;
                return <option key={colId} value={colId}>{col.label}</option>;
              })}
            </select>
            <button
              onClick={() => setSortConfig(prev => ({ ...prev, direction: prev.direction === 'asc' ? 'desc' : 'asc' }))}
              className="text-[10px] text-gray-500 bg-gray-100 px-2 py-1 rounded-lg font-bold"
            >
              {sortConfig.direction === 'asc' ? '▲' : '▼'}
            </button>
          </div>
        </div>

        {/* Card list */}
        <div className="max-h-[calc(100vh-220px)] overflow-y-auto divide-y divide-gray-100">
          {sortedLeads.map(lead => {
            const status = getStatus(lead.statusId);
            const isExpanded = expandedRows.has(lead.id);
            const isSwiped = swipedRowId === lead.id;
            const renewed = hasRenewed(lead);
            const planName = lead.dynamicData?.planName || '';
            const planPrice = lead.dynamicData?.planPrice || '';
            const totalPaid = lead.dynamicData?.totalPaid || '';
            const lastPayment = lead.dynamicData?.lastPaymentStatus || '';
            const startDate = lead.dynamicData?.startDate || '';
            const cancelDate = lead.dynamicData?.cancellationDate || '';
            const cancelReason = lead.dynamicData?.cancellationReason || '';

            return (
              <div
                key={lead.id}
                className="relative overflow-hidden"
                onTouchStart={e => handleTouchStart(e, lead.id)}
                onTouchEnd={e => handleTouchEnd(e, lead.id)}
              >
                {/* Delete button behind card */}
                {isSwiped && (
                  <div className="absolute left-0 top-0 bottom-0 w-20 bg-red-500 flex items-center justify-center z-0">
                    {confirmDeleteId === lead.id ? (
                      <button
                        onClick={() => { onDeleteLead(lead.id); setSwipedRowId(null); setConfirmDeleteId(null); }}
                        className="text-white font-bold text-[11px] animate-pulse"
                      >
                        בטוח?
                      </button>
                    ) : (
                      <button
                        onClick={() => setConfirmDeleteId(lead.id)}
                        className="text-white font-bold text-xs flex flex-col items-center gap-0.5"
                      >
                        <TrashIcon />
                        <span className="text-[10px]">מחק</span>
                      </button>
                    )}
                  </div>
                )}

                {/* Card content */}
                <div
                  className={`relative z-10 bg-white transition-transform duration-200 ease-out ${isSwiped ? '-translate-x-20' : 'translate-x-0'}`}
                >
                  {/* ── Compact row (always visible) ── */}
                  <div
                    className={`flex items-center gap-1.5 px-3 py-2.5 cursor-pointer active:bg-gray-50 ${status.rowColor || ''}`}
                    onClick={() => isSwiped ? setSwipedRowId(null) : toggleExpand(lead.id)}
                  >
                    {/* Name */}
                    <span className="text-[13px] font-semibold text-gray-900 truncate min-w-0 flex-1">
                      {lead.name}
                    </span>

                    {/* Phone (compact) */}
                    <span className="text-[11px] text-gray-500 font-mono shrink-0" dir="ltr">
                      {lead.phone.replace(/^(\d{3})(\d{3})(\d{4})$/, '$1-$2-$3')}
                    </span>

                    {/* Call button */}
                    <a
                      href={`tel:${lead.phone}`}
                      onClick={e => e.stopPropagation()}
                      className="shrink-0 w-7 h-7 flex items-center justify-center rounded-full bg-blue-50 text-blue-600 active:bg-blue-100"
                    >
                      <PhoneIcon />
                    </a>

                    {/* Status badge */}
                    <span className={`shrink-0 text-[9px] font-bold text-white px-1.5 py-0.5 rounded-full ${status.color}`}>
                      {status.label.length > 6 ? status.label.slice(0, 6) + '..' : status.label}
                    </span>

                    {/* Renewed indicator */}
                    {renewed === true && (
                      <span className="shrink-0 text-[9px] text-green-700 bg-green-50 px-1 py-0.5 rounded-full font-bold">&#10003;</span>
                    )}
                    {renewed === false && (
                      <span className="shrink-0 text-[9px] text-red-600 bg-red-50 px-1 py-0.5 rounded-full font-bold">&#10007;</span>
                    )}

                    {/* Expand chevron */}
                    <span className={`shrink-0 text-[10px] text-gray-400 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}>
                      &#9654;
                    </span>
                  </div>

                  {/* ── Expanded details card ── */}
                  {isExpanded && (
                    <div className="px-4 pb-3 pt-1 bg-gray-50/60 border-t border-gray-100 animate-in slide-in-from-top-1 duration-150">
                      {/* Details grid */}
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[11px] mb-3">
                        {planName && (
                          <>
                            <span className="text-gray-400">תוכנית</span>
                            <span className="text-gray-800 font-medium">{planName}</span>
                          </>
                        )}
                        {planPrice && (
                          <>
                            <span className="text-gray-400">מחיר</span>
                            <span className="text-gray-800 font-medium">{String(planPrice).includes('\u20AA') ? planPrice : `\u20AA${planPrice}`}</span>
                          </>
                        )}
                        {totalPaid && (
                          <>
                            <span className="text-gray-400">סה"כ שילם</span>
                            <span className="text-gray-800 font-medium">{String(totalPaid).includes('\u20AA') ? totalPaid : `\u20AA${totalPaid}`}</span>
                          </>
                        )}
                        {lastPayment && (
                          <>
                            <span className="text-gray-400">תשלום אחרון</span>
                            <span className={`font-medium ${lastPayment === 'נכשל' || lastPayment.toLowerCase() === 'failed' ? 'text-red-600' : 'text-gray-800'}`}>
                              {lastPayment}
                            </span>
                          </>
                        )}
                        {startDate && (
                          <>
                            <span className="text-gray-400">התחלה</span>
                            <span className="text-gray-800">{startDate}</span>
                          </>
                        )}
                        {cancelDate && (
                          <>
                            <span className="text-gray-400">ביטול</span>
                            <span className="text-red-600">{cancelDate}</span>
                          </>
                        )}
                        {cancelReason && (
                          <>
                            <span className="text-gray-400">סיבה</span>
                            <span className="text-gray-700">{cancelReason}</span>
                          </>
                        )}
                        {lead.email && (
                          <>
                            <span className="text-gray-400">אימייל</span>
                            <span className="text-gray-700 truncate">{lead.email}</span>
                          </>
                        )}
                        {lead.notes.length > 0 && (
                          <>
                            <span className="text-gray-400">הערה</span>
                            <span className="text-gray-600 italic truncate">{lead.notes[0].text}</span>
                          </>
                        )}
                      </div>

                      {/* Action buttons */}
                      <div className="flex gap-2">
                        <a
                          href={`tel:${lead.phone}`}
                          className="flex-1 flex items-center justify-center gap-1 bg-blue-600 text-white text-[11px] font-bold py-2 rounded-xl active:bg-blue-700"
                        >
                          <PhoneIcon /> חייג
                        </a>
                        <a
                          href={getWhatsAppUrl(lead.phone)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-1 flex items-center justify-center gap-1 bg-green-500 text-white text-[11px] font-bold py-2 rounded-xl active:bg-green-600"
                        >
                          <WhatsAppIcon /> WhatsApp
                        </a>
                        {lead.email && (
                          <a
                            href={`mailto:${lead.email}`}
                            onClick={e => e.stopPropagation()}
                            className="flex-1 flex items-center justify-center gap-1 bg-purple-500 text-white text-[11px] font-bold py-2 rounded-xl active:bg-purple-600"
                          >
                            <EmailIcon /> אימייל
                          </a>
                        )}
                        <button
                          onClick={(e) => { e.stopPropagation(); onLeadClick(lead.id); }}
                          className="flex-1 flex items-center justify-center gap-1 bg-gray-200 text-gray-700 text-[11px] font-bold py-2 rounded-xl active:bg-gray-300"
                        >
                          <ExpandIcon /> פרטים
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {sortedLeads.length === 0 && (
            <div className="p-12 text-center text-gray-400">
              <EmptyStateIcon />
              <p className="mt-3 font-medium text-sm">לא נמצאו מנויים</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════
  //  DESKTOP VIEW — Compact Table
  // ═══════════════════════════════════════════
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      {/* Column Selector */}
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
                    <input type="checkbox" checked={visibleColumns.includes(col.id)} onChange={() => onToggleColumn(col.id)} className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                    <span className="text-xs text-gray-700">{col.label}</span>
                  </label>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      <div className="overflow-x-auto max-h-[calc(100vh-280px)] overflow-y-auto">
        <table className="w-full text-right border-collapse" style={{ tableLayout: 'auto' }}>
          <thead className="sticky top-0 z-20 shadow-sm">
            <tr className="bg-gray-50 border-b border-gray-200">
              <th onClick={() => handleSort('name')} className="px-1 py-1 text-[11px] font-bold text-gray-600 bg-gray-50 cursor-pointer hover:bg-gray-100 select-none whitespace-nowrap">
                <div className="flex items-center"><SortIndicator columnId="name" />שם</div>
              </th>
              <th onClick={() => handleSort('phone')} className="px-1 py-1 text-[11px] font-bold text-gray-600 bg-gray-50 cursor-pointer hover:bg-gray-100 select-none whitespace-nowrap">
                <div className="flex items-center"><SortIndicator columnId="phone" />טלפון</div>
              </th>
              <th className="px-0.5 py-1 text-[11px] font-bold text-gray-600 bg-gray-50 whitespace-nowrap">פעולות</th>
              <th onClick={() => handleSort('status')} className="px-1 py-1 text-[11px] font-bold text-gray-600 bg-gray-50 cursor-pointer hover:bg-gray-100 select-none whitespace-nowrap">
                <div className="flex items-center"><SortIndicator columnId="status" />סטטוס</div>
              </th>
              <th onClick={() => handleSort('renewed')} className="px-0.5 py-1 text-[11px] font-bold text-gray-600 bg-gray-50 cursor-pointer hover:bg-gray-100 select-none whitespace-nowrap" title="האם חידש מנוי?">
                <div className="flex items-center"><SortIndicator columnId="renewed" />חידוש</div>
              </th>
              {columns.map(col => (
                <th key={col.id} onClick={() => handleSort(col.id)} className="px-1 py-1 text-[11px] font-bold text-gray-600 bg-gray-50 cursor-pointer hover:bg-gray-100 select-none whitespace-nowrap">
                  <div className="flex items-center"><SortIndicator columnId={col.id} />{col.label}</div>
                </th>
              ))}
              <th className="px-1 py-1 text-[11px] font-bold text-gray-600 bg-gray-50 whitespace-nowrap">הערות</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {sortedLeads.map(lead => {
              const status = getStatus(lead.statusId);
              const orderCount = parseInt((lead.dynamicData?.totalOrders || '1').toString()) || 1;
              const isExpanded = expandedRows.has(lead.id);
              const renewed = hasRenewed(lead);
              let orderSummaries: any[] = [];
              if (isExpanded && lead.dynamicData?.allOrders) {
                try { orderSummaries = JSON.parse(lead.dynamicData.allOrders as string); } catch {}
              }

              return (
                <React.Fragment key={lead.id}>
                  <tr
                    className={`hover:brightness-95 transition-all cursor-pointer ${status.rowColor}`}
                    onClick={() => onLeadClick(lead.id)}
                  >
                    <td className="px-1 py-0.5 text-[12px] font-semibold text-gray-900 whitespace-nowrap max-w-[140px] truncate">
                      <div className="flex items-center gap-0.5">
                        {orderCount > 1 && (
                          <button onClick={(e) => { e.stopPropagation(); toggleExpand(lead.id); }} className="text-gray-400 hover:text-blue-600 text-[9px] shrink-0">
                            {isExpanded ? '\u25BC' : '\u25B6'}
                          </button>
                        )}
                        <span className="truncate">{lead.name}</span>
                      </div>
                    </td>
                    <td className="px-1 py-0.5 text-[11px] text-gray-700 font-mono whitespace-nowrap" dir="ltr">
                      <div className="flex items-center gap-0.5">
                        <a href={getWixUrl(lead.phone)} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="text-blue-600 hover:underline">{lead.phone}</a>
                        <button onClick={e => copyToClipboard(lead.phone, e)} className="p-0.5 hover:bg-gray-200 rounded text-gray-400" title="העתק"><CopyIcon /></button>
                      </div>
                    </td>
                    <td className="px-0.5 py-0.5" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center gap-0.5">
                        <a href={`tel:${lead.phone}`} className="inline-flex items-center gap-0.5 text-blue-600 hover:text-blue-800 text-[10px] border border-blue-200 rounded-md px-1 py-0.5 bg-blue-50/50" title="חייג">
                          <PhoneIcon />
                        </a>
                        <a href={getWhatsAppUrl(lead.phone)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center text-green-600 hover:text-green-800 text-[10px] border border-green-200 rounded-md px-1 py-0.5 bg-green-50/50" title="WhatsApp">
                          <WhatsAppIcon />
                        </a>
                        {lead.email && (
                          <a href={`mailto:${lead.email}`} className="inline-flex items-center text-purple-600 hover:text-purple-800 text-[10px] border border-purple-200 rounded-md px-1 py-0.5 bg-purple-50/50" title={lead.email}>
                            <EmailIcon />
                          </a>
                        )}
                      </div>
                    </td>
                    <td className="px-0.5 py-0.5" onClick={e => e.stopPropagation()}>
                      <select value={lead.statusId} onChange={e => onStatusChange(lead.id, e.target.value)} className={`text-[10px] font-bold text-white px-1.5 py-0.5 rounded-full cursor-pointer border-none appearance-none text-center shadow-sm ${status.color}`}>
                        {statuses.map(s => <option key={s.id} value={s.id} className="bg-white text-gray-900">{s.label}</option>)}
                      </select>
                    </td>
                    <td className="px-0.5 py-0.5 text-center whitespace-nowrap">
                      {renewed === true && <span className="text-[9px] text-green-700 bg-green-50 px-1 py-0.5 rounded-full font-bold">&#10003; חידש</span>}
                      {renewed === false && <span className="text-[9px] text-red-600 bg-red-50 px-1 py-0.5 rounded-full font-bold">&#10007; להתקשר</span>}
                    </td>
                    {columns.map(col => (
                      <td key={col.id} className="px-1 py-0.5 text-[11px] text-gray-700 whitespace-nowrap">
                        {col.id === 'totalOrders' && orderCount > 1 ? (
                          <span className="bg-blue-50 text-blue-700 px-1 py-0.5 rounded-full text-[10px] font-bold">{lead.dynamicData[col.id] || ''}</span>
                        ) : (lead.dynamicData[col.id] || '')}
                      </td>
                    ))}
                    <td className="px-1 py-0.5 text-[10px] text-gray-500 max-w-[120px] truncate italic">
                      {lead.notes.length > 0 ? lead.notes[0].text : ''}
                    </td>
                  </tr>

                  {/* Expanded sub-rows */}
                  {isExpanded && orderSummaries.length > 0 && orderSummaries.map((os, i) => (
                    <tr key={`${lead.id}-order-${i}`} className="bg-blue-50/40 border-r-4 border-r-blue-300">
                      <td className="px-1 py-0.5 text-[10px] text-blue-400 font-mono">{i + 1}/{orderSummaries.length}</td>
                      <td colSpan={4} className="px-1 py-0.5 text-[10px] text-gray-500 italic">
                        {os.status === 'ACTIVE' ? '\uD83D\uDFE2 פעיל' : os.status === 'CANCELED' ? '\uD83D\uDD34 בוטל' : `\u26AA ${os.status}`}
                        {os.plan ? ` \u2014 ${os.plan}` : ''}
                      </td>
                      {columns.map(col => (
                        <td key={col.id} className="px-1 py-0.5 text-[10px] text-gray-600 whitespace-nowrap">
                          {col.id === 'planName' ? os.plan :
                           col.id === 'wixStatus' ? wixStatusHebrew(os.status) :
                           col.id === 'planPrice' ? (os.price > 0 ? `\u20AA${os.price}` : '') :
                           col.id === 'totalPaid' ? (os.paid > 0 ? `\u20AA${os.paid.toFixed(0)}` : '') :
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

// ─── Icons ───

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
  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
    <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
  </svg>
);

const WhatsAppIcon = () => (
  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
  </svg>
);

const TrashIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
);

const ExpandIcon = () => (
  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
  </svg>
);

const EmailIcon = () => (
  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
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
