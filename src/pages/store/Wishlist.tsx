import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { StorefrontLayout } from '@/components/storefront/StorefrontLayout';
import { ProductCard } from '@/components/storefront/ProductCard';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Heart, Trash2 } from 'lucide-react';
import type { Product, Wishlist } from '@/types/database';

export default function WishlistPage() {
  const [wishlistItems, setWishlistItems] = useState<(Wishlist & { product: Product })[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (user) fetchWishlist();
  }, [user]);

  const fetchWishlist = async () => {
    if (!user) return;
    setIsLoading(true);
    const { data } = await supabase
      .from('wishlist')
      .select('*, product:products(*, category:categories(*), images:product_images(*))')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    setWishlistItems((data || []) as unknown as (Wishlist & { product: Product })[]);
    setIsLoading(false);
  };

  const handleRemove = async (wishlistId: string) => {
    await supabase.from('wishlist').delete().eq('id', wishlistId);
    setWishlistItems(prev => prev.filter(i => i.id !== wishlistId));
    toast({ title: 'Removed from wishlist' });
  };

  const handleAddToCart = async (product: Product) => {
    if (!user) return;
    try {
      let { data: cart } = await supabase.from('cart').select('id').eq('user_id', user.id).single();
      if (!cart) {
        const { data: newCart } = await supabase.from('cart').insert({ user_id: user.id }).select().single();
        cart = newCart;
      }
      if (cart) {
        const { data: existing } = await supabase.from('cart_items').select('id, quantity').eq('cart_id', cart.id).eq('product_id', product.id).single();
        if (existing) {
          await supabase.from('cart_items').update({ quantity: existing.quantity + 1 }).eq('id', existing.id);
        } else {
          await supabase.from('cart_items').insert({ cart_id: cart.id, product_id: product.id, quantity: 1 });
        }
        toast({ title: 'Added to cart', description: `${product.name} added to your cart` });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to add to cart', variant: 'destructive' });
    }
  };

  if (!user) {
    return (
      <StorefrontLayout>
        <div className="container mx-auto px-4 py-16 text-center">
          <Heart className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold mb-2">Login to view your wishlist</h2>
          <Button asChild><Link to="/auth">Login</Link></Button>
        </div>
      </StorefrontLayout>
    );
  }

  return (
    <StorefrontLayout>
      <div className="container mx-auto px-4 py-6">
        <h1 className="text-2xl font-bold mb-6">My Wishlist</h1>

        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="animate-pulse bg-muted rounded-lg aspect-[3/4]" />
            ))}
          </div>
        ) : wishlistItems.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Heart className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">Your wishlist is empty</h3>
              <p className="text-muted-foreground mb-4">Save items you love for later</p>
              <Button asChild><Link to="/products">Browse Products</Link></Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
            {wishlistItems.map((item) => (
              <div key={item.id} className="relative">
                <ProductCard product={item.product} onAddToCart={handleAddToCart} />
                <Button
                  variant="destructive"
                  size="icon"
                  className="absolute top-2 right-2 h-7 w-7 z-10"
                  onClick={() => handleRemove(item.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </StorefrontLayout>
  );
}