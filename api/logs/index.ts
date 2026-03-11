import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from '../db';
import { verifyAuth } from '../auth/me';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const user = await verifyAuth(req);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });

  if (req.method === 'GET') {
    const rows = await sql`SELECT * FROM logs ORDER BY timestamp DESC LIMIT 100`;
    return res.json(rows.map(r => ({
      id: r.id,
      timestamp: r.timestamp,
      level: r.level,
      message: r.message,
      details: r.details,
    })));
  }

  if (req.method === 'POST') {
    const { level, message, details } = req.body;
    await sql`INSERT INTO logs (level, message, details) VALUES (${level}, ${message}, ${details || null})`;
    return res.json({ ok: true });
  }

  if (req.method === 'DELETE') {
    await sql`DELETE FROM logs`;
    return res.json({ ok: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
