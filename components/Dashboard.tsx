
import React, { useMemo, useState, useEffect } from 'react';
import { Lead, StatusConfig } from '../types';
import { computeFinancialMetrics } from '../lib/analytics';
import api from '../lib/api';

interface DashboardProps {
  leads: Lead[];
  statuses: StatusConfig[];
}

interface DashboardData {
  today: { revenue: number; orders: number; yesterdayRevenue: number; yesterdayOrders: number };
  mtd: { revenue: number; orders: number };
  allTime: { revenue: number; orders: number; refunds: number };
  monthlyTrend: { month: string; revenue: number; orders: number; refunds: number }[];
  customerCount: number;
}

const Dashboard: React.FC<DashboardProps> = ({ leads, statuses }) => {
  const fm = useMemo(() => computeFinancialMetrics(leads), [leads]);
  const [dbData, setDbData] = useState<DashboardData | null>(null);

  useEffect(() => {
    api.getDashboardData().then(setDbData).catch(() => {});
  }, []);

  // Renewal stats
  const renewalStats = useMemo(() => {
    const paymentFailed = leads.filter(l => {
      const reason = (l.dynamicData?.cancellationReason || '').toString();
      const lastPayment = String(l.dynamicData?.lastPaymentStatus || '').toLowerCase();
      return reason === 'תשלום נכשל' || lastPayment === 'failed' || lastPayment === 'נכשל';
    });
    const renewed = paymentFailed.filter(l => {
      const hasActive = String(l.dynamicData?.hasActiveSubscription || '');
      const wixStatus = String(l.dynamicData?.wixStatus || '');
      return hasActive === 'כן' || wixStatus === 'ACTIVE';
    });
    return { total: paymentFailed.length, renewed: renewed.length, needCall: paymentFailed.length - renewed.length };
  }, [leads]);

  const combinedRevenue = fm.totalRevenue + fm.ecomRevenue;
  const churnRate = leads.length > 0 ? Math.round((fm.canceledCount / leads.length) * 100) : 0;
  const retentionRate = leads.length > 0 ? Math.round((fm.activeCount / leads.length) * 100) : 0;
  const arpu = leads.length > 0 ? Math.round(combinedRevenue / leads.length) : 0;

  // Today comparison
  const todayChange = dbData?.today ? (dbData.today.yesterdayRevenue > 0
    ? Math.round(((dbData.today.revenue - dbData.today.yesterdayRevenue) / dbData.today.yesterdayRevenue) * 100)
    : dbData.today.revenue > 0 ? 100 : 0) : 0;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Today's Revenue - Hero Card */}
      {dbData && (
        <div className="bg-gradient-to-l from-blue-600 via-blue-700 to-indigo-800 p-6 rounded-2xl shadow-xl text-white relative overflow-hidden">
          <div className="absolute top-0 left-0 w-32 h-32 bg-white/5 rounded-full -translate-x-12 -translate-y-12"></div>
          <div className="absolute bottom-0 right-0 w-24 h-24 bg-white/5 rounded-full translate-x-8 translate-y-8"></div>
          <div className="relative z-10">
            <p className="text-blue-200 text-sm font-medium mb-1">הכנסות היום</p>
            <div className="flex items-baseline gap-3">
              <span className="text-4xl font-black">₪{dbData.today.revenue.toLocaleString()}</span>
              {todayChange !== 0 && (
                <span className={`text-sm font-bold px-2 py-0.5 rounded-full ${todayChange > 0 ? 'bg-green-500/30 text-green-200' : 'bg-red-500/30 text-red-200'}`}>
                  {todayChange > 0 ? '↑' : '↓'} {Math.abs(todayChange)}% מאתמול
                </span>
              )}
            </div>
            <div className="flex gap-8 mt-4 text-sm">
              <div>
                <span className="text-blue-200">אתמול:</span>{' '}
                <span className="font-bold">₪{dbData.today.yesterdayRevenue.toLocaleString()}</span>
              </div>
              <div>
                <span className="text-blue-200">החודש:</span>{' '}
                <span className="font-bold">₪{dbData.mtd.revenue.toLocaleString()}</span>
              </div>
              <div>
                <span className="text-blue-200">הזמנות היום:</span>{' '}
                <span className="font-bold">{dbData.today.orders}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* KPI Cards Row */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <KPICard label="הכנסות כולל" value={`₪${combinedRevenue.toLocaleString()}`} icon={<MoneyIcon />} color="emerald" />
        <KPICard label="MRR" value={`₪${fm.monthlyActiveRevenue.toLocaleString()}`} icon={<TrendIcon />} color="blue" />
        <KPICard label="מנויים פעילים" value={fm.activeCount.toLocaleString()} icon={<CheckIcon />} color="green" />
        <KPICard label="שימור" value={`${retentionRate}%`} icon={<ShieldIcon />} color="cyan" />
        <KPICard label="נטישה" value={`${churnRate}%`} icon={<XIcon />} color="red" />
        <KPICard label="ARPU" value={`₪${arpu.toLocaleString()}`} icon={<UserIcon />} color="purple" />
      </div>

      {/* Subscriber Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MiniCard label="לקוחות" value={leads.length.toLocaleString()} sub={dbData ? `${dbData.customerCount.toLocaleString()} ב-DB` : ''} color="blue" />
        <MiniCard label="תשלום נכשל" value={fm.paymentFailedCount.toLocaleString()} sub={`${renewalStats.renewed} חידשו`} color="orange" />
        <MiniCard label="ביטולים" value={fm.canceledCount.toLocaleString()} sub="" color="red" />
        <MiniCard label="צריך להתקשר" value={renewalStats.needCall.toLocaleString()} sub="תשלום נכשל ללא חידוש" color="amber" alert={renewalStats.needCall > 0} />
      </div>

      {/* Revenue Trend from daily_sales */}
      {dbData && dbData.monthlyTrend.length > 0 && (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <h3 className="text-lg font-bold mb-4 text-gray-800 flex items-center gap-2">
            <TrendIcon /> מגמת הכנסות (12 חודשים)
          </h3>
          <div className="space-y-2.5">
            {dbData.monthlyTrend.map((m) => {
              const maxRev = Math.max(...dbData.monthlyTrend.map(x => x.revenue));
              const pct = maxRev > 0 ? (m.revenue / maxRev) * 100 : 0;
              const monthLabel = formatMonth(m.month);
              return (
                <div key={m.month}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-medium text-gray-700">{monthLabel}</span>
                    <span className="text-gray-500">
                      ₪{m.revenue.toLocaleString()} · {m.orders} הזמנות
                      {m.refunds > 0 && <span className="text-red-400 mr-2">(-₪{m.refunds.toLocaleString()})</span>}
                    </span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-3">
                    <div className="h-3 rounded-full bg-gradient-to-l from-blue-500 to-emerald-400 transition-all duration-500" style={{ width: `${pct}%` }}></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue by Plan */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <h3 className="text-lg font-bold mb-4 text-gray-800">הכנסות לפי מנוי</h3>
          <div className="space-y-3">
            {fm.revenueByPlan.map(([plan, data]) => {
              const maxRevenue = fm.revenueByPlan[0]?.[1]?.revenue || 1;
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
          {fm.cancelsByMonth.length > 0 ? (
            <div className="space-y-3">
              {fm.cancelsByMonth.map(([month, count]) => {
                const maxCancel = Math.max(...fm.cancelsByMonth.map(m => m[1] as number));
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

      {/* Payment Status + CRM Status + Retention Circle */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Payment Status Breakdown */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <h3 className="text-lg font-bold mb-4 text-gray-800">סטטוס תשלומים</h3>
          <div className="space-y-3">
            {Object.entries(fm.paymentStatusBreakdown).sort((a, b) => b[1] - a[1]).map(([status, count]) => {
              const total = Object.values(fm.paymentStatusBreakdown).reduce((a, b) => a + b, 0);
              const pct = total > 0 ? Math.round((count / total) * 100) : 0;
              const color = status === 'שולם' ? 'bg-green-500' : status === 'הוחזר' ? 'bg-purple-500' : 'bg-orange-400';
              return (
                <div key={status} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${color}`}></div>
                    <span className="text-sm text-gray-700">{status}</span>
                  </div>
                  <span className="text-sm font-bold text-gray-600">{count} ({pct}%)</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* CRM Status Distribution */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <h3 className="text-lg font-bold mb-4 text-gray-800">סטטוסים (CRM)</h3>
          <div className="space-y-3">
            {statuses.map(s => {
              const count = leads.filter(l => l.statusId === s.id).length;
              const percentage = leads.length > 0 ? Math.round((count / leads.length) * 100) : 0;
              return (
                <div key={s.id}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-medium text-gray-700">{s.label}</span>
                    <span className="text-gray-500">{count} ({percentage}%)</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2">
                    <div className={`h-2 rounded-full ${s.color}`} style={{ width: `${percentage}%` }}></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Retention Circle */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center justify-center text-center">
          <div className="w-28 h-28 bg-gradient-to-br from-emerald-500 to-emerald-700 rounded-full flex items-center justify-center text-white text-3xl font-black mb-3 shadow-lg shadow-emerald-200">
            {retentionRate}%
          </div>
          <h3 className="text-lg font-bold text-gray-800">שימור</h3>
          <p className="text-sm text-gray-500 mt-1">{fm.activeCount} פעילים מתוך {leads.length}</p>
          {fm.ecomRevenue > 0 && (
            <div className="mt-3 pt-3 border-t border-gray-100 w-full">
              <p className="text-xs text-gray-400">חנות eCommerce</p>
              <p className="text-lg font-bold text-purple-600">₪{fm.ecomRevenue.toLocaleString()}</p>
              <p className="text-xs text-gray-400">{fm.totalOrdersCount} הזמנות</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Helper: format YYYY-MM to Hebrew month
const MONTH_NAMES = ['', 'ינואר', 'פברואר', 'מרס', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];
const formatMonth = (ym: string) => {
  const [y, m] = ym.split('-');
  return `${MONTH_NAMES[parseInt(m)] || m} ${y}`;
};

// KPI Card Component
const KPICard = ({ label, value, icon, color }: { label: string; value: string; icon: React.ReactNode; color: string }) => {
  const colorMap: Record<string, { bg: string; text: string }> = {
    emerald: { bg: 'bg-emerald-50', text: 'text-emerald-600' },
    blue: { bg: 'bg-blue-50', text: 'text-blue-600' },
    green: { bg: 'bg-green-50', text: 'text-green-600' },
    cyan: { bg: 'bg-cyan-50', text: 'text-cyan-600' },
    red: { bg: 'bg-red-50', text: 'text-red-600' },
    purple: { bg: 'bg-purple-50', text: 'text-purple-600' },
  };
  const c = colorMap[color] || colorMap.blue;
  return (
    <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 transition-transform hover:scale-[1.02]">
      <div className={`w-10 h-10 ${c.bg} ${c.text} rounded-xl flex items-center justify-center mb-2`}>
        {icon}
      </div>
      <p className="text-[11px] font-medium text-gray-400">{label}</p>
      <p className="text-xl font-black text-gray-900">{value}</p>
    </div>
  );
};

// Mini Card Component
const MiniCard = ({ label, value, sub, color, alert }: { label: string; value: string; sub: string; color: string; alert?: boolean }) => {
  const colorMap: Record<string, string> = {
    blue: 'border-l-blue-500', orange: 'border-l-orange-500', red: 'border-l-red-500', amber: 'border-l-amber-500',
  };
  return (
    <div className={`bg-white p-4 rounded-xl shadow-sm border border-gray-100 border-r-4 ${colorMap[color] || ''} ${alert ? 'animate-pulse' : ''}`} style={{ borderRightColor: color === 'blue' ? '#3b82f6' : color === 'orange' ? '#f97316' : color === 'red' ? '#ef4444' : '#f59e0b' }}>
      <p className="text-xs font-medium text-gray-400">{label}</p>
      <p className="text-2xl font-black text-gray-900">{value}</p>
      {sub && <p className="text-[10px] text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
};

// Icons
const MoneyIcon = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
const TrendIcon = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>;
const CheckIcon = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
const XIcon = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>;
const ShieldIcon = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>;
const UserIcon = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>;

export default Dashboard;
