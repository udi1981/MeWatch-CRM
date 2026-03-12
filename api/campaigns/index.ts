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
    const rows = await sql`SELECT * FROM campaigns ORDER BY created_at DESC`;
    return res.json(rows);
  }

  if (req.method === 'POST') {
    const { id, title, subject, content_html, image_url, coupon_code, coupon_expiry, cta_text, cta_url, channel, recipient_filter, recipient_count } = req.body;
    const campaignId = id || `camp_${Date.now()}`;
    await sql`
      INSERT INTO campaigns (id, title, subject, content_html, image_url, coupon_code, coupon_expiry, cta_text, cta_url, channel, recipient_filter, recipient_count)
      VALUES (${campaignId}, ${title || ''}, ${subject || ''}, ${content_html || ''}, ${image_url || null}, ${coupon_code || null}, ${coupon_expiry || null}, ${cta_text || null}, ${cta_url || null}, ${channel || 'email'}, ${JSON.stringify(recipient_filter || {})}, ${recipient_count || 0})
      ON CONFLICT (id) DO UPDATE SET
        title = EXCLUDED.title, subject = EXCLUDED.subject, content_html = EXCLUDED.content_html,
        image_url = EXCLUDED.image_url, coupon_code = EXCLUDED.coupon_code, coupon_expiry = EXCLUDED.coupon_expiry,
        cta_text = EXCLUDED.cta_text, cta_url = EXCLUDED.cta_url, channel = EXCLUDED.channel,
        recipient_filter = EXCLUDED.recipient_filter, recipient_count = EXCLUDED.recipient_count
    `;
    return res.json({ ok: true, id: campaignId });
  }

  if (req.method === 'DELETE') {
    const { id } = req.body;
    if (!id) return res.status(400).json({ error: 'id required' });
    await sql`DELETE FROM campaigns WHERE id = ${id}`;
    return res.json({ ok: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
