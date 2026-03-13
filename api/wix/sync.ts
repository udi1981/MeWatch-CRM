import type { VercelRequest, VercelResponse } from '@vercel/node';
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

// ==================== SITE SYNC (Products, Blog, Coupons) ====================

async function syncSiteProducts() {
  const allProducts: any[] = [];
  let offset = 0;
  while (true) {
    const r = await fetch(`${WIX_BASE}/stores/v1/products/query`, {
      method: 'POST', headers: WIX_HEADERS,
      body: JSON.stringify({ query: { paging: { limit: 100, offset } } }),
    });
    if (!r.ok) {
      const errText = await r.text().catch(() => 'unknown');
      await addLog('error', `Wix Products API error (${r.status})`, errText.substring(0, 500));
      break;
    }
    const data = await r.json();
    const products = data.products || [];
    allProducts.push(...products);
    if (products.length < 100) break;
    offset += 100;
    await new Promise(r => setTimeout(r, 50));
  }

  await addLog('info', `Products API returned ${allProducts.length} products`);
  // Upsert products to DB
  for (const p of allProducts) {
    const priceStr = typeof p.price?.formatted === 'string' ? p.price.formatted.replace(/[₪,]/g, '') : '';
    const price = parseFloat(priceStr || p.price?.price || p.priceData?.price || '0') || 0;
    const comparePrice = parseFloat(p.price?.discountedPrice || p.priceData?.discountedPrice || '0');
    const desc = p.description || '';
    const media = p.media?.items || p.media?.mainMedia ? [p.media.mainMedia, ...(p.media?.items || [])] : [];
    const variants = p.variants || p.productOptions?.length > 0 ? p.variants || [] : [];
    const specs: Record<string, string> = {};
    for (const info of (p.additionalInfoSections || [])) {
      if (info.title && info.description) specs[info.title] = info.description;
    }

    const inStock = p.stock?.inStock !== false && p.stock?.inventoryStatus !== 'OUT_OF_STOCK';
    const trackInventory = p.stock?.trackInventory === true;
    const quantity = p.stock?.quantity || 0;

    await sql`INSERT INTO site_products (id, wix_id, name, slug, description, price, compare_price, currency, sku, weight, visible, in_stock, track_inventory, quantity, product_type, specs, synced_at)
      VALUES (${p.id}, ${p.id}, ${p.name || ''}, ${p.slug || ''}, ${desc}, ${price}, ${comparePrice || null}, ${'ILS'}, ${p.sku || null}, ${p.weight || null}, ${p.visible !== false}, ${inStock}, ${trackInventory}, ${quantity}, ${p.productType || 'physical'}, ${JSON.stringify(specs)}, NOW())
      ON CONFLICT (wix_id) DO UPDATE SET name = EXCLUDED.name, slug = EXCLUDED.slug, description = EXCLUDED.description, price = EXCLUDED.price, compare_price = EXCLUDED.compare_price, sku = EXCLUDED.sku, weight = EXCLUDED.weight, visible = EXCLUDED.visible, in_stock = EXCLUDED.in_stock, track_inventory = EXCLUDED.track_inventory, quantity = EXCLUDED.quantity, specs = EXCLUDED.specs, synced_at = NOW(), updated_at = NOW()`;

    // Upsert media
    await sql`DELETE FROM site_product_media WHERE product_id = ${p.id}`;
    for (let mi = 0; mi < media.length; mi++) {
      const m = media[mi];
      if (!m) continue;
      const url = m.image?.url || m.url || m.src || '';
      if (!url) continue;
      await sql`INSERT INTO site_product_media (product_id, url, thumbnail_url, media_type, alt_text, sort_order)
        VALUES (${p.id}, ${url}, ${m.image?.url || url}, ${m.mediaType === 'VIDEO' ? 'video' : 'image'}, ${m.image?.altText || m.altText || ''}, ${mi})`;
    }

    // Upsert variants
    for (const v of variants) {
      const vPrice = parseFloat(v.variant?.priceData?.price || v.price?.price || '0');
      await sql`INSERT INTO site_product_variants (id, product_id, wix_id, sku, price, weight, visible, options)
        VALUES (${v.id || v._id || `${p.id}_${Math.random().toString(36).substr(2, 6)}`}, ${p.id}, ${v.id || v._id || null}, ${v.sku || null}, ${vPrice || null}, ${v.weight || null}, ${v.visible !== false}, ${JSON.stringify(v.choices || v.options || {})})
        ON CONFLICT (id) DO UPDATE SET sku = EXCLUDED.sku, price = EXCLUDED.price, options = EXCLUDED.options, visible = EXCLUDED.visible`;
    }
  }

  // Sync collections
  try {
    const r = await fetch(`${WIX_BASE}/stores/v1/collections/query`, {
      method: 'POST', headers: WIX_HEADERS,
      body: JSON.stringify({ query: { paging: { limit: 100, offset: 0 } } }),
    });
    if (r.ok) {
      const data = await r.json();
      for (const c of (data.collections || [])) {
        await sql`INSERT INTO site_collections (id, wix_id, name, slug, description, image_url, visible)
          VALUES (${c.id}, ${c.id}, ${c.name || ''}, ${c.slug || ''}, ${c.description || null}, ${c.media?.mainMedia?.image?.url || null}, ${c.visible !== false})
          ON CONFLICT (wix_id) DO UPDATE SET name = EXCLUDED.name, slug = EXCLUDED.slug, description = EXCLUDED.description, image_url = EXCLUDED.image_url`;
      }
      // Link products to collections
      for (const c of (data.collections || [])) {
        if (c.productIds) {
          for (const pid of c.productIds) {
            await sql`INSERT INTO site_product_collections (product_id, collection_id) VALUES (${pid}, ${c.id}) ON CONFLICT DO NOTHING`;
          }
        }
      }
    }
  } catch { /* skip collections if API not available */ }

  return { products: allProducts.length };
}

