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

  if (req.method === 'GET') {
    const rows = await sql`SELECT * FROM customers ORDER BY created_at DESC`;
    return res.json(rows.map(r => ({
      id: r.id,
      name: r.name,
      phone: r.phone,
      email: r.email,
      source: r.source,
      createdAt: r.created_at,
      subscriptionIds: r.subscription_ids || [],
      inquiryIds: r.inquiry_ids || [],
      tags: r.tags || [],
      totalSpent: r.total_spent ? parseFloat(r.total_spent) : 0,
      ecomSpent: r.ecom_spent ? parseFloat(r.ecom_spent) : 0,
      lastActivity: r.last_activity,
      wixMemberStatus: r.wix_member_status,
      emailUnsubscribed: r.email_unsubscribed || false,
      unsubscribedAt: r.unsubscribed_at,
      unsubscribeSource: r.unsubscribe_source,
    })));
  }

  if (req.method === 'PUT') {
    const { id, emailUnsubscribed } = req.body;
    if (!id) return res.status(400).json({ error: 'id required' });

    if (emailUnsubscribed === true) {
      await sql`UPDATE customers SET email_unsubscribed = true, unsubscribed_at = NOW(), unsubscribe_source = 'manual' WHERE id = ${id}`;
    } else {
      await sql`UPDATE customers SET email_unsubscribed = false, unsubscribed_at = NULL, unsubscribe_source = NULL WHERE id = ${id}`;
    }

    await sql`INSERT INTO logs (level, message, details) VALUES ('info', ${emailUnsubscribed ? 'Manual unsubscribe' : 'Manual re-subscribe'}, ${id})`;
    return res.json({ ok: true });
  }

  if (req.method === 'POST') {
    const { id, name, phone, email, source, createdAt, subscriptionIds, inquiryIds, tags, totalSpent, ecomSpent, lastActivity, wixMemberStatus } = req.body;
    await sql`INSERT INTO customers (id, name, phone, email, source, created_at, subscription_ids, inquiry_ids, tags, total_spent, ecom_spent, last_activity, wix_member_status, unsubscribe_token)
              VALUES (${id}, ${name}, ${phone || ''}, ${email || null}, ${source || 'manual'}, ${createdAt || new Date().toISOString()}, ${subscriptionIds || []}, ${inquiryIds || []}, ${tags || []}, ${totalSpent || 0}, ${ecomSpent || 0}, ${lastActivity || null}, ${wixMemberStatus || null}, ${email ? require('crypto').randomBytes(16).toString('hex') : null})
              ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, phone = EXCLUDED.phone, email = EXCLUDED.email, source = EXCLUDED.source, subscription_ids = EXCLUDED.subscription_ids, inquiry_ids = EXCLUDED.inquiry_ids, tags = EXCLUDED.tags, total_spent = EXCLUDED.total_spent, ecom_spent = EXCLUDED.ecom_spent, last_activity = EXCLUDED.last_activity, wix_member_status = EXCLUDED.wix_member_status, unsubscribe_token = COALESCE(customers.unsubscribe_token, EXCLUDED.unsubscribe_token)`;
    return res.json({ ok: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
