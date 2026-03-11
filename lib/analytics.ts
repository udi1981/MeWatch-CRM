import { Lead } from '../types';

export type PlanMetrics = { revenue: number; count: number; active: number };

export type FinancialMetrics = {
  totalRevenue: number;
  monthlyActiveRevenue: number;
  ecomRevenue: number;
  combinedRevenue: number;
  activeCount: number;
  canceledCount: number;
  paymentFailedCount: number;
  refundedCount: number;
  totalOrdersCount: number;
  churnRate: number;
  retentionRate: number;
  avgRevenuePerCustomer: number;
  revenueByPlan: [string, PlanMetrics][];
  revenueByMonth: [string, number][];
  cancelsByMonth: [string, number][];
  paymentStatusBreakdown: Record<string, number>;
};

/** Parses ₪-prefixed currency strings like "₪1,250" → 1250 */
const parseCurrency = (val: string | number | undefined): number =>
  parseFloat((val || '').toString().replace('₪', '').replace(/,/g, '')) || 0;

/**
 * Computes all financial metrics from leads.
 * Used by both Dashboard and Analytics Bot.
 */
export const computeFinancialMetrics = (leads: Lead[]): FinancialMetrics => {
  let totalRevenue = 0;
  let monthlyActiveRevenue = 0;
  let activeCount = 0;
  let canceledCount = 0;
  let paymentFailedCount = 0;
  let refundedCount = 0;
  let ecomRevenue = 0;
  let totalOrdersCount = 0;
  const revenueByPlan: Record<string, PlanMetrics> = {};
  const cancelsByMonth: Record<string, number> = {};
  const revenueByMonth: Record<string, number> = {};
  const paymentStatusBreakdown: Record<string, number> = {};

  for (const l of leads) {
    const d = l.dynamicData || {};
    const price = parseCurrency(d.planPrice);
    const totalPaid = parseCurrency(d.totalPaid);
    const reason = (d.cancellationReason || '').toString();
    const wixStatus = (d.wixStatus || '').toString();
    const planName = (d.planName || 'אחר').toString();
    const paymentStatus = (d.lastPaymentStatus || '').toString();
    const isActive = d.hasActiveSubscription === 'כן' || wixStatus === 'ACTIVE';
    const ecomSpent = parseCurrency(d.ecomTotalSpent);

    totalRevenue += totalPaid;
    ecomRevenue += ecomSpent;
    totalOrdersCount += parseInt((d.totalOrders || '0').toString()) || 0;

    if (isActive) {
      activeCount++;
      monthlyActiveRevenue += price;
    }
    if (reason === 'תשלום נכשל') paymentFailedCount++;
    if (reason.includes('בוטל')) canceledCount++;
    if (paymentStatus === 'הוחזר') refundedCount++;

    // Payment status breakdown
    if (paymentStatus) {
      paymentStatusBreakdown[paymentStatus] = (paymentStatusBreakdown[paymentStatus] || 0) + 1;
    }

    // Revenue by plan
    if (!revenueByPlan[planName]) revenueByPlan[planName] = { revenue: 0, count: 0, active: 0 };
    revenueByPlan[planName].revenue += totalPaid;
    revenueByPlan[planName].count++;
    if (isActive) revenueByPlan[planName].active++;

    // Cancels by month
    const cancelDate = (d.cancellationDate || '').toString();
    if (cancelDate && reason && reason !== 'פעיל') {
      const parts = cancelDate.split('.');
      if (parts.length === 3) {
        const monthKey = `${parts[1]}/${parts[2]}`;
        cancelsByMonth[monthKey] = (cancelsByMonth[monthKey] || 0) + 1;
      }
    }

    // Revenue by month (from start date)
    const startDate = (d.startDate || '').toString();
    if (startDate && totalPaid > 0) {
      const parts = startDate.split('.');
      if (parts.length === 3) {
        const monthKey = `${parts[1]}/${parts[2]}`;
        revenueByMonth[monthKey] = (revenueByMonth[monthKey] || 0) + totalPaid;
      }
    }
  }

  const plansSorted = Object.entries(revenueByPlan)
    .sort((a, b) => b[1].revenue - a[1].revenue);

  const cancelMonths = Object.entries(cancelsByMonth)
    .sort((a, b) => b[0].localeCompare(a[0]))
    .slice(0, 6);

  const revenueMonths = Object.entries(revenueByMonth)
    .sort((a, b) => b[0].localeCompare(a[0]))
    .slice(0, 12);

  const combinedRevenue = totalRevenue + ecomRevenue;
  const total = leads.length;
  const churnRate = total > 0 ? Math.round((canceledCount / total) * 100) : 0;
  const retentionRate = total > 0 ? Math.round((activeCount / total) * 100) : 0;
  const avgRevenuePerCustomer = total > 0 ? Math.round(combinedRevenue / total) : 0;

  return {
    totalRevenue,
    monthlyActiveRevenue,
    ecomRevenue,
    combinedRevenue,
    activeCount,
    canceledCount,
    paymentFailedCount,
    refundedCount,
    totalOrdersCount,
    churnRate,
    retentionRate,
    avgRevenuePerCustomer,
    revenueByPlan: plansSorted,
    revenueByMonth: revenueMonths,
    cancelsByMonth: cancelMonths,
    paymentStatusBreakdown,
  };
};