async function syncSiteBlog() {
  const allPosts: any[] = [];
  let offset = 0;
  while (true) {
    const r = await fetch(`${WIX_BASE}/blog/v3/posts?paging.limit=100&paging.offset=${offset}&fieldsets=CONTENT_TEXT`, {
      method: 'GET', headers: WIX_HEADERS,
    });
    if (!r.ok) {
      const errText = await r.text().catch(() => 'unknown');
      await addLog('error', `Wix Blog API error (${r.status})`, errText.substring(0, 500));
      break;
    }
    const data = await r.json();
    const posts = data.posts || [];
    allPosts.push(...posts);
    if (posts.length < 100) break;
    offset += 100;
    await new Promise(r => setTimeout(r, 50));
  }

  for (const p of allPosts) {
    // Wix Blog v3: with fieldsets=CONTENT_TEXT, content comes in contentText or plainContent
    const content = p.contentText || p.plainContent || p.richContent?.text || p.content || '';
    const excerpt = (p.excerpt || content.substring(0, 200)).trim();
    const coverImage = p.coverImage?.url || p.coverImage?.image?.url || p.media?.image?.url || p.heroImage?.url || '';
    const tags = (p.tags || []).map((t: any) => typeof t === 'string' ? t : t.label || t.name || '');
    const categoryIds = (p.categoryIds || []);

    await sql`INSERT INTO site_blog_posts (id, wix_id, title, slug, content, excerpt, cover_image, status, author, category_ids, tags, published_at, synced_at)
      VALUES (${p.id || p._id}, ${p.id || p._id}, ${p.title || ''}, ${p.slug || ''}, ${content}, ${excerpt}, ${coverImage}, ${p.published ? 'published' : 'draft'}, ${p.author?.displayName || ''}, ${categoryIds}, ${tags}, ${p.firstPublishedDate || p.publishedDate || null}, NOW())
      ON CONFLICT (wix_id) DO UPDATE SET title = EXCLUDED.title, slug = EXCLUDED.slug, content = EXCLUDED.content, excerpt = EXCLUDED.excerpt, cover_image = EXCLUDED.cover_image, status = EXCLUDED.status, tags = EXCLUDED.tags, category_ids = EXCLUDED.category_ids, synced_at = NOW(), updated_at = NOW()`;
  }

  // Sync blog categories
  try {
    const r = await fetch(`${WIX_BASE}/blog/v3/categories?paging.limit=100`, {
      method: 'GET', headers: WIX_HEADERS,
    });
    if (r.ok) {
      const data = await r.json();
      for (const c of (data.categories || [])) {
        await sql`INSERT INTO site_blog_categories (id, wix_id, name, slug, post_count)
          VALUES (${c.id || c._id}, ${c.id || c._id}, ${c.label || c.name || ''}, ${c.slug || ''}, ${c.postCount || 0})
          ON CONFLICT (wix_id) DO UPDATE SET name = EXCLUDED.name, slug = EXCLUDED.slug, post_count = EXCLUDED.post_count`;
      }
    }
  } catch { /* skip */ }

  return { posts: allPosts.length };
}

