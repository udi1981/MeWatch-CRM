
import React, { useState, useMemo } from 'react';
import { Lead, StatusConfig, Column } from '../types';

interface LeadTableProps {
  leads: Lead[];
  statuses: StatusConfig[];
  columns: Column[];
  onStatusChange: (leadId: string, statusId: string) => void;
  onLeadClick: (leadId: string) => void;
  onDeleteLead: (leadId: string) => void;
}

const LeadTable: React.FC<LeadTableProps> = ({ leads, statuses, columns, onStatusChange, onLeadClick, onDeleteLead }) => {
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);

  const getStatus = (id: string) => statuses.find(s => s.id === id) || statuses[0];

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const parseDate = (dateStr: any): number => {
    if (!dateStr) return 0;
    const str = String(dateStr).trim();
    
    // Handle DD.MM.YYYY or DD/MM/YYYY or DD-MM-YYYY format
    const parts = str.split(/[./-]/);
    if (parts.length === 3) {
      const day = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      let year = parseInt(parts[2], 10);
      
      // Handle 2-digit years (e.g., 25 -> 2025)
      if (year < 100) {
        year += 2000;
      }
      
      const d = new Date(year, month, day);
      return d.getTime() || 0;
    }
    
    // Fallback for standard ISO formats
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

      // Check if it's a date column
      const isDate = key.toLowerCase().includes('date') || columns.find(c => c.id === key)?.type === 'date';
      
      if (isDate) {
        const timeA = parseDate(valA);
        const timeB = parseDate(valB);
        if (timeA === timeB) return 0;
        return sortConfig.direction === 'asc' ? timeA - timeB : timeB - timeA;
      }

      // Standard string comparison
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

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="overflow-x-auto max-h-[calc(100vh-250px)] overflow-y-auto">
        <table className="w-full text-right border-collapse sticky-header">
          <thead className="sticky top-0 z-20 shadow-sm">
            <tr className="bg-gray-50 border-b border-gray-200">
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
              return (
                <tr 
                  key={lead.id} 
                  className={`hover:brightness-95 transition-all cursor-pointer ${status.rowColor}`}
                  onClick={() => onLeadClick(lead.id)}
                >
                  <td className="px-4 py-3 text-xs text-gray-400 text-center font-mono">{index + 1}</td>
                  {columns.map(col => (
                    <td key={col.id} className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">
                      {lead.dynamicData[col.id] || ''}
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
              );
            })}
          </tbody>
        </table>
      </div>
      {sortedLeads.length === 0 && (
        <div className="p-12 text-center text-gray-500">
           <EmptyStateIcon />
           <p className="mt-4 font-medium">לא נמצאו לידים במערכת</p>
        </div>
      )}
    </div>
  );
};

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
