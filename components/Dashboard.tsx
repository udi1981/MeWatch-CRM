
import React from 'react';
import { Lead, StatusConfig } from '../types';

interface DashboardProps {
  leads: Lead[];
  statuses: StatusConfig[];
}

const Dashboard: React.FC<DashboardProps> = ({ leads, statuses }) => {
  const stats = [
    { label: 'סה"כ לידים', value: leads.length, icon: <UsersIcon />, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'לידים חדשים', value: leads.filter(l => l.statusId === 'new').length, icon: <PlusIcon />, color: 'text-green-600', bg: 'bg-green-50' },
    { label: 'ממתינים לחזרה', value: leads.filter(l => l.statusId === 'callback').length, icon: <ClockIcon />, color: 'text-orange-600', bg: 'bg-orange-50' },
    { label: 'ביטולים', value: leads.filter(l => l.statusId === 'cancelled').length, icon: <XIcon />, color: 'text-red-600', bg: 'bg-red-50' },
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, i) => (
          <div key={i} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4 transition-transform hover:scale-[1.02]">
            <div className={`w-14 h-14 ${stat.bg} ${stat.color} rounded-2xl flex items-center justify-center`}>
              {stat.icon}
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">{stat.label}</p>
              <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <h3 className="text-lg font-bold mb-6 text-gray-800">התפלגות סטטוסים</h3>
          <div className="space-y-4">
            {statuses.map(s => {
              const count = leads.filter(l => l.statusId === s.id).length;
              const percentage = leads.length > 0 ? (count / leads.length) * 100 : 0;
              return (
                <div key={s.id}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-medium text-gray-700">{s.label}</span>
                    <span className="text-gray-500">{count} ({Math.round(percentage)}%)</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2.5">
                    <div className={`h-2.5 rounded-full ${s.color}`} style={{ width: `${percentage}%` }}></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center justify-center text-center">
          <div className="w-24 h-24 bg-blue-600 rounded-full flex items-center justify-center text-white text-3xl font-bold mb-4 shadow-lg shadow-blue-200">
            {leads.length > 0 ? Math.round((leads.filter(l => l.statusId === 'done').length / leads.length) * 100) : 0}%
          </div>
          <h3 className="text-lg font-bold text-gray-800">אחוז המרה</h3>
          <p className="text-sm text-gray-500 mt-2 px-4">לידים שנסגרו בהצלחה מתוך כלל הלידים במערכת</p>
        </div>
      </div>
    </div>
  );
};

const UsersIcon = () => <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>;
const PlusIcon = () => <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>;
const ClockIcon = () => <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
const XIcon = () => <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>;

export default Dashboard;
