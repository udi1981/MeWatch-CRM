
import React, { useState, useMemo } from 'react';
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

const LeadTable: React.FC<LeadTableProps> = ({ leads, statuses, columns, allColumns, visibleColumns, matchingOrdersCount, onToggleColumn, onStatusChange, onLeadClick, onDeleteLead }) => {
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [showColumnPicker, setShowColumnPicker] = useState(false);

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

  const sortedLeads = useMemo(() => {
    if (!sortConfig) return leads;
    const sorted = [...leads].sort((a, b) => {
      const key = sortConfig.key;
      let valA: any = '';
      let valB: any = '';
      if (key === 'name') { valA = a.name; valB = b.name; }
      else if (key === 'phone') { valA = a.phone; valB = b.phone; }
      else if (key === 'status') { valA = getStatus(a.statusId).label; valB = getStatus(b.statusId).label; }
      else { valA = a.dynamicData[key] || ''; valB = b.dynamicData[key] || ''; }
      const isDate = key.toLowerCase().includes('date') || columns.find(c => c.id === key)?.type === 'date';
      if (isDate) {
        const timeA = parseDate(valA);
        const timeB = parseDate(valB);
        if (timeA === timeB) return 0;
        return sortConfig.direction === 'asc' ? timeA - timeB : timeB - timeA;
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

  const SortIndicator = ({ columnId }: { columnId: string }) => {
    if (!sortConfig || sortConfig.key !== columnId) return <span className="text-gray-300 mr-1 opacity-50 text-[10px]">⇅</span>;
    return <span className="text-blue-600 mr-1 font-bold">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>;
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

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      {/* Column Selector Button */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100 bg-gray-50/50">
        <span className="text-xs text-gray-500">
          {leads.length} תוצאות
          {matchingOrdersCount ? <span className="text-blue-600 font-bold mr-1"> ({matchingOrdersCount} מנויים)</span> : null}
        </span>
        <div className="relative">
          <button
            onClick={() => setShowColumnPicker(!showColumnPicker)}
            className="flex items-center gap-1.5 text-xs text-gray-600 hover:text-blue-600 transition-colors px-2 py-1 rounded-md hover:bg-gray-100"
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

      <div className="overflow-x-auto max-h-[calc(100vh-300px)] overflow-y-auto">
        <table className="w-full text-right border-collapse sticky-header">
          <thead className="sticky top-0 z-20 shadow-sm">
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="px-2 py-4 text-xs font-bold text-gray-500 w-8 text-center bg-gray-50"></th>
              <th className="px-4 py-4 text-xs font-bold text-gray-500 w-12 text-center bg-gray-50">#</th>
              {columns.map(col => (
                <th
                  key={col.id}
                  onClick={() => handleSort(col.id)}
                  className="px-4 py-4 text-xs font-bold text-gray-600 min-w-[120px] bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors select-none"
                >
                  <div className="flex items-center">
                    <SortIndicator columnId={col.id} />
                    {col.label}
                  </div>
                </th>
              ))}
              <th
                onClick={() => handleSort('name')}
                className="px-4 py-4 text-xs font-bold text-gray-600 min-w-[150px] bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors select-none"
              >
                <div className="flex items-center">
                  <SortIndicator columnId="name" />
                  שם הלקוח
                </div>
              </th>
              <th
                onClick={() => handleSort('phone')}
                className="px-4 py-4 text-xs font-bold text-gray-600 bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors select-none"
              >
                <div className="flex items-center">
                  <SortIndicator columnId="phone" />
                  טלפון
                </div>
              </th>
              <th className="px-4 py-4 text-xs font-bold text-gray-600 bg-gray-50">שיחה</th>
              <th
                onClick={() => handleSort('status')}
                className="px-4 py-4 text-xs font-bold text-gray-600 min-w-[130px] bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors select-none"
              >
                <div className="flex items-center">
                  <SortIndicator columnId="status" />
                  סטטוס
                </div>
              </th>
              <th className="px-4 py-4 text-xs font-bold text-gray-600 bg-gray-50">הערות אחרונות</th>
              <th className="px-4 py-4 text-xs font-bold text-gray-600 text-center bg-gray-50">פעולות</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {sortedLeads.map((lead, index) => {
              const status = getStatus(lead.statusId);
              const orderCount = parseInt((lead.dynamicData?.totalOrders || '1').toString()) || 1;
              const isExpanded = expandedRows.has(lead.id);
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
                    {/* Expand arrow */}
                    <td className="px-2 py-3 text-center" onClick={(e) => orderCount > 1 ? toggleExpand(lead.id, e) : e.stopPropagation()}>
                      {orderCount > 1 ? (
                        <button className="text-gray-400 hover:text-blue-600 transition-colors text-sm">
                          {isExpanded ? '▼' : '▶'}
                        </button>
                      ) : <span className="text-gray-200 text-xs">—</span>}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400 text-center font-mono">{index + 1}</td>
                    {columns.map(col => (
                      <td key={col.id} className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">
                        {col.id === 'totalOrders' && orderCount > 1 ? (
                          <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full text-xs font-bold">
                            {lead.dynamicData[col.id] || ''}
                          </span>
                        ) : (lead.dynamicData[col.id] || '')}
                      </td>
                    ))}
                    <td className="px-4 py-3 text-sm font-semibold text-gray-900">{lead.name}</td>
                    <td className="px-4 py-3 text-sm text-gray-700 font-mono" dir="ltr">
                      <div className="flex items-center gap-2">
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
                          className="p-1 hover:bg-gray-200 rounded-md text-gray-400 transition-colors"
                          title="העתק מספר"
                        >
                          <CopyIcon />
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <a
                        href={`tel:${lead.phone}`}
                        className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 font-medium text-xs border border-blue-200 rounded-lg px-2 py-1 bg-blue-50/50 transition-colors"
                      >
                        <PhoneIcon /> חייג
                      </a>
                    </td>
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <div className="relative inline-block w-full">
                        <select
                          value={lead.statusId}
                          onChange={(e) => onStatusChange(lead.id, e.target.value)}
                          className={`w-full text-[11px] font-bold text-white px-2 py-1 rounded-full cursor-pointer border-none appearance-none text-center shadow-sm ${status.color}`}
                        >
                          {statuses.map(s => (
                            <option key={s.id} value={s.id} className="bg-white text-gray-900">{s.label}</option>
                          ))}
                        </select>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 max-w-[200px] truncate italic">
                      {lead.notes.length > 0 ? lead.notes[0].text : ''}
                    </td>
                    <td className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                      <div className="flex justify-center">
                         <button
                          onClick={() => onDeleteLead(lead.id)}
                          className="p-1 text-gray-300 hover:text-red-500 rounded transition-colors"
                          title="מחיקה"
                        >
                           <TrashIcon />
                         </button>
                      </div>
                    </td>
                  </tr>

                  {/* Expanded sub-rows for multiple orders */}
                  {isExpanded && orderSummaries.length > 0 && orderSummaries.map((os, i) => (
                    <tr key={`${lead.id}-order-${i}`} className="bg-blue-50/40 border-r-4 border-r-blue-300">
                      <td className="px-2 py-2"></td>
                      <td className="px-4 py-2 text-xs text-blue-400 text-center font-mono">{i + 1}/{orderSummaries.length}</td>
                      {columns.map(col => (
                        <td key={col.id} className="px-4 py-2 text-xs text-gray-600 whitespace-nowrap">
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
                      <td colSpan={5} className="px-4 py-2 text-xs text-gray-400 italic">
                        {os.status === 'ACTIVE' ? '🟢 פעיל' : os.status === 'CANCELED' ? '🔴 בוטל' : `⚪ ${os.status}`}
                      </td>
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
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
  </svg>
);

const CopyIcon = () => (
  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
  </svg>
);

const PhoneIcon = () => (
  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
    <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
  </svg>
);

const TrashIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
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
