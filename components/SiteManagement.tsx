
import React, { useState, useEffect, useCallback } from 'react';
import { SiteProduct, SiteCollection, SiteBlogPost, SiteBlogCategory, SiteCoupon, SiteSocialLink, SiteStats } from '../types';
import api from '../lib/api';

type SiteTab = 'overview' | 'products' | 'blog' | 'coupons' | 'social';

const TABS: { id: SiteTab; label: string; icon: string }[] = [
  { id: 'overview', label: 'סקירה כללית', icon: '📊' },
  { id: 'products', label: 'מוצרים', icon: '🛍️' },
  { id: 'blog', label: 'בלוג', icon: '📝' },
  { id: 'coupons', label: 'קופונים', icon: '🎟️' },
  { id: 'social', label: 'רשתות חברתיות', icon: '📱' },
];

const SiteManagement: React.FC = () => {
  const [activeTab, setActiveTab] = useState<SiteTab>('overview');
  const [stats, setStats] = useState<SiteStats | null>(null);
  const [products, setProducts] = useState<SiteProduct[]>([]);
  const [collections, setCollections] = useState<SiteCollection[]>([]);
  const [blogPosts, setBlogPosts] = useState<SiteBlogPost[]>([]);
  const [blogCategories, setBlogCategories] = useState<SiteBlogCategory[]>([]);
  const [coupons, setCoupons] = useState<SiteCoupon[]>([]);
  const [socialLinks, setSocialLinks] = useState<SiteSocialLink[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<SiteProduct | null>(null);

  useEffect(() => {
    loadStats();
  }, []);

  useEffect(() => {
    if (activeTab === 'products' && products.length === 0) loadProducts();
    if (activeTab === 'blog' && blogPosts.length === 0) loadBlog();
    if (activeTab === 'coupons' && coupons.length === 0) loadCoupons();
    if (activeTab === 'social' && socialLinks.length === 0) loadSocial();
  }, [activeTab]);

  const loadStats = async () => {
    try {
      const data = await api.getSiteStats();
      setStats(data);
    } catch {}
  };

  const loadProducts = async () => {
    setLoading(true);
    try {
      const data = await api.getSiteProducts();
      setProducts(data.products || []);
    } catch {} finally { setLoading(false); }
  };

  const loadBlog = async () => {
    setLoading(true);
    try {
      const data = await api.getSiteBlog();
      setBlogPosts(data.posts || []);
      setBlogCategories(data.categories || []);
    } catch {} finally { setLoading(false); }
  };

  const loadCoupons = async () => {
    setLoading(true);
    try {
      const data = await api.getSiteCoupons();
      setCoupons(data.coupons || []);
    } catch {} finally { setLoading(false); }
  };

  const loadSocial = async () => {
    try {
      const data = await api.getSiteSocial();
      setSocialLinks(data.links || []);
    } catch {}
  };

  const handleSync = useCallback(async (type = 'all') => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const result = await api.syncSite(type);
      const parts: string[] = [];
      if (result.results?.products) parts.push(`${result.results.products.products} מוצרים`);
      if (result.results?.blog) parts.push(`${result.results.blog.posts} פוסטים`);
      if (result.results?.coupons) parts.push(`${result.results.coupons.coupons} קופונים`);
      setSyncResult(`סנכרון הושלם: ${parts.join(', ') || 'הצלחה'}`);
      loadStats();
      if (activeTab === 'products') loadProducts();
      if (activeTab === 'blog') loadBlog();
      if (activeTab === 'coupons') loadCoupons();
    } catch (err: any) {
      setSyncResult(`שגיאת סנכרון: ${err.message}`);
    } finally {
      setSyncing(false);
    }
  }, [activeTab]);

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-4 md:px-6 py-4 border-b border-gray-200 bg-gradient-to-l from-emerald-50 to-teal-50">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-xl font-black text-gray-800 flex items-center gap-2">
              🌐 ניהול אתר
            </h1>
            <p className="text-xs text-gray-500 mt-0.5">מוצרים, בלוג, קופונים, רשתות חברתיות</p>
          </div>
          <button
            onClick={() => handleSync()}
            disabled={syncing}
            className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50 text-sm font-bold flex items-center gap-2 shadow-lg shadow-emerald-200"
          >
            <svg className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
            {syncing ? 'מסנכרן...' : 'סנכרון מ-Wix'}
          </button>
        </div>

        {syncResult && (
          <div className={`text-xs px-3 py-1.5 rounded-lg mb-2 ${syncResult.includes('שגיאה') ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>
            {syncResult}
          </div>
        )}

        {/* Sub-tabs */}
        <div className="flex gap-1 overflow-x-auto">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                activeTab === tab.id
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-white/60 text-gray-600 hover:bg-white'
              }`}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        {activeTab === 'overview' && <OverviewTab stats={stats} onSync={handleSync} syncing={syncing} />}
        {activeTab === 'products' && (
          selectedProduct
            ? <ProductDetail product={selectedProduct} onBack={() => setSelectedProduct(null)} />
            : <ProductsTab products={products} loading={loading} onSelect={setSelectedProduct} />
        )}
        {activeTab === 'blog' && <BlogTab posts={blogPosts} categories={blogCategories} loading={loading} />}
        {activeTab === 'coupons' && <CouponsTab coupons={coupons} loading={loading} />}
        {activeTab === 'social' && <SocialTab links={socialLinks} onRefresh={loadSocial} />}
      </div>
    </div>
  );
};

