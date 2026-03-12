
import React, { useState, useEffect, useMemo } from 'react';
import { Campaign, Lead } from '../types';
import api from '../lib/api';

interface MarketingViewProps {
  leads: Lead[];
}

type EditorStep = 'audience' | 'content' | 'review';
type AudienceFilter = { status: string; plan: string; hasEmail: boolean };

const MarketingView: React.FC<MarketingViewProps> = ({ leads }) => {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEditor, setShowEditor] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<Partial<Campaign> | null>(null);
  const [step, setStep] = useState<EditorStep>('audience');

  // Editor state
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('');
  const [contentHtml, setContentHtml] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [couponCode, setCouponCode] = useState('');
  const [couponExpiry, setCouponExpiry] = useState('');
  const [ctaText, setCtaText] = useState('');
  const [ctaUrl, setCtaUrl] = useState('');
  const [channel, setChannel] = useState<'email' | 'whatsapp' | 'sms'>('email');
  const [audienceFilter, setAudienceFilter] = useState<AudienceFilter>({ status: 'all', plan: 'all', hasEmail: true });
  const [sending, setSending] = useState(false);
  const [testSent, setTestSent] = useState(false);
  const [testEmail, setTestEmail] = useState('udi1981@gmail.com');
  const [showPreview, setShowPreview] = useState(false);
  const [previewHtml, setPreviewHtml] = useState('');

  useEffect(() => {
    api.getCampaigns().then(setCampaigns).catch(() => {}).finally(() => setLoading(false));
  }, []);

  // Compute recipients based on filter
  const recipients = useMemo(() => {
    return leads.filter(l => {
      if (audienceFilter.hasEmail && !l.email) return false;
      if (audienceFilter.status !== 'all') {
        const wixStatus = String(l.dynamicData?.wixStatus || '');
        const reason = String(l.dynamicData?.cancellationReason || '');
        if (audienceFilter.status === 'active' && wixStatus !== 'ACTIVE') return false;
        if (audienceFilter.status === 'canceled' && !reason.includes('בוטל')) return false;
        if (audienceFilter.status === 'payment_failed' && reason !== 'תשלום נכשל') return false;
      }
      if (audienceFilter.plan !== 'all') {
        const planName = String(l.dynamicData?.planName || '');
        if (planName !== audienceFilter.plan) return false;
      }
      return true;
    });
  }, [leads, audienceFilter]);

  const recipientEmails = useMemo(() =>
    [...new Set(recipients.filter(l => l.email).map(l => l.email!))],
    [recipients]
  );

  // Available plans for filter
  const plans = useMemo(() => {
    const set = new Set<string>();
    leads.forEach(l => { const p = String(l.dynamicData?.planName || ''); if (p) set.add(p); });
    return Array.from(set).sort();
  }, [leads]);

  const openEditor = (campaign?: Campaign) => {
    if (campaign) {
      setEditingCampaign(campaign);
      setTitle(campaign.title);
      setSubject(campaign.subject);
      setContentHtml(campaign.content_html);
      setImageUrl(campaign.image_url || '');
      setCouponCode(campaign.coupon_code || '');
      setCouponExpiry(campaign.coupon_expiry || '');
      setCtaText(campaign.cta_text || '');
      setCtaUrl(campaign.cta_url || '');
      setChannel(campaign.channel);
      if (campaign.recipient_filter) setAudienceFilter(campaign.recipient_filter as AudienceFilter);
    } else {
      setEditingCampaign(null);
      setTitle(''); setSubject(''); setContentHtml(''); setImageUrl('');
      setCouponCode(''); setCouponExpiry(''); setCtaText(''); setCtaUrl('');
      setChannel('email');
      setAudienceFilter({ status: 'all', plan: 'all', hasEmail: true });
    }
    setStep('audience');
    setTestSent(false);
    setShowEditor(true);
  };

  const saveDraft = async () => {
    const data = {
      id: editingCampaign?.id,
      title: title || subject || 'קמפיין חדש',
      subject, content_html: contentHtml, image_url: imageUrl,
      coupon_code: couponCode, coupon_expiry: couponExpiry || null,
      cta_text: ctaText, cta_url: ctaUrl, channel,
      recipient_filter: audienceFilter, recipient_count: recipientEmails.length,
    };
    const result = await api.saveCampaign(data);
    setEditingCampaign({ ...editingCampaign, id: result.id });
    api.getCampaigns().then(setCampaigns).catch(() => {});
  };

  const sendTest = async () => {
    if (!testEmail) { alert('הזן כתובת אימייל לבדיקה'); return; }
    setTestSent(false);
    try {
      await api.sendTestCampaign({
        subject, contentHtml, imageUrl, couponCode, couponExpiry, ctaText, ctaUrl,
        previewEmail: testEmail,
      });
      setTestSent(true);
    } catch (err: any) {
      alert('שגיאה בשליחת בדיקה: ' + err.message);
    }
  };

  const loadPreview = async () => {
    try {
      const result = await api.getEmailPreview({ subject, contentHtml, imageUrl, couponCode, couponExpiry, ctaText, ctaUrl });
      setPreviewHtml(result.html);
      setShowPreview(true);
    } catch (err: any) {
      alert('שגיאה בטעינת תצוגה מקדימה: ' + err.message);
    }
  };

  const sendCampaign = async () => {
    if (recipientEmails.length === 0) { alert('אין נמענים עם אימייל'); return; }
    if (!confirm(`לשלוח ל-${recipientEmails.length} נמענים?`)) return;
    setSending(true);
    try {
      await saveDraft();
      const result = await api.sendCampaign({
        campaignId: editingCampaign?.id,
        subject, contentHtml, imageUrl, couponCode, couponExpiry, ctaText, ctaUrl,
        recipients: recipientEmails,
      });
      const skipped = result.skippedUnsubscribed || 0;
      const skippedMsg = skipped > 0 ? `\n(${skipped} הוסרו אוטומטית — ביקשו הסרה מדיוור)` : '';
      alert(`נשלח בהצלחה! ${result.sentCount}/${result.filteredRecipients || result.totalRecipients} מיילים${skippedMsg}`);
      setShowEditor(false);
      api.getCampaigns().then(setCampaigns).catch(() => {});
    } catch (err: any) {
      alert('שגיאה: ' + err.message);
    } finally {
      setSending(false);
    }
  };

  // ═══════════════════════════════════════════
  //  CAMPAIGN EDITOR
  // ═══════════════════════════════════════════
  if (showEditor) {
    return (
      <div className="space-y-4 animate-in fade-in duration-300">
        {/* Editor Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => setShowEditor(false)} className="p-2 hover:bg-gray-100 rounded-xl">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
            </button>
            <h2 className="text-xl font-bold text-gray-800">{editingCampaign?.id ? 'עריכת קמפיין' : 'קמפיין חדש'}</h2>
          </div>
          <button onClick={saveDraft} className="text-sm text-blue-600 hover:bg-blue-50 px-3 py-1.5 rounded-lg font-medium">שמור טיוטה</button>
        </div>

        {/* Steps indicator */}
        <div className="flex bg-white rounded-xl border border-gray-200 overflow-hidden">
          {(['audience', 'content', 'review'] as EditorStep[]).map((s, i) => (
            <button
              key={s}
              onClick={() => setStep(s)}
              className={`flex-1 py-3 text-sm font-bold transition-colors ${step === s ? 'bg-blue-600 text-white' : 'text-gray-500 hover:bg-gray-50'}`}
            >
              {i + 1}. {s === 'audience' ? 'קהל יעד' : s === 'content' ? 'תוכן' : 'שלח'}
            </button>
          ))}
        </div>

        {/* Channel tabs */}
        <div className="flex gap-2">
          <button onClick={() => setChannel('email')} className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold transition-all ${channel === 'email' ? 'bg-blue-600 text-white shadow-lg' : 'bg-white text-gray-600 border border-gray-200'}`}>
            <MailIcon /> אימייל
          </button>
          <button className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium bg-gray-100 text-gray-400 border border-gray-200 cursor-not-allowed relative">
            <WhatsAppSmallIcon /> WhatsApp
            <span className="absolute -top-1.5 -left-1.5 text-[8px] bg-orange-400 text-white px-1.5 py-0.5 rounded-full font-bold">בקרוב</span>
          </button>
          <button className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium bg-gray-100 text-gray-400 border border-gray-200 cursor-not-allowed relative">
            <SmsIcon /> SMS
            <span className="absolute -top-1.5 -left-1.5 text-[8px] bg-orange-400 text-white px-1.5 py-0.5 rounded-full font-bold">בקרוב</span>
          </button>
        </div>

        {/* Step 1: Audience */}
        {step === 'audience' && (
          <div className="bg-white p-6 rounded-2xl border border-gray-200 space-y-4">
            <h3 className="text-lg font-bold text-gray-800">בחר קהל יעד</h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">סטטוס</label>
                <select value={audienceFilter.status} onChange={e => setAudienceFilter(p => ({ ...p, status: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm">
                  <option value="all">כולם</option>
                  <option value="active">פעילים</option>
                  <option value="canceled">ביטלו</option>
                  <option value="payment_failed">תשלום נכשל</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">מנוי</label>
                <select value={audienceFilter.plan} onChange={e => setAudienceFilter(p => ({ ...p, plan: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm">
                  <option value="all">כל המנויים</option>
                  {plans.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div className="flex items-end">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={audienceFilter.hasEmail} onChange={e => setAudienceFilter(p => ({ ...p, hasEmail: e.target.checked }))} className="rounded" />
                  <span className="text-sm text-gray-700">רק עם אימייל</span>
                </label>
              </div>
            </div>

            {/* Recipient preview */}
            <div className="bg-blue-50 rounded-xl p-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-blue-800">{recipientEmails.length} נמענים עם אימייל</p>
                <p className="text-xs text-blue-600 mt-0.5">{recipients.length} לקוחות תואמים (מתוך {leads.length})</p>
              </div>
              <div className="text-3xl font-black text-blue-600">{recipientEmails.length}</div>
            </div>

            <div className="flex justify-end">
              <button onClick={() => setStep('content')} className="bg-blue-600 text-white px-6 py-2.5 rounded-xl font-bold hover:bg-blue-700">
                המשך לתוכן ←
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Content */}
        {step === 'content' && (
          <div className="bg-white p-6 rounded-2xl border border-gray-200 space-y-4">
            <h3 className="text-lg font-bold text-gray-800">תוכן הקמפיין</h3>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">כותרת פנימית (לא נשלחת)</label>
              <input value={title} onChange={e => setTitle(e.target.value)} placeholder="שם הקמפיין..."
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">שורת נושא (Subject)</label>
              <input value={subject} onChange={e => setSubject(e.target.value)} placeholder="נושא המייל..."
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">תוכן ההודעה</label>
              <textarea value={contentHtml} onChange={e => setContentHtml(e.target.value)}
                placeholder="כתוב כאן את תוכן המייל... (תומך HTML)"
                rows={6}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">קישור לתמונה (URL)</label>
              <input value={imageUrl} onChange={e => setImageUrl(e.target.value)} placeholder="https://..."
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
              {imageUrl && <img src={imageUrl} alt="preview" className="mt-2 max-h-40 rounded-xl object-cover" onError={e => (e.target as HTMLImageElement).style.display = 'none'} />}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">🎁 קוד קופון</label>
                <input value={couponCode} onChange={e => setCouponCode(e.target.value)} placeholder="SUMMER2026"
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none font-mono" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">תוקף קופון</label>
                <input type="date" value={couponExpiry} onChange={e => setCouponExpiry(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">טקסט כפתור (CTA)</label>
                <input value={ctaText} onChange={e => setCtaText(e.target.value)} placeholder="לרכישה →"
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">קישור כפתור</label>
                <input value={ctaUrl} onChange={e => setCtaUrl(e.target.value)} placeholder="https://mewatch.co.il/plans"
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>
            </div>

            <div className="flex justify-between">
              <button onClick={() => setStep('audience')} className="text-gray-600 hover:bg-gray-100 px-4 py-2 rounded-xl text-sm font-medium">
                → חזור לקהל
              </button>
              <button onClick={() => setStep('review')} disabled={!subject.trim() || !contentHtml.trim()}
                className="bg-blue-600 text-white px-6 py-2.5 rounded-xl font-bold hover:bg-blue-700 disabled:opacity-50">
                המשך לשליחה ←
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Review & Send */}
        {step === 'review' && (
          <div className="space-y-4">
            {/* Summary */}
            <div className="bg-white p-6 rounded-2xl border border-gray-200">
              <h3 className="text-lg font-bold text-gray-800 mb-4">סיכום קמפיין</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><span className="text-gray-400">כותרת:</span> <span className="font-bold text-gray-800">{title || subject}</span></div>
                <div><span className="text-gray-400">נושא:</span> <span className="font-bold text-gray-800">{subject}</span></div>
                <div><span className="text-gray-400">ערוץ:</span> <span className="font-bold text-gray-800">{channel === 'email' ? 'אימייל' : channel}</span></div>
                <div><span className="text-gray-400">נמענים:</span> <span className="font-bold text-blue-600">{recipientEmails.length}</span></div>
                {couponCode && <div><span className="text-gray-400">קופון:</span> <span className="font-bold font-mono text-amber-700">{couponCode}</span></div>}
                {ctaText && <div><span className="text-gray-400">כפתור:</span> <span className="font-bold text-gray-800">{ctaText}</span></div>}
              </div>
            </div>

            {/* Email preview */}
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
              <div className="bg-gray-50 px-4 py-2 border-b border-gray-200 flex items-center gap-2">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-400"></div>
                  <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
                  <div className="w-3 h-3 rounded-full bg-green-400"></div>
                </div>
                <span className="text-xs text-gray-500 mr-2">תצוגה מקדימה</span>
              </div>
              <div className="p-4 max-h-80 overflow-y-auto">
                <div dir="rtl" style={{ fontFamily: 'sans-serif', maxWidth: 500, margin: '0 auto' }}>
                  <div style={{ background: 'linear-gradient(135deg, #1e40af, #7c3aed)', padding: 16, textAlign: 'center', borderRadius: '12px 12px 0 0' }}>
                    <h1 style={{ color: '#fff', fontSize: 18, margin: 0 }}>{subject || 'נושא המייל'}</h1>
                  </div>
                  {imageUrl && <img src={imageUrl} alt="" style={{ width: '100%', maxHeight: 200, objectFit: 'cover' }} />}
                  <div style={{ padding: 20, fontSize: 14, lineHeight: '1.7', color: '#374151' }}>
                    <p style={{ whiteSpace: 'pre-wrap' }}>{contentHtml || 'תוכן ההודעה יופיע כאן...'}</p>
                  </div>
                  {couponCode && (
                    <div style={{ margin: '0 20px', background: '#fef3c7', border: '2px dashed #f59e0b', borderRadius: 12, padding: 16, textAlign: 'center' }}>
                      <div style={{ fontSize: 12, color: '#92400e' }}>🎁 קוד קופון מיוחד</div>
                      <div style={{ fontSize: 24, fontWeight: 900, color: '#92400e', letterSpacing: 3 }}>{couponCode}</div>
                      {couponExpiry && <div style={{ fontSize: 11, color: '#a16207', marginTop: 4 }}>בתוקף עד {couponExpiry}</div>}
                    </div>
                  )}
                  {ctaText && ctaUrl && (
                    <div style={{ textAlign: 'center', padding: '16px 20px' }}>
                      <span style={{ display: 'inline-block', background: 'linear-gradient(135deg, #2563eb, #7c3aed)', color: '#fff', padding: '12px 32px', borderRadius: 12, fontSize: 16, fontWeight: 700 }}>{ctaText}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Test Campaign Section — Prominent */}
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 space-y-3">
              <h4 className="text-sm font-bold text-amber-800 flex items-center gap-2">
                📧 שליחת בדיקה לפני שליחה המונית
              </h4>
              <div className="flex gap-2">
                <input
                  value={testEmail}
                  onChange={e => setTestEmail(e.target.value)}
                  placeholder="כתובת אימייל לבדיקה..."
                  type="email"
                  className="flex-1 px-4 py-2.5 border border-amber-300 rounded-xl text-sm focus:ring-2 focus:ring-amber-500 outline-none bg-white"
                />
                <button onClick={sendTest}
                  className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${testSent ? 'bg-green-500 text-white' : 'bg-amber-600 text-white hover:bg-amber-700'}`}>
                  {testSent ? '✓ נשלח!' : '📧 שלח בדיקה'}
                </button>
              </div>
              <button onClick={loadPreview} className="text-xs text-amber-700 hover:underline">
                👁️ תצוגה מקדימה של ה-HTML המלא (כמו שהלקוח יראה)
              </button>
              <p className="text-[11px] text-amber-600">* לקוחות שביקשו הסרה מדיוור יסוננו אוטומטית בשליחה</p>
            </div>

            {/* Full HTML Preview Modal */}
            {showPreview && (
              <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setShowPreview(false)}>
                <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden" onClick={e => e.stopPropagation()}>
                  <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-50">
                    <span className="text-sm font-bold text-gray-700">תצוגה מקדימה — HTML מלא</span>
                    <button onClick={() => setShowPreview(false)} className="p-1 hover:bg-gray-200 rounded text-gray-500">✕</button>
                  </div>
                  <iframe srcDoc={previewHtml} className="w-full h-[70vh] border-0" title="Email Preview" />
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3">
              <button onClick={() => setStep('content')} className="flex-1 py-3 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50">
                → חזור לעריכה
              </button>
              <button onClick={sendCampaign} disabled={sending || recipientEmails.length === 0}
                className="flex-[2] py-3 px-6 rounded-xl bg-gradient-to-l from-blue-600 to-purple-600 text-white text-sm font-bold hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 shadow-lg">
                {sending ? '⏳ שולח...' : `🚀 שלח ל-${recipientEmails.length} נמענים`}
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ═══════════════════════════════════════════
  //  CAMPAIGN LIST
  // ═══════════════════════════════════════════
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black text-gray-800">שיווק</h2>
          <p className="text-sm text-gray-500 mt-1">ניהול קמפיינים ודיוורים</p>
        </div>
        <button onClick={() => openEditor()} className="bg-gradient-to-l from-blue-600 to-purple-600 text-white px-5 py-2.5 rounded-xl font-bold hover:from-blue-700 hover:to-purple-700 shadow-lg flex items-center gap-2">
          <PlusIcon /> קמפיין חדש
        </button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
          <p className="text-xs text-gray-400">סה"כ קמפיינים</p>
          <p className="text-2xl font-black text-gray-800">{campaigns.length}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
          <p className="text-xs text-gray-400">נשלחו</p>
          <p className="text-2xl font-black text-green-600">{campaigns.filter(c => c.status === 'sent').length}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
          <p className="text-xs text-gray-400">טיוטות</p>
          <p className="text-2xl font-black text-orange-500">{campaigns.filter(c => c.status === 'draft').length}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
          <p className="text-xs text-gray-400">סה"כ מיילים</p>
          <p className="text-2xl font-black text-blue-600">{campaigns.reduce((sum, c) => sum + (c.sent_count || 0), 0)}</p>
        </div>
      </div>

      {/* Campaign list */}
      {loading ? (
        <div className="text-center py-12 text-gray-400">טוען קמפיינים...</div>
      ) : campaigns.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
          <div className="w-20 h-20 bg-purple-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <MailIcon className="w-10 h-10 text-purple-500" />
          </div>
          <h3 className="text-lg font-bold text-gray-700 mb-2">אין קמפיינים עדיין</h3>
          <p className="text-sm text-gray-400 mb-6">צור קמפיין ראשון ושלח לנמענים</p>
          <button onClick={() => openEditor()} className="bg-blue-600 text-white px-6 py-2.5 rounded-xl font-bold hover:bg-blue-700">
            צור קמפיין ראשון
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {campaigns.map(c => (
            <div key={c.id} className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow cursor-pointer flex items-center gap-4"
              onClick={() => openEditor(c)}>
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
                c.status === 'sent' ? 'bg-green-100 text-green-600' :
                c.status === 'sending' ? 'bg-blue-100 text-blue-600' :
                'bg-gray-100 text-gray-500'
              }`}>
                {c.status === 'sent' ? <CheckCircleIcon /> : c.status === 'sending' ? <LoadingIcon /> : <DraftIcon />}
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-bold text-gray-800 truncate">{c.title || c.subject || 'ללא כותרת'}</h4>
                <p className="text-xs text-gray-400 mt-0.5">
                  {c.status === 'sent' ? `נשלח ל-${c.sent_count} נמענים` : c.status === 'sending' ? 'שולח...' : 'טיוטה'}
                  {c.sent_at ? ` · ${new Date(c.sent_at).toLocaleDateString('he-IL')}` : ` · ${new Date(c.created_at).toLocaleDateString('he-IL')}`}
                </p>
              </div>
              <div className="shrink-0 flex items-center gap-2">
                <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${
                  c.status === 'sent' ? 'bg-green-100 text-green-700' :
                  c.status === 'sending' ? 'bg-blue-100 text-blue-700' :
                  'bg-gray-100 text-gray-600'
                }`}>
                  {c.status === 'sent' ? 'נשלח' : c.status === 'sending' ? 'שולח' : 'טיוטה'}
                </span>
                {c.channel !== 'email' && (
                  <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-orange-100 text-orange-700">{c.channel}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ─── Icons ───
const PlusIcon = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>;
const MailIcon = ({ className }: { className?: string }) => <svg className={className || "w-4 h-4"} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>;
const WhatsAppSmallIcon = () => <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91C21.95 6.45 17.5 2 12.04 2zm0 18.15c-1.48 0-2.93-.4-4.2-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.264 8.264 0 01-1.26-4.38c0-4.54 3.7-8.24 8.24-8.24 2.2 0 4.27.86 5.82 2.42a8.183 8.183 0 012.41 5.83c.01 4.54-3.68 8.23-8.22 8.23z" /></svg>;
const SmsIcon = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>;
const CheckCircleIcon = () => <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
const LoadingIcon = () => <svg className="w-6 h-6 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>;
const DraftIcon = () => <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>;

export default MarketingView;
