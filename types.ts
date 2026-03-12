
export enum StatusKey {
  DONE = 'done',
  NO_ANSWER = 'no_answer',
  CALLBACK = 'callback',
  CANCELLED = 'cancelled',
  NEW = 'new'
}

export interface StatusConfig {
  id: string;
  label: string;
  color: string;
  rowColor: string;
  order: number;
}

export interface Note {
  id: string;
  text: string;
  timestamp: string;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  dueDate: string;
  isCompleted: boolean;
  leadId?: string;
  type: 'call' | 'action' | 'general';
}

export interface Column {
  id: string;
  label: string;
  type: 'text' | 'number' | 'date';
}

export interface LogEntry {
  id: string;
  timestamp: string;
  level: 'info' | 'error' | 'warning' | 'success';
  message: string;
  details?: string;
}

export interface Lead {
  id: string;
  name: string;
  phone: string;
  email?: string;
  statusId: string;
  createdAt: string;
  notes: Note[];
  dynamicData: Record<string, string | number>;
  reminderAt?: string;
  endingReason?: string;
  subscriptionType?: string;
  subscriptionStatus?: string;
  customerId?: string;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  email?: string;
  source: 'wix' | 'inquiry' | 'manual' | 'import';
  createdAt: string;
  subscriptionIds: string[];
  inquiryIds: string[];
  tags: string[];
  totalSpent?: number;
  ecomSpent?: number;
  lastActivity?: string;
  wixMemberStatus?: string;
}

export interface Inquiry {
  id: string;
  customerId?: string;
  name: string;
  phone: string;
  email?: string;
  subject: string;
  message: string;
  source: 'wix_form' | 'manual';
  status: 'new' | 'handled' | 'closed';
  createdAt: string;
}

export interface RevenueChannel {
  id: string;
  name: string;
  isAutomatic: boolean;
}

export interface PnLEntry {
  id: string;
  type: 'expense' | 'revenue';
  channelId?: string;
  category: string;
  description: string;
  amount: number;
  date: string;
  source: 'manual' | 'icount' | 'wix';
  invoiceId?: string;
}

export interface Campaign {
  id: string;
  title: string;
  subject: string;
  content_html: string;
  image_url?: string;
  coupon_code?: string;
  coupon_expiry?: string;
  cta_text?: string;
  cta_url?: string;
  channel: 'email' | 'whatsapp' | 'sms';
  status: 'draft' | 'scheduled' | 'sending' | 'sent';
  recipient_filter: Record<string, any>;
  recipient_count: number;
  sent_count: number;
  created_at: string;
  sent_at?: string;
}

// ==================== Site Management Types ====================

export type SiteProduct = {
  id: string;
  wix_id: string;
  name: string;
  slug: string;
  description: string;
  price: number;
  compare_price?: number;
  currency: string;
  sku?: string;
  weight?: number;
  visible: boolean;
  in_stock: boolean;
  track_inventory: boolean;
  quantity: number;
  product_type?: string;
  specs: Record<string, string>;
  seo_title?: string;
  seo_description?: string;
  created_at: string;
  updated_at: string;
  synced_at?: string;
  media: SiteProductMedia[];
  variants: SiteProductVariant[];
};

export type SiteProductMedia = {
  id: string;
  url: string;
  thumbnail_url?: string;
  media_type: 'image' | 'video';
  alt_text?: string;
  sort_order: number;
};

export type SiteProductVariant = {
  id: string;
  sku?: string;
  price?: number;
  options: Record<string, string>;
  in_stock: boolean;
};

export type SiteCollection = {
  id: string;
  wix_id: string;
  name: string;
  slug: string;
  description?: string;
  image_url?: string;
  visible: boolean;
  sort_order: number;
};

export type SiteBlogPost = {
  id: string;
  wix_id: string;
  title: string;
  slug: string;
  content: string;
  excerpt: string;
  cover_image?: string;
  status: 'draft' | 'published' | 'scheduled';
  author: string;
  category_ids: string[];
  tags: string[];
  published_at?: string;
  created_at: string;
  updated_at: string;
};

export type SiteBlogCategory = {
  id: string;
  wix_id: string;
  name: string;
  slug: string;
  post_count: number;
};

export type SiteCoupon = {
  id: string;
  wix_id: string;
  code: string;
  type: 'moneyOff' | 'percentOff' | 'freeShipping' | 'fixedPrice' | 'other';
  value: number;
  min_purchase?: number;
  usage_limit?: number;
  usage_count: number;
  active: boolean;
  starts_at?: string;
  expires_at?: string;
};

export type SiteSocialLink = {
  id: string;
  platform: 'facebook' | 'instagram' | 'tiktok' | 'youtube';
  url: string;
  followers?: number;
  last_checked?: string;
};

export type SiteStats = {
  products: number;
  posts: number;
  coupons: number;
  collections: number;
};

export interface AppState {
  leads: Lead[];
  customers: Customer[];
  inquiries: Inquiry[];
  pnlEntries: PnLEntry[];
  revenueChannels: RevenueChannel[];
  statuses: StatusConfig[];
  columns: Column[];
  tasks: Task[];
  logs: LogEntry[];
}