// ==================== SUB COMPONENTS ====================

const OverviewTab: React.FC<{ stats: SiteStats | null; onSync: (type: string) => void; syncing: boolean }> = ({ stats, onSync, syncing }) => (
  <div className="space-y-6">
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {[
        { label: 'מוצרים', value: stats?.products || 0, icon: '🛍️', color: 'bg-blue-50 border-blue-200 text-blue-700' },
        { label: 'פוסטי בלוג', value: stats?.posts || 0, icon: '📝', color: 'bg-purple-50 border-purple-200 text-purple-700' },
        { label: 'קופונים', value: stats?.coupons || 0, icon: '🎟️', color: 'bg-orange-50 border-orange-200 text-orange-700' },
        { label: 'קטגוריות', value: stats?.collections || 0, icon: '📂', color: 'bg-emerald-50 border-emerald-200 text-emerald-700' },
      ].map(card => (
        <div key={card.label} className={`rounded-2xl p-4 border ${card.color} text-center`}>
          <div className="text-2xl mb-1">{card.icon}</div>
          <div className="text-3xl font-black">{card.value}</div>
          <div className="text-xs font-medium opacity-70">{card.label}</div>
        </div>
      ))}
    </div>

    {stats && (stats.products === 0 && stats.posts === 0) && (
      <div className="bg-gray-50 rounded-2xl p-8 text-center border-2 border-dashed border-gray-200">
        <div className="text-5xl mb-4">🔗</div>
        <h3 className="text-lg font-bold text-gray-700 mb-2">עדיין אין נתונים</h3>
        <p className="text-sm text-gray-500 mb-4">לחץ על "סנכרון מ-Wix" כדי לשלוף את כל המוצרים, הבלוג והקופונים</p>
        <button
          onClick={() => onSync('all')}
          disabled={syncing}
          className="px-6 py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-colors disabled:opacity-50"
        >
          {syncing ? 'מסנכרן...' : '🚀 התחל סנכרון'}
        </button>
      </div>
    )}

    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
      {[
        { label: 'סנכרון מוצרים', type: 'products', icon: '🛍️' },
        { label: 'סנכרון בלוג', type: 'blog', icon: '📝' },
        { label: 'סנכרון קופונים', type: 'coupons', icon: '🎟️' },
      ].map(btn => (
        <button
          key={btn.type}
          onClick={() => onSync(btn.type)}
          disabled={syncing}
          className="flex items-center gap-3 px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
        >
          <span className="text-xl">{btn.icon}</span>
          <span className="font-medium">{btn.label}</span>
        </button>
      ))}
    </div>
  </div>
);

