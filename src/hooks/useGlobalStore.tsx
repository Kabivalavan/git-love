import { createContext, useContext, ReactNode, useCallback, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Category, Offer, Product, Banner } from '@/types/database';
import { useStorefrontTheme, StorefrontTheme } from '@/hooks/useTheme';

interface StoreInfo {
  name?: string;
  logo_url?: string;
  favicon_url?: string;
  [key: string]: any;
}

interface AnnouncementSettings {
  text: string;
  is_active: boolean;
  link?: string;
}

interface ProductOffer {
  offer: Offer;
  discountedPrice: number;
  discountAmount: number;
  discountLabel: string;
}

interface ReviewStats {
  [productId: string]: { avg_rating: number; review_count: number };
}

interface SocialLinks {
  facebook?: string;
  instagram?: string;
  twitter?: string;
  youtube?: string;
}

interface AIAssistantConfig {
  enabled?: boolean;
  show_popup?: boolean;
  site_id?: string;
  api_base?: string;
  secret_key?: string;
  button_text?: string;
  assistant_name?: string;
}

interface GlobalStoreData {
  categories: Category[];
  offers: Offer[];
  banners: Banner[];
  middleBanners: Banner[];
  popupBanner: Banner | null;
  storeInfo: StoreInfo | null;
  announcement: AnnouncementSettings | null;
  storefrontDisplay: any | null;
  bestsellers: Product[];
  featured: Product[];
  newArrivals: Product[];
  bundles: any[];
  reviewStats: ReviewStats;
  isCriticalLoading: boolean;
  isFullLoading: boolean;
  isLoading: boolean;
  hasCachedData: boolean;
  getProductOffer: (product: Product, variantId?: string | null) => ProductOffer | null;
  calculateCartDiscount: (products: { product: Product; quantity: number }[]) => {
    totalDiscount: number;
    appliedOffers: { offer: Offer; discount: number }[];
  };
  aiAssistantConfig: AIAssistantConfig | null;
  conversionOptimization: any | null;
  socialLinks: SocialLinks | null;
}

const GlobalStoreContext = createContext<GlobalStoreData | null>(null);

// --- localStorage cache helpers ---
const STORE_CACHE_KEY = 'cached_store_info';
const FULL_CACHE_KEY = 'cached_homepage_full';
const FULL_CACHE_TTL = 10 * 60 * 1000; // 10 minutes

