import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from '../db';
import { verifyAuth } from '../auth/me';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const user = await verifyAuth(req);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });

  if (req.method === 'GET') {
    const rows = await sql`SELECT * FROM leads ORDER BY created_at DESC`;
    return res.json(rows.map(r => ({
      id: r.id,
      name: r.name,
      phone: r.phone,
      email: r.email,
      statusId: r.status_id,
      createdAt: r.created_at,
      reminderAt: r.reminder_at,
      dynamicData: r.dynamic_data || {},
      notes: r.notes || [],
      customerId: r.customer_id,
      source: r.source,
      endingReason: r.ending_reason,
      subscriptionType: r.subscription_type,
      subscriptionStatus: r.subscription_status,
    })));
  }

  if (req.method === 'POST') {
    const { id, name, phone, email, statusId, createdAt, dynamicData, notes, customerId, source } = req.body;
    const leadId = id || Math.random().toString(36).substr(2, 9);
    await sql`INSERT INTO leads (id, name, phone, email, status_id, created_at, dynamic_data, notes, customer_id, source)
              VALUES (${leadId}, ${name}, ${phone || ''}, ${email || null}, ${statusId || 'new'}, ${createdAt || new Date().toISOString()}, ${JSON.stringify(dynamicData || {})}, ${JSON.stringify(notes || [])}, ${customerId || null}, ${source || 'manual'})
              ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, phone = EXCLUDED.phone, email = EXCLUDED.email, status_id = EXCLUDED.status_id, dynamic_data = EXCLUDED.dynamic_data, notes = EXCLUDED.notes, customer_id = EXCLUDED.customer_id, source = EXCLUDED.source`;
    return res.json({ ok: true, id: leadId });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
