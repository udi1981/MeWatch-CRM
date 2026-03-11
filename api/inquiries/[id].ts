import type { VercelRequest, VercelResponse } from '@vercel/node';
import { neon } from '@neondatabase/serverless';
const sql = neon(process.env.DATABASE_URL!);
import { verifyAuth } from '../auth/me';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const user = await verifyAuth(req);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });

  const { id } = req.query;
  if (!id || typeof id !== 'string') return res.status(400).json({ error: 'ID required' });

  if (req.method === 'PUT') {
    const { status } = req.body;
    if (status) await sql`UPDATE inquiries SET status = ${status} WHERE id = ${id}`;
    return res.json({ ok: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