const ProductsTab: React.FC<{ products: SiteProduct[]; loading: boolean; onSelect: (p: SiteProduct) => void }> = ({ products, loading, onSelect }) => {
  const [search, setSearch] = useState('');
  const filtered = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.sku && p.sku.toLowerCase().includes(search.toLowerCase()))
  );

  if (loading) return <div className="flex items-center justify-center h-40 text-gray-400"><LoadingDots /> <span className="mr-2 text-sm">טוען מוצרים...</span></div>;

  return (
    <div className="space-y-4">
      <input
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="חיפוש מוצר..."
        className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-400 outline-none"
      />
      {filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-400 text-sm">{products.length === 0 ? 'אין מוצרים — לחץ "סנכרון מ-Wix"' : 'לא נמצאו תוצאות'}</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map(p => (
            <div
              key={p.id}
              onClick={() => onSelect(p)}
              className="bg-white border border-gray-200 rounded-xl overflow-hidden hover:shadow-lg transition-shadow cursor-pointer"
            >
              {p.media?.[0]?.url ? (
                <img src={p.media[0].url} alt={p.name} className="w-full h-40 object-cover" />
              ) : (
                <div className="w-full h-40 bg-gray-100 flex items-center justify-center text-3xl text-gray-300">🖼️</div>
              )}
              <div className="p-3">
                <h3 className="font-bold text-sm text-gray-800 truncate">{p.name}</h3>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-emerald-600 font-black text-lg">₪{p.price}</span>
                  {p.compare_price && p.compare_price > p.price && (
                    <span className="text-xs text-gray-400 line-through">₪{p.compare_price}</span>
                  )}
                </div>
                <div className="flex gap-1 mt-2">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full ${p.visible ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {p.visible ? 'מוצג' : 'מוסתר'}
                  </span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full ${p.in_stock ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'}`}>
                    {p.in_stock ? 'במלאי' : 'אזל'}
                  </span>
                  {p.sku && <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">{p.sku}</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const ProductDetail: React.FC<{ product: SiteProduct; onBack: () => void }> = ({ product, onBack }) => (
  <div className="space-y-4">
    <button onClick={onBack} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 transition-colors">
      → חזרה למוצרים
    </button>
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
      {/* Images */}
      {product.media && product.media.length > 0 && (
        <div className="flex gap-2 p-4 overflow-x-auto">
          {product.media.map((m, i) => (
            <img key={i} src={m.url} alt={m.alt_text || product.name} className="h-48 rounded-xl object-cover shrink-0" />
          ))}
        </div>
      )}
      <div className="p-4 md:p-6 space-y-4">
        <div>
          <h2 className="text-2xl font-black text-gray-800">{product.name}</h2>
          {product.slug && <p className="text-xs text-gray-400 mt-1">/{product.slug}</p>}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-3xl font-black text-emerald-600">₪{product.price}</span>
          {product.compare_price && product.compare_price > product.price && (
            <span className="text-lg text-gray-400 line-through">₪{product.compare_price}</span>
          )}
        </div>
        {product.description && (
          <div className="text-sm text-gray-600 leading-relaxed" dangerouslySetInnerHTML={{ __html: product.description }} />
        )}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'SKU', value: product.sku || '-' },
            { label: 'סוג', value: product.product_type || '-' },
            { label: 'משקל', value: product.weight ? `${product.weight} ק"ג` : '-' },
            { label: 'מלאי', value: product.track_inventory ? `${product.quantity} יח'` : 'לא נעקב' },
          ].map(f => (
            <div key={f.label} className="bg-gray-50 rounded-xl p-3">
              <div className="text-[10px] text-gray-400 font-medium">{f.label}</div>
              <div className="text-sm font-bold text-gray-700">{f.value}</div>
            </div>
          ))}
        </div>
        {product.specs && Object.keys(product.specs).length > 0 && (
          <div>
            <h3 className="font-bold text-gray-700 mb-2">מפרט טכני</h3>
            {Object.entries(product.specs).map(([key, val]) => (
              <div key={key} className="flex border-b border-gray-100 py-2 text-sm">
                <span className="font-medium text-gray-600 w-1/3">{key}</span>
                <span className="text-gray-800" dangerouslySetInnerHTML={{ __html: val }} />
              </div>
            ))}
          </div>
        )}
        {product.variants && product.variants.length > 0 && (
          <div>
            <h3 className="font-bold text-gray-700 mb-2">וריאנטים ({product.variants.length})</h3>
            <div className="space-y-1">
              {product.variants.map(v => (
                <div key={v.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2 text-sm">
                  <span className="text-gray-600">{Object.values(v.options || {}).join(' / ') || v.sku || v.id}</span>
                  <div className="flex items-center gap-3">
                    {v.price && <span className="font-bold">₪{v.price}</span>}
                    <span className={`text-[10px] px-2 py-0.5 rounded-full ${v.in_stock ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {v.in_stock ? 'במלאי' : 'אזל'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  </div>
);

const BlogTab: React.FC<{ posts: SiteBlogPost[]; categories: SiteBlogCategory[]; loading: boolean }> = ({ posts, categories, loading }) => {
  if (loading) return <div className="flex items-center justify-center h-40 text-gray-400"><LoadingDots /> <span className="mr-2 text-sm">טוען פוסטים...</span></div>;

  return (
    <div className="space-y-4">
      {categories.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {categories.map(c => (
            <span key={c.id} className="px-3 py-1 bg-purple-50 border border-purple-200 rounded-full text-xs text-purple-700 font-medium">
              {c.name} ({c.post_count})
            </span>
          ))}
        </div>
      )}
      {posts.length === 0 ? (
        <div className="text-center py-12 text-gray-400 text-sm">אין פוסטים — לחץ "סנכרון מ-Wix"</div>
      ) : (
        <div className="space-y-3">
          {posts.map(post => (
            <div key={post.id} className="bg-white border border-gray-200 rounded-xl p-4 flex gap-4 hover:shadow-md transition-shadow">
              {post.cover_image && (
                <img src={post.cover_image} alt={post.title} className="w-24 h-24 rounded-lg object-cover shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-gray-800 truncate">{post.title}</h3>
                <p className="text-xs text-gray-500 mt-1 line-clamp-2">{post.excerpt}</p>
                <div className="flex items-center gap-2 mt-2">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full ${post.status === 'published' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                    {post.status === 'published' ? 'מפורסם' : 'טיוטה'}
                  </span>
                  {post.author && <span className="text-[10px] text-gray-400">{post.author}</span>}
                  {post.published_at && <span className="text-[10px] text-gray-400">{new Date(post.published_at).toLocaleDateString('he-IL')}</span>}
                </div>
                {post.tags && post.tags.length > 0 && (
                  <div className="flex gap-1 mt-2 flex-wrap">
                    {post.tags.slice(0, 5).map(t => (
                      <span key={t} className="text-[10px] px-1.5 py-0.5 bg-gray-100 rounded text-gray-500">#{t}</span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const CouponsTab: React.FC<{ coupons: SiteCoupon[]; loading: boolean }> = ({ coupons, loading }) => {
  if (loading) return <div className="flex items-center justify-center h-40 text-gray-400"><LoadingDots /> <span className="mr-2 text-sm">טוען קופונים...</span></div>;

  const typeLabels: Record<string, string> = { moneyOff: 'הנחה בשקלים', percentOff: 'הנחה באחוזים', freeShipping: 'משלוח חינם', fixedPrice: 'מחיר קבוע' };

  return (
    <div className="space-y-3">
      {coupons.length === 0 ? (
        <div className="text-center py-12 text-gray-400 text-sm">אין קופונים — לחץ "סנכרון מ-Wix"</div>
      ) : coupons.map(c => (
        <div key={c.id} className="bg-white border border-gray-200 rounded-xl p-4 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono font-bold text-lg text-gray-800 bg-gray-50 px-3 py-1 rounded-lg border border-dashed border-gray-300">{c.code}</span>
              <span className={`text-[10px] px-2 py-0.5 rounded-full ${c.active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                {c.active ? 'פעיל' : 'לא פעיל'}
              </span>
            </div>
            <div className="text-xs text-gray-500 mt-1">
              {typeLabels[c.type] || c.type} · {c.type === 'percentOff' ? `${c.value}%` : c.type === 'freeShipping' ? '' : `₪${c.value}`}
              {c.usage_limit && ` · עד ${c.usage_limit} שימושים`}
              {c.expires_at && ` · עד ${new Date(c.expires_at).toLocaleDateString('he-IL')}`}
            </div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-black text-orange-600">{c.usage_count}</div>
            <div className="text-[10px] text-gray-400">שימושים</div>
          </div>
        </div>
      ))}
    </div>
  );
};

const SocialTab: React.FC<{ links: SiteSocialLink[]; onRefresh: () => void }> = ({ links, onRefresh }) => {
  const [newPlatform, setNewPlatform] = useState('');
  const [newUrl, setNewUrl] = useState('');

  const platforms = [
    { id: 'facebook', label: 'Facebook', icon: '📘', color: 'bg-blue-50 border-blue-200' },
    { id: 'instagram', label: 'Instagram', icon: '📸', color: 'bg-pink-50 border-pink-200' },
    { id: 'tiktok', label: 'TikTok', icon: '🎵', color: 'bg-gray-50 border-gray-300' },
    { id: 'youtube', label: 'YouTube', icon: '🎬', color: 'bg-red-50 border-red-200' },
  ];

  const handleAdd = async () => {
    if (!newPlatform || !newUrl) return;
    try {
      await api.saveSocialLink({ platform: newPlatform, url: newUrl });
      setNewPlatform('');
      setNewUrl('');
      onRefresh();
    } catch {}
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {platforms.map(p => {
          const link = links.find(l => l.platform === p.id);
          return (
            <div key={p.id} className={`rounded-xl border p-4 text-center ${p.color}`}>
              <div className="text-3xl mb-2">{p.icon}</div>
              <div className="font-bold text-sm text-gray-700">{p.label}</div>
              {link ? (
                <a href={link.url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 hover:underline mt-1 block truncate">{link.url}</a>
              ) : (
                <span className="text-xs text-gray-400 mt-1 block">לא מחובר</span>
              )}
            </div>
          );
        })}
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <h3 className="font-bold text-sm text-gray-700 mb-3">הוסף קישור לרשת חברתית</h3>
        <div className="flex gap-2">
          <select
            value={newPlatform}
            onChange={e => setNewPlatform(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white"
          >
            <option value="">בחר רשת...</option>
            {platforms.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
          <input
            value={newUrl}
            onChange={e => setNewUrl(e.target.value)}
            placeholder="https://..."
            className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm"
          />
          <button
            onClick={handleAdd}
            disabled={!newPlatform || !newUrl}
            className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-bold disabled:opacity-50 hover:bg-emerald-700 transition-colors"
          >
            הוסף
          </button>
        </div>
      </div>
    </div>
  );
};

const LoadingDots = () => (
  <div className="flex gap-1">
    <span className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
    <span className="w-2 h-2 bg-teal-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
    <span className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
  </div>
);

export default SiteManagement;
