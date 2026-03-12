import type { VercelRequest, VercelResponse } from '@vercel/node';
import { neon } from '@neondatabase/serverless';
import { jwtVerify } from 'jose';

const sql = neon(process.env.DATABASE_URL!);
const jwtSecret = new TextEncoder().encode(process.env.JWT_SECRET || 'dev-secret-change-me');

async function verifyAuth(req: VercelRequest) {
  const cookie = req.headers.cookie || '';
  const match = cookie.match(/token=([^;]+)/);
  if (!match) return null;
  try { const { payload } = await jwtVerify(match[1], jwtSecret); return payload as any; } catch { return null; }
}

// ============ AI SUMMARY MODE ============
async function getAISummary() {
  const [
    revenueOverview,
    dailyRevenue,
    weeklyRevenue,
    monthlyRevenue,
    subscriptionStatus,
    planDistribution,
    cancellationByReason,
    cancellationByMonth,
    cancellationByPlan,
    renewalRecovery,
    customerSegments,
    atRiskCustomers,
    growthMetrics,
    ecomSummary,
    lastSync,
    totalLeads,
    leadsWithPhone,
    leadsWithEmail,
  ] = await Promise.all([
    // 1. Revenue Overview: today/yesterday/week/month/year + comparisons
    sql`
      SELECT
        COALESCE(SUM(CASE WHEN sale_date = CURRENT_DATE THEN total_sales END), 0) as today,
        COALESCE(SUM(CASE WHEN sale_date = CURRENT_DATE - 1 THEN total_sales END), 0) as yesterday,
        COALESCE(SUM(CASE WHEN sale_date >= CURRENT_DATE - 7 THEN total_sales END), 0) as last_7_days,
        COALESCE(SUM(CASE WHEN sale_date >= CURRENT_DATE - 14 AND sale_date < CURRENT_DATE - 7 THEN total_sales END), 0) as prev_7_days,
        COALESCE(SUM(CASE WHEN sale_date >= date_trunc('month', CURRENT_DATE) THEN total_sales END), 0) as this_month,
        COALESCE(SUM(CASE WHEN sale_date >= date_trunc('month', CURRENT_DATE - INTERVAL '1 month') AND sale_date < date_trunc('month', CURRENT_DATE) THEN total_sales END), 0) as last_month,
        COALESCE(SUM(CASE WHEN sale_date >= date_trunc('year', CURRENT_DATE) THEN total_sales END), 0) as this_year,
        COALESCE(SUM(CASE WHEN sale_date >= date_trunc('year', CURRENT_DATE - INTERVAL '1 year') AND sale_date < date_trunc('year', CURRENT_DATE) THEN total_sales END), 0) as last_year,
        COALESCE(SUM(total_sales), 0) as all_time,
        COALESCE(SUM(total_orders), 0) as all_time_orders,
        COALESCE(SUM(refunds), 0) as all_time_refunds
      FROM daily_sales
    `,
    // 2. Daily Revenue — last 30 days
    sql`
      SELECT sale_date::text as date, total_sales as revenue, total_orders as orders, refunds
      FROM daily_sales WHERE sale_date >= CURRENT_DATE - 30
      ORDER BY sale_date DESC
    `,
    // 3. Weekly Revenue — last 12 weeks
    sql`
      SELECT
        to_char(date_trunc('week', sale_date), 'YYYY-MM-DD') as week_start,
        SUM(total_sales) as revenue, SUM(total_orders) as orders
      FROM daily_sales WHERE sale_date >= CURRENT_DATE - 84
      GROUP BY date_trunc('week', sale_date)
      ORDER BY week_start DESC
    `,
    // 4. Monthly Revenue — last 24 months
    sql`
      SELECT
        to_char(date_trunc('month', sale_date), 'YYYY-MM') as month,
        SUM(total_sales) as revenue, SUM(total_orders) as orders, SUM(refunds) as refunds
      FROM daily_sales WHERE sale_date >= CURRENT_DATE - INTERVAL '24 months'
      GROUP BY date_trunc('month', sale_date)
      ORDER BY month ASC
    `,
    // 5. Subscription Status — by wixStatus with count + revenue
    sql`
      SELECT
        dynamic_data->>'wixStatus' as status,
        COUNT(*) as count,
        COALESCE(SUM((dynamic_data->>'totalPaid')::numeric), 0) as revenue
      FROM leads
      WHERE dynamic_data->>'wixStatus' IS NOT NULL AND dynamic_data->>'wixStatus' != ''
      GROUP BY dynamic_data->>'wixStatus'
      ORDER BY count DESC
    `,
    // 6. Plan Distribution — by plan: count, active, revenue
    sql`
      SELECT
        dynamic_data->>'planName' as plan,
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE dynamic_data->>'hasActiveSubscription' = 'כן' OR dynamic_data->>'wixStatus' = 'ACTIVE') as active,
        COALESCE(SUM((dynamic_data->>'totalPaid')::numeric), 0) as revenue
      FROM leads
      WHERE dynamic_data->>'planName' IS NOT NULL AND dynamic_data->>'planName' != ''
      GROUP BY dynamic_data->>'planName'
      ORDER BY revenue DESC
    `,
    // 7a. Cancellation by reason
    sql`
      SELECT
        dynamic_data->>'cancellationReason' as reason,
        COUNT(*) as count
      FROM leads
      WHERE dynamic_data->>'cancellationReason' IS NOT NULL AND dynamic_data->>'cancellationReason' != ''
      GROUP BY dynamic_data->>'cancellationReason'
      ORDER BY count DESC
    `,
    // 7b. Cancellation by month (using cancellationDate DD.MM.YYYY)
    sql`
      SELECT
        CASE
          WHEN dynamic_data->>'cancellationDate' ~ '^\d{2}\.\d{2}\.\d{4}$'
          THEN substring(dynamic_data->>'cancellationDate' from 4 for 2) || '/' || substring(dynamic_data->>'cancellationDate' from 7 for 4)
          ELSE 'לא ידוע'
        END as month_year,
        COUNT(*) as count,
        dynamic_data->>'cancellationReason' as reason
      FROM leads
      WHERE dynamic_data->>'cancellationDate' IS NOT NULL AND dynamic_data->>'cancellationDate' != ''
      GROUP BY month_year, reason
      ORDER BY month_year DESC
    `,
    // 7c. Cancellation by plan
    sql`
      SELECT
        dynamic_data->>'planName' as plan,
        dynamic_data->>'cancellationReason' as reason,
        COUNT(*) as count
      FROM leads
      WHERE dynamic_data->>'cancellationReason' IS NOT NULL AND dynamic_data->>'cancellationReason' != ''
        AND dynamic_data->>'planName' IS NOT NULL
      GROUP BY plan, reason
      ORDER BY count DESC
    `,
    // 8. Renewal/Recovery — payment-failed: how many renewed
    sql`
      SELECT
        COUNT(*) as total_failed,
        COUNT(*) FILTER (WHERE dynamic_data->>'hasActiveSubscription' = 'כן' OR dynamic_data->>'wixStatus' = 'ACTIVE') as renewed,
        COUNT(*) FILTER (WHERE dynamic_data->>'hasActiveSubscription' != 'כן' AND (dynamic_data->>'wixStatus' IS NULL OR dynamic_data->>'wixStatus' != 'ACTIVE')) as not_renewed
      FROM leads
      WHERE dynamic_data->>'cancellationReason' = 'תשלום נכשל'
        OR LOWER(dynamic_data->>'lastPaymentStatus') IN ('failed', 'נכשל')
    `,
    // 9. Customer Segments — count by tags
    sql`
      SELECT tags, COUNT(*) as count FROM customers
      WHERE tags IS NOT NULL AND tags != '' AND tags != '[]'
      GROUP BY tags ORDER BY count DESC LIMIT 20
    `,
    // 10. At-Risk Customers — 100 payment-failed not renewed
    sql`
      SELECT name, phone, email, dynamic_data->>'planName' as plan,
        dynamic_data->>'totalPaid' as total_paid,
        dynamic_data->>'cancellationDate' as cancel_date,
        dynamic_data->>'cancellationReason' as reason
      FROM leads
      WHERE (dynamic_data->>'cancellationReason' = 'תשלום נכשל'
        OR LOWER(dynamic_data->>'lastPaymentStatus') IN ('failed', 'נכשל'))
        AND dynamic_data->>'hasActiveSubscription' != 'כן'
        AND (dynamic_data->>'wixStatus' IS NULL OR dynamic_data->>'wixStatus' != 'ACTIVE')
      ORDER BY created_at DESC
      LIMIT 100
    `,
    // 11. Growth Metrics — new leads by month, net growth
    sql`
      SELECT
        to_char(date_trunc('month', created_at), 'YYYY-MM') as month,
        COUNT(*) as new_leads,
        COUNT(*) FILTER (WHERE dynamic_data->>'hasActiveSubscription' = 'כן' OR dynamic_data->>'wixStatus' = 'ACTIVE') as active_at_creation
      FROM leads
      WHERE created_at >= CURRENT_DATE - INTERVAL '12 months'
      GROUP BY date_trunc('month', created_at)
      ORDER BY month ASC
    `,
    // 12. Ecommerce Summary
    sql`
      SELECT
        COALESCE(SUM((dynamic_data->>'ecomSpent')::numeric), 0) as total_ecom_revenue,
        COUNT(*) FILTER (WHERE (dynamic_data->>'ecomSpent')::numeric > 0) as ecom_customers
      FROM leads
      WHERE dynamic_data->>'ecomSpent' IS NOT NULL AND dynamic_data->>'ecomSpent' != '' AND dynamic_data->>'ecomSpent' != '0'
    `,
    // 13. Last Sync timestamp
    sql`SELECT MAX(created_at) as last_sync FROM leads`,
    // 14. Total leads
    sql`SELECT COUNT(*) as total FROM leads`,
    // 15. Leads with phone
    sql`SELECT COUNT(*) as count FROM leads WHERE phone IS NOT NULL AND phone != ''`,
    // 16. Leads with email
    sql`SELECT COUNT(*) as count FROM leads WHERE email IS NOT NULL AND email != ''`,
  ]);

  const rev = revenueOverview[0] || {};
  const renewal = renewalRecovery[0] || {};
  const ecom = ecomSummary[0] || {};

  return {
    generatedAt: new Date().toISOString(),
    overview: {
      totalLeads: parseInt(totalLeads[0]?.total) || 0,
      withPhone: parseInt(leadsWithPhone[0]?.count) || 0,
      withEmail: parseInt(leadsWithEmail[0]?.count) || 0,
    },
    revenue: {
      today: parseFloat(rev.today) || 0,
      yesterday: parseFloat(rev.yesterday) || 0,
      last7Days: parseFloat(rev.last_7_days) || 0,
      prev7Days: parseFloat(rev.prev_7_days) || 0,
      thisMonth: parseFloat(rev.this_month) || 0,
      lastMonth: parseFloat(rev.last_month) || 0,
      thisYear: parseFloat(rev.this_year) || 0,
      lastYear: parseFloat(rev.last_year) || 0,
      allTime: parseFloat(rev.all_time) || 0,
      allTimeOrders: parseInt(rev.all_time_orders) || 0,
      allTimeRefunds: parseFloat(rev.all_time_refunds) || 0,
    },
    dailyRevenue: dailyRevenue.map((r: any) => ({
      date: r.date, revenue: parseFloat(r.revenue) || 0, orders: parseInt(r.orders) || 0, refunds: parseFloat(r.refunds) || 0,
    })),
    weeklyRevenue: weeklyRevenue.map((r: any) => ({
      weekStart: r.week_start, revenue: parseFloat(r.revenue) || 0, orders: parseInt(r.orders) || 0,
    })),
    monthlyRevenue: monthlyRevenue.map((r: any) => ({
      month: r.month, revenue: parseFloat(r.revenue) || 0, orders: parseInt(r.orders) || 0, refunds: parseFloat(r.refunds) || 0,
    })),
    subscriptionStatus: subscriptionStatus.map((r: any) => ({
      status: r.status, count: parseInt(r.count), revenue: parseFloat(r.revenue) || 0,
    })),
    planDistribution: planDistribution.map((r: any) => ({
      plan: r.plan, total: parseInt(r.total), active: parseInt(r.active), revenue: parseFloat(r.revenue) || 0,
    })),
    cancellations: {
      byReason: cancellationByReason.map((r: any) => ({ reason: r.reason, count: parseInt(r.count) })),
      byMonth: cancellationByMonth.map((r: any) => ({ monthYear: r.month_year, reason: r.reason, count: parseInt(r.count) })),
      byPlan: cancellationByPlan.map((r: any) => ({ plan: r.plan, reason: r.reason, count: parseInt(r.count) })),
    },
    renewal: {
      totalFailed: parseInt(renewal.total_failed) || 0,
      renewed: parseInt(renewal.renewed) || 0,
      notRenewed: parseInt(renewal.not_renewed) || 0,
      renewalRate: parseInt(renewal.total_failed) > 0
        ? Math.round((parseInt(renewal.renewed) / parseInt(renewal.total_failed)) * 100)
        : 0,
    },
    customerSegments: customerSegments.map((r: any) => ({ tags: r.tags, count: parseInt(r.count) })),
    atRiskCustomers: atRiskCustomers.map((r: any) => ({
      name: r.name, phone: r.phone, email: r.email, plan: r.plan,
      totalPaid: r.total_paid, cancelDate: r.cancel_date, reason: r.reason,
    })),
    growthMetrics: growthMetrics.map((r: any) => ({
      month: r.month, newLeads: parseInt(r.new_leads), activeAtCreation: parseInt(r.active_at_creation),
    })),
    ecommerce: {
      totalRevenue: parseFloat(ecom.total_ecom_revenue) || 0,
      customerCount: parseInt(ecom.ecom_customers) || 0,
    },
    lastSync: lastSync[0]?.last_sync || null,
  };
}

