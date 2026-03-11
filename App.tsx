
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Lead, StatusConfig, Column, Note, Task, LogEntry, Customer, Inquiry } from './types';
import { INITIAL_STATUSES, INITIAL_COLUMNS, MOCK_LEADS } from './constants';
import LeadTable from './components/LeadTable';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import LeadDetailModal from './components/LeadDetailModal';
import SettingsModal from './components/SettingsModal';
import AddLeadModal from './components/AddLeadModal';
import ImportModal from './components/ImportModal';
import Dashboard from './components/Dashboard';
import TasksView from './components/TasksView';
import CustomersView from './components/CustomersView';
import InquiriesView from './components/InquiriesView';
import AddInquiryModal from './components/AddInquiryModal';
import PnLView from './components/PnLView';
import SystemLogModal from './components/SystemLogModal';
import AIExtractModal from './components/AIExtractModal';
import AIAnalyticsChat from './components/AIAnalyticsChat';
import SmartViewBar, { ViewCommand } from './components/SmartViewBar';

const WIX_SITE_ID = process.env.WIX_SITE_ID || '';
const WIX_AUTH_TOKEN = process.env.WIX_AUTH_TOKEN || '';

const WIX_HEADERS = {
  'Content-Type': 'application/json',
  'Wix-Site-Id': WIX_SITE_ID,
  'Authorization': WIX_AUTH_TOKEN,
};

// Map Wix cancellation cause to Hebrew
function mapCancellationReason(order: any): string {
  const cause = (order.cancellation?.cause || '').toString();
  const status = order.status || '';

  if (cause === 'MEMBER_ACTION' || cause.includes('member')) return 'בוטל ע"י הלקוח';
  if (cause === 'OWNER_ACTION' || cause.includes('owner')) return 'בוטל ע"י החברה';
  if (cause === 'PAYMENT_FAILURE' || cause.toLowerCase().includes('payment')) return 'תשלום נכשל';

  if (status === 'ACTIVE') return 'פעיל';
  if (status === 'PAUSED') return 'מושהה';
  if (status === 'ENDED') return 'הסתיים';
  if (['CANCELED', 'OFFLINE_CANCELLED'].includes(status)) {
    return cause || 'בוטל';
  }
  return cause || '';
}

// Wix status filter options
const WIX_FILTER_OPTIONS = [
  { value: 'all', label: 'הכל' },
  { value: 'active', label: 'מנוי פעיל' },
  { value: 'canceled_customer', label: 'בוטל ע"י הלקוח' },
  { value: 'canceled_company', label: 'בוטל ע"י החברה' },
  { value: 'payment_failed', label: 'תשלום נכשל' },
  { value: 'ended', label: 'הסתיים' },
  { value: 'no_phone', label: 'ללא טלפון' },
];

