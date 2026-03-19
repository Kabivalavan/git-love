import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ShoppingCart, Menu, Heart, Search, ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { GlobalSearch } from './GlobalSearch';
import { useAuth } from '@/hooks/useAuth';
import { useGlobalStore } from '@/hooks/useGlobalStore';
import { useCartCount } from '@/hooks/useCartQuery';
import { cn } from '@/lib/utils';

export function Header() {
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const { user } = useAuth();
  const { categories, storeInfo, announcement } = useGlobalStore();
  const location = useLocation();
  const cartCount = useCartCount();
  const isHome = location.pathname === '/';
  const isProductDetail = location.pathname.startsWith('/product/');

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
    <header className="sticky top-0 z-50">
      {/* Top announcement bar */}
      {announcement?.is_active && announcement?.text && (
        <div className="bg-accent text-accent-foreground">
          <div className="container mx-auto px-4 py-1.5 text-center text-xs sm:text-sm font-medium">
            {announcement.link ? (
              <Link to={announcement.link} className="hover:underline">{announcement.text}</Link>
            ) : (
              announcement.text
            )}
          </div>
        </div>
      )}

      {/* Curved dark header */}
      <div className="bg-primary rounded-b-[28px] shadow-lg relative" style={{ zIndex: 60 }}>
        {/* Main header row */}
        <div className="container mx-auto px-4 pt-3 pb-5">
          {/* Top row: Logo/back + actions */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              {/* Mobile menu */}
              <Sheet>
                <SheetTrigger asChild className="lg:hidden">
                  <Button variant="ghost" size="icon" className="h-9 w-9 text-primary-foreground hover:bg-primary-foreground/10">
                    <Menu className="h-5 w-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-72">
                  <nav className="flex flex-col gap-4 mt-6">
                    <Link to="/" className="text-lg font-semibold">Home</Link>
                    <Link to="/products" className="text-lg font-semibold">Shop</Link>
                    {categories.map((cat) => (
                      <Link key={cat.id} to={`/category/${cat.slug}`} className="text-muted-foreground pl-2">{cat.name}</Link>
                    ))}
                  </nav>
                </SheetContent>
              </Sheet>

              {/* Logo */}
              <Link to="/" className="flex items-center gap-2 flex-shrink-0">
                {storeInfo?.logo_url ? (
                  <img src={storeInfo.logo_url} alt={storeInfo.name} className="h-7 sm:h-9 max-w-[120px] object-contain" />
                ) : (
                  <span className="text-lg sm:text-xl font-bold text-primary-foreground">{storeInfo?.name || 'Store'}</span>
                )}
              </Link>
            </div>

            {/* Desktop inline nav */}
            <nav className="hidden lg:flex items-center gap-5 ml-6">
              <Link to="/" className="text-sm font-medium text-primary-foreground/80 hover:text-primary-foreground transition-colors">Home</Link>
              <Link to="/products" className="text-sm font-medium text-primary-foreground/80 hover:text-primary-foreground transition-colors">Shop</Link>
            </nav>

            {/* Right actions */}
            <div className="flex items-center gap-1 ml-auto">
              {user && (
                <Button variant="ghost" size="icon" className="h-9 w-9 text-primary-foreground hover:bg-primary-foreground/10" asChild>
                  <Link to="/wishlist"><Heart className="h-5 w-5" /></Link>
                </Button>
              )}
              <Button variant="ghost" size="icon" className="relative h-9 w-9 text-primary-foreground hover:bg-primary-foreground/10" asChild>
                <Link to="/cart">
                  <ShoppingCart className="h-5 w-5" />
                  {cartCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 h-5 w-5 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center">{cartCount}</span>
                  )}
                </Link>
              </Button>
            </div>
          </div>

          {/* Search bar - prominent centered */}
          <div className="lg:max-w-xl lg:mx-auto">
            <GlobalSearch className="w-full" variant="header" />
          </div>
        </div>
      </div>

      {/* Desktop category navigation bar */}
      <nav className="hidden lg:block border-b border-border bg-card">
        <div className="container mx-auto px-4">
          <div className="flex items-center gap-1 py-2 overflow-x-auto scrollbar-thin">
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
              const isActive = location.pathname === `/category/${cat.slug}`;
              return (
                <Link
                  key={cat.id}
                  to={`/category/${cat.slug}`}
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
