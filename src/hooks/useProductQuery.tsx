import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Product, ProductVariant, Review } from '@/types/database';

/** Single product by slug - cached and deduplicated */
export function useProductBySlug(slug: string | undefined) {
  return useQuery({
    queryKey: ['product', slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select('*, category:categories(*), images:product_images(*)')
        .eq('slug', slug!)
        .eq('is_active', true)
        .single();
      if (error || !data) throw new Error('Product not found');
      return data as unknown as Product;
    },
    enabled: !!slug,
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

/** Product variants - fetched once per product */
export function useProductVariants(productId: string | undefined) {
  return useQuery({
    queryKey: ['product-variants', productId],
    queryFn: async () => {
      const { data } = await supabase
        .from('product_variants')
        .select('*')
        .eq('product_id', productId!)
        .eq('is_active', true);
      return (data || []) as ProductVariant[];
    },
    enabled: !!productId,
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

/** Product reviews - deduplicated */
export function useProductReviews(productId: string | undefined) {
  return useQuery({
    queryKey: ['product-reviews', productId],
    queryFn: async () => {
      const { data } = await supabase
        .from('reviews')
        .select('*')
        .eq('product_id', productId!)
        .eq('is_approved', true)
        .order('created_at', { ascending: false })
        .limit(50);
      return (data || []) as unknown as Review[];
    },
    enabled: !!productId,
    staleTime: 3 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

/** Related products - cached per category */
export function useRelatedProducts(categoryId: string | undefined, excludeProductId: string | undefined) {
  return useQuery({
    queryKey: ['related-products', categoryId, excludeProductId],
    queryFn: async () => {
      const { data } = await supabase
        .from('products')
        .select('*, category:categories(*), images:product_images(*)')
        .eq('category_id', categoryId!)
        .eq('is_active', true)
        .neq('id', excludeProductId!)
        .limit(4);
      return (data || []) as Product[];
    },
    enabled: !!categoryId && !!excludeProductId,
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

/** Storefront coupons - global cache */
export function useStorefrontCoupons() {
  return useQuery({
    queryKey: ['storefront-coupons'],
    queryFn: async () => {
      const { data } = await supabase
        .from('coupons')
        .select('*')
        .eq('is_active', true)
        .eq('show_on_storefront', true)
        .order('created_at', { ascending: false });
      return data || [];
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

/** Checkout settings - rarely changes */
export function useCheckoutSettings() {
  return useQuery({
    queryKey: ['checkout-settings'],
    queryFn: async () => {
      const { data } = await supabase
        .from('store_settings')
        .select('value')
        .eq('key', 'checkout')
        .single();
      return (data?.value as any) || {
        cod_enabled: true,
        min_order_value: 0,
        free_shipping_threshold: 500,
        default_shipping_charge: 50,
      };
    },
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}
