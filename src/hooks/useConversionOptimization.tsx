import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Product } from '@/types/database';

export interface ConversionSettings {
  exit_popup: {
    enabled: boolean;
    coupon_code: string;
    discount_text: string;
    headline: string;
    description: string;
    show_once_per_session: boolean;
  };
  upsell: {
    enabled: boolean;
    price_diff_min: number;
    max_items: number;
  };
  cross_sell: {
    enabled: boolean;
    max_items: number;
  };
  cart_optimizer: {
    enabled: boolean;
    show_free_shipping_bar: boolean;
    upsell_headline: string;
  };
}

const DEFAULT_SETTINGS: ConversionSettings = {
  exit_popup: {
    enabled: false,
    coupon_code: 'EXIT10',
    discount_text: '10% OFF',
    headline: "Wait! Don't leave empty-handed 🎁",
    description: 'Use this exclusive discount code on your first order',
    show_once_per_session: true,
  },
  upsell: {
    enabled: true,
    price_diff_min: 10,
    max_items: 3,
  },
  cross_sell: {
    enabled: true,
    max_items: 4,
  },
  cart_optimizer: {
    enabled: true,
    show_free_shipping_bar: true,
    upsell_headline: 'Customers also bought',
  },
};

export function useConversionSettings() {
  return useQuery({
    queryKey: ['conversion-settings'],
    queryFn: async () => {
      const { data } = await supabase
        .from('store_settings')
        .select('value')
        .eq('key', 'conversion_optimization')
        .single();
      return { ...DEFAULT_SETTINGS, ...(data?.value as any) } as ConversionSettings;
    },
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

/** Upsell products: higher-priced items in same category */
export function useUpsellProducts(product: Product | undefined, enabled: boolean) {
  return useQuery({
    queryKey: ['upsell-products', product?.id],
    queryFn: async () => {
      if (!product?.category_id) return [];
      // First check admin-defined upsell rules
      const { data: rules } = await supabase
        .from('cross_sell_rules')
        .select('target_product_id')
        .eq('source_product_id', product.id)
        .eq('rule_type', 'upsell')
        .eq('is_active', true)
        .order('sort_order')
        .limit(4);
      
      if (rules && rules.length > 0) {
        const ids = rules.map(r => r.target_product_id);
        const { data } = await supabase
          .from('products')
          .select('*, category:categories(*), images:product_images(*)')
          .in('id', ids)
          .eq('is_active', true);
        return (data || []) as Product[];
      }

      // Fallback: auto-detect higher-priced products in same category
      const { data } = await supabase
        .from('products')
        .select('*, category:categories(*), images:product_images(*)')
        .eq('category_id', product.category_id)
        .eq('is_active', true)
        .neq('id', product.id)
        .gt('price', product.price)
        .order('price', { ascending: true })
        .limit(3);
      return (data || []) as Product[];
    },
    enabled: !!product?.id && enabled,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

/** Cross-sell products: complementary items from different categories or admin-defined */
export function useCrossSellProducts(product: Product | undefined, enabled: boolean) {
  return useQuery({
    queryKey: ['cross-sell-products', product?.id],
    queryFn: async () => {
      if (!product) return [];
      // First check admin-defined cross-sell rules
      const { data: rules } = await supabase
        .from('cross_sell_rules')
        .select('target_product_id')
        .eq('source_product_id', product.id)
        .eq('rule_type', 'cross_sell')
        .eq('is_active', true)
        .order('sort_order')
        .limit(6);
      
      if (rules && rules.length > 0) {
        const ids = rules.map(r => r.target_product_id);
        const { data } = await supabase
          .from('products')
          .select('*, category:categories(*), images:product_images(*)')
          .in('id', ids)
          .eq('is_active', true);
        return (data || []) as Product[];
      }

      // Fallback: bestsellers from other categories
      const { data } = await supabase
        .from('products')
        .select('*, category:categories(*), images:product_images(*)')
        .eq('is_active', true)
        .eq('is_bestseller', true)
        .neq('id', product.id)
        .limit(4);
      return (data || []) as Product[];
    },
    enabled: !!product?.id && enabled,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

/** Cart upsell suggestions - popular products not in cart */
export function useCartUpsellProducts(cartProductIds: string[], enabled: boolean) {
  return useQuery({
    queryKey: ['cart-upsell', cartProductIds.sort().join(',')],
    queryFn: async () => {
      let query = supabase
        .from('products')
        .select('*, category:categories(*), images:product_images(*)')
        .eq('is_active', true)
        .eq('is_bestseller', true)
        .order('sort_order')
        .limit(4);
      
      if (cartProductIds.length > 0) {
        query = query.not('id', 'in', `(${cartProductIds.join(',')})`);
      }
      const { data } = await query;
      return (data || []) as Product[];
    },
    enabled: enabled,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

export function trackConversionEvent(eventType: string, data?: Record<string, any>) {
  const visitorId = localStorage.getItem('ai_visitor_id') || 'anonymous';
  supabase.from('conversion_events').insert({
    event_type: eventType,
    visitor_id: visitorId,
    product_id: data?.product_id || null,
    source_product_id: data?.source_product_id || null,
    metadata: data?.metadata || {},
  }).then(() => {});
}
