
import React, { useMemo } from 'react';
import { Lead, StatusConfig } from '../types';
import { computeFinancialMetrics } from '../lib/analytics';

interface DashboardProps {
  leads: Lead[];
  statuses: StatusConfig[];
}

const Dashboard: React.FC<DashboardProps> = ({ leads, statuses }) => {
  const fm = useMemo(() => computeFinancialMetrics(leads), [leads]);

  const financial = {
    totalRevenue: fm.totalRevenue,
    monthlyActiveRevenue: fm.monthlyActiveRevenue,
    activeCount: fm.activeCount,
    canceledCount: fm.canceledCount,
    paymentFailedCount: fm.paymentFailedCount,
    refundedCount: fm.refundedCount,
    ecomRevenue: fm.ecomRevenue,
    totalOrdersCount: fm.totalOrdersCount,
    plansSorted: fm.revenueByPlan,
    cancelMonths: fm.cancelsByMonth,
    revenueMonths: fm.revenueByMonth,
  };

  const stats = [
    { label: 'לקוחות', value: leads.length.toLocaleString(), icon: <UsersIcon />, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'סה"כ הזמנות', value: financial.totalOrdersCount.toLocaleString(), icon: <CartIcon />, color: 'text-indigo-600', bg: 'bg-indigo-50' },
    { label: 'מנויים פעילים', value: financial.activeCount.toLocaleString(), icon: <CheckIcon />, color: 'text-green-600', bg: 'bg-green-50' },
    { label: 'תשלום נכשל', value: financial.paymentFailedCount.toLocaleString(), icon: <AlertIcon />, color: 'text-orange-600', bg: 'bg-orange-50' },
    { label: 'ביטולים', value: financial.canceledCount.toLocaleString(), icon: <XIcon />, color: 'text-red-600', bg: 'bg-red-50' },
  ];

  const combinedRevenue = financial.totalRevenue + financial.ecomRevenue;

  const finStats = [
    { label: 'הכנסות כולל', value: `₪${combinedRevenue.toLocaleString()}`, icon: <MoneyIcon />, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: 'הכנסות מנויים', value: `₪${financial.totalRevenue.toLocaleString()}`, icon: <TrendIcon />, color: 'text-blue-600', bg: 'bg-blue-50' },
    ...(financial.ecomRevenue > 0 ? [{ label: 'הכנסות חנות', value: `₪${financial.ecomRevenue.toLocaleString()}`, icon: <CartIcon />, color: 'text-purple-600', bg: 'bg-purple-50' }] : []),
    { label: 'הכנסה חודשית פעילה', value: `₪${financial.monthlyActiveRevenue.toLocaleString()}`, icon: <TrendIcon />, color: 'text-cyan-600', bg: 'bg-cyan-50' },
    { label: 'אחוז ביטולים', value: leads.length > 0 ? `${Math.round((financial.canceledCount / leads.length) * 100)}%` : '0%', icon: <PercentIcon />, color: 'text-red-600', bg: 'bg-red-50' },
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Subscriber Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {stats.map((stat, i) => (
          <div key={i} className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4 transition-transform hover:scale-[1.02]">
            <div className={`w-12 h-12 ${stat.bg} ${stat.color} rounded-xl flex items-center justify-center`}>
              {stat.icon}
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500">{stat.label}</p>
              <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Financial Stats */}
      <div>
        <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
          <MoneyIcon /> דוח כספי
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {finStats.map((stat, i) => (
            <div key={i} className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4 transition-transform hover:scale-[1.02]">
              <div className={`w-12 h-12 ${stat.bg} ${stat.color} rounded-xl flex items-center justify-center`}>
                {stat.icon}
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500">{stat.label}</p>
                <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Revenue by Month */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <h3 className="text-lg font-bold mb-4 text-gray-800 flex items-center gap-2">
          <TrendIcon /> הכנסות לפי חודש
        </h3>
        {financial.revenueMonths.length > 0 ? (
          <div className="space-y-3">
            {financial.revenueMonths.map(([month, revenue]) => {
              const maxRev = Math.max(...financial.revenueMonths.map(m => m[1] as number));
              const pct = maxRev > 0 ? ((revenue as number) / maxRev) * 100 : 0;
              return (
                <div key={month}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-medium text-gray-700">{month}</span>
                    <span className="text-gray-500">₪{(revenue as number).toLocaleString()}</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-3">
                    <div className="h-3 rounded-full bg-gradient-to-l from-blue-500 to-emerald-400" style={{ width: `${pct}%` }}></div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-gray-400 text-center py-8">אין נתוני הכנסות</p>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue by Plan */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <h3 className="text-lg font-bold mb-4 text-gray-800">הכנסות לפי מנוי</h3>
          <div className="space-y-3">
            {financial.plansSorted.map(([plan, data]) => {
              const maxRevenue = financial.plansSorted[0]?.[1]?.revenue || 1;
              const pct = (data.revenue / maxRevenue) * 100;
              return (
                <div key={plan}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-medium text-gray-700">{plan}</span>
                    <span className="text-gray-500">
                      ₪{data.revenue.toLocaleString()} · {data.active} פעילים / {data.count} סה"כ
                    </span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2.5">
                    <div className="h-2.5 rounded-full bg-emerald-500" style={{ width: `${pct}%` }}></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Cancellations by Month */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <h3 className="text-lg font-bold mb-4 text-gray-800">ביטולים לפי חודש</h3>
          {financial.cancelMonths.length > 0 ? (
            <div className="space-y-3">
              {financial.cancelMonths.map(([month, count]) => {
                const maxCancel = Math.max(...financial.cancelMonths.map(m => m[1] as number));
                const pct = (count / maxCancel) * 100;
                return (
                  <div key={month}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-medium text-gray-700">{month}</span>
                      <span className="text-gray-500">{count} ביטולים</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2.5">
                      <div className="h-2.5 rounded-full bg-red-400" style={{ width: `${pct}%` }}></div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-gray-400 text-center py-8">אין נתוני ביטולים</p>
          )}
        </div>
      </div>

      {/* CRM Status Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <h3 className="text-lg font-bold mb-6 text-gray-800">התפלגות סטטוסים (CRM)</h3>
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
          <div className="w-24 h-24 bg-emerald-600 rounded-full flex items-center justify-center text-white text-2xl font-bold mb-4 shadow-lg shadow-emerald-200">
            {financial.activeCount > 0 ? `${Math.round((financial.activeCount / leads.length) * 100)}%` : '0%'}
          </div>
          <h3 className="text-lg font-bold text-gray-800">אחוז שימור</h3>
          <p className="text-sm text-gray-500 mt-2 px-4">מנויים פעילים מתוך כלל המנויים במערכת</p>
        </div>
      </div>
    </div>
  );
};

const UsersIcon = () => <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>;
const CheckIcon = () => <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
const AlertIcon = () => <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>;
const XIcon = () => <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>;
const MoneyIcon = () => <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
const TrendIcon = () => <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>;

const PercentIcon = () => <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h0m6 10h0M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" /></svg>;
const CartIcon = () => <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z" /></svg>;

export default Dashboard;
