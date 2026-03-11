
import { StatusConfig, Column, Lead, RevenueChannel } from './types';

export const INITIAL_STATUSES: StatusConfig[] = [
  { id: 'done', label: 'בוצע', color: 'bg-[#107c41]', rowColor: 'bg-green-50', order: 1 },
  { id: 'no_answer', label: 'לא ענה', color: 'bg-[#f87171]', rowColor: 'bg-red-50', order: 2 },
  { id: 'callback', label: 'לחזור אליו', color: 'bg-[#fb923c]', rowColor: 'bg-orange-50', order: 3 },
  { id: 'cancelled', label: 'ביטל', color: 'bg-[#991b1b]', rowColor: 'bg-gray-100', order: 4 },
  { id: 'new', label: 'חדש', color: 'bg-blue-500', rowColor: 'bg-blue-50', order: 0 },
];

export const INITIAL_COLUMNS: Column[] = [
  { id: 'planName', label: 'מנויים', type: 'text' },
  { id: 'wixStatus', label: 'סטטוס Wix', type: 'text' },
  { id: 'hasActiveSubscription', label: 'מנוי פעיל?', type: 'text' },
  { id: 'planPrice', label: 'מחיר מנוי', type: 'text' },
  { id: 'totalPaid', label: 'סה"כ שולם', type: 'text' },
  { id: 'lastPaymentStatus', label: 'סטטוס תשלום', type: 'text' },
  { id: 'cancellationReason', label: 'סיבת ביטול', type: 'text' },
  { id: 'cancellationDate', label: 'תאריך ביטול', type: 'date' },
  { id: 'startDate', label: 'תאריך התחלה', type: 'date' },
  { id: 'totalOrders', label: 'הזמנות', type: 'text' },
  { id: 'ecomTotalSpent', label: 'רכישות חנות', type: 'text' },
  { id: 'ecomOrderCount', label: 'הזמנות חנות', type: 'text' },
  { id: 'simNumber', label: 'מספר סים', type: 'text' },
];

export const DEFAULT_REVENUE_CHANNELS: RevenueChannel[] = [
  { id: 'subscriptions', name: 'מנויים', isAutomatic: true },
  { id: 'website_sales', name: 'מכירות באתר', isAutomatic: true },
  { id: 'super_pharm', name: 'סופר פארם', isAutomatic: false },
  { id: 'kravitz', name: 'קרביץ', isAutomatic: false },
  { id: 'ksp', name: 'KSP', isAutomatic: false },
  { id: 'bulk_purchases', name: 'רכישות מרוכזות', isAutomatic: false },
];

export const MOCK_LEADS: Lead[] = [
  {
    id: '1',
    name: 'Adar Raitses',
    phone: '54-613-7832',
    statusId: 'no_answer',
    createdAt: '2023-12-10T10:00:00Z',
    notes: [
      { id: 'n1', text: 'ניסיון ראשון - לא ענה', timestamp: '2023-12-10 10:05' }
    ],
    dynamicData: {
      endingReason: 'Payment failed',
      planName: 'מנוי חודשי',
      wixStatus: 'CANCELED',
      cancellationDate: '30.12.2025'
    }
  }
];