// ============ REGULAR DASHBOARD MODE ============
async function getDashboardData() {
  const [todayRows, monthlyRows, customerCountRows] = await Promise.all([
    sql`
      SELECT
        COALESCE(SUM(CASE WHEN sale_date = CURRENT_DATE THEN total_sales END), 0) as today_revenue,
        COALESCE(SUM(CASE WHEN sale_date = CURRENT_DATE THEN total_orders END), 0) as today_orders,
        COALESCE(SUM(CASE WHEN sale_date = CURRENT_DATE - 1 THEN total_sales END), 0) as yesterday_revenue,
        COALESCE(SUM(CASE WHEN sale_date = CURRENT_DATE - 1 THEN total_orders END), 0) as yesterday_orders,
        COALESCE(SUM(CASE WHEN sale_date >= date_trunc('month', CURRENT_DATE) THEN total_sales END), 0) as mtd_revenue,
        COALESCE(SUM(CASE WHEN sale_date >= date_trunc('month', CURRENT_DATE) THEN total_orders END), 0) as mtd_orders,
        COALESCE(SUM(total_sales), 0) as all_time_revenue,
        COALESCE(SUM(total_orders), 0) as all_time_orders,
        COALESCE(SUM(refunds), 0) as all_time_refunds
      FROM daily_sales
    `,
    sql`
      SELECT
        to_char(date_trunc('month', sale_date), 'YYYY-MM') as month,
        SUM(total_sales) as revenue,
        SUM(total_orders) as orders,
        SUM(refunds) as refunds
      FROM daily_sales
      WHERE sale_date >= CURRENT_DATE - INTERVAL '12 months'
      GROUP BY date_trunc('month', sale_date)
      ORDER BY month ASC
    `,
    sql`SELECT COUNT(*) as total FROM customers`,
  ]);

  const today = todayRows[0] || {};
  return {
    today: {
      revenue: parseFloat(today.today_revenue) || 0,
      orders: parseInt(today.today_orders) || 0,
      yesterdayRevenue: parseFloat(today.yesterday_revenue) || 0,
      yesterdayOrders: parseInt(today.yesterday_orders) || 0,
    },
    mtd: {
      revenue: parseFloat(today.mtd_revenue) || 0,
      orders: parseInt(today.mtd_orders) || 0,
    },
    allTime: {
      revenue: parseFloat(today.all_time_revenue) || 0,
      orders: parseInt(today.all_time_orders) || 0,
      refunds: parseFloat(today.all_time_refunds) || 0,
    },
    monthlyTrend: monthlyRows.map((r: any) => ({
      month: r.month,
      revenue: parseFloat(r.revenue) || 0,
      orders: parseInt(r.orders) || 0,
      refunds: parseFloat(r.refunds) || 0,
    })),
    customerCount: parseInt(customerCountRows[0]?.total) || 0,
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const user = await verifyAuth(req);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });

  try {
    const mode = (req.query.mode as string) || 'dashboard';

    if (mode === 'ai-summary') {
      const summary = await getAISummary();
      return res.json(summary);
    }

    const data = await getDashboardData();
    return res.json(data);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
}
