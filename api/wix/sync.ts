import type { VercelRequest, VercelResponse } from '@vercel/node';
import { neon } from '@neondatabase/serverless';
const sql = neon(process.env.DATABASE_URL!);
import { verifyAuth } from '../auth/me';

const WIX_HEADERS = {
  'Content-Type': 'application/json',
  'Wix-Site-Id': process.env.WIX_SITE_ID || '',
  'Authorization': process.env.WIX_AUTH_TOKEN || '',
};
const WIX_BASE = 'https://www.wixapis.com';

function mapCancellationReason(order: any): string {
  const cause = (order.cancellation?.cause || '').toString();
  const status = order.status || '';
  if (cause === 'MEMBER_ACTION' || cause.includes('member')) return 'בוטל ע"י הלקוח';
  if (cause === 'OWNER_ACTION' || cause.includes('owner')) return 'בוטל ע"י החברה';
  if (cause === 'PAYMENT_FAILURE' || cause.toLowerCase().includes('payment')) return 'תשלום נכשל';
  if (status === 'ACTIVE') return 'פעיל';
  if (status === 'PAUSED') return 'מושהה';
  if (status === 'ENDED') return 'הסתיים';
  if (['CANCELED', 'OFFLINE_CANCELLED'].includes(status)) return cause || 'בוטל';
  return cause || '';
}

async function addLog(level: string, message: string, details?: string) {
  await sql`INSERT INTO logs (level, message, details) VALUES (${level}, ${message}, ${details || null})`;
}