const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'leads' | 'customers' | 'inquiries' | 'pnl' | 'tasks'>('leads');
  const [leads, setLeads] = useState<Lead[]>(() => {
    const saved = localStorage.getItem('crm_leads');
    return saved ? JSON.parse(saved) : MOCK_LEADS;
  });
  const [customers, setCustomers] = useState<Customer[]>(() => {
    const saved = localStorage.getItem('crm_customers');
    return saved ? JSON.parse(saved) : [];
  });
  const [inquiries, setInquiries] = useState<Inquiry[]>(() => {
    const saved = localStorage.getItem('crm_inquiries');
    return saved ? JSON.parse(saved) : [];
  });
  const [tasks, setTasks] = useState<Task[]>([]);
  const [statuses, setStatuses] = useState<StatusConfig[]>(INITIAL_STATUSES);
  const [columns, setColumns] = useState<Column[]>(INITIAL_COLUMNS);
  const [logs, setLogs] = useState<LogEntry[]>(() => {
    const saved = localStorage.getItem('crm_logs');
    return saved ? JSON.parse(saved) : [];
  });
  
  const [searchQuery, setSearchQuery] = useState('');
  const [wixStatusFilter, setWixStatusFilter] = useState('all');
  const [isSyncing, setIsSyncing] = useState(false);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAddLeadOpen, setIsAddLeadOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isLogsOpen, setIsLogsOpen] = useState(false);
  const [isAIModalOpen, setIsAIModalOpen] = useState(false);
  const [isAnalyticsChatOpen, setIsAnalyticsChatOpen] = useState(false);
  const [isAddInquiryOpen, setIsAddInquiryOpen] = useState(false);
  const [notifications, setNotifications] = useState<string[]>([]);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState<string[]>(() => {
    const saved = localStorage.getItem('crm_visible_columns');
    return saved ? JSON.parse(saved) : INITIAL_COLUMNS.map(c => c.id);
  });
  const [dateRange, setDateRange] = useState<{ from: string; to: string }>({ from: '', to: '' });
  const [activeSmartView, setActiveSmartView] = useState<ViewCommand | null>(null);

  useEffect(() => {
    localStorage.setItem('crm_leads', JSON.stringify(leads));
  }, [leads]);

  useEffect(() => {
    localStorage.setItem('crm_customers', JSON.stringify(customers));
  }, [customers]);

  useEffect(() => {
    localStorage.setItem('crm_inquiries', JSON.stringify(inquiries));
  }, [inquiries]);

  useEffect(() => {
    localStorage.setItem('crm_logs', JSON.stringify(logs));
  }, [logs]);

  useEffect(() => {
    localStorage.setItem('crm_visible_columns', JSON.stringify(visibleColumns));
  }, [visibleColumns]);

  const addLog = useCallback((level: LogEntry['level'], message: string, details?: string) => {
    const newLog: LogEntry = {
      id: Math.random().toString(36).substr(2, 9),
      timestamp: new Date().toLocaleString('he-IL'),
      level,
      message,
      details
    };
    setLogs(prev => [newLog, ...prev].slice(0, 100));
  }, []);

  const handleWixSync = async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    addLog('info', 'מתחיל סנכרון מלא מול Wix...');

    try {
      // Step 1: Fetch plans
      const plansMap: Record<string, string> = {};
      const plansRes = await fetch('/wixapi/pricing-plans/v2/plans', { method: 'GET', headers: WIX_HEADERS });
      if (plansRes.ok) {
        const plansData = await plansRes.json();
        for (const p of (plansData.plans || [])) plansMap[p.id] = p.name;
      }
      addLog('info', `נטענו ${Object.keys(plansMap).length} תוכניות מנוי.`);

      // Step 2: Paginate ALL orders directly (50 per page, ~65 requests for ~3200 orders)
      const allOrders: any[] = [];
      let orderOffset = 0;
      const ORDER_LIMIT = 50;
      const DELAY_MS = 150;

      const fetchOrderPage = async (offset: number, retries = 2): Promise<{ orders: any[]; hasMore: boolean }> => {
        try {
          const res = await fetch(`/wixapi/pricing-plans/v2/orders?limit=${ORDER_LIMIT}&offset=${offset}`, {
            method: 'GET', headers: WIX_HEADERS
          });
          if (res.status === 429 && retries > 0) {
            await new Promise(r => setTimeout(r, 2000));
            return fetchOrderPage(offset, retries - 1);
          }
          if (!res.ok) return { orders: [], hasMore: false };
          const data = await res.json();
          const orders = data.orders || [];
          return { orders, hasMore: orders.length === ORDER_LIMIT };
        } catch { return { orders: [], hasMore: false }; }
      };

      while (true) {
        const { orders, hasMore } = await fetchOrderPage(orderOffset);
        allOrders.push(...orders);
        if (orderOffset === 0 || orderOffset % 500 === 0) {
          addLog('info', `נטענו ${allOrders.length} הזמנות...`);
        }
        if (!hasMore || orders.length === 0) break;
        orderOffset += ORDER_LIMIT;
        await new Promise(r => setTimeout(r, DELAY_MS));
      }
      addLog('info', `סה"כ ${allOrders.length} הזמנות.`);

      // Step 3: Fetch ALL contacts (paginated, no label filter)
      const contactsMap: Record<string, any> = {};
      let contactOffset = 0;
      while (true) {
        const res = await fetch('/wixapi/contacts/v4/contacts/query', {
          method: 'POST', headers: WIX_HEADERS,
          body: JSON.stringify({ query: { paging: { limit: 100, offset: contactOffset } } })
        });
        if (!res.ok) break;
        const data = await res.json();
        const contacts = data.contacts || [];
        for (const c of contacts) contactsMap[c.id] = c;
        if (contactOffset === 0 || contactOffset % 500 === 0) {
          addLog('info', `נטענו ${Object.keys(contactsMap).length} / ${data.pagingMetadata?.total || '?'} אנשי קשר...`);
        }
        if (contacts.length < 100 || !data.pagingMetadata?.hasNext) break;
        contactOffset += 100;
        await new Promise(r => setTimeout(r, 80));
      }
      addLog('info', `סה"כ ${Object.keys(contactsMap).length} אנשי קשר.`);

      // Step 4: Fetch Wix Store e-commerce orders
      const ecomOrders: any[] = [];
      let ecomCursor: string | null = null;
      try {
        while (true) {
          const body: any = { search: {} };
          if (ecomCursor) body.search.cursorPaging = { limit: 50, cursor: ecomCursor };
          else body.search.cursorPaging = { limit: 50 };
          const res = await fetch('/wixapi/ecom/v1/orders/search', { method: 'POST', headers: WIX_HEADERS, body: JSON.stringify(body) });
          if (!res.ok) break;
          const data = await res.json();
          const orders = data.orders || [];
          ecomOrders.push(...orders);
          const nextCursor = data.metadata?.cursors?.next || data.pagingMetadata?.cursors?.next;
          if (!nextCursor || orders.length < 50) break;
          ecomCursor = nextCursor;
          await new Promise(r => setTimeout(r, 100));
        }
        if (ecomOrders.length > 0) addLog('info', `נטענו ${ecomOrders.length} הזמנות חנות (e-commerce).`);
      } catch { /* e-commerce API not available — skip silently */ }

      // Step 5: Fetch Wix Forms submissions (inquiries/contact forms)
      const wixFormSubmissions: any[] = [];
      try {
        let formCursor: string | null = null;
        while (true) {
          const body: any = { query: {} };
          if (formCursor) body.query.cursorPaging = { limit: 50, cursor: formCursor };
          else body.query.cursorPaging = { limit: 50 };
          const res = await fetch('/wixapi/wix-forms/v4/submissions/query', {
            method: 'POST', headers: WIX_HEADERS, body: JSON.stringify(body)
          });
          if (!res.ok) break;
          const data = await res.json();
          const submissions = data.submissions || [];
          wixFormSubmissions.push(...submissions);
          const nextCursor = data.pagingMetadata?.cursors?.next;
          if (!nextCursor || submissions.length < 50) break;
          formCursor = nextCursor;
          await new Promise(r => setTimeout(r, 80));
        }
        if (wixFormSubmissions.length > 0) addLog('info', `נטענו ${wixFormSubmissions.length} פניות מטפסי Wix.`);
      } catch { /* Wix Forms API not available — skip silently */ }

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

      // Step 5: Build contactId → order data
      const contactData: Record<string, { statuses: string[]; causes: string[]; orders: any[] }> = {};
      let ordersWithoutContactId = 0;
      for (const o of allOrders) {
        const cid = o.buyer?.contactId;
        if (!cid) { ordersWithoutContactId++; continue; }
        if (!contactData[cid]) contactData[cid] = { statuses: [], causes: [], orders: [] };
        contactData[cid].statuses.push(o.status || '');
        contactData[cid].causes.push(o.cancellation?.cause || '');
        contactData[cid].orders.push(o);
      }
      if (ordersWithoutContactId > 0) addLog('warning', `${ordersWithoutContactId} הזמנות ללא מזהה לקוח (דילוג).`);

      // Step 6: Deduplicate — keep the most recent order per contact (for primary display)
      const latestOrderByContact: Record<string, any> = {};
      for (const order of allOrders) {
        const cid = order.buyer?.contactId;
        if (!cid) continue;
        const existing = latestOrderByContact[cid];
        const orderDate = order.createdDate || order._createdDate;
        const existingDate = existing?.createdDate || existing?._createdDate;
        if (!existing || new Date(orderDate) > new Date(existingDate)) {
          latestOrderByContact[cid] = order;
        }
      }

      // Step 7: Build leads — one per contact, store ALL orders for expansion
      let totalRevenue = 0;
      let totalActiveRevenue = 0;
      let totalCanceled = 0;
      let totalPaymentFailed = 0;
      let totalEcomRevenue = 0;

      // Log formData structure from first order (for debugging custom form fields)
      const firstOrderWithForm = allOrders.find((o: any) => o.formData?.submissionData);
      if (firstOrderWithForm) {
        console.log('[Wix Sync] formData.submissionData sample:', JSON.stringify(firstOrderWithForm.formData.submissionData, null, 2));
        addLog('info', `נמצאו שדות טופס מותאמים: ${Object.keys(firstOrderWithForm.formData.submissionData).join(', ')}`);
      }

      const wixLeads: Lead[] = Object.values(latestOrderByContact).map((order: any) => {
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

        // Extract custom form fields (SIM number, etc.) from checkout form — check ALL orders for this contact
        let simNumber = '';
        for (const o of cd.orders) {
          const sub = o.formData?.submissionData || {};
          simNumber = sub['מספר סים'] || sub['sim'] || sub['SIM'] || sub['simNumber'] || sub['Sim Number'] || '';
          if (simNumber) break;
        }
        const hasActive = cd.statuses.includes('ACTIVE');
        // Use BEST status: if ANY order is active, show as active
        const primaryOrder = hasActive ? (cd.orders.find((o: any) => o.status === 'ACTIVE') || order) : order;
        const cancelReason = hasActive ? 'פעיל' : mapCancellationReason(order);

        // Extract financial data from primary order (for display)
        const activeOrder = hasActive ? (cd.orders.find((o: any) => o.status === 'ACTIVE') || order) : order;
        const price = parseFloat(activeOrder.planPrice || activeOrder.priceDetails?.planPrice || activeOrder.pricing?.prices?.[0]?.price?.total || activeOrder.priceDetails?.total || '0');
        const currency = activeOrder.pricing?.prices?.[0]?.price?.currency || activeOrder.priceDetails?.currency || 'ILS';
        const lastPayment = activeOrder.lastPaymentStatus || '';
        const orderStartDate = activeOrder.startDate || activeOrder.createdDate || activeOrder._createdDate || '';
        const totalOrders = cd.orders.length;

        // Compute total paid across all orders for this contact (price × cycles)
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

        // E-commerce data for this contact
        const ecom = ecomByContact[cid] || { orders: [], totalSpent: 0 };
        totalEcomRevenue += ecom.totalSpent;

        // Store compact order summaries for expandable rows (avoid storing full raw order objects — too large for localStorage)
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

        return {
          id: cid,
          name: `${firstName} ${lastName}`.trim() || email || 'לקוח Wix',
          phone,
          email,
          statusId: 'new',
          createdAt: order.createdDate || order._createdDate || new Date().toISOString(),
          notes: [],
          dynamicData: {
            planName: hasActive
              ? (plansMap[activeOrder.planId] || activeOrder.planName || 'מנוי Wix')
              : (plansMap[order.planId] || order.planName || 'מנוי Wix'),
            wixStatus: hasActive ? 'ACTIVE' : order.status,
            hasActiveSubscription: hasActive ? 'כן' : 'לא',
            cancellationReason: cancelReason,
            cancellationDate: (!hasActive && (order.updatedDate || order._updatedDate))
              ? new Date(order.updatedDate || order._updatedDate).toLocaleDateString('he-IL')
              : '',
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

      // Sort: canceled/payment-failed at top, then active
      const priorityOrder = (lead: Lead): number => {
        const reason = (lead.dynamicData?.cancellationReason || '').toString();
        const wixStatus = (lead.dynamicData?.wixStatus || '').toString();
        if (reason === 'תשלום נכשל') return 0;
        if (reason.includes('בוטל')) return 1;
        if (['CANCELED', 'OFFLINE_CANCELLED'].includes(wixStatus)) return 2;
        if (wixStatus === 'ENDED') return 3;
        return 4; // active
      };
      wixLeads.sort((a, b) => priorityOrder(a) - priorityOrder(b));

      // Merge: update existing Wix leads, add new ones, keep non-Wix leads
      const allWixContactIds = new Set(wixLeads.map(l => l.id));
      setLeads(prev => {
        const existingWixIds = new Set(wixLeads.map(l => l.id));
        const nonWixLeads = prev.filter(l => !existingWixIds.has(l.id) && !allWixContactIds.has(l.id));
        const mergedWixLeads = wixLeads.map(wl => {
          const existing = prev.find(l => l.id === wl.id);
          if (existing) {
            return { ...wl, statusId: existing.statusId, notes: existing.notes, reminderAt: existing.reminderAt };
          }
          return wl;
        });
        return [...mergedWixLeads, ...nonWixLeads];
      });

      // Build unified customers from synced leads (dedup by email → phone)
      const customerMap = new Map<string, Customer>();
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

      // Build a lookup: contactId → subscription tags/stats for tag generation
      const contactSubStats: Record<string, { hasActive: boolean; hasCancelled: boolean; hasPaymentFailed: boolean; totalPaid: number }> = {};
      for (const lead of wixLeads) {
        const reason = (lead.dynamicData?.cancellationReason || '').toString();
        const wixStatus = (lead.dynamicData?.wixStatus || '').toString();
        const paid = parseFloat((lead.dynamicData?.totalPaid || '0').toString().replace('₪', '').replace(/,/g, ''));
        contactSubStats[lead.id] = {
          hasActive: wixStatus === 'ACTIVE',
          hasCancelled: ['CANCELED', 'OFFLINE_CANCELLED', 'ENDED'].includes(wixStatus),
          hasPaymentFailed: reason === 'תשלום נכשל',
          totalPaid: paid,
        };
      }

      for (const lead of wixLeads) {
        const existingKey = findKey(lead.email, lead.phone);
        if (existingKey) {
          const existing = customerMap.get(existingKey)!;
          if (!existing.subscriptionIds.includes(lead.id)) {
            existing.subscriptionIds.push(lead.id);
          }
          if (!existing.email && lead.email) existing.email = lead.email;
          if (!existing.phone && lead.phone) existing.phone = lead.phone;
        } else {
          const customerId = `cust_${lead.id}`;
          customerMap.set(customerId, {
            id: customerId,
            name: lead.name,
            phone: lead.phone,
            email: lead.email,
            source: 'wix',
            createdAt: lead.createdAt,
            subscriptionIds: [lead.id],
            inquiryIds: [],
            tags: [],
          });
        }
      }

      // Now add ALL remaining Wix contacts that don't have subscriptions
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

        // Skip if already exists in customerMap (was added as subscriber)
        const existingKey = findKey(email, phone);
        if (existingKey) continue;

        // Skip contacts with no name and no email and no phone
        if (!name && !email && !phone) continue;

        const customerId = `cust_${contactId}`;
        customerMap.set(customerId, {
          id: customerId,
          name: name || email || 'איש קשר Wix',
          phone: phone || '',
          email: email || undefined,
          source: 'wix',
          createdAt: contact.createdDate || contact._createdDate || new Date().toISOString(),
          subscriptionIds: [],
          inquiryIds: [],
          tags: [],
        });
      }

      // Assign marketing tags to all customers
      for (const [, customer] of customerMap) {
        const tags: string[] = [];
        const contactId = customer.id.replace('cust_', '');
        const contact = contactsMap[contactId] as any;

        // Subscription-based tags
        let custTotalPaid = 0;
        let custEcomSpent = 0;
        let hasActiveSubscription = false;
        let hasCancelledSubscription = false;
        let hasPaymentFailed = false;

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

        // E-commerce tags
        const ecom = ecomByContact[contactId];
        if (ecom && ecom.orders.length > 0) {
          tags.push('ecom_buyer');
          custEcomSpent = ecom.totalSpent;
        }

        // Wix contact metadata tags
        if (contact) {
          const memberStatus = contact.memberStatus || '';
          customer.wixMemberStatus = memberStatus;
          if (memberStatus === 'APPROVED' || memberStatus === 'ACTIVE') tags.push('member');

          // Label keys from Wix (e.g. contacts/customers, contacts/leads)
          const labelKeys: string[] = contact.info?.labelKeys?.items || contact.info?.labelKeys || [];
          if (labelKeys.some((lk: string) => lk.includes('subscribers') || lk.includes('newsletter'))) tags.push('email_subscriber');
          if (labelKeys.some((lk: string) => lk.includes('sms'))) tags.push('sms_subscriber');
        }

        // If no subscription and no ecom → contact only
        if (customer.subscriptionIds.length === 0 && !ecom) tags.push('contact_only');

        customer.tags = tags;
        customer.totalSpent = custTotalPaid + custEcomSpent;
        customer.ecomSpent = custEcomSpent;
        customer.lastActivity = contact?.lastActivity?.activityDate || contact?._updatedDate || '';
      }

      // Merge with existing customers (preserve manual/import customers, update wix ones)
      setCustomers(prev => {
        const newCustomers = Array.from(customerMap.values());
        const newIds = new Set(newCustomers.map(c => c.id));
        const nonWixCustomers = prev.filter(c => !newIds.has(c.id) && c.source !== 'wix');
        // Preserve inquiryIds from existing customers
        const merged = newCustomers.map(nc => {
          const existing = prev.find(c => c.id === nc.id);
          if (existing) return { ...nc, inquiryIds: existing.inquiryIds };
          return nc;
        });
        return [...merged, ...nonWixCustomers];
      });

      // Link leads to their customer IDs
      const leadToCustomer = new Map<string, string>();
      for (const [, customer] of customerMap) {
        for (const sid of customer.subscriptionIds) {
          leadToCustomer.set(sid, customer.id);
        }
      }
      setLeads(prev => prev.map(l => {
        const cid = leadToCustomer.get(l.id);
        return cid ? { ...l, customerId: cid } : l;
      }));

      // Build inquiries from Wix Forms submissions
      if (wixFormSubmissions.length > 0) {
        const newInquiries: Inquiry[] = wixFormSubmissions.map((sub: any) => {
          const fields = sub.submissions || sub.formData || sub.values || {};
          // Try common field names for contact info
          const name = fields['שם'] || fields['שם מלא'] || fields['name'] || fields['full_name'] || fields['fullName'] || '';
          const email = fields['אימייל'] || fields['email'] || fields['דואר אלקטרוני'] || '';
          const phone = fields['טלפון'] || fields['phone'] || fields['נייד'] || fields['mobile'] || '';
          const subject = fields['נושא'] || fields['subject'] || sub.formName || '';
          const message = fields['הודעה'] || fields['message'] || fields['תוכן'] || fields['content'] || '';

          // Try to match to customer
          let customerId: string | undefined;
          if (email || phone) {
            for (const [, cust] of customerMap) {
              if (email && cust.email && cust.email.toLowerCase() === email.toLowerCase()) {
                customerId = cust.id;
                break;
              }
              if (phone && cust.phone) {
                const cleanPhone = phone.replace(/[^0-9]/g, '');
                if (cust.phone.replace(/[^0-9]/g, '') === cleanPhone) {
                  customerId = cust.id;
                  break;
                }
              }
            }
          }

          return {
            id: sub._id || sub.id || Math.random().toString(36).substr(2, 9),
            customerId,
            name: name.toString(),
            phone: phone.toString(),
            email: email.toString(),
            subject: subject.toString(),
            message: message.toString(),
            source: 'wix_form' as const,
            status: 'new' as const,
            createdAt: sub._createdDate || sub.createdDate || sub.submittedDate || new Date().toISOString(),
          };
        });

        // Merge: update existing, add new, keep manual inquiries
        setInquiries(prev => {
          const newIds = new Set(newInquiries.map(i => i.id));
          const manualInquiries = prev.filter(i => i.source === 'manual');
          const existingWixInquiries = prev.filter(i => i.source === 'wix_form' && !newIds.has(i.id));
          // Preserve status of existing inquiries
          const merged = newInquiries.map(ni => {
            const existing = prev.find(i => i.id === ni.id);
            if (existing) return { ...ni, status: existing.status };
            return ni;
          });
          return [...merged, ...existingWixInquiries, ...manualInquiries];
        });

        // Link inquiry IDs to customers
        for (const inq of newInquiries) {
          if (inq.customerId) {
            const cust = customerMap.get(inq.customerId);
            if (cust && !cust.inquiryIds.includes(inq.id)) {
              cust.inquiryIds.push(inq.id);
            }
          }
        }

        addLog('info', `${newInquiries.length} פניות מטפסים עובדו (${newInquiries.filter(i => i.customerId).length} מקושרות ללקוח).`);
      }

      const withPhone = wixLeads.filter(l => l.phone).length;
      const noPhone = wixLeads.filter(l => !l.phone).length;
      const contactOnlyCount = Array.from(customerMap.values()).filter(c => c.tags.includes('contact_only')).length;
      const subscriberCount = Array.from(customerMap.values()).filter(c => c.tags.includes('subscriber')).length;
      addLog('success', `סנכרון מלא הושלם! ${Object.keys(contactsMap).length} אנשי קשר → ${customerMap.size} לקוחות (${subscriberCount} מנויים, ${contactOnlyCount} אנשי קשר בלבד). ${allOrders.length} הזמנות מנויים${ecomOrders.length > 0 ? ` + ${ecomOrders.length} הזמנות חנות` : ''}.`);
      addLog('info', `דוח כספי: הכנסות מנויים ₪${totalRevenue.toFixed(0)}${totalEcomRevenue > 0 ? ` | הכנסות חנות ₪${totalEcomRevenue.toFixed(0)}` : ''} | הכנסה חודשית פעילה ₪${totalActiveRevenue.toFixed(0)} | ביטולים: ${totalCanceled} | תשלום נכשל: ${totalPaymentFailed}`);
    } catch (error: any) {
      console.error('Wix sync error:', error);
      addLog('error', 'שגיאת סנכרון', error.message);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleUpdateLeadStatus = (leadId: string, statusId: string) => {
    setLeads(prev => prev.map(l => l.id === leadId ? { ...l, statusId } : l));
  };
  const handleUpdateLeadReminder = (leadId: string, reminderAt: string | undefined) => {
    setLeads(prev => prev.map(l => l.id === leadId ? { ...l, reminderAt } : l));
  };
  const handleAddNote = (leadId: string, noteText: string) => {
    const newNote: Note = {
      id: Math.random().toString(36).substr(2, 9),
      text: noteText,
      timestamp: new Date().toLocaleString('he-IL')
    };
    setLeads(prev => prev.map(l => l.id === leadId ? { ...l, notes: [newNote, ...l.notes] } : l));
  };
  const handleAddTask = (task: Omit<Task, 'id' | 'isCompleted'>) => {
    const newTask: Task = { ...task, id: Math.random().toString(36).substr(2, 9), isCompleted: false };
    setTasks([newTask, ...tasks]);
  };
  const toggleTaskCompletion = (taskId: string) => {
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, isCompleted: !t.isCompleted } : t));
  };
  const deleteTask = (taskId: string) => {
    setTasks(prev => prev.filter(t => t.id !== taskId));
  };
  const handleAddLead = (newLeadData: Partial<Lead>) => {
    const newLead: Lead = {
      id: Math.random().toString(36).substr(2, 9),
      name: newLeadData.name || 'לקוח חדש',
      phone: newLeadData.phone || '',
      email: newLeadData.email || '',
      statusId: 'new',
      createdAt: new Date().toISOString(),
      notes: [],
      dynamicData: newLeadData.dynamicData || {},
    };
    setLeads([newLead, ...leads]);
    addLog('info', `נוסף מנוי חדש: ${newLead.name}`);
    setIsAddLeadOpen(false);
  };
  const handleDeleteLead = (leadId: string) => {
    if (window.confirm('האם אתה בטוח שברצונך למחוק מנוי זה?')) {
      setLeads(prev => prev.filter(l => l.id !== leadId));
    }
  };
  const handleInquiryStatusChange = (id: string, status: Inquiry['status']) => {
    setInquiries(prev => prev.map(i => i.id === id ? { ...i, status } : i));
  };
  const handleAddInquiry = (data: { name: string; phone: string; email: string; subject: string; message: string; customerId?: string }) => {
    const newInquiry: Inquiry = {
      id: Math.random().toString(36).substr(2, 9),
      customerId: data.customerId,
      name: data.name,
      phone: data.phone,
      email: data.email,
      subject: data.subject,
      message: data.message,
      source: 'manual',
      status: 'new',
      createdAt: new Date().toISOString(),
    };
    setInquiries(prev => [newInquiry, ...prev]);
    // Link to customer if matched
    if (data.customerId) {
      setCustomers(prev => prev.map(c =>
        c.id === data.customerId && !c.inquiryIds.includes(newInquiry.id)
          ? { ...c, inquiryIds: [...c.inquiryIds, newInquiry.id] }
          : c
      ));
    }
  };
  const handleAddStatus = (status: StatusConfig) => setStatuses([...statuses, status]);
  const handleRemoveStatus = (statusId: string) => setStatuses(statuses.filter(s => s.id !== statusId));
  const handleAddColumn = (col: Column) => setColumns([...columns, col]);
  const handleRemoveColumn = (colId: string) => setColumns(columns.filter(c => c.id !== colId));

  // Smart View handlers
  const handleApplySmartView = useCallback((cmd: ViewCommand) => {
    setActiveSmartView(cmd);
    // Apply status filter
    if (cmd.statusFilter && cmd.statusFilter !== 'all') {
      setWixStatusFilter(cmd.statusFilter);
    } else if (cmd.statusFilter === 'all') {
      setWixStatusFilter('all');
    }
    // Apply date range
    if (cmd.dateFrom || cmd.dateTo) {
      setDateRange({ from: cmd.dateFrom, to: cmd.dateTo });
    }
    // Apply search query
    if (cmd.searchQuery) {
      setSearchQuery(cmd.searchQuery);
    }
    // Apply column visibility (only if AI specified columns)
    if (cmd.columns.length > 0) {
      setVisibleColumns(cmd.columns);
    }
  }, []);

  const handleResetSmartView = useCallback(() => {
    setActiveSmartView(null);
    setWixStatusFilter('all');
    setDateRange({ from: '', to: '' });
    setSearchQuery('');
    setVisibleColumns(INITIAL_COLUMNS.map(c => c.id));
  }, []);

  // Column labels map for SmartViewBar
  const columnLabelsMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const c of columns) map[c.id] = c.label;
    return map;
  }, [columns]);

  const filteredLeads = useMemo(() => {
    let result = leads;

    // Apply Wix status filter
    if (wixStatusFilter !== 'all') {
      result = result.filter(lead => {
        const reason = (lead.dynamicData?.cancellationReason || lead.dynamicData?.endingReason || '').toString();
        const wixStatus = (lead.dynamicData?.wixStatus || '').toString();
        const hasActive = lead.dynamicData?.hasActiveSubscription === 'כן';

        switch (wixStatusFilter) {
          case 'active': return hasActive || wixStatus === 'ACTIVE';
          case 'canceled_customer': return reason === 'בוטל ע"י הלקוח';
          case 'canceled_company': return reason === 'בוטל ע"י החברה';
          case 'payment_failed': return reason === 'תשלום נכשל';
          case 'ended': return reason === 'הסתיים' || wixStatus === 'ENDED';
          case 'no_phone': return !lead.phone;
          default: return true;
        }
      });
    }

    // Apply date range filter
    if (dateRange.from || dateRange.to) {
      const parseDMY = (str: string) => {
        if (!str) return null;
        const parts = str.split('.');
        if (parts.length !== 3) return null;
        return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
      };
      const parseISO = (str: string) => {
        if (!str) return null;
        const d = new Date(str);
        return isNaN(d.getTime()) ? null : new Date(d.getFullYear(), d.getMonth(), d.getDate());
      };
      // Parse YYYY-MM-DD as local time (not UTC) to avoid timezone offset issues
      const parseYMD = (s: string) => {
        const [y, m, d] = s.split('-').map(Number);
        return new Date(y, m - 1, d);
      };
      const from = dateRange.from ? parseYMD(dateRange.from) : null;
      const to = dateRange.to ? parseYMD(dateRange.to) : null;

      const inRange = (d: Date | null) => {
        if (!d) return false;
        if (from && d < from) return false;
        if (to && d > to) return false;
        return true;
      };

      // Map cancellation status filter to order-level cancel reasons
      const cancelStatusMap: Record<string, string[]> = {
        'payment_failed': ['תשלום נכשל', 'PAYMENT_FAILURE'],
        'canceled_customer': ['בוטל ע"י הלקוח', 'OWNER_ACTION'],
        'canceled_company': ['בוטל ע"י החברה', 'CANCELED_BY_OWNER'],
      };
      const useCancelDate = wixStatusFilter in cancelStatusMap;

      result = result.filter(lead => {
        if (useCancelDate) {
          // For canceled/failed: scan ALL individual orders for matching cancel reason + date
          try {
            const allOrders = JSON.parse(lead.dynamicData?.allOrders || '[]');
            const matchReasons = cancelStatusMap[wixStatusFilter] || [];
            return allOrders.some((o: any) => {
              const reasonMatch = matchReasons.includes(o.cancelReason) || matchReasons.includes(o.cancel);
              if (!reasonMatch) return false;
              const orderCancelDate = parseISO(o.cancelDate);
              return inRange(orderCancelDate);
            });
          } catch {
            // Fallback to lead-level date
            const cancelDate = parseDMY((lead.dynamicData?.cancellationDate || '').toString());
            return inRange(cancelDate);
          }
        }
        // For active/all: check startDate
        const startDate = parseDMY((lead.dynamicData?.startDate || '').toString());
        const cancelDate = parseDMY((lead.dynamicData?.cancellationDate || '').toString());
        return inRange(startDate) || inRange(cancelDate);
      });
    }

    // Apply search query
    const q = searchQuery.toLowerCase().trim();
    if (q) {
      result = result.filter(lead =>
        lead.name.toLowerCase().includes(q) ||
        lead.phone.includes(q) ||
        (lead.email && lead.email.toLowerCase().includes(q))
      );
    }

    return result;
  }, [leads, searchQuery, wixStatusFilter, dateRange]);

  // Count matching individual orders (for display when filtered by canceled/failed + date range)
  const matchingOrdersCount = useMemo(() => {
    const cancelStatusMap: Record<string, string[]> = {
      'payment_failed': ['תשלום נכשל', 'PAYMENT_FAILURE'],
      'canceled_customer': ['בוטל ע"י הלקוח', 'MEMBER_ACTION'],
      'canceled_company': ['בוטל ע"י החברה', 'OWNER_ACTION'],
    };
    if (!(wixStatusFilter in cancelStatusMap) || (!dateRange.from && !dateRange.to)) return 0;

    const parseYMD = (s: string) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
    const parseISO = (str: string) => { if (!str) return null; const d = new Date(str); return isNaN(d.getTime()) ? null : new Date(d.getFullYear(), d.getMonth(), d.getDate()); };
    const from = dateRange.from ? parseYMD(dateRange.from) : null;
    const to = dateRange.to ? parseYMD(dateRange.to) : null;
    const inRange = (d: Date | null) => { if (!d) return false; if (from && d < from) return false; if (to && d > to) return false; return true; };
    const matchReasons = cancelStatusMap[wixStatusFilter];

    let count = 0;
    filteredLeads.forEach(lead => {
      try {
        const allOrders = JSON.parse(lead.dynamicData?.allOrders || '[]');
        allOrders.forEach((o: any) => {
          if ((matchReasons.includes(o.cancelReason) || matchReasons.includes(o.cancel)) && inRange(parseISO(o.cancelDate))) {
            count++;
          }
        });
      } catch {}
    });
    return count;
  }, [filteredLeads, wixStatusFilter, dateRange]);

  const selectedLead = useMemo(() => leads.find(l => l.id === selectedLeadId), [leads, selectedLeadId]);
  const hasErrors = logs.some(l => l.level === 'error');

  // --- Auth Screen (Registration) ---
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#f1f5f9] flex items-center justify-center p-4 font-sans" dir="rtl">
        <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl p-8 border border-gray-100 flex flex-col relative overflow-hidden">
          {/* Logo / Title Section */}
          <div className="flex flex-col items-center mb-8">
            <div className="w-16 h-16 bg-[#1e40af] rounded-2xl flex items-center justify-center text-white text-3xl font-black mb-4 shadow-xl shadow-blue-100">U</div>
            <h2 className="text-[#1e40af] font-black text-xs uppercase tracking-widest mb-1">Welcome to ULIVER</h2>
            <h1 className="text-2xl font-bold text-gray-800">כניסה למערכת הניהול</h1>
          </div>

          <form onSubmit={(e) => { e.preventDefault(); setIsAuthenticated(true); }} className="space-y-5">
            <div>
              <label className="block text-xs font-bold text-gray-400 mb-2 mr-1">כתובת אימייל</label>
              <input 
                type="email" 
                required 
                placeholder="name@gmail.com" 
                className="w-full px-5 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all font-medium text-gray-700"
              />
            </div>
            
            <button 
              type="submit" 
              className="w-full bg-[#1e40af] hover:bg-[#1e3a8a] text-white font-bold py-4 rounded-2xl shadow-lg shadow-blue-100 transition-all transform active:scale-95 text-lg"
            >
              התחבר עכשיו
            </button>
          </form>

          {/* Moved Terms to the bottom of the white frame */}
          <div className="mt-12 pt-6 border-t border-gray-50 flex justify-center gap-6 text-[10px] font-bold text-gray-300 uppercase tracking-widest">
            <a href="#" className="hover:text-blue-600 transition-colors">Privacy Policy</a>
            <a href="#" className="hover:text-blue-600 transition-colors">Terms of Use</a>
            <a href="#" className="hover:text-blue-600 transition-colors">Contact Support</a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-50 text-gray-900 font-sans" dir="rtl">
      <Sidebar
        activeTab={activeTab}
        onTabChange={(tab) => { setActiveTab(tab as any); setIsMobileMenuOpen(false); }}
        onSettingsClick={() => setIsSettingsOpen(false)}
        onAddLeadClick={() => setIsAddLeadOpen(true)}
        onImportClick={() => setIsImportOpen(true)}
        onSyncClick={() => { handleWixSync(); setIsMobileMenuOpen(false); }}
        onLogsClick={() => setIsLogsOpen(true)}
        onAIClick={() => setIsAIModalOpen(true)}
        onAnalyticsClick={() => setIsAnalyticsChatOpen(true)}
        hasErrors={hasErrors}
      />

      {/* Mobile Slide-out Menu */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setIsMobileMenuOpen(false)} />
          <aside className="absolute right-0 top-0 h-full w-72 bg-slate-900 text-white flex flex-col animate-in slide-in-from-right duration-200 shadow-2xl">
            <div className="p-5 flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center font-bold">L</div>
                <span className="font-bold text-lg">Smart CRM</span>
              </div>
              <button onClick={() => setIsMobileMenuOpen(false)} className="p-1 hover:bg-slate-800 rounded-lg">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <nav className="p-4 space-y-1">
              {[
                { key: 'dashboard', label: 'לוח בקרה', icon: <MobileHomeIcon /> },
                { key: 'leads', label: 'מנויים', icon: <MobileSubscriptionIcon /> },
                { key: 'customers', label: 'לקוחות', icon: <MobileUsersIcon /> },
                { key: 'inquiries', label: 'פניות', icon: <MobileInboxIcon /> },
                { key: 'pnl', label: 'P&L', icon: <MobilePnLIcon /> },
                { key: 'tasks', label: 'משימות', icon: <MobileCalendarIcon /> },
              ].map(item => (
                <button key={item.key} onClick={() => { setActiveTab(item.key as any); setIsMobileMenuOpen(false); }}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-right transition-colors ${activeTab === item.key ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-800'}`}>
                  {item.icon}<span className="font-medium">{item.label}</span>
                </button>
              ))}
            </nav>
            <div className="p-4 space-y-1 border-t border-slate-800">
              <button onClick={() => { handleWixSync(); setIsMobileMenuOpen(false); }} className="w-full flex items-center gap-3 px-4 py-3 text-sm text-slate-300 hover:bg-slate-800 rounded-xl">
                <SyncIcon className={isSyncing ? 'animate-spin' : ''} /> {isSyncing ? 'מסנכרן...' : 'סנכרון Wix'}
              </button>
              <button onClick={() => { setIsAnalyticsChatOpen(true); setIsMobileMenuOpen(false); }} className="w-full flex items-center gap-3 px-4 py-3 text-sm text-blue-300 hover:bg-slate-800 rounded-xl font-bold">
                <MobileAnalyticsIcon /> בוט אנליטיקה (AI)
              </button>
              <button onClick={() => { setIsAIModalOpen(true); setIsMobileMenuOpen(false); }} className="w-full flex items-center gap-3 px-4 py-3 text-sm text-purple-300 hover:bg-slate-800 rounded-xl font-bold">
                <SparklesIcon /> שליפה מאימייל (AI)
              </button>
              <button onClick={() => { setIsLogsOpen(true); setIsMobileMenuOpen(false); }} className="w-full flex items-center gap-3 px-4 py-3 text-sm text-slate-300 hover:bg-slate-800 rounded-xl relative">
                <MobileTerminalIcon /> לוג שגיאות
                {hasErrors && <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />}
              </button>
              <button onClick={() => { setIsSettingsOpen(true); setIsMobileMenuOpen(false); }} className="w-full flex items-center gap-3 px-4 py-3 text-sm text-slate-300 hover:bg-slate-800 rounded-xl">
                <MobileSettingsIcon /> הגדרות
              </button>
            </div>
          </aside>
        </div>
      )}

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile Top Bar */}
        <div className="md:hidden flex items-center justify-between px-4 py-3 bg-white border-b border-gray-100 shrink-0">
          <button onClick={() => setIsMobileMenuOpen(true)} className="p-2 hover:bg-gray-100 rounded-lg">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
          </button>
          <h1 className="text-lg font-bold text-gray-800">
            {activeTab === 'dashboard' ? 'לוח בקרה' : activeTab === 'tasks' ? 'משימות' : activeTab === 'customers' ? 'לקוחות' : activeTab === 'inquiries' ? 'פניות' : activeTab === 'pnl' ? 'P&L' : 'מנויים'}
          </h1>
          <div className="flex gap-1">
            {activeTab === 'leads' && (
              <button onClick={handleWixSync} disabled={isSyncing} className="p-2 hover:bg-gray-100 rounded-lg">
                <SyncIcon className={`w-5 h-5 ${isSyncing ? 'animate-spin text-blue-500' : 'text-gray-600'}`} />
              </button>
            )}
            {activeTab === 'leads' && (
              <button onClick={() => setIsAddLeadOpen(true)} className="p-2 bg-blue-600 text-white rounded-lg">
                <PlusIcon />
              </button>
            )}
          </div>
        </div>

        <div className="hidden md:block">
          <Header
            reminderCount={leads.filter(l => l.reminderAt && new Date(l.reminderAt) < new Date()).length}
            notifications={notifications}
            clearNotifications={() => setNotifications([])}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
          />
        </div>

        <main className="flex-1 overflow-auto p-3 md:p-6 lg:p-8 pb-20 md:pb-8">
          <div className="max-w-[1600px] mx-auto">
             {/* Desktop Header — non-leads pages */}
             {activeTab !== 'leads' && (
               <div className="hidden md:flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold text-gray-800">
                  {activeTab === 'dashboard' ? 'לוח בקרה' : activeTab === 'tasks' ? 'משימות ותזכורות' : activeTab === 'customers' ? 'ניהול לקוחות' : activeTab === 'inquiries' ? 'פניות מהאתר' : activeTab === 'pnl' ? 'P&L — רווח והפסד' : ''}
                </h1>
              </div>
             )}

            {/* === LEADS PAGE: Smart View Chat + Action Buttons + Filters === */}
            {activeTab === 'leads' && (
              <div className="space-y-3 mb-4">
                {/* Top Row: Title + Action Buttons */}
                <div className="hidden md:flex justify-between items-center">
                  <h1 className="text-2xl font-bold text-gray-800">ניהול מנויים</h1>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setIsAIModalOpen(true)}
                      className="bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100 px-3 py-1.5 rounded-lg flex items-center gap-2 transition-all shadow-sm text-sm"
                    >
                      <SparklesIcon /> שליפה מאימייל
                    </button>
                    <button
                      onClick={handleWixSync}
                      disabled={isSyncing}
                      className={`bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 px-3 py-1.5 rounded-lg flex items-center gap-2 transition-all shadow-sm text-sm ${isSyncing ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      <SyncIcon className={isSyncing ? 'animate-spin' : ''} /> {isSyncing ? 'מסנכרן...' : 'סנכרון Wix'}
                    </button>
                    <button onClick={() => setIsAddLeadOpen(true)} className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg flex items-center gap-2 transition-colors shadow-lg text-sm">
                      <PlusIcon /> מנוי חדש
                    </button>
                  </div>
                </div>

                {/* Smart View Chat Bar */}
                <SmartViewBar
                  allColumnIds={columns.map(c => c.id)}
                  allColumnLabels={columnLabelsMap}
                  currentFilter={wixStatusFilter}
                  onApplyView={handleApplySmartView}
                  onReset={handleResetSmartView}
                  activeView={activeSmartView}
                  leadsCount={leads.length}
                  filteredCount={filteredLeads.length}
                  totalOrders={leads.reduce((sum, l) => sum + (parseInt((l.dynamicData?.totalOrders || '1').toString()) || 1), 0)}
                />

                {/* Quick Filter Chips (compact row) */}
                <div className="flex items-center gap-1.5 flex-wrap overflow-x-auto">
                  <span className="text-xs font-medium text-gray-400 shrink-0">סינון מהיר:</span>
                  {WIX_FILTER_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => { setWixStatusFilter(opt.value); if (activeSmartView) setActiveSmartView(null); }}
                      className={`px-2.5 py-1 rounded-full text-[11px] font-bold transition-all border ${
                        wixStatusFilter === opt.value
                          ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                          : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      {opt.label}
                      {opt.value !== 'all' && (
                        <span className="mr-0.5 opacity-70">
                          ({leads.filter(l => {
                            const reason = (l.dynamicData?.cancellationReason || l.dynamicData?.endingReason || '').toString();
                            const wixStatus = (l.dynamicData?.wixStatus || '').toString();
                            const hasActive = l.dynamicData?.hasActiveSubscription === 'כן';
                            switch (opt.value) {
                              case 'active': return hasActive || wixStatus === 'ACTIVE';
                              case 'canceled_customer': return reason === 'בוטל ע"י הלקוח';
                              case 'canceled_company': return reason === 'בוטל ע"י החברה';
                              case 'payment_failed': return reason === 'תשלום נכשל';
                              case 'ended': return reason === 'הסתיים' || wixStatus === 'ENDED';
                              case 'no_phone': return !l.phone;
                              default: return true;
                            }
                          }).length})
                        </span>
                      )}
                    </button>
                  ))}
                  {/* Date presets inline */}
                  <span className="text-gray-300 mx-1">|</span>
                  {[
                    { label: 'החודש', from: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0], to: '' },
                    { label: '3 חודשים', from: new Date(new Date().setMonth(new Date().getMonth() - 3)).toISOString().split('T')[0], to: '' },
                    { label: 'שנה', from: new Date(new Date().setFullYear(new Date().getFullYear() - 1)).toISOString().split('T')[0], to: '' },
                  ].map(preset => (
                    <button
                      key={preset.label}
                      onClick={() => { setDateRange({ from: preset.from, to: preset.to }); if (activeSmartView) setActiveSmartView(null); }}
                      className={`px-2 py-1 rounded-md text-[11px] font-medium transition-all border ${
                        dateRange.from === preset.from && dateRange.to === preset.to
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      📅 {preset.label}
                    </button>
                  ))}
                  {(dateRange.from || dateRange.to) && (
                    <button onClick={() => setDateRange({ from: '', to: '' })} className="text-[11px] text-red-500 hover:text-red-700 font-medium">
                      ✕
                    </button>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'dashboard' ? (
              <Dashboard leads={leads} statuses={statuses} />
            ) : activeTab === 'tasks' ? (
              <TasksView
                tasks={tasks}
                leads={leads}
                onAddTask={handleAddTask}
                onToggleTask={toggleTaskCompletion}
                onDeleteTask={deleteTask}
                onOpenLead={(id) => { setSelectedLeadId(id); setActiveTab('leads'); }}
              />
            ) : activeTab === 'customers' ? (
              <CustomersView customers={customers} leads={leads} onOpenLead={(id) => { setSelectedLeadId(id); setActiveTab('leads'); }} />
            ) : activeTab === 'inquiries' ? (
              <InquiriesView
                inquiries={inquiries}
                customers={customers}
                onStatusChange={handleInquiryStatusChange}
                onAddInquiry={() => setIsAddInquiryOpen(true)}
                onOpenCustomer={(id) => { setActiveTab('customers'); }}
              />
            ) : activeTab === 'pnl' ? (
              <PnLView />
            ) : (
              <LeadTable
                leads={filteredLeads}
                statuses={statuses}
                columns={columns.filter(c => visibleColumns.includes(c.id))}
                allColumns={columns}
                visibleColumns={visibleColumns}
                matchingOrdersCount={matchingOrdersCount}
                onToggleColumn={(colId) => setVisibleColumns(prev => prev.includes(colId) ? prev.filter(c => c !== colId) : [...prev, colId])}
                onStatusChange={handleUpdateLeadStatus}
                onLeadClick={(id) => setSelectedLeadId(id)}
                onDeleteLead={handleDeleteLead}
              />
            )}
          </div>
        </main>
      </div>

      {selectedLead && (
        <LeadDetailModal 
          lead={selectedLead}
          statuses={statuses}
          onClose={() => setSelectedLeadId(null)}
          onAddNote={(text) => handleAddNote(selectedLead.id, text)}
          onStatusChange={(statusId) => handleUpdateLeadStatus(selectedLead.id, statusId)}
          onUpdateReminder={(date) => handleUpdateLeadReminder(selectedLead.id, date)}
        />
      )}

      {isSettingsOpen && (
        <SettingsModal 
          statuses={statuses}
          columns={columns}
          onClose={() => setIsSettingsOpen(false)}
          onAddStatus={handleAddStatus}
          onRemoveStatus={handleRemoveStatus}
          onAddColumn={handleAddColumn}
          onRemoveColumn={handleRemoveColumn}
        />
      )}

      {isAddLeadOpen && (
        <AddLeadModal onClose={() => setIsAddLeadOpen(false)} onAdd={handleAddLead} columns={columns} />
      )}

      {isImportOpen && (
        <ImportModal 
          statuses={statuses}
          onClose={() => setIsImportOpen(false)}
          onImport={(importedLeads) => {
            setLeads(prev => [...importedLeads, ...prev]);
            addLog('success', `ייבוא אקסל הושלם. נוספו ${importedLeads.length} רשומות.`);
            setIsImportOpen(false);
          }}
        />
      )}

      {isLogsOpen && (
        <SystemLogModal 
          logs={logs}
          onClose={() => setIsLogsOpen(false)}
          onClear={() => { setLogs([]); localStorage.removeItem('crm_logs'); }}
        />
      )}

      {isAIModalOpen && (
        <AIExtractModal
          onClose={() => setIsAIModalOpen(false)}
          onAddLead={(newLead) => {
            handleAddLead(newLead);
            setIsAIModalOpen(false);
            setNotifications(prev => [`מנוי חדש חולץ מאימייל: ${newLead.name}`, ...prev]);
          }}
          columns={columns}
        />
      )}

      {isAnalyticsChatOpen && (
        <AIAnalyticsChat
          leads={leads}
          onClose={() => setIsAnalyticsChatOpen(false)}
        />
      )}

      <AddInquiryModal
        isOpen={isAddInquiryOpen}
        onClose={() => setIsAddInquiryOpen(false)}
        onSubmit={handleAddInquiry}
        customers={customers}
      />

      {/* Mobile Bottom Nav */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex justify-around py-2 px-1 z-30 safe-area-bottom">
        {[
          { key: 'dashboard', label: 'בקרה', icon: <MobileHomeIcon /> },
          { key: 'leads', label: 'מנויים', icon: <MobileSubscriptionIcon /> },
          { key: 'customers', label: 'לקוחות', icon: <MobileUsersIcon /> },
          { key: 'pnl', label: 'P&L', icon: <MobilePnLIcon /> },
        ].map(item => (
          <button key={item.key} onClick={() => setActiveTab(item.key as any)}
            className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-colors min-w-[52px] ${activeTab === item.key ? 'text-blue-600' : 'text-gray-400'}`}>
            {item.icon}
            <span className="text-[10px] font-bold">{item.label}</span>
          </button>
        ))}
        <button onClick={() => setIsAnalyticsChatOpen(true)}
          className="flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl text-purple-500 min-w-[52px]">
          <MobileAnalyticsIcon />
          <span className="text-[10px] font-bold">AI</span>
        </button>
      </div>
    </div>
  );
};

const PlusIcon = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>;
const SyncIcon = ({ className }: { className?: string }) => <svg className={`w-5 h-5 ${className || ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>;
const SparklesIcon = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-7.714 2.143L11 21l-2.286-6.857L1 12l7.714-2.143L11 3z" /></svg>;
const MobileHomeIcon = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>;
const MobileUsersIcon = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>;
const MobileCalendarIcon = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>;
const MobileSubscriptionIcon = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" /></svg>;
const MobileInboxIcon = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" /></svg>;
const MobilePnLIcon = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>;
const MobileAnalyticsIcon = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>;
const MobileTerminalIcon = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>;
const MobileSettingsIcon = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>;

export default App;
