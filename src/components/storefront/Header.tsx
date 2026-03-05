import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ShoppingCart, User, Menu, Heart, Search, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { GlobalSearch } from './GlobalSearch';
import { useAuth } from '@/hooks/useAuth';
import { useGlobalStore } from '@/hooks/useGlobalStore';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { cn } from '@/lib/utils';

const fetchCartCount = async (userId: string) => {
  const { data: cart } = await supabase.from('cart').select('id').eq('user_id', userId).single();
  if (cart) {
    const { count } = await supabase.from('cart_items').select('*', { count: 'exact', head: true }).eq('cart_id', cart.id);
    return count || 0;
  }
  return 0;
};

export function Header() {
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const { user } = useAuth();
  const { categories, storeInfo, announcement } = useGlobalStore();
  const location = useLocation();

  const { data: cartCount = 0 } = useQuery({
    queryKey: ['cart-count', user?.id],
    queryFn: () => fetchCartCount(user!.id),
    enabled: !!user,
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
  });

  // Set dynamic favicon from store settings
  useEffect(() => {
    if (storeInfo?.favicon_url) {
      const link = document.querySelector("link[rel~='icon']") as HTMLLinkElement | null;
      if (link) {
        link.href = storeInfo.favicon_url;
      } else {
        const newLink = document.createElement('link');
        newLink.rel = 'icon';
        newLink.href = storeInfo.favicon_url;
        document.head.appendChild(newLink);
      }
    }
  }, [storeInfo?.favicon_url]);

  return (
    <header className="sticky top-0 z-50 bg-card shadow-sm">
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

      {/* Main header row */}
      <div className="container mx-auto px-4 py-2.5">
        <div className="flex items-center gap-3">
          {/* Mobile menu */}
          <Sheet>
            <SheetTrigger asChild className="lg:hidden">
              <Button variant="ghost" size="icon" className="h-9 w-9 flex-shrink-0">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72">
              <nav className="flex flex-col gap-4 mt-6">
                <Link to="/" className="text-lg font-semibold">Home</Link>
                <Link to="/products" className="text-lg font-semibold">Shop</Link>
                {categories.map((cat) => (
                  <Link key={cat.id} to={`/products?category=${cat.slug}`} className="text-muted-foreground pl-2">{cat.name}</Link>
                ))}
              </nav>
            </SheetContent>
          </Sheet>

          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 flex-shrink-0">
            {storeInfo?.logo_url ? (
              <img src={storeInfo.logo_url} alt={storeInfo.name} className="h-8 sm:h-10 max-w-[140px] object-contain" />
            ) : (
              <span className="text-xl sm:text-2xl font-bold text-primary">{storeInfo?.name || 'Store'}</span>
            )}
          </Link>

          {/* Desktop inline nav links */}
          <nav className="hidden lg:flex items-center gap-5 ml-4">
            <Link to="/" className="text-sm font-medium text-foreground hover:text-primary transition-colors">Home</Link>
            <Link to="/products" className="text-sm font-medium text-foreground hover:text-primary transition-colors">Shop</Link>
          </nav>

          {/* Search bar - centered, pill-shaped like Cartsy */}
          <div className="hidden lg:block flex-1 max-w-xl mx-4">
            <GlobalSearch className="w-full" />
          </div>

          {/* Right actions */}
          <div className="flex items-center gap-0.5 ml-auto">
            {/* Mobile search toggle */}
            <Button variant="ghost" size="icon" className="lg:hidden h-9 w-9" onClick={() => setIsSearchOpen(!isSearchOpen)}>
              <Search className="h-5 w-5" />
            </Button>

            {/* Wishlist */}
            {user && (
              <Button variant="ghost" size="icon" className="h-9 w-9" asChild>
                <Link to="/wishlist"><Heart className="h-5 w-5" /></Link>
              </Button>
            )}

            {/* Cart */}
            <Button variant="ghost" size="icon" className="relative h-9 w-9" asChild>
              <Link to="/cart">
                <ShoppingCart className="h-5 w-5" />
                {cartCount > 0 && (
                  <Badge className="absolute -top-1 -right-1 h-4 w-4 p-0 flex items-center justify-center text-[10px] rounded-full">{cartCount}</Badge>
                )}
              </Link>
            </Button>

            {/* User */}
            {user ? (
              <Button variant="ghost" size="icon" className="h-9 w-9" asChild>
                <Link to="/account"><User className="h-5 w-5" /></Link>
              </Button>
            ) : (
              <Button asChild size="sm" className="h-8 text-xs ml-1"><Link to="/auth">Sign In</Link></Button>
            )}
          </div>
        </div>

        {/* Mobile search dropdown */}
        {isSearchOpen && (
          <div className="lg:hidden mt-2 pb-1">
            <GlobalSearch onClose={() => setIsSearchOpen(false)} autoFocus />
          </div>
        )}
      </div>

      {/* Category navigation bar - horizontal scrollable chips like Cartsy */}
      <nav className="border-t border-border bg-card">
        <div className="container mx-auto px-4">
          <div className="flex items-center gap-1 py-2 overflow-x-auto scrollbar-thin">
            {/* Categories dropdown on desktop */}
            <Link
              to="/products"
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors flex-shrink-0",
                location.pathname === '/products' && !location.search
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-secondary-foreground hover:bg-primary/10"
              )}
            >
              All
            </Link>
            {categories.slice(0, 8).map((cat) => {
              const isActive = location.search.includes(`category=${cat.slug}`);
              return (
                <Link
                  key={cat.id}
                  to={`/products?category=${cat.slug}`}
                  className={cn(
                    "px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors flex-shrink-0",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-secondary-foreground hover:bg-primary/10"
                  )}
                >
                  {cat.name}
                </Link>
              );
            })}
          </div>
        </div>
      </nav>
    </header>
  );
}