export const config = { maxDuration: 60 };

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const user = await verifyAuth(req);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    await addLog('info', 'מתחיל סנכרון מלא מול Wix...');

    // Step 1: Fetch plans
    const plansMap: Record<string, string> = {};
    const plansRes = await fetch(`${WIX_BASE}/pricing-plans/v2/plans`, { method: 'GET', headers: WIX_HEADERS });
    if (plansRes.ok) {
      const plansData = await plansRes.json();
      for (const p of (plansData.plans || [])) plansMap[p.id] = p.name;
    }
    await addLog('info', `נטענו ${Object.keys(plansMap).length} תוכניות מנוי.`);

    // Step 2: Paginate ALL orders
    const allOrders: any[] = [];
    let orderOffset = 0;
    const ORDER_LIMIT = 50;

    const fetchOrderPage = async (offset: number, retries = 2): Promise<{ orders: any[]; hasMore: boolean }> => {
      try {
        const r = await fetch(`${WIX_BASE}/pricing-plans/v2/orders?limit=${ORDER_LIMIT}&offset=${offset}`, { method: 'GET', headers: WIX_HEADERS });
        if (r.status === 429 && retries > 0) {
          await new Promise(resolve => setTimeout(resolve, 2000));
          return fetchOrderPage(offset, retries - 1);
        }
        if (!r.ok) return { orders: [], hasMore: false };
        const data = await r.json();
        const orders = data.orders || [];
        return { orders, hasMore: orders.length === ORDER_LIMIT };
      } catch { return { orders: [], hasMore: false }; }
    };

    while (true) {
      const { orders, hasMore } = await fetchOrderPage(orderOffset);
      allOrders.push(...orders);
      if (orderOffset === 0 || orderOffset % 500 === 0) await addLog('info', `נטענו ${allOrders.length} הזמנות...`);
      if (!hasMore || orders.length === 0) break;
      orderOffset += ORDER_LIMIT;
      await new Promise(r => setTimeout(r, 150));
    }
    await addLog('info', `סה"כ ${allOrders.length} הזמנות.`);

    // Step 3: Fetch ALL contacts
    const contactsMap: Record<string, any> = {};
    let contactOffset = 0;
    while (true) {
      const r = await fetch(`${WIX_BASE}/contacts/v4/contacts/query`, {
        method: 'POST', headers: WIX_HEADERS,
        body: JSON.stringify({ query: { paging: { limit: 100, offset: contactOffset } } })
      });
      if (!r.ok) break;
      const data = await r.json();
      const contacts = data.contacts || [];
      for (const c of contacts) contactsMap[c.id] = c;
      if (contactOffset === 0 || contactOffset % 500 === 0) await addLog('info', `נטענו ${Object.keys(contactsMap).length} / ${data.pagingMetadata?.total || '?'} אנשי קשר...`);
      if (contacts.length < 100 || !data.pagingMetadata?.hasNext) break;
      contactOffset += 100;
      await new Promise(r => setTimeout(r, 80));
    }
    await addLog('info', `סה"כ ${Object.keys(contactsMap).length} אנשי קשר.`);

    // Step 4: Fetch eCommerce orders
    const ecomOrders: any[] = [];
    let ecomCursor: string | null = null;
    try {
      while (true) {
        const body: any = { search: {} };
        if (ecomCursor) body.search.cursorPaging = { limit: 50, cursor: ecomCursor };
        else body.search.cursorPaging = { limit: 50 };
        const r = await fetch(`${WIX_BASE}/ecom/v1/orders/search`, { method: 'POST', headers: WIX_HEADERS, body: JSON.stringify(body) });
        if (!r.ok) break;
        const data = await r.json();
        const orders = data.orders || [];
        ecomOrders.push(...orders);
        const nextCursor = data.metadata?.cursors?.next || data.pagingMetadata?.cursors?.next;
        if (!nextCursor || orders.length < 50) break;
        ecomCursor = nextCursor;
        await new Promise(r => setTimeout(r, 100));
      }
      if (ecomOrders.length > 0) await addLog('info', `נטענו ${ecomOrders.length} הזמנות חנות (e-commerce).`);
    } catch { /* skip */ }

    // Step 5: Fetch Wix Forms submissions
    const wixFormSubmissions: any[] = [];
    try {
      let formCursor: string | null = null;
      while (true) {
        const body: any = { query: {} };
        if (formCursor) body.query.cursorPaging = { limit: 50, cursor: formCursor };
        else body.query.cursorPaging = { limit: 50 };
        const r = await fetch(`${WIX_BASE}/wix-forms/v4/submissions/query`, { method: 'POST', headers: WIX_HEADERS, body: JSON.stringify(body) });
        if (!r.ok) break;
        const data = await r.json();
        const submissions = data.submissions || [];
        wixFormSubmissions.push(...submissions);
        const nextCursor = data.pagingMetadata?.cursors?.next;
        if (!nextCursor || submissions.length < 50) break;
        formCursor = nextCursor;
        await new Promise(r => setTimeout(r, 80));
      }
      if (wixFormSubmissions.length > 0) await addLog('info', `נטענו ${wixFormSubmissions.length} פניות מטפסי Wix.`);
    } catch { /* skip */ }

    // Build ecom data per contactId
    const ecomByContact: Record<string, { orders: any[]; totalSpent: number }> = {};
    for (const eo of ecomOrders) {
      const cid = eo.buyerInfo?.contactId || eo.buyer?.contactId;
      if (!cid) continue;
      if (!ecomByContact[cid]) ecomByContact[cid] = { orders: [], totalSpent: 0 };
      ecomByContact[cid].orders.push(eo);
      const amount = parseFloat(eo.priceSummary?.total?.amount || eo.totals?.total || '0');
      ecomByContact[cid].totalSpent += amount;
    }

    // Build contactId → order data
    const contactData: Record<string, { statuses: string[]; causes: string[]; orders: any[] }> = {};
    for (const o of allOrders) {
      const cid = o.buyer?.contactId;
      if (!cid) continue;
      if (!contactData[cid]) contactData[cid] = { statuses: [], causes: [], orders: [] };
      contactData[cid].statuses.push(o.status || '');
      contactData[cid].causes.push(o.cancellation?.cause || '');
      contactData[cid].orders.push(o);
    }

    // Deduplicate — keep the most recent order per contact
    const latestOrderByContact: Record<string, any> = {};
    for (const order of allOrders) {
      const cid = order.buyer?.contactId;
      if (!cid) continue;
      const existing = latestOrderByContact[cid];
      const orderDate = order.createdDate || order._createdDate;
      const existingDate = existing?.createdDate || existing?._createdDate;
      if (!existing || new Date(orderDate) > new Date(existingDate)) latestOrderByContact[cid] = order;
    }

    // Build leads
    let totalRevenue = 0, totalActiveRevenue = 0, totalCanceled = 0, totalPaymentFailed = 0, totalEcomRevenue = 0;

    const contactSubStats: Record<string, { hasActive: boolean; hasCancelled: boolean; hasPaymentFailed: boolean; totalPaid: number }> = {};

    const wixLeads = Object.values(latestOrderByContact).map((order: any) => {
      const cid = order.buyer?.contactId;
      const contact = contactsMap[cid] || {};
      const firstName = contact.info?.name?.first || '';
      const lastName = contact.info?.name?.last || '';
      const phoneItems = contact.info?.phones?.items || contact.info?.phones || [];
      const primaryPhone = phoneItems.find?.((p: any) => p.primary);
      const phone = primaryPhone?.phone || phoneItems[0]?.phone || '';
      const emailItems = contact.info?.emails?.items || contact.info?.emails || [];
      const primaryEmail = emailItems.find?.((e: any) => e.primary);
      const email = primaryEmail?.email || emailItems[0]?.email || '';

      const cd = contactData[cid] || { statuses: [], causes: [], orders: [] };

      let simNumber = '';
      for (const o of cd.orders) {
        const sub = o.formData?.submissionData || {};
        simNumber = sub['מספר סים'] || sub['sim'] || sub['SIM'] || sub['simNumber'] || sub['Sim Number'] || '';
        if (simNumber) break;
      }

      const hasActive = cd.statuses.includes('ACTIVE');
      const primaryOrder = hasActive ? (cd.orders.find((o: any) => o.status === 'ACTIVE') || order) : order;
      const cancelReason = hasActive ? 'פעיל' : mapCancellationReason(order);

      const activeOrder = hasActive ? (cd.orders.find((o: any) => o.status === 'ACTIVE') || order) : order;
      const price = parseFloat(activeOrder.planPrice || activeOrder.priceDetails?.planPrice || activeOrder.pricing?.prices?.[0]?.price?.total || activeOrder.priceDetails?.total || '0');
      const currency = activeOrder.pricing?.prices?.[0]?.price?.currency || activeOrder.priceDetails?.currency || 'ILS';
      const lastPayment = activeOrder.lastPaymentStatus || '';
      const orderStartDate = activeOrder.startDate || activeOrder.createdDate || activeOrder._createdDate || '';
      const totalOrders = cd.orders.length;

      let contactTotalPaid = 0;
      for (const o of cd.orders) {
        const p = parseFloat(o.planPrice || o.priceDetails?.planPrice || o.pricing?.prices?.[0]?.price?.total || o.priceDetails?.total || '0');
        const cycleCount = o.currentCycle?.index || 1;
        if (p > 0) contactTotalPaid += p * cycleCount;
      }
      totalRevenue += contactTotalPaid;
      if (hasActive) totalActiveRevenue += price;
      if (cancelReason === 'תשלום נכשל') totalPaymentFailed++;
      if (cancelReason.includes('בוטל')) totalCanceled++;

      const ecom = ecomByContact[cid] || { orders: [], totalSpent: 0 };
      totalEcomRevenue += ecom.totalSpent;

      const orderSummaries = cd.orders
        .sort((a: any, b: any) => new Date(b.createdDate || b._createdDate || 0).getTime() - new Date(a.createdDate || a._createdDate || 0).getTime())
        .map((o: any) => ({
          id: o._id || o.id,
          plan: plansMap[o.planId] || o.planName || '?',
          status: o.status,
          price: parseFloat(o.planPrice || o.priceDetails?.planPrice || o.pricing?.prices?.[0]?.price?.total || o.priceDetails?.total || '0'),
          paid: (parseFloat(o.planPrice || o.priceDetails?.planPrice || o.pricing?.prices?.[0]?.price?.total || o.priceDetails?.total || '0') * (o.currentCycle?.index || 1)),
          cycles: o.currentCycle?.index || 1,
          start: o.startDate || o.createdDate || o._createdDate || '',
          cancel: o.cancellation?.cause || '',
          cancelReason: mapCancellationReason(o),
          cancelDate: o.endDate || o._updatedDate || o.updatedDate || '',
          payment: o.lastPaymentStatus || '',
        }));

      // Track stats for tag generation
      contactSubStats[cid] = {
        hasActive,
        hasCancelled: ['CANCELED', 'OFFLINE_CANCELLED', 'ENDED'].some(s => cd.statuses.includes(s)),
        hasPaymentFailed: cancelReason === 'תשלום נכשל',
        totalPaid: contactTotalPaid,
      };

      return {
        id: cid,
        name: `${firstName} ${lastName}`.trim() || email || 'לקוח Wix',
        phone, email,
        statusId: 'new',
        createdAt: order.createdDate || order._createdDate || new Date().toISOString(),
        notes: [],
        dynamicData: {
          planName: hasActive ? (plansMap[activeOrder.planId] || activeOrder.planName || 'מנוי Wix') : (plansMap[order.planId] || order.planName || 'מנוי Wix'),
          wixStatus: hasActive ? 'ACTIVE' : order.status,
          hasActiveSubscription: hasActive ? 'כן' : 'לא',
          cancellationReason: cancelReason,
          cancellationDate: (!hasActive && (order.updatedDate || order._updatedDate)) ? new Date(order.updatedDate || order._updatedDate).toLocaleDateString('he-IL') : '',
          endingReason: cancelReason,
          planPrice: price > 0 ? `₪${price.toFixed(0)}` : '',
          currency,
          lastPaymentStatus: lastPayment === 'PAID' ? 'שולם' : lastPayment === 'NOT_PAID' ? 'לא שולם' : lastPayment === 'REFUNDED' ? 'הוחזר' : lastPayment === 'FAILED' ? 'נכשל' : lastPayment || '',
          totalPaid: contactTotalPaid > 0 ? `₪${contactTotalPaid.toFixed(0)}` : '',
          totalOrders: totalOrders.toString(),
          startDate: orderStartDate ? new Date(orderStartDate).toLocaleDateString('he-IL') : '',
          allOrders: JSON.stringify(orderSummaries),
          ecomTotalSpent: ecom.totalSpent > 0 ? `₪${ecom.totalSpent.toFixed(0)}` : '',
          ecomOrderCount: ecom.orders.length > 0 ? ecom.orders.length.toString() : '',
          simNumber: simNumber.toString(),
        }
      };
    });

    // Upsert leads to DB (preserve existing statusId, notes, reminderAt)
    for (const lead of wixLeads) {
      const existing = await sql`SELECT status_id, notes, reminder_at FROM leads WHERE id = ${lead.id}`;
      if (existing.length > 0) {
        await sql`UPDATE leads SET name = ${lead.name}, phone = ${lead.phone}, email = ${lead.email || null}, dynamic_data = ${JSON.stringify(lead.dynamicData)}, customer_id = ${null}, source = ${'wix'} WHERE id = ${lead.id}`;
      } else {
        await sql`INSERT INTO leads (id, name, phone, email, status_id, created_at, dynamic_data, notes, source) VALUES (${lead.id}, ${lead.name}, ${lead.phone}, ${lead.email || null}, ${lead.statusId}, ${lead.createdAt}, ${JSON.stringify(lead.dynamicData)}, ${JSON.stringify(lead.notes)}, ${'wix'})`;
      }
    }

    // Build customers
    const customerMap = new Map<string, any>();
    const findKey = (email?: string, phone?: string): string | undefined => {
      if (email) {
        for (const [key, c] of customerMap) {
          if (c.email && c.email.toLowerCase() === email.toLowerCase()) return key;
        }
      }
      if (phone) {
        const cleanPhone = phone.replace(/[^0-9]/g, '');
        for (const [key, c] of customerMap) {
          if (c.phone && c.phone.replace(/[^0-9]/g, '') === cleanPhone) return key;
        }
      }
      return undefined;
    };

    // Customers from subscription leads
    for (const lead of wixLeads) {
      const existingKey = findKey(lead.email, lead.phone);
      if (existingKey) {
        const existing = customerMap.get(existingKey)!;
        if (!existing.subscriptionIds.includes(lead.id)) existing.subscriptionIds.push(lead.id);
        if (!existing.email && lead.email) existing.email = lead.email;
        if (!existing.phone && lead.phone) existing.phone = lead.phone;
      } else {
        customerMap.set(`cust_${lead.id}`, {
          id: `cust_${lead.id}`, name: lead.name, phone: lead.phone, email: lead.email,
          source: 'wix', createdAt: lead.createdAt, subscriptionIds: [lead.id], inquiryIds: [], tags: [],
        });
      }
    }

    // Add remaining contacts without subscriptions
    for (const [contactId, contact] of Object.entries(contactsMap) as [string, any][]) {
      const firstName = contact.info?.name?.first || '';
      const lastName = contact.info?.name?.last || '';
      const name = `${firstName} ${lastName}`.trim();
      const phoneItems = contact.info?.phones?.items || contact.info?.phones || [];
      const primaryPhone = phoneItems.find?.((p: any) => p.primary);
      const phone = primaryPhone?.phone || phoneItems[0]?.phone || '';
      const emailItems = contact.info?.emails?.items || contact.info?.emails || [];
      const primaryEmail = emailItems.find?.((e: any) => e.primary);
      const email = primaryEmail?.email || emailItems[0]?.email || '';

      const existingKey = findKey(email, phone);
      if (existingKey) continue;
      if (!name && !email && !phone) continue;

      customerMap.set(`cust_${contactId}`, {
        id: `cust_${contactId}`, name: name || email || 'איש קשר Wix', phone: phone || '', email: email || undefined,
        source: 'wix', createdAt: contact.createdDate || contact._createdDate || new Date().toISOString(),
        subscriptionIds: [], inquiryIds: [], tags: [],
      });
    }

    // Assign marketing tags
    for (const [, customer] of customerMap) {
      const tags: string[] = [];
      const contactId = customer.id.replace('cust_', '');
      const contact = contactsMap[contactId] as any;

      let custTotalPaid = 0, custEcomSpent = 0;
      let hasActiveSubscription = false, hasCancelledSubscription = false, hasPaymentFailed = false;

      for (const sid of customer.subscriptionIds) {
        const stats = contactSubStats[sid];
        if (stats) {
          if (stats.hasActive) hasActiveSubscription = true;
          if (stats.hasCancelled) hasCancelledSubscription = true;
          if (stats.hasPaymentFailed) hasPaymentFailed = true;
          custTotalPaid += stats.totalPaid;
        }
      }

      if (customer.subscriptionIds.length > 0) tags.push('subscriber');
      if (hasActiveSubscription) tags.push('paying');
      if (hasCancelledSubscription && !hasActiveSubscription) tags.push('cancelled');
      if (hasPaymentFailed) tags.push('payment_failed');

      const ecom = ecomByContact[contactId];
      if (ecom && ecom.orders.length > 0) { tags.push('ecom_buyer'); custEcomSpent = ecom.totalSpent; }

      if (contact) {
        const memberStatus = contact.memberStatus || '';
        customer.wixMemberStatus = memberStatus;
        if (memberStatus === 'APPROVED' || memberStatus === 'ACTIVE') tags.push('member');
        const labelKeys: string[] = contact.info?.labelKeys?.items || contact.info?.labelKeys || [];
        if (labelKeys.some((lk: string) => lk.includes('subscribers') || lk.includes('newsletter'))) tags.push('email_subscriber');
        if (labelKeys.some((lk: string) => lk.includes('sms'))) tags.push('sms_subscriber');
      }

      if (customer.subscriptionIds.length === 0 && !ecom) tags.push('contact_only');

      customer.tags = tags;
      customer.totalSpent = custTotalPaid + custEcomSpent;
      customer.ecomSpent = custEcomSpent;
      customer.lastActivity = contact?.lastActivity?.activityDate || contact?._updatedDate || '';
    }

    // Upsert customers to DB (preserve inquiryIds from existing)
    for (const [, customer] of customerMap) {
      const existing = await sql`SELECT inquiry_ids FROM customers WHERE id = ${customer.id}`;
      const existingInquiryIds = existing.length > 0 ? existing[0].inquiry_ids || [] : [];
      const mergedInquiryIds = [...new Set([...existingInquiryIds, ...customer.inquiryIds])];

      await sql`INSERT INTO customers (id, name, phone, email, source, created_at, subscription_ids, inquiry_ids, tags, total_spent, ecom_spent, last_activity, wix_member_status)
                VALUES (${customer.id}, ${customer.name}, ${customer.phone || ''}, ${customer.email || null}, ${customer.source}, ${customer.createdAt}, ${customer.subscriptionIds}, ${mergedInquiryIds}, ${customer.tags}, ${customer.totalSpent || 0}, ${customer.ecomSpent || 0}, ${customer.lastActivity || null}, ${customer.wixMemberStatus || null})
                ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, phone = EXCLUDED.phone, email = EXCLUDED.email, subscription_ids = EXCLUDED.subscription_ids, inquiry_ids = EXCLUDED.inquiry_ids, tags = EXCLUDED.tags, total_spent = EXCLUDED.total_spent, ecom_spent = EXCLUDED.ecom_spent, last_activity = EXCLUDED.last_activity, wix_member_status = EXCLUDED.wix_member_status`;
    }

    // Link leads to customers
    for (const [, customer] of customerMap) {
      for (const sid of customer.subscriptionIds) {
        await sql`UPDATE leads SET customer_id = ${customer.id} WHERE id = ${sid}`;
      }
    }

    // Build inquiries from form submissions
    if (wixFormSubmissions.length > 0) {
      for (const sub of wixFormSubmissions) {
        const fields = sub.submissions || sub.formData || sub.values || {};
        const name = (fields['שם'] || fields['שם מלא'] || fields['name'] || fields['full_name'] || fields['fullName'] || '').toString();
        const email = (fields['אימייל'] || fields['email'] || fields['דואר אלקטרוני'] || '').toString();
        const phone = (fields['טלפון'] || fields['phone'] || fields['נייד'] || fields['mobile'] || '').toString();
        const subject = (fields['נושא'] || fields['subject'] || sub.formName || '').toString();
        const message = (fields['הודעה'] || fields['message'] || fields['תוכן'] || fields['content'] || '').toString();

        let customerId: string | null = null;
        if (email || phone) {
          for (const [, cust] of customerMap) {
            if (email && cust.email && cust.email.toLowerCase() === email.toLowerCase()) { customerId = cust.id; break; }
            if (phone && cust.phone) {
              if (cust.phone.replace(/[^0-9]/g, '') === phone.replace(/[^0-9]/g, '')) { customerId = cust.id; break; }
            }
          }
        }

        const inqId = sub._id || sub.id || Math.random().toString(36).substr(2, 9);
        const existing = await sql`SELECT status FROM inquiries WHERE id = ${inqId}`;
        const preservedStatus = existing.length > 0 ? existing[0].status : 'new';

        await sql`INSERT INTO inquiries (id, customer_id, name, phone, email, subject, message, source, status, created_at)
                  VALUES (${inqId}, ${customerId}, ${name}, ${phone}, ${email}, ${subject}, ${message}, ${'wix_form'}, ${preservedStatus}, ${sub._createdDate || sub.createdDate || sub.submittedDate || new Date().toISOString()})
                  ON CONFLICT (id) DO UPDATE SET customer_id = EXCLUDED.customer_id, name = EXCLUDED.name, phone = EXCLUDED.phone, email = EXCLUDED.email, subject = EXCLUDED.subject, message = EXCLUDED.message`;

        if (customerId) {
          await sql`UPDATE customers SET inquiry_ids = array_append(inquiry_ids, ${inqId}) WHERE id = ${customerId} AND NOT (${inqId} = ANY(inquiry_ids))`;
        }
      }
      await addLog('info', `${wixFormSubmissions.length} פניות מטפסים עובדו.`);
    }

    const contactOnlyCount = Array.from(customerMap.values()).filter((c: any) => c.tags.includes('contact_only')).length;
    const subscriberCount = Array.from(customerMap.values()).filter((c: any) => c.tags.includes('subscriber')).length;
    await addLog('success', `סנכרון מלא הושלם! ${Object.keys(contactsMap).length} אנשי קשר → ${customerMap.size} לקוחות (${subscriberCount} מנויים, ${contactOnlyCount} אנשי קשר בלבד). ${allOrders.length} הזמנות מנויים${ecomOrders.length > 0 ? ` + ${ecomOrders.length} הזמנות חנות` : ''}.`);

    return res.json({
      ok: true,
      stats: {
        contacts: Object.keys(contactsMap).length,
        customers: customerMap.size,
        leads: wixLeads.length,
        orders: allOrders.length,
        ecomOrders: ecomOrders.length,
        inquiries: wixFormSubmissions.length,
      }
    });

  } catch (error: any) {
    await addLog('error', 'שגיאת סנכרון', error.message);
    return res.status(500).json({ error: error.message });
  }
}
