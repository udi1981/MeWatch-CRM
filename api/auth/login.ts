import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from '../db';
import { SignJWT } from 'jose';

const secret = new TextEncoder().encode(process.env.JWT_SECRET || 'dev-secret-change-me');

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email required' });

  const rows = await sql`SELECT * FROM users WHERE email = ${email}`;
  if (rows.length === 0) return res.status(401).json({ error: 'User not found' });

  const user = rows[0];
  const token = await new SignJWT({ userId: user.id, email: user.email, role: user.role })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('30d')
    .sign(secret);

  res.setHeader('Set-Cookie', `token=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${30 * 24 * 60 * 60}${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`);
  return res.json({ ok: true, user: { id: user.id, email: user.email, name: user.name, role: user.role } });
}
