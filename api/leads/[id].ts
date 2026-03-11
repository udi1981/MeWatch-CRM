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

  const { id } = req.query;
  if (!id || typeof id !== 'string') return res.status(400).json({ error: 'ID required' });

  if (req.method === 'PUT') {
    const { statusId, reminderAt, notes, dynamicData, customerId } = req.body;
    const updates: string[] = [];
    if (statusId !== undefined) await sql`UPDATE leads SET status_id = ${statusId} WHERE id = ${id}`;
    if (reminderAt !== undefined) await sql`UPDATE leads SET reminder_at = ${reminderAt || null} WHERE id = ${id}`;
    if (notes !== undefined) await sql`UPDATE leads SET notes = ${JSON.stringify(notes)} WHERE id = ${id}`;
    if (dynamicData !== undefined) await sql`UPDATE leads SET dynamic_data = ${JSON.stringify(dynamicData)} WHERE id = ${id}`;
    if (customerId !== undefined) await sql`UPDATE leads SET customer_id = ${customerId} WHERE id = ${id}`;
    return res.json({ ok: true });
  }

  if (req.method === 'DELETE') {
    await sql`DELETE FROM leads WHERE id = ${id}`;
    return res.json({ ok: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
