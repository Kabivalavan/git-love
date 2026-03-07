import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useCartMutations } from '@/hooks/useCartQuery';
import type { Product } from '@/types/database';

export function useHomeAddToCart() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { addToCart } = useCartMutations();

  const handleAddToCart = async (product: Product) => {
    if (!user) {
      toast({ title: 'Please login', description: 'You need to login to add items to cart' });
      return;
    }
    addToCart.mutate({ product, quantity: 1 });
  };

  const handleAddToWishlist = async (product: Product) => {
    if (!user) {
      toast({ title: 'Please login', description: 'You need to login to add items to wishlist' });
      return;
    }
    try {
      await supabase.from('wishlist').insert({ user_id: user.id, product_id: product.id });
      toast({ title: 'Added to wishlist', description: `${product.name} has been added to your wishlist` });
    } catch (error: any) {
      if (error.code === '23505') {
        toast({ title: 'Already in wishlist', description: 'This item is already in your wishlist' });
      } else {
        toast({ title: 'Error', description: 'Failed to add item to wishlist', variant: 'destructive' });
      }
    }
  };

  return { handleAddToCart, handleAddToWishlist };
}

export function useBestsellers() {
  return useQuery({
    queryKey: ['home-bestsellers'],
    queryFn: async () => {
      const { data } = await supabase.from('products')
        .select('*, category:categories(*), images:product_images(*)')
        .eq('is_active', true).eq('is_bestseller', true).limit(8);
      return (data || []) as Product[];
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });
}

export function useFeaturedProducts() {
  return useQuery({
    queryKey: ['home-featured'],
    queryFn: async () => {
      const { data } = await supabase.from('products')
        .select('*, category:categories(*), images:product_images(*)')
        .eq('is_active', true).eq('is_featured', true).limit(8);
      return (data || []) as Product[];
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });
}

export function useNewArrivals() {
  return useQuery({
    queryKey: ['home-new-arrivals'],
    queryFn: async () => {
      const { data } = await supabase.from('products')
        .select('*, category:categories(*), images:product_images(*)')
        .eq('is_active', true).order('created_at', { ascending: false }).limit(8);
      return (data || []) as Product[];
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });
}

export function useBundles() {
  return useQuery({
    queryKey: ['home-bundles'],
    queryFn: async () => {
      const { data } = await supabase.from('bundles')
        .select('*, items:bundle_items(*, product:products(name, price, images:product_images(*)))')
        .eq('is_active', true).order('sort_order').limit(6);
      return data || [];
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });
}

export function useReviewStats(productIds: string[]) {
  return useQuery({
    queryKey: ['home-review-stats', productIds.sort().join(',')],
    queryFn: async () => {
      if (productIds.length === 0) return {};
      const { data } = await supabase.from('reviews')
        .select('product_id, rating')
        .eq('is_approved', true)
        .in('product_id', productIds);
      const stats: Record<string, { avgRating: number; reviewCount: number }> = {};
      if (data) {
        const grouped: Record<string, number[]> = {};
        data.forEach(r => {
          if (!grouped[r.product_id]) grouped[r.product_id] = [];
          grouped[r.product_id].push(r.rating);
        });
        Object.entries(grouped).forEach(([pid, ratings]) => {
          stats[pid] = {
            avgRating: ratings.reduce((a, b) => a + b, 0) / ratings.length,
            reviewCount: ratings.length,
          };
        });
      }
      return stats;
    },
    enabled: productIds.length > 0,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });
}
