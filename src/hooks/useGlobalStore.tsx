import { createContext, useContext, ReactNode, useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import type { Category, Offer, Product } from '@/types/database';

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

interface GlobalStoreData {
  categories: Category[];
  offers: Offer[];
  storeInfo: StoreInfo | null;
  announcement: AnnouncementSettings | null;
  storefrontDisplay: any | null;
  isLoading: boolean;
  getProductOffer: (product: Product) => ProductOffer | null;
  calculateCartDiscount: (products: { product: Product; quantity: number }[]) => {
    totalDiscount: number;
    appliedOffers: { offer: Offer; discount: number }[];
  };
}

const GlobalStoreContext = createContext<GlobalStoreData | null>(null);

const fetchGlobalData = async () => {
  const { data, error } = await supabase.rpc('get_homepage_data');
  if (error) throw error;
  return data as any;
};

export function GlobalStoreProvider({ children }: { children: ReactNode }) {
  const { isLoading: isAuthLoading } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ['global-store-data'],
    queryFn: fetchGlobalData,
    staleTime: 10 * 60 * 1000, // 10 minutes - global data rarely changes
    gcTime: 30 * 60 * 1000,    // 30 minutes cache
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
    retry: 3,
    enabled: !isAuthLoading,
  });

  const categories = useMemo(() => (data?.categories || []) as Category[], [data?.categories]);
  const offers = useMemo(() => (data?.offers || []) as unknown as Offer[], [data?.offers]);
  const storeInfo = (data?.store_info || null) as StoreInfo | null;
  const announcement = (data?.announcement || null) as AnnouncementSettings | null;
  const storefrontDisplay = data?.storefront_display || null;

  const getProductOffer = useCallback((product: Product): ProductOffer | null => {
    if (!product || offers.length === 0) return null;

    const now = new Date();
    const activeOffers = offers.filter(o => {
      if (o.end_date && new Date(o.end_date) < now) return false;
      if (o.start_date && new Date(o.start_date) > now) return false;
      return true;
    });

    const productOffer = activeOffers.find(o => o.product_id === product.id);
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
      discountLabel = `₹${applicableOffer.value} OFF`;
    } else if (applicableOffer.type === 'buy_x_get_y') {
      discountLabel = `Buy ${applicableOffer.buy_quantity} Get ${applicableOffer.get_quantity}`;
      discountedPrice = basePrice;
      discountAmount = 0;
    }

    return {
      offer: applicableOffer,
      discountedPrice: Math.round(discountedPrice * 100) / 100,
      discountAmount: Math.round(discountAmount * 100) / 100,
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
    storeInfo,
    announcement,
    storefrontDisplay,
    isLoading,
    getProductOffer,
    calculateCartDiscount,
  }), [categories, offers, storeInfo, announcement, storefrontDisplay, isLoading, getProductOffer, calculateCartDiscount]);

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
