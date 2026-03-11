import type { VercelRequest, VercelResponse } from '@vercel/node';
import { neon } from '@neondatabase/serverless';
const sql = neon(process.env.DATABASE_URL!);
import { SignJWT } from 'jose';
import { scryptSync, timingSafeEqual } from 'crypto';

const secret = new TextEncoder().encode(process.env.JWT_SECRET || 'dev-secret-change-me');

function verifyPassword(password: string, storedHash: string): boolean {
  const [salt, hash] = storedHash.split(':');
  const derived = scryptSync(password, salt, 64).toString('hex');
  return timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(derived, 'hex'));
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { email: rawEmail, password } = req.body || {};
  if (!rawEmail) return res.status(400).json({ error: 'Email required' });
  if (!password) return res.status(400).json({ error: 'Password required' });
  const email = rawEmail.trim().toLowerCase();

  const rows = await sql`SELECT * FROM users WHERE LOWER(email) = ${email}`;
  if (rows.length === 0) return res.status(401).json({ error: 'אימייל או סיסמה שגויים' });

  const user = rows[0];
  if (!user.password_hash || !verifyPassword(password, user.password_hash)) {
    return res.status(401).json({ error: 'אימייל או סיסמה שגויים' });
  }

  const token = await new SignJWT({ userId: user.id, email: user.email, role: user.role })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('30d')
    .sign(secret);

  res.setHeader('Set-Cookie', `token=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${30 * 24 * 60 * 60}${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`);
  return res.json({ ok: true, user: { id: user.id, email: user.email, name: user.name, role: user.role } });
}
