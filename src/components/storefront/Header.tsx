import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ShoppingCart, User, Menu, Heart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { GlobalSearch } from './GlobalSearch';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import type { Category, StoreInfo } from '@/types/database';

interface AnnouncementSettings {
  text: string;
  is_active: boolean;
  link?: string;
}

const fetchHeaderData = async () => {
  const [categoriesRes, storeRes, announcementRes] = await Promise.all([
    supabase.from('categories').select('*').eq('is_active', true).is('parent_id', null).order('sort_order'),
    supabase.from('store_settings').select('value').eq('key', 'store_info').single(),
    supabase.from('store_settings').select('value').eq('key', 'announcement').single(),
  ]);
  return {
    categories: (categoriesRes.data || []) as Category[],
    storeInfo: storeRes.data?.value as unknown as StoreInfo | null,
    announcement: announcementRes.data?.value as unknown as AnnouncementSettings | null,
  };
};

export function Header() {
  const [cartCount, setCartCount] = useState(0);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const { user, signOut } = useAuth();

  const { data, isLoading: isHeaderLoading } = useQuery({
    queryKey: ['header-data'],
    queryFn: fetchHeaderData,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const categories = data?.categories || [];
  const storeInfo = data?.storeInfo || null;
  const announcement = data?.announcement || null;

  useEffect(() => {
    if (user) fetchCartCount();
  }, [user]);

  const fetchCartCount = async () => {
    if (!user) return;
    const { data: cart } = await supabase.from('cart').select('id').eq('user_id', user.id).single();
    if (cart) {
      const { count } = await supabase.from('cart_items').select('*', { count: 'exact', head: true }).eq('cart_id', cart.id);
      setCartCount(count || 0);
    }
  };

  return (
    <header className="sticky top-0 z-50 bg-card border-b border-border">
      {/* Top announcement bar */}
      {announcement?.is_active && announcement?.text && (
        <div className="bg-primary text-primary-foreground">
          <div className="container mx-auto px-4 py-1.5 text-center text-xs sm:text-sm">
            {announcement.link ? (
              <Link to={announcement.link} className="hover:underline">{announcement.text}</Link>
            ) : (
              announcement.text
            )}
          </div>
        </div>
      )}

      {/* Main header */}
      <div className="container mx-auto px-4 py-2.5">
        <div className="flex items-center justify-between gap-3 relative">
          {/* Mobile menu */}
          <Sheet>
            <SheetTrigger asChild className="lg:hidden">
              <Button variant="ghost" size="icon" className="h-9 w-9">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72">
              <nav className="flex flex-col gap-4 mt-6">
                <Link to="/" className="text-lg font-semibold">Home</Link>
                <Link to="/products" className="text-lg font-semibold">All Products</Link>
                {categories.map((cat) => (
                  <Link key={cat.id} to={`/products?category=${cat.slug}`} className="text-muted-foreground">{cat.name}</Link>
                ))}
              </nav>
            </SheetContent>
          </Sheet>

          {/* Logo - centered on mobile */}
          <Link to="/" className="flex items-center gap-2 flex-shrink-0 absolute left-1/2 -translate-x-1/2 lg:relative lg:left-auto lg:translate-x-0">
            {isHeaderLoading ? (
              <div className="h-8 sm:h-10 w-24 rounded bg-muted animate-pulse" />
            ) : storeInfo?.logo_url ? (
              <img src={storeInfo.logo_url} alt={storeInfo.name} className="h-8 sm:h-10 max-w-[120px] object-contain" />
            ) : (
              <span className="text-xl sm:text-2xl font-bold text-primary">{storeInfo?.name || 'Store'}</span>
            )}
          </Link>

          {/* Desktop search */}
          <GlobalSearch className="hidden lg:block flex-1 max-w-xl" />

          {/* Actions */}
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="lg:hidden h-9 w-9" onClick={() => setIsSearchOpen(!isSearchOpen)}>
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </Button>

            {user && (
              <Button variant="ghost" size="icon" className="h-9 w-9" asChild>
                <Link to="/wishlist"><Heart className="h-5 w-5" /></Link>
              </Button>
            )}

            <Button variant="ghost" size="icon" className="relative h-9 w-9" asChild>
              <Link to="/cart">
                <ShoppingCart className="h-5 w-5" />
                {cartCount > 0 && (
                  <Badge className="absolute -top-1 -right-1 h-4 w-4 p-0 flex items-center justify-center text-[10px]">{cartCount}</Badge>
                )}
              </Link>
            </Button>

            {user ? (
              <Button variant="ghost" size="icon" className="h-9 w-9" asChild>
                <Link to="/account"><User className="h-5 w-5" /></Link>
              </Button>
            ) : (
              <Button asChild size="sm" className="h-8 text-xs"><Link to="/auth">Login</Link></Button>
            )}
          </div>
        </div>

        {isSearchOpen && (
          <div className="lg:hidden mt-2">
            <GlobalSearch onClose={() => setIsSearchOpen(false)} autoFocus />
          </div>
        )}
      </div>

      {/* Desktop navigation */}
      <nav className="hidden lg:block border-t border-border">
        <div className="container mx-auto px-4">
          <ul className="flex items-center gap-6 py-2">
            <li><Link to="/" className="text-sm font-medium hover:text-primary transition-colors">Home</Link></li>
            <li><Link to="/products" className="text-sm font-medium hover:text-primary transition-colors">All Products</Link></li>
            {categories.slice(0, 6).map((cat) => (
              <li key={cat.id}>
                <Link to={`/products?category=${cat.slug}`} className="text-sm font-medium hover:text-primary transition-colors">{cat.name}</Link>
              </li>
            ))}
          </ul>
        </div>
      </nav>
    </header>
  );
}