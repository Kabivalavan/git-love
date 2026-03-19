import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import type { Product, ProductVariant } from '@/types/database';

export interface CartItemWithProduct {
  id: string;
  cart_id: string;
  product_id: string;
  variant_id: string | null;
  quantity: number;
  bundle_id?: string | null;
  bundle_name?: string | null;
  product: Product;
  variant?: ProductVariant;
}

const CART_QUERY_KEY = ['user-cart'] as const;

async function fetchCart(userId: string): Promise<CartItemWithProduct[]> {
  const { data: cart } = await supabase
    .from('cart')
    .select('id')
    .eq('user_id', userId)
    .single();

  if (!cart) return [];

  const { data: items } = await supabase
    .from('cart_items')
    .select('*, product:products(*, category:categories(*), images:product_images(*)), variant:product_variants(*)')
    .eq('cart_id', cart.id);

  return (items || []) as unknown as CartItemWithProduct[];
}

export function useCartQuery() {
  const { user } = useAuth();

  return useQuery({
    queryKey: CART_QUERY_KEY,
    queryFn: () => fetchCart(user!.id),
    enabled: !!user,
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

export function useCartCount() {
  const { data: items } = useCartQuery();
  return items?.reduce((sum, item) => sum + item.quantity, 0) || 0;
}

export function useCartMutations() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const invalidateCart = () => queryClient.invalidateQueries({ queryKey: CART_QUERY_KEY });

  const getOrCreateCart = async () => {
    if (!user) throw new Error('Not authenticated');
    let { data: cart } = await supabase.from('cart').select('id').eq('user_id', user.id).single();
    if (!cart) {
      const { data: newCart } = await supabase.from('cart').insert({ user_id: user.id }).select().single();
      cart = newCart;
    }
    return cart!;
  };

  const addToCart = useMutation({
    mutationFn: async ({ product, quantity = 1, variantId }: { product: Product; quantity?: number; variantId?: string | null }) => {
      const cart = await getOrCreateCart();
      const { data: existing } = await supabase
        .from('cart_items')
        .select('id, quantity')
        .eq('cart_id', cart.id)
        .eq('product_id', product.id)
        .eq('variant_id', variantId || null)
        .single();

      if (existing) {
        await supabase.from('cart_items').update({ quantity: existing.quantity + quantity }).eq('id', existing.id);
      } else {
        await supabase.from('cart_items').insert({
          cart_id: cart.id,
          product_id: product.id,
          variant_id: variantId || null,
          quantity,
        });
      }
      return product.name;
    },
    onSuccess: (name) => {
      invalidateCart();
      toast({ title: 'Added to cart', description: `${name} has been added to your cart` });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to add item to cart', variant: 'destructive' });
    },
  });

  const updateQuantity = useMutation({
    mutationFn: async ({ itemId, quantity }: { itemId: string; quantity: number }) => {
      if (quantity <= 0) {
        await supabase.from('cart_items').delete().eq('id', itemId);
      } else {
        await supabase.from('cart_items').update({ quantity }).eq('id', itemId);
      }
    },
    onMutate: async ({ itemId, quantity }) => {
      await queryClient.cancelQueries({ queryKey: CART_QUERY_KEY });
      const previous = queryClient.getQueryData<CartItemWithProduct[]>(CART_QUERY_KEY);
      queryClient.setQueryData<CartItemWithProduct[]>(CART_QUERY_KEY, (old) => {
        if (!old) return old;
        if (quantity <= 0) return old.filter(i => i.id !== itemId);
        return old.map(i => i.id === itemId ? { ...i, quantity } : i);
      });
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(CART_QUERY_KEY, context.previous);
      toast({ title: 'Error', description: 'Failed to update cart', variant: 'destructive' });
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: CART_QUERY_KEY }),
  });

  const removeItem = useMutation({
    mutationFn: async (itemId: string) => {
      await supabase.from('cart_items').delete().eq('id', itemId);
    },
    onSuccess: invalidateCart,
    onError: () => {
      toast({ title: 'Error', description: 'Failed to remove item', variant: 'destructive' });
    },
  });

  const clearCart = useMutation({
    mutationFn: async () => {
      if (!user) return;
      const { data: cart } = await supabase.from('cart').select('id').eq('user_id', user.id).single();
      if (cart) {
        await supabase.from('cart_items').delete().eq('cart_id', cart.id);
      }
    },
    onSuccess: invalidateCart,
  });

  return {
    addToCart,
    updateQuantity,
    removeItem,
    clearCart,
    invalidateCart,
  };
}