function getCachedStoreInfo(): StoreInfo | null {
  try {
    const raw = localStorage.getItem(STORE_CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function setCachedStoreInfo(info: StoreInfo) {
  try { localStorage.setItem(STORE_CACHE_KEY, JSON.stringify({ name: info.name, logo_url: info.logo_url, favicon_url: info.favicon_url })); } catch {}
}

function getCachedFullData(): any | null {
  try {
    const raw = localStorage.getItem(FULL_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Date.now() - (parsed._ts || 0) > FULL_CACHE_TTL) {
      localStorage.removeItem(FULL_CACHE_KEY);
      return null;
    }
    return parsed;
  } catch { return null; }
}

function setCachedFullData(data: any) {
  try {
    localStorage.setItem(FULL_CACHE_KEY, JSON.stringify({ ...data, _ts: Date.now() }));
  } catch {}
}

// --- RPC fetchers ---
const fetchCriticalData = async () => {
  const { data, error } = await supabase.rpc('get_homepage_critical');
  if (error) throw error;
  return data as any;
};

const fetchFullData = async () => {
  const { data, error } = await supabase.rpc('get_homepage_data');
  if (error) throw error;
  return data as any;
};

export function GlobalStoreProvider({ children }: { children: ReactNode }) {
  const { _setThemeFromRPC } = useStorefrontTheme();

  // Hydrate from full cache on mount
  const cachedFull = useMemo(() => getCachedFullData(), []);
  const cachedInfo = useMemo(() => getCachedStoreInfo(), []);
  const hasCachedData = cachedFull !== null || cachedInfo !== null;

  // Critical query — lightweight, fires immediately
  const { data: critical, isLoading: isCriticalLoading } = useQuery({
    queryKey: ['store-critical'],
    queryFn: fetchCriticalData,
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
    retry: 2,
    // If we have a full cache, we already have critical data — skip this query
    enabled: !cachedFull,
  });

  // Full query — heavier, fires in parallel (not gated on critical)
  const { data: full, isLoading: isFullLoading } = useQuery({
    queryKey: ['global-store-data'],
    queryFn: fetchFullData,
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
    retry: 2,
    // Use cached full data as initialData for instant hydration
    ...(cachedFull ? { initialData: cachedFull } : {}),
  });

  // Sync theme from whichever data arrives first
  useEffect(() => {
    const themeSource = full?.storefront_theme || critical?.storefront_theme || cachedFull?.storefront_theme;
    if (themeSource) {
      const themeVal = themeSource as { theme?: StorefrontTheme };
      if (themeVal.theme) _setThemeFromRPC(themeVal.theme);
    }
  }, [full?.storefront_theme, critical?.storefront_theme, _setThemeFromRPC]);

  // Cache full data when it arrives
  useEffect(() => {
    if (full && !full._ts) setCachedFullData(full);
  }, [full]);

  // Cache storeInfo
  useEffect(() => {
    const info = full?.store_info || critical?.store_info;
    if (info) setCachedStoreInfo(info as StoreInfo);
  }, [full?.store_info, critical?.store_info]);

  // Merge: full > critical > cachedFull > cachedInfo
  const source = full || cachedFull;
  const criticalSource = critical || cachedFull;

  const categories = useMemo(() => (criticalSource?.categories || source?.categories || []) as Category[], [criticalSource?.categories, source?.categories]);
  const offers = useMemo(() => (source?.offers || []) as unknown as Offer[], [source?.offers]);
  const banners = useMemo(() => (criticalSource?.banners || source?.banners || []) as unknown as Banner[], [criticalSource?.banners, source?.banners]);
  const middleBanners = useMemo(() => (criticalSource?.middle_banners || source?.middle_banners || []) as unknown as Banner[], [criticalSource?.middle_banners, source?.middle_banners]);
  const popupBanner = (criticalSource?.popup_banner || source?.popup_banner || null) as unknown as Banner | null;
  const storeInfo = (criticalSource?.store_info || source?.store_info || cachedInfo || null) as StoreInfo | null;
  const announcement = (criticalSource?.announcement || source?.announcement || null) as AnnouncementSettings | null;
  const storefrontDisplay = criticalSource?.storefront_display || source?.storefront_display || null;
  const bestsellers = useMemo(() => (source?.bestsellers || []) as Product[], [source?.bestsellers]);
  const featured = useMemo(() => (source?.featured || []) as Product[], [source?.featured]);
  const newArrivals = useMemo(() => (source?.new_arrivals || []) as Product[], [source?.new_arrivals]);
  const bundles = useMemo(() => (source?.bundles || []) as any[], [source?.bundles]);
  const reviewStats = useMemo(() => (source?.review_stats || {}) as ReviewStats, [source?.review_stats]);
  const aiAssistantConfig = (criticalSource?.ai_assistant || source?.ai_assistant || null) as AIAssistantConfig | null;
  const conversionOptimization = criticalSource?.conversion_optimization || source?.conversion_optimization || null;
  const socialLinks = (criticalSource?.social_links || source?.social_links || null) as SocialLinks | null;

  // Critical loading = still waiting for above-fold data AND no cache
  const isLoading = isCriticalLoading && isFullLoading && !hasCachedData;

  const getProductOffer = useCallback((product: Product, variantId?: string | null): ProductOffer | null => {
    if (!product || offers.length === 0) return null;

    const now = new Date();
    const activeOffers = offers.filter(o => {
      if (o.end_date && new Date(o.end_date) < now) return false;
      if (o.start_date && new Date(o.start_date) > now) return false;
      return true;
    });

    const productOffer = activeOffers.find(o => {
      if (o.product_id !== product.id) return false;
      const vids = (o as any).variant_ids as string[] | null;
      if (vids && vids.length > 0 && variantId) return vids.includes(variantId);
      if (vids && vids.length > 0 && !variantId) return false;
      return true;
    });
    const categoryOffer = product.category_id
      ? activeOffers.find(o => o.category_id === product.category_id && !o.product_id)
      : null;

    const applicableOffer = productOffer || categoryOffer;
    if (!applicableOffer) return null;

    const basePrice = product.price;
    let discountAmount = 0;
    let discountedPrice = basePrice;
    let discountLabel = '';

    if (applicableOffer.type === 'percentage') {
      discountAmount = (basePrice * applicableOffer.value) / 100;
      if (applicableOffer.max_discount && discountAmount > applicableOffer.max_discount) discountAmount = applicableOffer.max_discount;
      discountedPrice = basePrice - discountAmount;
      discountLabel = `${applicableOffer.value}% OFF`;
    } else if (applicableOffer.type === 'flat') {
      discountAmount = applicableOffer.value;
      discountedPrice = Math.max(0, basePrice - discountAmount);
      discountLabel = `₹${Math.round(applicableOffer.value)} OFF`;
    } else if (applicableOffer.type === 'buy_x_get_y') {
      discountLabel = `Buy ${applicableOffer.buy_quantity} Get ${applicableOffer.get_quantity}`;
      discountedPrice = basePrice;
      discountAmount = 0;
    }

    return { offer: applicableOffer, discountedPrice: Math.round(discountedPrice), discountAmount: Math.round(discountAmount), discountLabel };
  }, [offers]);

  const calculateCartDiscount = useCallback((products: { product: Product; quantity: number }[]) => {
    const appliedOffers: { offer: Offer; discount: number }[] = [];
    let totalDiscount = 0;

    products.forEach(({ product, quantity }) => {
      const po = getProductOffer(product);
      if (po && po.discountAmount > 0) {
        const discount = po.discountAmount * quantity;
        totalDiscount += discount;
        const existing = appliedOffers.find(ao => ao.offer.id === po.offer.id);
        if (existing) existing.discount += discount;
        else appliedOffers.push({ offer: po.offer, discount });
      }
    });

    return { totalDiscount, appliedOffers };
  }, [getProductOffer]);

  const value = useMemo(() => ({
    categories, offers, banners, middleBanners, popupBanner, storeInfo, announcement, storefrontDisplay,
    bestsellers, featured, newArrivals, bundles, reviewStats,
    isCriticalLoading, isFullLoading, isLoading, hasCachedData,
    getProductOffer, calculateCartDiscount,
    aiAssistantConfig, conversionOptimization, socialLinks,
  }), [categories, offers, banners, middleBanners, popupBanner, storeInfo, announcement, storefrontDisplay,
    bestsellers, featured, newArrivals, bundles, reviewStats,
    isCriticalLoading, isFullLoading, isLoading, hasCachedData,
    getProductOffer, calculateCartDiscount,
    aiAssistantConfig, conversionOptimization, socialLinks]);

  return (
    <GlobalStoreContext.Provider value={value}>
      {children}
    </GlobalStoreContext.Provider>
  );
}

export function useGlobalStore() {
  const context = useContext(GlobalStoreContext);
  if (!context) throw new Error('useGlobalStore must be used within GlobalStoreProvider');
  return context;
}
