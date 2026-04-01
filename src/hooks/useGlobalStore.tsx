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
  isLoading: boolean;
  getProductOffer: (product: Product, variantId?: string | null) => ProductOffer | null;
  calculateCartDiscount: (products: { product: Product; quantity: number }[]) => {
    totalDiscount: number;
    appliedOffers: { offer: Offer; discount: number }[];
  };
  // Consolidated settings from RPC
  aiAssistantConfig: AIAssistantConfig | null;
  conversionOptimization: any | null;
  socialLinks: SocialLinks | null;
}

const GlobalStoreContext = createContext<GlobalStoreData | null>(null);

const fetchGlobalData = async () => {
  const { data, error } = await supabase.rpc('get_homepage_data');
  if (error) throw error;
  return data as any;
};

export function GlobalStoreProvider({ children }: { children: ReactNode }) {
  const { _setThemeFromRPC } = useStorefrontTheme();

  const { data, isLoading } = useQuery({
    queryKey: ['global-store-data'],
    queryFn: fetchGlobalData,
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
    retry: 2,
  });

  // Sync theme from RPC when data arrives
  useEffect(() => {
    if (data?.storefront_theme) {
      const themeVal = data.storefront_theme as { theme?: StorefrontTheme };
      if (themeVal.theme) {
        _setThemeFromRPC(themeVal.theme);
      }
    }
  }, [data?.storefront_theme, _setThemeFromRPC]);

  const categories = useMemo(() => (data?.categories || []) as Category[], [data?.categories]);
  const offers = useMemo(() => (data?.offers || []) as unknown as Offer[], [data?.offers]);
  const banners = useMemo(() => (data?.banners || []) as unknown as Banner[], [data?.banners]);
  const middleBanners = useMemo(() => (data?.middle_banners || []) as unknown as Banner[], [data?.middle_banners]);
  const popupBanner = (data?.popup_banner || null) as unknown as Banner | null;
  const storeInfo = (data?.store_info || null) as StoreInfo | null;
  const announcement = (data?.announcement || null) as AnnouncementSettings | null;
  const storefrontDisplay = data?.storefront_display || null;
  const bestsellers = useMemo(() => (data?.bestsellers || []) as Product[], [data?.bestsellers]);
  const featured = useMemo(() => (data?.featured || []) as Product[], [data?.featured]);
  const newArrivals = useMemo(() => (data?.new_arrivals || []) as Product[], [data?.new_arrivals]);
  const bundles = useMemo(() => (data?.bundles || []) as any[], [data?.bundles]);
  const reviewStats = useMemo(() => (data?.review_stats || {}) as ReviewStats, [data?.review_stats]);

  // New consolidated settings
  const aiAssistantConfig = (data?.ai_assistant || null) as AIAssistantConfig | null;
  const conversionOptimization = data?.conversion_optimization || null;
  const socialLinks = (data?.social_links || null) as SocialLinks | null;

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
      if (vids && vids.length > 0 && variantId) {
        return vids.includes(variantId);
      }
      if (vids && vids.length > 0 && !variantId) {
        return false;
      }
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
      if (applicableOffer.max_discount && discountAmount > applicableOffer.max_discount) {
        discountAmount = applicableOffer.max_discount;
      }
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

    return {
      offer: applicableOffer,
      discountedPrice: Math.round(discountedPrice),
      discountAmount: Math.round(discountAmount),
      discountLabel,
    };
  }, [offers]);

  const calculateCartDiscount = useCallback((
    products: { product: Product; quantity: number }[]
  ) => {
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
    categories,
    offers,
    banners,
    middleBanners,
    popupBanner,
    storeInfo,
    announcement,
    storefrontDisplay,
    bestsellers,
    featured,
    newArrivals,
    bundles,
    reviewStats,
    isLoading,
    getProductOffer,
    calculateCartDiscount,
    aiAssistantConfig,
    conversionOptimization,
    socialLinks,
  }), [categories, offers, banners, middleBanners, popupBanner, storeInfo, announcement, storefrontDisplay, bestsellers, featured, newArrivals, bundles, reviewStats, isLoading, getProductOffer, calculateCartDiscount, aiAssistantConfig, conversionOptimization, socialLinks]);

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