async function syncSiteCoupons() {
  let total = 0;
  try {
    const r = await fetch(`${WIX_BASE}/marketing/v1/coupons/query`, {
      method: 'POST', headers: WIX_HEADERS,
      body: JSON.stringify({ query: { paging: { limit: 100, offset: 0 } } }),
    });
    if (r.ok) {
      const data = await r.json();
      const coupons = data.coupons || [];
      total = coupons.length;
      for (const c of coupons) {
        const type = c.moneyOffAmount ? 'moneyOff' : c.percentOffAmount ? 'percentOff' : c.freeShipping ? 'freeShipping' : c.fixedPriceAmount ? 'fixedPrice' : 'other';
        const value = c.moneyOffAmount || c.percentOffAmount || c.fixedPriceAmount || 0;
        await sql`INSERT INTO site_coupons (id, wix_id, code, type, value, min_purchase, usage_limit, usage_count, active, expires_at)
          VALUES (${c.id || c._id}, ${c.id || c._id}, ${c.code || ''}, ${type}, ${parseFloat(value) || 0}, ${parseFloat(c.minimumSubtotal) || null}, ${c.usageLimit || null}, ${c.numberOfUsages || 0}, ${c.active !== false}, ${c.expirationTime || null})
          ON CONFLICT (wix_id) DO UPDATE SET code = EXCLUDED.code, type = EXCLUDED.type, value = EXCLUDED.value, usage_count = EXCLUDED.usage_count, active = EXCLUDED.active, expires_at = EXCLUDED.expires_at`;
      }
    }
  } catch { /* skip */ }
  return { coupons: total };
}

async function handleSiteSync(req: VercelRequest, res: VercelResponse) {
  const syncType = (req.query.type as string) || 'all';
  await addLog('info', `סנכרון אתר: ${syncType}...`);

  const results: any = {};
  try {
    if (syncType === 'products' || syncType === 'all') {
      results.products = await syncSiteProducts();
    }
    if (syncType === 'blog' || syncType === 'all') {
      results.blog = await syncSiteBlog();
    }
    if (syncType === 'coupons' || syncType === 'all') {
      results.coupons = await syncSiteCoupons();
    }

    await addLog('success', `סנכרון אתר הושלם: ${JSON.stringify(results)}`);
    return res.json({ ok: true, results });
  } catch (error: any) {
    await addLog('error', 'שגיאת סנכרון אתר', error.message);
    return res.status(500).json({ error: error.message });
  }
}

