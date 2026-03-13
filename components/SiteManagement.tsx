
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
      const [prodData, collData] = await Promise.all([api.getSiteProducts(), api.getSiteCollections()]);
      setProducts(prodData.products || []);
      setCollections(collData.collections || []);
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
            ? <ProductEditor product={selectedProduct} collections={collections} onBack={() => setSelectedProduct(null)} onReload={loadProducts} />
            : <ProductsTab products={products} collections={collections} loading={loading} onSelect={setSelectedProduct} onNewProduct={() => setSelectedProduct({ id: '', wix_id: '', name: '', slug: '', description: '', price: 0, currency: 'ILS', visible: true, in_stock: true, track_inventory: false, quantity: 0, specs: {}, media: [], variants: [], collection_ids: [], created_at: '', updated_at: '' })} />
        )}
        {activeTab === 'blog' && <BlogTab posts={blogPosts} categories={blogCategories} loading={loading} onReload={loadBlog} />}
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

const ProductsTab: React.FC<{ products: SiteProduct[]; collections: SiteCollection[]; loading: boolean; onSelect: (p: SiteProduct) => void; onNewProduct: () => void }> = ({ products, collections, loading, onSelect, onNewProduct }) => {
  const [search, setSearch] = useState('');
  const [filterCol, setFilterCol] = useState('');

  const collectionCounts = React.useMemo(() => {
    const counts: Record<string, number> = {};
    products.forEach(p => (p.collection_ids || []).forEach(cid => { counts[cid] = (counts[cid] || 0) + 1; }));
    return counts;
  }, [products]);

  const filtered = products.filter(p => {
    const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase()) || (p.sku && p.sku.toLowerCase().includes(search.toLowerCase()));
    const matchCol = !filterCol || (p.collection_ids || []).includes(filterCol);
    return matchSearch && matchCol;
  });

  if (loading) return <div className="flex items-center justify-center h-40 text-gray-400"><LoadingDots /> <span className="mr-2 text-sm">טוען מוצרים...</span></div>;

  return (
    <div className="space-y-4">
      {/* Top bar: search + new product */}
      <div className="flex items-center gap-3">
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="חיפוש מוצר..."
          className="flex-1 px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-400 outline-none" />
        <button onClick={onNewProduct}
          className="px-4 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 transition-colors flex items-center gap-1 shadow-lg shadow-blue-200 whitespace-nowrap">
          ➕ מוצר חדש
        </button>
      </div>

      {/* Category filter chips */}
      {collections.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          <button onClick={() => setFilterCol('')}
            className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors shrink-0 ${!filterCol ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}>
            הכל ({products.length})
          </button>
          {collections.filter(c => collectionCounts[c.id]).map(c => (
            <button key={c.id} onClick={() => setFilterCol(filterCol === c.id ? '' : c.id)}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors shrink-0 ${filterCol === c.id ? 'bg-blue-600 text-white border-blue-600' : 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100'}`}>
              {c.name} ({collectionCounts[c.id] || 0})
            </button>
          ))}
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-400 text-sm">{products.length === 0 ? 'אין מוצרים — לחץ "סנכרון מ-Wix"' : 'לא נמצאו תוצאות'}</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map(p => (
            <div key={p.id} onClick={() => onSelect(p)}
              className="bg-white border border-gray-200 rounded-xl overflow-hidden hover:shadow-lg transition-shadow cursor-pointer">
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

const ProductEditor: React.FC<{ product: SiteProduct; collections: SiteCollection[]; onBack: () => void; onReload: () => void }> = ({ product, collections, onBack, onReload }) => {
  const isNew = !product.id;
  const [name, setName] = useState(product.name);
  const [slug, setSlug] = useState(product.slug);
  const [description, setDescription] = useState(product.description);
  const [price, setPrice] = useState(String(product.price || ''));
  const [comparePrice, setComparePrice] = useState(String(product.compare_price || ''));
  const [sku, setSku] = useState(product.sku || '');
  const [weight, setWeight] = useState(String(product.weight || ''));
  const [productType, setProductType] = useState(product.product_type || 'physical');
  const [visible, setVisible] = useState(product.visible);
  const [inStock, setInStock] = useState(product.in_stock);
  const [trackInventory, setTrackInventory] = useState(product.track_inventory);
  const [quantity, setQuantity] = useState(String(product.quantity || 0));
  const [media, setMedia] = useState(product.media || []);
  const [newMediaUrl, setNewMediaUrl] = useState('');
  const [newMediaType, setNewMediaType] = useState<'image' | 'video'>('image');
  const [specs, setSpecs] = useState<{ key: string; value: string }[]>(Object.entries(product.specs || {}).map(([k, v]) => ({ key: k, value: v })));
  const [variants, setVariants] = useState(product.variants || []);
  const [collectionIds, setCollectionIds] = useState<string[]>(product.collection_ids || []);
  const [seoTitle, setSeoTitle] = useState(product.seo_title || '');
  const [seoDesc, setSeoDesc] = useState(product.seo_description || '');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) return alert('שם מוצר חובה');
    setSaving(true);
    try {
      const data = {
        id: product.id || undefined, wix_id: product.wix_id || undefined,
        name, slug: slug || name.replace(/\s+/g, '-').toLowerCase(), description,
        price: parseFloat(price) || 0, compare_price: parseFloat(comparePrice) || 0,
        sku, weight: parseFloat(weight) || 0, product_type: productType,
        visible, in_stock: inStock, track_inventory: trackInventory, quantity: parseInt(quantity) || 0,
        media: media.map((m, i) => ({ url: m.url, thumbnail_url: m.thumbnail_url || m.url, media_type: m.media_type || 'image', alt_text: m.alt_text || '' })),
        specs: Object.fromEntries(specs.filter(s => s.key.trim()).map(s => [s.key, s.value])),
        variants: variants.map(v => ({ id: v.id, sku: v.sku, price: v.price, options: v.options, visible: true, in_stock: v.in_stock })),
        collection_ids: collectionIds,
        seo_title: seoTitle, seo_description: seoDesc,
      };
      await api.saveProduct(data);
      onReload();
      onBack();
    } catch (err: any) { alert('שגיאה: ' + err.message); } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!product.id || !confirm('למחוק את המוצר?')) return;
    setDeleting(true);
    try {
      await api.deleteProduct(product.id);
      onReload();
      onBack();
    } catch (err: any) { alert('שגיאה: ' + err.message); } finally { setDeleting(false); }
  };

  const addMedia = () => {
    if (!newMediaUrl.trim()) return;
    setMedia([...media, { id: `new_${Date.now()}`, url: newMediaUrl, media_type: newMediaType, alt_text: '', sort_order: media.length } as any]);
    setNewMediaUrl('');
  };

  const moveMedia = (idx: number, dir: -1 | 1) => {
    const arr = [...media];
    const swap = idx + dir;
    if (swap < 0 || swap >= arr.length) return;
    [arr[idx], arr[swap]] = [arr[swap], arr[idx]];
    setMedia(arr);
  };

  const Toggle: React.FC<{ label: string; value: boolean; onChange: (v: boolean) => void }> = ({ label, value, onChange }) => (
    <button type="button" onClick={() => onChange(!value)} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${value ? 'bg-green-50 border-green-300 text-green-700' : 'bg-gray-50 border-gray-200 text-gray-500'}`}>
      <span className={`w-8 h-5 rounded-full relative transition-colors ${value ? 'bg-green-500' : 'bg-gray-300'}`}>
        <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${value ? 'right-0.5' : 'right-3.5'}`} />
      </span>
      {label}
    </button>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800">→ חזרה למוצרים</button>
        <h2 className="font-bold text-gray-800">{isNew ? '🆕 מוצר חדש' : `✏️ עריכת: ${product.name}`}</h2>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 p-4 md:p-6 space-y-5">
        {/* Media Gallery */}
        <div>
          <label className="block text-xs font-bold text-gray-500 mb-2">🖼️ מדיה ({media.length})</label>
          {media.length > 0 && (
            <div className="flex gap-3 overflow-x-auto pb-2">
              {media.map((m, i) => (
                <div key={i} className="relative shrink-0 group">
                  {m.media_type === 'video' ? (
                    <div className="w-32 h-32 bg-gray-900 rounded-xl flex items-center justify-center text-white text-3xl">🎬</div>
                  ) : (
                    <img src={m.url} alt={m.alt_text || ''} className="w-32 h-32 object-cover rounded-xl border border-gray-200" />
                  )}
                  <div className="absolute top-1 left-1 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    {i > 0 && <button onClick={() => moveMedia(i, -1)} className="w-5 h-5 bg-white/90 rounded text-[10px] shadow hover:bg-white">→</button>}
                    {i < media.length - 1 && <button onClick={() => moveMedia(i, 1)} className="w-5 h-5 bg-white/90 rounded text-[10px] shadow hover:bg-white">←</button>}
                    <button onClick={() => setMedia(media.filter((_, j) => j !== i))} className="w-5 h-5 bg-red-500 text-white rounded text-[10px] shadow hover:bg-red-600">✕</button>
                  </div>
                  {i === 0 && <span className="absolute bottom-1 right-1 text-[9px] bg-blue-600 text-white px-1.5 py-0.5 rounded">ראשי</span>}
                </div>
              ))}
            </div>
          )}
          <div className="flex gap-2 mt-2">
            <select value={newMediaType} onChange={e => setNewMediaType(e.target.value as any)} className="px-2 py-2 border border-gray-200 rounded-lg text-xs bg-white">
              <option value="image">🖼️ תמונה</option>
              <option value="video">🎬 סרטון</option>
            </select>
            <input value={newMediaUrl} onChange={e => setNewMediaUrl(e.target.value)} placeholder="URL של תמונה או סרטון..."
              className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-400 outline-none" />
            <button onClick={addMedia} disabled={!newMediaUrl.trim()} className="px-3 py-2 bg-blue-600 text-white rounded-lg text-xs font-bold disabled:opacity-50 hover:bg-blue-700">הוסף</button>
          </div>
        </div>

        {/* Core fields */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1">שם מוצר *</label>
            <input value={name} onChange={e => setName(e.target.value)} className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-blue-400 outline-none" />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1">Slug</label>
            <input value={slug} onChange={e => setSlug(e.target.value)} placeholder={name.replace(/\s+/g, '-').toLowerCase()}
              className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-400 outline-none" dir="ltr" />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1">מחיר (₪)</label>
            <input type="number" value={price} onChange={e => setPrice(e.target.value)} className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold text-emerald-700 focus:ring-2 focus:ring-blue-400 outline-none" dir="ltr" />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1">מחיר השוואה (₪)</label>
            <input type="number" value={comparePrice} onChange={e => setComparePrice(e.target.value)} className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-400 outline-none" dir="ltr" />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1">SKU</label>
            <input value={sku} onChange={e => setSku(e.target.value)} className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-400 outline-none" dir="ltr" />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1">משקל (ק"ג)</label>
            <input type="number" value={weight} onChange={e => setWeight(e.target.value)} className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-400 outline-none" dir="ltr" />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1">סוג מוצר</label>
            <select value={productType} onChange={e => setProductType(e.target.value)} className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm">
              <option value="physical">פיזי</option>
              <option value="digital">דיגיטלי</option>
            </select>
          </div>
          {trackInventory && (
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1">כמות במלאי</label>
              <input type="number" value={quantity} onChange={e => setQuantity(e.target.value)} className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-400 outline-none" dir="ltr" />
            </div>
          )}
        </div>

        {/* Toggles */}
        <div className="flex gap-3 flex-wrap">
          <Toggle label="מוצג באתר" value={visible} onChange={setVisible} />
          <Toggle label="במלאי" value={inStock} onChange={setInStock} />
          <Toggle label="מעקב מלאי" value={trackInventory} onChange={setTrackInventory} />
        </div>

        {/* Description */}
        <div>
          <label className="block text-xs font-bold text-gray-500 mb-1">תיאור מוצר</label>
          <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="תיאור מפורט של המוצר..."
            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm min-h-[120px] resize-y focus:ring-2 focus:ring-blue-400 outline-none" dir="rtl" />
        </div>

        {/* Specs */}
        <div>
          <label className="block text-xs font-bold text-gray-500 mb-2">📋 מפרט טכני</label>
          {specs.map((s, i) => (
            <div key={i} className="flex gap-2 mb-2">
              <input value={s.key} onChange={e => { const arr = [...specs]; arr[i].key = e.target.value; setSpecs(arr); }} placeholder="שם מאפיין"
                className="w-1/3 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm" />
              <input value={s.value} onChange={e => { const arr = [...specs]; arr[i].value = e.target.value; setSpecs(arr); }} placeholder="ערך"
                className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm" />
              <button onClick={() => setSpecs(specs.filter((_, j) => j !== i))} className="px-2 text-red-400 hover:text-red-600 text-lg">✕</button>
            </div>
          ))}
          <button onClick={() => setSpecs([...specs, { key: '', value: '' }])} className="text-xs text-blue-600 font-medium hover:underline">+ הוסף מאפיין</button>
        </div>

        {/* Variants */}
        {variants.length > 0 && (
          <div>
            <label className="block text-xs font-bold text-gray-500 mb-2">🏷️ וריאנטים ({variants.length})</label>
            {variants.map((v, i) => (
              <div key={v.id} className="flex items-center gap-3 bg-gray-50 rounded-lg px-3 py-2 mb-1 text-sm">
                <span className="text-gray-600 flex-1">{Object.values(v.options || {}).join(' / ') || v.sku || v.id}</span>
                <input type="number" value={v.price || ''} onChange={e => { const arr = [...variants]; arr[i] = { ...arr[i], price: parseFloat(e.target.value) || 0 }; setVariants(arr); }}
                  className="w-20 px-2 py-1 border border-gray-200 rounded text-sm text-center" dir="ltr" placeholder="מחיר" />
                <input value={v.sku || ''} onChange={e => { const arr = [...variants]; arr[i] = { ...arr[i], sku: e.target.value }; setVariants(arr); }}
                  className="w-24 px-2 py-1 border border-gray-200 rounded text-sm" dir="ltr" placeholder="SKU" />
                <button onClick={() => { const arr = [...variants]; arr[i] = { ...arr[i], in_stock: !arr[i].in_stock }; setVariants(arr); }}
                  className={`text-[10px] px-2 py-1 rounded-full ${v.in_stock ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                  {v.in_stock ? 'במלאי' : 'אזל'}
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Categories */}
        {collections.length > 0 && (
          <div>
            <label className="block text-xs font-bold text-gray-500 mb-2">📂 קטגוריות</label>
            <div className="flex gap-2 flex-wrap">
              {collections.map(c => (
                <label key={c.id} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs cursor-pointer transition-colors ${collectionIds.includes(c.id) ? 'bg-blue-50 border-blue-400 text-blue-700' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                  <input type="checkbox" checked={collectionIds.includes(c.id)}
                    onChange={e => setCollectionIds(e.target.checked ? [...collectionIds, c.id] : collectionIds.filter(x => x !== c.id))}
                    className="w-3.5 h-3.5 rounded border-gray-300 text-blue-600" />
                  {c.name}
                </label>
              ))}
            </div>
          </div>
        )}

        {/* SEO */}
        <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
          <h3 className="font-bold text-blue-800 text-sm mb-3">🔍 SEO</h3>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-bold text-blue-600 mb-1">כותרת SEO (60 תו)</label>
              <input value={seoTitle || name} onChange={e => setSeoTitle(e.target.value)} maxLength={60}
                className="w-full px-3 py-2 bg-white border border-blue-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-400 outline-none" />
              <div className="text-[10px] text-blue-400 mt-0.5">{(seoTitle || name).length}/60</div>
            </div>
            <div>
              <label className="block text-xs font-bold text-blue-600 mb-1">תיאור SEO (160 תו)</label>
              <textarea value={seoDesc} onChange={e => setSeoDesc(e.target.value)} maxLength={160}
                className="w-full px-3 py-2 bg-white border border-blue-200 rounded-lg text-sm min-h-[50px] resize-y focus:ring-2 focus:ring-blue-400 outline-none" />
              <div className="text-[10px] text-blue-400 mt-0.5">{seoDesc.length}/160</div>
            </div>
            <div className="bg-white rounded-lg p-3 border border-gray-200">
              <div className="text-[10px] text-gray-400 mb-1">תצוגה מקדימה ב-Google:</div>
              <div className="text-blue-700 text-sm font-medium truncate">{seoTitle || name || 'שם המוצר'}</div>
              <div className="text-green-700 text-xs truncate">mewatch.co.il/products/{slug || name.replace(/\s+/g, '-').toLowerCase()}</div>
              <div className="text-gray-600 text-xs line-clamp-2 mt-0.5">{seoDesc || description?.substring(0, 160) || 'תיאור המוצר...'}</div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-2 flex-wrap">
          <button onClick={handleSave} disabled={saving || !name.trim()}
            className="px-6 py-2.5 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-colors disabled:opacity-50 flex items-center gap-2">
            {saving ? <><LoadingDots /> <span>שומר...</span></> : <><span>💾</span> <span>שמור מוצר</span></>}
          </button>
          <button disabled className="px-6 py-2.5 bg-blue-100 text-blue-400 rounded-xl font-medium cursor-not-allowed flex items-center gap-2" title="בקרוב">
            🚀 דחיפה ל-Wix (בקרוב)
          </button>
          {!isNew && (
            <button onClick={handleDelete} disabled={deleting}
              className="px-6 py-2.5 bg-white border border-red-300 text-red-600 rounded-xl font-medium hover:bg-red-50 transition-colors disabled:opacity-50 flex items-center gap-2">
              {deleting ? 'מוחק...' : '🗑️ מחק'}
            </button>
          )}
          <button onClick={onBack} className="px-6 py-2.5 bg-gray-100 text-gray-600 rounded-xl font-medium hover:bg-gray-200 transition-colors">ביטול</button>
        </div>
      </div>
    </div>
  );
};

const BlogTab: React.FC<{ posts: SiteBlogPost[]; categories: SiteBlogCategory[]; loading: boolean; onReload: () => void }> = ({ posts, categories, loading, onReload }) => {
  const [selectedPost, setSelectedPost] = useState<SiteBlogPost | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [editExcerpt, setEditExcerpt] = useState('');
  const [editCoverImage, setEditCoverImage] = useState('');
  const [editTags, setEditTags] = useState('');
  const [editSeoTitle, setEditSeoTitle] = useState('');
  const [editSeoDesc, setEditSeoDesc] = useState('');
  const [saving, setSaving] = useState(false);
  const [filterCat, setFilterCat] = useState<string>('');

  const startEdit = (post?: SiteBlogPost) => {
    if (post) {
      setEditTitle(post.title);
      setEditContent(post.content || '');
      setEditExcerpt(post.excerpt || '');
      setEditCoverImage(post.cover_image || '');
      setEditTags((post.tags || []).join(', '));
      setEditSeoTitle('');
      setEditSeoDesc('');
    } else {
      setEditTitle('');
      setEditContent('');
      setEditExcerpt('');
      setEditCoverImage('');
      setEditTags('');
      setEditSeoTitle('');
      setEditSeoDesc('');
    }
    setEditMode(true);
  };

  const handleSave = async () => {
    if (!editTitle.trim()) return;
    setSaving(true);
    try {
      const postData = {
        id: selectedPost?.id || `local_${Date.now()}`,
        title: editTitle,
        content: editContent,
        excerpt: editExcerpt || editContent.substring(0, 200),
        cover_image: editCoverImage,
        tags: editTags.split(',').map(t => t.trim()).filter(Boolean),
        seo_title: editSeoTitle,
        seo_description: editSeoDesc,
      };
      await fetch('/api/wix/sync?action=save-blog-post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(postData),
      }).then(r => r.json());
      setEditMode(false);
      setSelectedPost(null);
      onReload();
    } catch (err: any) {
      alert('שגיאה בשמירה: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  // Edit mode — blog editor
  if (editMode) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <button onClick={() => setEditMode(false)} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800">
            &rarr; חזרה לרשימה
          </button>
          <h2 className="font-bold text-gray-800">{selectedPost ? 'עריכת פוסט' : 'פוסט חדש'}</h2>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-4 md:p-6 space-y-4">
          {/* Title */}
          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1">כותרת</label>
            <input value={editTitle} onChange={e => setEditTitle(e.target.value)} placeholder="כותרת הפוסט..."
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-lg font-bold focus:ring-2 focus:ring-purple-400 outline-none" />
          </div>

          {/* Cover image */}
          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1">תמונת כיסוי (URL)</label>
            <input value={editCoverImage} onChange={e => setEditCoverImage(e.target.value)} placeholder="https://..."
              className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-purple-400 outline-none" />
            {editCoverImage && <img src={editCoverImage} alt="cover" className="mt-2 w-full max-h-48 object-cover rounded-xl" />}
          </div>

          {/* Content — rich text area with toolbar */}
          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1">תוכן</label>
            <div className="border border-gray-200 rounded-xl overflow-hidden">
              <div className="flex gap-1 px-3 py-2 bg-gray-50 border-b border-gray-200 flex-wrap">
                {[
                  { label: 'B', cmd: 'bold', title: 'מודגש' },
                  { label: 'I', cmd: 'italic', title: 'נטוי' },
                  { label: 'U', cmd: 'underline', title: 'קו תחתון' },
                  { label: 'H1', cmd: 'h1', title: 'כותרת 1' },
                  { label: 'H2', cmd: 'h2', title: 'כותרת 2' },
                  { label: 'H3', cmd: 'h3', title: 'כותרת 3' },
                  { label: '•', cmd: 'ul', title: 'רשימה' },
                  { label: '1.', cmd: 'ol', title: 'רשימה ממוספרת' },
                  { label: '"', cmd: 'quote', title: 'ציטוט' },
                  { label: '🔗', cmd: 'link', title: 'קישור' },
                  { label: '🖼️', cmd: 'image', title: 'תמונה' },
                  { label: '🎬', cmd: 'video', title: 'סרטון' },
                ].map(btn => (
                  <button key={btn.cmd} title={btn.title}
                    onClick={() => {
                      const ta = document.getElementById('blog-editor') as HTMLTextAreaElement;
                      if (!ta) return;
                      const start = ta.selectionStart;
                      const end = ta.selectionEnd;
                      const sel = editContent.substring(start, end);
                      let insert = '';
                      if (btn.cmd === 'bold') insert = `**${sel || 'טקסט מודגש'}**`;
                      else if (btn.cmd === 'italic') insert = `*${sel || 'טקסט נטוי'}*`;
                      else if (btn.cmd === 'underline') insert = `<u>${sel || 'טקסט עם קו תחתון'}</u>`;
                      else if (btn.cmd === 'h1') insert = `\n# ${sel || 'כותרת ראשית'}\n`;
                      else if (btn.cmd === 'h2') insert = `\n## ${sel || 'כותרת משנית'}\n`;
                      else if (btn.cmd === 'h3') insert = `\n### ${sel || 'כותרת משנה'}\n`;
                      else if (btn.cmd === 'ul') insert = `\n- ${sel || 'פריט ברשימה'}\n`;
                      else if (btn.cmd === 'ol') insert = `\n1. ${sel || 'פריט ברשימה'}\n`;
                      else if (btn.cmd === 'quote') insert = `\n> ${sel || 'ציטוט'}\n`;
                      else if (btn.cmd === 'link') { const url = prompt('הכנס URL:'); if (url) insert = `[${sel || 'טקסט'}](${url})`; }
                      else if (btn.cmd === 'image') { const url = prompt('הכנס URL של תמונה:'); if (url) insert = `\n![${sel || 'תיאור'}](${url})\n`; }
                      else if (btn.cmd === 'video') { const url = prompt('הכנס URL של סרטון (YouTube/Vimeo):'); if (url) insert = `\n[צפה בסרטון](${url})\n`; }
                      if (insert) {
                        const newContent = editContent.substring(0, start) + insert + editContent.substring(end);
                        setEditContent(newContent);
                        setTimeout(() => { ta.focus(); ta.selectionStart = ta.selectionEnd = start + insert.length; }, 50);
                      }
                    }}
                    className="px-2 py-1 text-xs font-bold rounded hover:bg-gray-200 transition-colors text-gray-600"
                  >
                    {btn.label}
                  </button>
                ))}
              </div>
              <textarea
                id="blog-editor"
                value={editContent}
                onChange={e => setEditContent(e.target.value)}
                placeholder="כתוב את תוכן הפוסט כאן... (תומך Markdown)"
                className="w-full px-4 py-3 min-h-[300px] text-sm leading-relaxed resize-y outline-none"
                dir="rtl"
              />
            </div>
            <p className="text-[10px] text-gray-400 mt-1">תומך Markdown: **מודגש**, *נטוי*, # כותרות, - רשימות, [קישור](url), ![תמונה](url)</p>
          </div>

          {/* Excerpt */}
          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1">תקציר (SEO)</label>
            <textarea value={editExcerpt} onChange={e => setEditExcerpt(e.target.value)} placeholder="תיאור קצר של הפוסט..."
              className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm min-h-[60px] resize-y focus:ring-2 focus:ring-purple-400 outline-none" />
          </div>

          {/* Tags */}
          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1">תגיות (מופרדות בפסיקים)</label>
            <input value={editTags} onChange={e => setEditTags(e.target.value)} placeholder="שעון חכם, ילדים, טכנולוגיה..."
              className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-purple-400 outline-none" />
          </div>

          {/* SEO Section */}
          <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
            <h3 className="font-bold text-blue-800 text-sm mb-3 flex items-center gap-1">🔍 SEO / GSO</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-blue-600 mb-1">כותרת SEO (עד 60 תווים)</label>
                <input value={editSeoTitle || editTitle} onChange={e => setEditSeoTitle(e.target.value)}
                  maxLength={60}
                  className="w-full px-3 py-2 bg-white border border-blue-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-400 outline-none" />
                <div className="text-[10px] text-blue-400 mt-0.5">{(editSeoTitle || editTitle).length}/60</div>
              </div>
              <div>
                <label className="block text-xs font-bold text-blue-600 mb-1">תיאור SEO (עד 160 תווים)</label>
                <textarea value={editSeoDesc || editExcerpt} onChange={e => setEditSeoDesc(e.target.value)}
                  maxLength={160}
                  className="w-full px-3 py-2 bg-white border border-blue-200 rounded-lg text-sm min-h-[50px] resize-y focus:ring-2 focus:ring-blue-400 outline-none" />
                <div className="text-[10px] text-blue-400 mt-0.5">{(editSeoDesc || editExcerpt).length}/160</div>
              </div>
              {/* Google Preview */}
              <div className="bg-white rounded-lg p-3 border border-gray-200">
                <div className="text-[10px] text-gray-400 mb-1">תצוגה מקדימה ב-Google:</div>
                <div className="text-blue-700 text-sm font-medium truncate">{editSeoTitle || editTitle || 'כותרת הפוסט'}</div>
                <div className="text-green-700 text-xs truncate">mewatch.co.il/blog/{editTitle.replace(/\s+/g, '-').toLowerCase()}</div>
                <div className="text-gray-600 text-xs line-clamp-2 mt-0.5">{editSeoDesc || editExcerpt || 'תיאור הפוסט...'}</div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button onClick={handleSave} disabled={saving || !editTitle.trim()}
              className="px-6 py-2.5 bg-purple-600 text-white rounded-xl font-bold hover:bg-purple-700 transition-colors disabled:opacity-50 flex items-center gap-2">
              {saving ? <><LoadingDots /> <span>שומר...</span></> : <><span>💾</span> <span>שמור פוסט</span></>}
            </button>
            <button onClick={() => setEditMode(false)} className="px-6 py-2.5 bg-gray-100 text-gray-600 rounded-xl font-medium hover:bg-gray-200 transition-colors">
              ביטול
            </button>
          </div>
        </div>
      </div>
    );
  }

  // View mode — single post
  if (selectedPost) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <button onClick={() => setSelectedPost(null)} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800">
            &rarr; חזרה לרשימה
          </button>
          <button onClick={() => startEdit(selectedPost)} className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-bold hover:bg-purple-700 transition-colors flex items-center gap-1">
            ✏️ עריכה
          </button>
        </div>
        <article className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          {selectedPost.cover_image && (
            <img src={selectedPost.cover_image} alt={selectedPost.title} className="w-full h-56 object-cover" />
          )}
          <div className="p-6 md:p-8">
            <h1 className="text-2xl font-black text-gray-800 mb-3">{selectedPost.title}</h1>
            <div className="flex items-center gap-3 mb-6 text-xs text-gray-400">
              <span className={`px-2 py-0.5 rounded-full font-medium ${selectedPost.status === 'published' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                {selectedPost.status === 'published' ? 'מפורסם' : 'טיוטה'}
              </span>
              {selectedPost.author && <span>{selectedPost.author}</span>}
              {selectedPost.published_at && <span>{new Date(selectedPost.published_at).toLocaleDateString('he-IL')}</span>}
            </div>
            {/* Embedded images gallery */}
            {selectedPost.embedded_images && selectedPost.embedded_images.length > 0 && !selectedPost.content_html && (
              <div className="flex gap-2 overflow-x-auto pb-2 mb-4">
                {selectedPost.embedded_images.map((img: string, i: number) => (
                  <img key={i} src={img} alt="" className="h-32 rounded-lg object-cover shrink-0 border border-gray-200" />
                ))}
              </div>
            )}
            {/* Rich HTML content or plain text fallback */}
            {selectedPost.content_html ? (
              <div className="prose prose-sm max-w-none text-gray-700 leading-relaxed" style={{ direction: 'rtl' }}
                dangerouslySetInnerHTML={{ __html: selectedPost.content_html }} />
            ) : selectedPost.content ? (
              <div className="prose prose-sm max-w-none text-gray-700 leading-relaxed whitespace-pre-wrap" style={{ direction: 'rtl' }}>
                {selectedPost.content}
              </div>
            ) : (
              <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-center">
                <p className="text-yellow-700 text-sm font-medium">אין תוכן זמין</p>
                <p className="text-yellow-600 text-xs mt-1">לחץ "סנכרון מ-Wix" כדי למשוך את תוכן הפוסטים</p>
              </div>
            )}
            {/* Embedded videos */}
            {selectedPost.embedded_videos && selectedPost.embedded_videos.length > 0 && (
              <div className="mt-4 space-y-2">
                <h3 className="font-bold text-gray-700 text-sm">🎬 סרטונים</h3>
                {selectedPost.embedded_videos.map((url: string, i: number) => (
                  <a key={i} href={url} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-2 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-blue-600 hover:bg-blue-50 transition-colors">
                    🎬 {url}
                  </a>
                ))}
              </div>
            )}
            {selectedPost.tags && selectedPost.tags.length > 0 && (
              <div className="flex gap-1 mt-6 pt-4 border-t border-gray-100 flex-wrap">
                {selectedPost.tags.map(t => (
                  <span key={t} className="text-xs px-2 py-1 bg-purple-50 border border-purple-200 rounded-full text-purple-600">#{t}</span>
                ))}
              </div>
            )}
            {/* Structured Data preview */}
            {selectedPost.structured_data && Object.keys(selectedPost.structured_data).length > 1 && (
              <details className="mt-4 bg-gray-50 rounded-xl border border-gray-200">
                <summary className="px-4 py-2 text-xs font-bold text-gray-600 cursor-pointer hover:text-gray-800">📊 Schema.org Structured Data (JSON-LD)</summary>
                <pre className="px-4 py-3 text-[10px] text-gray-500 overflow-x-auto" dir="ltr">{JSON.stringify(selectedPost.structured_data, null, 2)}</pre>
              </details>
            )}
          </div>
        </article>
      </div>
    );
  }

  if (loading) return <div className="flex items-center justify-center h-40 text-gray-400"><LoadingDots /> <span className="mr-2 text-sm">טוען פוסטים...</span></div>;

  // List mode
  const filtered = filterCat ? posts.filter(p => p.category_ids?.includes(filterCat)) : posts;

  return (
    <div className="space-y-4">
      {/* Top bar */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex gap-2 flex-wrap items-center">
          {categories.length > 0 && (
            <>
              <button onClick={() => setFilterCat('')}
                className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${!filterCat ? 'bg-purple-600 text-white border-purple-600' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}>
                הכל ({posts.length})
              </button>
              {categories.map(c => (
                <button key={c.id} onClick={() => setFilterCat(c.id)}
                  className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${filterCat === c.id ? 'bg-purple-600 text-white border-purple-600' : 'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100'}`}>
                  {c.name} ({c.post_count})
                </button>
              ))}
            </>
          )}
        </div>
        <button onClick={() => { setSelectedPost(null); startEdit(); }}
          className="px-4 py-2 bg-purple-600 text-white rounded-xl text-sm font-bold hover:bg-purple-700 transition-colors flex items-center gap-1 shadow-lg shadow-purple-200">
          ✏️ פוסט חדש
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-400 text-sm">{posts.length === 0 ? 'אין פוסטים — לחץ "סנכרון מ-Wix"' : 'לא נמצאו פוסטים בקטגוריה זו'}</div>
      ) : (
        <div className="space-y-3">
          {filtered.map(post => (
            <div key={post.id} onClick={() => setSelectedPost(post)}
              className="bg-white border border-gray-200 rounded-xl p-4 flex gap-4 hover:shadow-md transition-shadow cursor-pointer group">
              {post.cover_image && (
                <img src={post.cover_image} alt={post.title} className="w-24 h-24 rounded-lg object-cover shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-gray-800 truncate group-hover:text-purple-700 transition-colors">{post.title}</h3>
                <p className="text-xs text-gray-500 mt-1 line-clamp-2">{post.excerpt}</p>
                <div className="flex items-center gap-2 mt-2">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full ${post.status === 'published' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                    {post.status === 'published' ? 'מפורסם' : 'טיוטה'}
                  </span>
                  {post.author && <span className="text-[10px] text-gray-400">{post.author}</span>}
                  {post.published_at && <span className="text-[10px] text-gray-400">{new Date(post.published_at).toLocaleDateString('he-IL')}</span>}
                  {post.content ? (
                    <span className="text-[10px] text-blue-500">📄 {Math.ceil(post.content.length / 500)} דקות קריאה</span>
                  ) : (
                    <span className="text-[10px] text-orange-500">⚠️ ללא תוכן</span>
                  )}
                </div>
                {post.tags && post.tags.length > 0 && (
                  <div className="flex gap-1 mt-2 flex-wrap">
                    {post.tags.slice(0, 5).map(t => (
                      <span key={t} className="text-[10px] px-1.5 py-0.5 bg-gray-100 rounded text-gray-500">#{t}</span>
                    ))}
                  </div>
                )}
              </div>
              <div className="self-center text-gray-300 group-hover:text-purple-500 transition-colors text-lg">&larr;</div>
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
