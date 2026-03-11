import type { VercelRequest, VercelResponse } from '@vercel/node';
import { neon } from '@neondatabase/serverless';
const sql = neon(process.env.DATABASE_URL!);
import { verifyAuth } from '../auth/me';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const user = await verifyAuth(req);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });

  if (req.method === 'GET') {
    const rows = await sql`SELECT * FROM inquiries ORDER BY created_at DESC`;
    return res.json(rows.map(r => ({
      id: r.id,
      customerId: r.customer_id,
      name: r.name,
      phone: r.phone,
      email: r.email,
      subject: r.subject,
      message: r.message,
      source: r.source,
      status: r.status,
      createdAt: r.created_at,
    })));
  }

  if (req.method === 'POST') {
    const { id, customerId, name, phone, email, subject, message, source, status, createdAt } = req.body;
    const inqId = id || Math.random().toString(36).substr(2, 9);
    await sql`INSERT INTO inquiries (id, customer_id, name, phone, email, subject, message, source, status, created_at)
              VALUES (${inqId}, ${customerId || null}, ${name}, ${phone || ''}, ${email || null}, ${subject || ''}, ${message || ''}, ${source || 'manual'}, ${status || 'new'}, ${createdAt || new Date().toISOString()})
              ON CONFLICT (id) DO UPDATE SET customer_id = EXCLUDED.customer_id, name = EXCLUDED.name, phone = EXCLUDED.phone, email = EXCLUDED.email, subject = EXCLUDED.subject, message = EXCLUDED.message, source = EXCLUDED.source, status = EXCLUDED.status`;
    return res.json({ ok: true, id: inqId });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