// Also need GET handler for fetching site data from DB
async function handleSiteData(req: VercelRequest, res: VercelResponse) {
  const dataType = (req.query.data as string) || 'products';

  try {
    if (dataType === 'products') {
      const products = await sql`
        SELECT p.*,
          COALESCE((SELECT json_agg(json_build_object('id', m.id, 'url', m.url, 'thumbnail_url', m.thumbnail_url, 'media_type', m.media_type, 'alt_text', m.alt_text) ORDER BY m.sort_order) FROM site_product_media m WHERE m.product_id = p.id), '[]') as media,
          COALESCE((SELECT json_agg(json_build_object('id', v.id, 'sku', v.sku, 'price', v.price, 'options', v.options, 'in_stock', v.in_stock) ) FROM site_product_variants v WHERE v.product_id = p.id), '[]') as variants
        FROM site_products p ORDER BY p.updated_at DESC`;
      return res.json({ products });
    }
    if (dataType === 'collections') {
      const collections = await sql`SELECT * FROM site_collections ORDER BY sort_order, name`;
      return res.json({ collections });
    }
    if (dataType === 'blog') {
      const posts = await sql`SELECT * FROM site_blog_posts ORDER BY published_at DESC NULLS LAST`;
      const categories = await sql`SELECT * FROM site_blog_categories ORDER BY post_count DESC`;
      return res.json({ posts, categories });
    }
    if (dataType === 'coupons') {
      const coupons = await sql`SELECT * FROM site_coupons ORDER BY created_at DESC`;
      return res.json({ coupons });
    }
    if (dataType === 'social') {
      const links = await sql`SELECT * FROM site_social_links ORDER BY platform`;
      return res.json({ links });
    }
    if (dataType === 'stats') {
      const [products, posts, coupons, collections] = await Promise.all([
        sql`SELECT COUNT(*) as count FROM site_products`,
        sql`SELECT COUNT(*) as count FROM site_blog_posts`,
        sql`SELECT COUNT(*) as count FROM site_coupons`,
        sql`SELECT COUNT(*) as count FROM site_collections`,
      ]);
      return res.json({
        products: parseInt(products[0]?.count) || 0,
        posts: parseInt(posts[0]?.count) || 0,
        coupons: parseInt(coupons[0]?.count) || 0,
        collections: parseInt(collections[0]?.count) || 0,
      });
    }
    return res.status(400).json({ error: 'Invalid data type' });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
}

// ==================== MAIN HANDLER ====================

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const user = await verifyAuth(req);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });

  // Route: GET = fetch site data, POST with type=site-* = site sync
  const syncType = (req.query.type as string) || '';
  const action = (req.query.action as string) || '';

  if (req.method === 'GET') {
    return handleSiteData(req, res);
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Save blog post (local DB only)
  if (action === 'save-blog-post') {
    try {
      const { id, title, content, excerpt, cover_image, tags, seo_title, seo_description } = req.body || {};
      if (!title) return res.status(400).json({ error: 'title required' });
      const postId = id || `local_${Date.now()}`;
      const slug = title.replace(/\s+/g, '-').toLowerCase();
      await sql`INSERT INTO site_blog_posts (id, wix_id, title, slug, content, excerpt, cover_image, status, author, category_ids, tags, seo_title, seo_description, synced_at)
        VALUES (${postId}, ${postId}, ${title}, ${slug}, ${content || ''}, ${excerpt || ''}, ${cover_image || ''}, 'draft', 'MeWatch', ${[]}, ${tags || []}, ${seo_title || null}, ${seo_description || null}, NOW())
        ON CONFLICT (wix_id) DO UPDATE SET title = EXCLUDED.title, slug = EXCLUDED.slug, content = EXCLUDED.content, excerpt = EXCLUDED.excerpt, cover_image = EXCLUDED.cover_image, tags = EXCLUDED.tags, updated_at = NOW()`;
      await addLog('info', `Blog post saved: ${title}`);
      return res.json({ ok: true, id: postId });
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  }

  // Save social link
  if (action === 'save-social') {
    try {
      const { platform, url, followers } = req.body || {};
      if (!platform || !url) return res.status(400).json({ error: 'platform and url required' });
      await sql`INSERT INTO site_social_links (platform, url, followers, last_checked)
        VALUES (${platform}, ${url}, ${followers || null}, NOW())
        ON CONFLICT (id) DO NOTHING`;
      return res.json({ ok: true });
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  }

  // Site sync routes
  if (syncType.startsWith('site')) {
    req.query.type = syncType.replace('site-', '') || 'all';
    return handleSiteSync(req, res);
  }

  // Original CRM sync
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
      await new Promise(r => setTimeout(r, 50));
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
      await new Promise(r => setTimeout(r, 30));
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
        await new Promise(r => setTimeout(r, 30));
      }
      if (ecomOrders.length > 0) await addLog('info', `נטענו ${ecomOrders.length} הזמנות חנות (e-commerce).`);
    } catch { /* skip */ }

    // ==================== BUILD DAILY SALES (early — before heavy processing) ====================
    const dailySalesMap: Record<string, { sales: number; orders: number; refunds: number }> = {};
    const toIsraelDate = (dateStr: string): string | null => {
      try {
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return null;
        return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' }); // YYYY-MM-DD
      } catch { return null; }
    };

    // Aggregate pricing plan orders — try multiple price field locations
    let ppMatched = 0, ppSkipped = 0;
    for (const order of allOrders) {
      const dateStr = order.startDate || order.createdDate || order._createdDate;
      if (!dateStr) continue;
      const date = toIsraelDate(dateStr);
      if (!date) continue;
      const price = parseFloat(
        order.planPrice || order.priceDetails?.planPrice ||
        order.pricing?.prices?.[0]?.price?.total || order.pricing?.prices?.[0]?.price?.amount ||
        order.priceDetails?.total || order.priceDetails?.subtotal ||
        order.pricing?.singlePaymentForDuration?.amount ||
        order.pricing?.subscription?.cycleDuration?.price?.amount ||
        order.totalPrice || order.amount ||
        '0'
      );
      if (price <= 0) { ppSkipped++; continue; }
      ppMatched++;
      if (!dailySalesMap[date]) dailySalesMap[date] = { sales: 0, orders: 0, refunds: 0 };
      dailySalesMap[date].sales += price;
      dailySalesMap[date].orders += 1;
      if (order.lastPaymentStatus === 'REFUNDED') dailySalesMap[date].refunds += price;
    }
    await addLog('info', `Pricing plan: ${ppMatched} עם מחיר, ${ppSkipped} ללא מחיר מתוך ${allOrders.length}.`);

    // Log sample order structure for debugging (first order with price=0)
    if (ppSkipped > ppMatched && allOrders.length > 0) {
      const sample = allOrders.find((o: any) => {
        const p = parseFloat(o.planPrice || o.priceDetails?.planPrice || o.pricing?.prices?.[0]?.price?.total || o.pricing?.prices?.[0]?.price?.amount || o.priceDetails?.total || o.totalPrice || '0');
        return p <= 0;
      });
      if (sample) {
        const keys = Object.keys(sample).join(', ');
        const priceKeys = sample.pricing ? JSON.stringify(sample.pricing).substring(0, 300) : 'no pricing';
        const priceDetails = sample.priceDetails ? JSON.stringify(sample.priceDetails).substring(0, 300) : 'no priceDetails';
        await addLog('info', `Sample order keys: ${keys}`, `pricing: ${priceKeys} | priceDetails: ${priceDetails}`);
      }
    }

    // Aggregate ecommerce orders
    for (const eo of ecomOrders) {
      const dateStr = eo._createdDate || eo.createdDate || eo.dateCreated;
      if (!dateStr) continue;
      const date = toIsraelDate(dateStr);
      if (!date) continue;
      const amount = parseFloat(eo.priceSummary?.total?.amount || eo.totals?.total || '0');
      if (amount <= 0) continue;
      if (!dailySalesMap[date]) dailySalesMap[date] = { sales: 0, orders: 0, refunds: 0 };
      dailySalesMap[date].sales += amount;
      dailySalesMap[date].orders += 1;
    }

    // Upsert daily sales to DB — use GREATEST to never overwrite higher existing values
    const dailyEntries = Object.entries(dailySalesMap);
    for (let i = 0; i < dailyEntries.length; i += 20) {
      const batch = dailyEntries.slice(i, i + 20);
      await Promise.all(batch.map(([date, data]) =>
        sql`INSERT INTO daily_sales (sale_date, total_sales, total_orders, avg_order_value, refunds)
          VALUES (${date}, ${data.sales}, ${data.orders}, ${data.orders > 0 ? data.sales / data.orders : 0}, ${data.refunds})
          ON CONFLICT (sale_date) DO UPDATE SET
            total_sales = GREATEST(EXCLUDED.total_sales, daily_sales.total_sales),
            total_orders = GREATEST(EXCLUDED.total_orders, daily_sales.total_orders),
            avg_order_value = CASE WHEN EXCLUDED.total_sales >= daily_sales.total_sales THEN EXCLUDED.avg_order_value ELSE daily_sales.avg_order_value END,
            refunds = GREATEST(EXCLUDED.refunds, daily_sales.refunds)`
      ));
    }
    await addLog('info', `עודכנו ${dailyEntries.length} ימי מכירות ב-daily_sales.`);

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
        await new Promise(r => setTimeout(r, 30));
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

    // Upsert leads to DB in parallel batches (preserve existing statusId, notes, reminderAt)
    const BATCH = 20;
    for (let i = 0; i < wixLeads.length; i += BATCH) {
      const batch = wixLeads.slice(i, i + BATCH);
      await Promise.all(batch.map(lead =>
        sql`INSERT INTO leads (id, name, phone, email, status_id, created_at, dynamic_data, notes, source)
            VALUES (${lead.id}, ${lead.name}, ${lead.phone}, ${lead.email || null}, ${lead.statusId}, ${lead.createdAt}, ${JSON.stringify(lead.dynamicData)}, ${JSON.stringify(lead.notes)}, ${'wix'})
            ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, phone = EXCLUDED.phone, email = EXCLUDED.email, dynamic_data = EXCLUDED.dynamic_data, source = EXCLUDED.source`
      ));
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

    // Upsert customers to DB in parallel batches (only subscribers + ecom buyers, skip contact-only)
    const customersToSave = Array.from(customerMap.values()).filter((c: any) => !c.tags.includes('contact_only') || c.tags.length > 1);
    for (let i = 0; i < customersToSave.length; i += BATCH) {
      const batch = customersToSave.slice(i, i + BATCH);
      await Promise.all(batch.map((customer: any) =>
        sql`INSERT INTO customers (id, name, phone, email, source, created_at, subscription_ids, inquiry_ids, tags, total_spent, ecom_spent, last_activity, wix_member_status)
            VALUES (${customer.id}, ${customer.name}, ${customer.phone || ''}, ${customer.email || null}, ${customer.source}, ${customer.createdAt}, ${customer.subscriptionIds}, ${customer.inquiryIds}, ${customer.tags}, ${customer.totalSpent || 0}, ${customer.ecomSpent || 0}, ${customer.lastActivity || null}, ${customer.wixMemberStatus || null})
            ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, phone = EXCLUDED.phone, email = EXCLUDED.email, subscription_ids = EXCLUDED.subscription_ids, tags = EXCLUDED.tags, total_spent = EXCLUDED.total_spent, ecom_spent = EXCLUDED.ecom_spent, last_activity = EXCLUDED.last_activity, wix_member_status = EXCLUDED.wix_member_status`
      ));
    }

    // Link leads to customers in parallel batches
    const linkPairs: { custId: string; sid: string }[] = [];
    for (const [, customer] of customerMap) {
      for (const sid of (customer as any).subscriptionIds) linkPairs.push({ custId: (customer as any).id, sid });
    }
    for (let i = 0; i < linkPairs.length; i += BATCH) {
      const batch = linkPairs.slice(i, i + BATCH);
      await Promise.all(batch.map(p => sql`UPDATE leads SET customer_id = ${p.custId} WHERE id = ${p.sid}`));
    }

    // Build inquiries from form submissions (batch)
    if (wixFormSubmissions.length > 0) {
      const inquiries = wixFormSubmissions.map(sub => {
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
            if (phone && cust.phone && cust.phone.replace(/[^0-9]/g, '') === phone.replace(/[^0-9]/g, '')) { customerId = cust.id; break; }
          }
        }
        return { id: sub._id || sub.id || Math.random().toString(36).substr(2, 9), customerId, name, phone, email, subject, message, createdAt: sub._createdDate || sub.createdDate || sub.submittedDate || new Date().toISOString() };
      });
      for (let i = 0; i < inquiries.length; i += BATCH) {
        const batch = inquiries.slice(i, i + BATCH);
        await Promise.all(batch.map(inq =>
          sql`INSERT INTO inquiries (id, customer_id, name, phone, email, subject, message, source, status, created_at)
              VALUES (${inq.id}, ${inq.customerId}, ${inq.name}, ${inq.phone}, ${inq.email}, ${inq.subject}, ${inq.message}, ${'wix_form'}, ${'new'}, ${inq.createdAt})
              ON CONFLICT (id) DO UPDATE SET customer_id = EXCLUDED.customer_id, name = EXCLUDED.name, phone = EXCLUDED.phone, email = EXCLUDED.email, subject = EXCLUDED.subject, message = EXCLUDED.message`
        ));
      }
      await addLog('info', `${wixFormSubmissions.length} פניות מטפסים עובדו.`);
    }

    const subscriberCount = Array.from(customerMap.values()).filter((c: any) => c.tags.includes('subscriber')).length;
    await addLog('success', `סנכרון מלא הושלם! ${wixLeads.length} מנויים, ${customersToSave.length} לקוחות נשמרו (${subscriberCount} מנויים). ${allOrders.length} הזמנות מנויים${ecomOrders.length > 0 ? ` + ${ecomOrders.length} הזמנות חנות` : ''}.`);

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
