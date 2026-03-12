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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const user = await verifyAuth(req);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });

  try {
    // Run all queries in parallel
    const [todayRows, monthlyRows, customerCountRows] = await Promise.all([
      // Today + yesterday revenue
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
      // Monthly revenue trend (last 12 months)
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
      // Customer count
      sql`SELECT COUNT(*) as total FROM customers`,
    ]);

    const today = todayRows[0] || {};

    return res.json({
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
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
}
