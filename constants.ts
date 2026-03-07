
import { StatusConfig, Column, Lead } from './types';

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
  { id: 'cancellationDate', label: 'תאריך ביטול', type: 'date' },
  { id: 'endingReason', label: 'סיבת סיום', type: 'text' },
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
