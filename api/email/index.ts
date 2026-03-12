import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Resend } from 'resend';
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

function buildEmailHTML(options: {
  subject: string;
  contentHtml: string;
  imageUrl?: string;
  couponCode?: string;
  couponExpiry?: string;
  ctaText?: string;
  ctaUrl?: string;
}): string {
  const { subject, contentHtml, imageUrl, couponCode, couponExpiry, ctaText, ctaUrl } = options;
  return `<!DOCTYPE html>
<html dir="rtl" lang="he">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  body { margin:0; padding:0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f4f4f5; direction: rtl; }
  .container { max-width: 600px; margin: 0 auto; background: #fff; }
  .header { background: linear-gradient(135deg, #1e40af, #7c3aed); padding: 24px; text-align: center; }
  .header h1 { color: #fff; font-size: 20px; margin: 12px 0 0; }
  .hero-img { width: 100%; max-height: 300px; object-fit: cover; }
  .content { padding: 32px 24px; font-size: 16px; line-height: 1.7; color: #374151; }
  .coupon-box { background: linear-gradient(135deg, #fef3c7, #fde68a); border: 2px dashed #f59e0b; border-radius: 12px; padding: 20px; text-align: center; margin: 24px 0; }
  .coupon-code { font-size: 28px; font-weight: 900; color: #92400e; letter-spacing: 3px; }
  .coupon-expiry { font-size: 13px; color: #a16207; margin-top: 8px; }
  .cta-btn { display: inline-block; background: linear-gradient(135deg, #2563eb, #7c3aed); color: #fff !important; text-decoration: none; padding: 14px 40px; border-radius: 12px; font-size: 18px; font-weight: 700; margin: 24px 0; }
  .footer { background: #f9fafb; padding: 20px; text-align: center; font-size: 12px; color: #9ca3af; border-top: 1px solid #e5e7eb; }
</style>
</head>
<body>
<div class="container">
  <div class="header">
    <h1>${subject}</h1>
  </div>
  ${imageUrl ? `<img src="${imageUrl}" alt="" class="hero-img">` : ''}
  <div class="content">
    ${contentHtml}
  </div>
  ${couponCode ? `
  <div style="padding: 0 24px;">
    <div class="coupon-box">
      <div style="font-size: 14px; color: #92400e; margin-bottom: 8px;">🎁 קוד קופון מיוחד</div>
      <div class="coupon-code">${couponCode}</div>
      ${couponExpiry ? `<div class="coupon-expiry">בתוקף עד ${couponExpiry}</div>` : ''}
    </div>
  </div>` : ''}
  ${ctaText && ctaUrl ? `
  <div style="text-align: center; padding: 0 24px 32px;">
    <a href="${ctaUrl}" class="cta-btn">${ctaText}</a>
  </div>` : ''}
  <div class="footer">
    <p>MeWatch — מערכת ניהול מנויים</p>
    <p style="margin-top: 8px;">לביטול קבלת הודעות, <a href="mailto:mewatch.office@gmail.com?subject=הסרה מרשימת דיוור" style="color: #6b7280;">לחצו כאן</a></p>
  </div>
</div>
</body>
</html>`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const user = await verifyAuth(req);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'RESEND_API_KEY not configured' });

  const resend = new Resend(apiKey);
  const fromEmail = process.env.RESEND_FROM_EMAIL || 'noreply@mewatch.co.il';

  // Determine action: "campaign" for bulk/test campaign, default for single email
  const { action } = req.body;

  // ============ CAMPAIGN MODE ============
  if (action === 'campaign') {
    const { campaignId, subject, contentHtml, imageUrl, couponCode, couponExpiry, ctaText, ctaUrl, recipients, testEmail } = req.body;
    if (!subject || !contentHtml) return res.status(400).json({ error: 'subject and contentHtml required' });

    const html = buildEmailHTML({ subject, contentHtml, imageUrl, couponCode, couponExpiry, ctaText, ctaUrl });

    // Test mode
    if (testEmail) {
      try {
        const { data, error } = await resend.emails.send({
          from: `MeWatch <${fromEmail}>`,
          to: [testEmail],
          subject: `[בדיקה] ${subject}`,
          html,
        });
        if (error) return res.status(400).json({ error: error.message });
        return res.json({ ok: true, testSent: true, id: data?.id });
      } catch (error: any) {
        return res.status(500).json({ error: error.message });
      }
    }

    // Bulk send
    if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
      return res.status(400).json({ error: 'recipients array required for bulk send' });
    }

    try {
      if (campaignId) {
        await sql`UPDATE campaigns SET status = 'sending', recipient_count = ${recipients.length} WHERE id = ${campaignId}`;
      }

      let sentCount = 0;
      const errors: string[] = [];
      const batchSize = 50;

      for (let i = 0; i < recipients.length; i += batchSize) {
        const batch = recipients.slice(i, i + batchSize);
        const promises = batch.map(async (email: string) => {
          try {
            await resend.emails.send({ from: `MeWatch <${fromEmail}>`, to: [email], subject, html });
            sentCount++;
          } catch (err: any) {
            errors.push(`${email}: ${err.message}`);
          }
        });
        await Promise.all(promises);
        if (i + batchSize < recipients.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      if (campaignId) {
        await sql`UPDATE campaigns SET status = 'sent', sent_count = ${sentCount}, sent_at = NOW() WHERE id = ${campaignId}`;
      }

      await sql`INSERT INTO logs (level, message, details) VALUES ('info', ${'Campaign sent: ' + sentCount + '/' + recipients.length + ' emails'}, ${campaignId || 'no-id'})`;

      return res.json({ ok: true, sentCount, totalRecipients: recipients.length, errors: errors.length > 0 ? errors.slice(0, 10) : undefined });
    } catch (error: any) {
      if (campaignId) {
        await sql`UPDATE campaigns SET status = 'draft' WHERE id = ${campaignId}`.catch(() => {});
      }
      return res.status(500).json({ error: error.message });
    }
  }

  // ============ SINGLE EMAIL MODE ============
  const { to, subject, html, text } = req.body;
  if (!to || !subject) return res.status(400).json({ error: 'to and subject required' });

  try {
    const { data, error } = await resend.emails.send({
      from: `MeWatch <${fromEmail}>`,
      to: Array.isArray(to) ? to : [to],
      subject,
      html: html || undefined,
      text: text || undefined,
    });

    if (error) return res.status(400).json({ error: error.message });

    await sql`INSERT INTO logs (level, message, details) VALUES ('info', ${'Email sent to ' + (Array.isArray(to) ? to.join(', ') : to)}, ${subject})`;

    return res.json({ ok: true, id: data?.id });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
}
