import type { VercelRequest, VercelResponse } from '@vercel/node';
import { jwtVerify } from 'jose';
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
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { prompt, systemInstruction, model, type } = req.body;
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'Gemini API key not configured' });

  try {
    // Default model per type
    let modelName = model;
    if (!modelName) {
      if (type === 'extract') modelName = 'gemini-2.0-flash';
      else modelName = 'gemini-2.5-flash';
    }

    const generationConfig: any = {};
    if (type === 'smart-filter') {
      generationConfig.responseMimeType = 'application/json';
    }

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        systemInstruction: systemInstruction ? { parts: [{ text: systemInstruction }] } : undefined,
        ...(Object.keys(generationConfig).length > 0 ? { generationConfig } : {}),
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return res.status(response.status).json({ error: errorText });
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    return res.json({ text });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
}
