import type { VercelRequest, VercelResponse } from '@vercel/node';
import { neon } from '@neondatabase/serverless';
import { SignJWT, jwtVerify } from 'jose';
import { scryptSync, timingSafeEqual } from 'crypto';

const sql = neon(process.env.DATABASE_URL!);
const secret = new TextEncoder().encode(process.env.JWT_SECRET || 'dev-secret-change-me');

function verifyPassword(password: string, storedHash: string): boolean {
  const [salt, hash] = storedHash.split(':');
  const derived = scryptSync(password, salt, 64).toString('hex');
  return timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(derived, 'hex'));
}

export async function verifyAuth(req: VercelRequest): Promise<{ userId: string; email: string; role: string } | null> {
  const cookie = req.headers.cookie || '';
  const match = cookie.match(/token=([^;]+)/);
  if (!match) return null;
  try {
    const { payload } = await jwtVerify(match[1], secret);
    return payload as any;
  } catch {
    return null;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // GET /api/auth → check current user (was /api/auth/me)
  if (req.method === 'GET') {
    const user = await verifyAuth(req);
    if (!user) return res.status(401).json({ error: 'Not authenticated' });
    return res.json({ ok: true, user });
  }

  // POST /api/auth → login (was /api/auth/login)
  if (req.method === 'POST') {
    const { email: rawEmail, password, rememberMe } = req.body || {};
    if (!rawEmail) return res.status(400).json({ error: 'Email required' });
    if (!password) return res.status(400).json({ error: 'Password required' });
    const email = rawEmail.trim().toLowerCase();

    const rows = await sql`SELECT * FROM users WHERE LOWER(email) = ${email}`;
    if (rows.length === 0) return res.status(401).json({ error: 'אימייל או סיסמה שגויים' });

    const user = rows[0];
    if (!user.password_hash || !verifyPassword(password, user.password_hash)) {
      return res.status(401).json({ error: 'אימייל או סיסמה שגויים' });
    }

    const expiry = rememberMe ? '30d' : '24h';
    const maxAge = rememberMe ? 30 * 24 * 60 * 60 : 24 * 60 * 60;

    const token = await new SignJWT({ userId: user.id, email: user.email, role: user.role })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime(expiry)
      .sign(secret);

    res.setHeader('Set-Cookie', `token=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`);
    return res.json({ ok: true, user: { id: user.id, email: user.email, name: user.name, role: user.role } });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
