import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, ArrowRight, Truck, Shield, RefreshCw, Headphones } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { StorefrontLayout } from '@/components/storefront/StorefrontLayout';
import { ProductCard } from '@/components/storefront/ProductCard';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useOffers } from '@/hooks/useOffers';
import { SEOHead } from '@/components/seo/SEOHead';
import type { Product, Banner, Category } from '@/types/database';

function FullPageShimmer() {
  return (
    <StorefrontLayout>
      <div className="min-h-screen">
        <Skeleton className="w-full aspect-[3/1] md:aspect-[4/1]" />
        <div className="py-4 bg-muted">
          <div className="container mx-auto px-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-12" />)}
            </div>
          </div>
        </div>
        <div className="container mx-auto px-4 py-10">
          <Skeleton className="h-8 w-48 mb-6" />
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-card rounded-lg border border-border overflow-hidden">
                <Skeleton className="aspect-square" />
                <div className="p-3 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                  <Skeleton className="h-6 w-1/3" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </StorefrontLayout>
  );
}

const fetchHomeData = async () => {
  const [bannersRes, middleBannersRes, categoriesRes, featuredRes, bestsellersRes, newRes, bundlesRes] = await Promise.all([
    supabase.from('banners').select('*').eq('is_active', true).eq('position', 'home_top').order('sort_order'),
    supabase.from('banners').select('*').eq('is_active', true).eq('position', 'home_middle').order('sort_order'),
    supabase.from('categories').select('*').eq('is_active', true).is('parent_id', null).order('sort_order').limit(8),
    supabase.from('products').select('*, category:categories(*), images:product_images(*)').eq('is_active', true).eq('is_featured', true).limit(8),
    supabase.from('products').select('*, category:categories(*), images:product_images(*)').eq('is_active', true).eq('is_bestseller', true).limit(8),
    supabase.from('products').select('*, category:categories(*), images:product_images(*)').eq('is_active', true).order('created_at', { ascending: false }).limit(8),
    supabase.from('bundles').select('*, items:bundle_items(*, product:products(name, price, images:product_images(*)))').eq('is_active', true).order('sort_order').limit(6),
  ]);
  return {
    banners: (bannersRes.data || []) as Banner[],
    middleBanners: (middleBannersRes.data || []) as Banner[],
    categories: (categoriesRes.data || []) as Category[],
    featuredProducts: (featuredRes.data || []) as Product[],
    bestsellerProducts: (bestsellersRes.data || []) as Product[],
    newArrivals: (newRes.data || []) as Product[],
    bundles: bundlesRes.data || [],
  };
};

export default function HomePage() {
  const [currentBanner, setCurrentBanner] = useState(0);
  const { toast } = useToast();
  const { user } = useAuth();
  const { getProductOffer, isLoading: isOffersLoading } = useOffers();

  const { data, isLoading } = useQuery({
    queryKey: ['home-page-data'],
    queryFn: fetchHomeData,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const banners = data?.banners || [];
  const middleBanners = data?.middleBanners || [];
  const categories = data?.categories || [];
  const featuredProducts = data?.featuredProducts || [];
  const bestsellerProducts = data?.bestsellerProducts || [];
  const newArrivals = data?.newArrivals || [];
  const bundles = data?.bundles || [];
  useEffect(() => {
    if (banners.length > 1) {
      const interval = setInterval(() => {
        setCurrentBanner((prev) => (prev + 1) % banners.length);
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [banners.length]);

  const handleAddToCart = async (product: Product) => {
    if (!user) {
      toast({ title: 'Please login', description: 'You need to login to add items to cart' });
      return;
    }
    try {
      let { data: cart } = await supabase.from('cart').select('id').eq('user_id', user.id).single();
      if (!cart) {
        const { data: newCart } = await supabase.from('cart').insert({ user_id: user.id }).select().single();
        cart = newCart;
      }
      if (cart) {
        const { data: existingItem } = await supabase.from('cart_items').select('id, quantity').eq('cart_id', cart.id).eq('product_id', product.id).single();
        if (existingItem) {
          await supabase.from('cart_items').update({ quantity: existingItem.quantity + 1 }).eq('id', existingItem.id);
        } else {
          await supabase.from('cart_items').insert({ cart_id: cart.id, product_id: product.id, quantity: 1 });
        }
        toast({ title: 'Added to cart', description: `${product.name} has been added to your cart` });
      }
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to add item to cart', variant: 'destructive' });
    }
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

  if (isLoading || isOffersLoading) return <FullPageShimmer />;

  return (
    <StorefrontLayout>
      <SEOHead
        title="Decon Fashions - Premium Men's Clothing Store"
        description="Shop premium men's shirts, pants & fashion at Decon Fashions. Free shipping on orders above ₹500. Quality clothing at affordable prices."
        jsonLd={{
          '@type': 'Store',
          name: 'Decon Fashions',
          description: 'Premium men\'s clothing store',
          url: window.location.origin,
          priceRange: '₹₹',
        }}
      />
      {/* Hero Banner Slider */}
      {banners.length > 0 && (
        <section className="relative">
          <div className="relative overflow-hidden aspect-[3/1] md:aspect-[4/1]">
            {banners.map((banner, index) => (
              <div key={banner.id} className={`absolute inset-0 transition-opacity duration-500 ${index === currentBanner ? 'opacity-100 z-10' : 'opacity-0 z-0'}`}>
                <Link to={banner.redirect_url || '/products'}>
                  <img src={banner.media_url} alt={banner.title} className="w-full h-full object-cover" />
                </Link>
              </div>
            ))}
          </div>
          {banners.length > 1 && (
            <>
              <Button variant="secondary" size="icon" className="absolute left-2 md:left-4 top-1/2 -translate-y-1/2 z-20 opacity-70 hover:opacity-100 h-8 w-8 md:h-10 md:w-10" onClick={() => setCurrentBanner((prev) => (prev - 1 + banners.length) % banners.length)}>
                <ChevronLeft className="h-4 w-4 md:h-6 md:w-6" />
              </Button>
              <Button variant="secondary" size="icon" className="absolute right-2 md:right-4 top-1/2 -translate-y-1/2 z-20 opacity-70 hover:opacity-100 h-8 w-8 md:h-10 md:w-10" onClick={() => setCurrentBanner((prev) => (prev + 1) % banners.length)}>
                <ChevronRight className="h-4 w-4 md:h-6 md:w-6" />
              </Button>
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 z-20">
                {banners.map((_, index) => (
                  <button key={index} className={`w-2 h-2 md:w-2.5 md:h-2.5 rounded-full transition-colors ${index === currentBanner ? 'bg-primary' : 'bg-white/50'}`} onClick={() => setCurrentBanner(index)} />
                ))}
              </div>
            </>
          )}
        </section>
      )}

      {/* Features Strip */}
      <section className="bg-muted py-3 md:py-4">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
            {[
              { icon: Truck, title: 'Free Shipping', desc: 'On orders above ₹500' },
              { icon: Shield, title: 'Secure Payment', desc: '100% secure checkout' },
              { icon: RefreshCw, title: 'Easy Returns', desc: '7-day return policy' },
              { icon: Headphones, title: '24/7 Support', desc: 'Dedicated support' },
            ].map((f, i) => (
              <div key={i} className="flex items-center gap-2 md:gap-3 justify-center">
                <f.icon className="h-4 w-4 md:h-6 md:w-6 text-primary flex-shrink-0" />
                <div className="min-w-0">
                  <p className="font-medium text-[10px] md:text-sm truncate">{f.title}</p>
                  <p className="text-[9px] md:text-xs text-muted-foreground truncate hidden md:block">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Categories */}
      {categories.length > 0 && (
        <section className="container mx-auto px-4 py-6 md:py-10">
          <div className="mb-4 md:mb-6">
            <h2 className="text-lg md:text-2xl font-bold text-foreground">Shop by Category</h2>
          </div>
          <div className="grid grid-cols-4 sm:grid-cols-4 lg:grid-cols-8 gap-3 md:gap-4">
            {categories.map((category) => (
              <Link key={category.id} to={`/products?category=${category.slug}`} className="group text-center">
                <div className="aspect-square rounded-xl overflow-hidden bg-muted border-2 border-transparent group-hover:border-primary transition-colors mx-auto w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24">
                  {category.image_url ? (
                    <img src={category.image_url} alt={category.name} className="w-full h-full object-cover" loading="lazy" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-secondary">
                      <span className="text-lg md:text-2xl font-bold text-muted-foreground">{category.name.charAt(0)}</span>
                    </div>
                  )}
                </div>
                <p className="mt-1.5 text-[10px] md:text-sm font-medium text-foreground group-hover:text-primary transition-colors truncate">{category.name}</p>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Best Sellers */}
      {bestsellerProducts.length > 0 && (
        <section className="bg-muted py-6 md:py-10">
          <div className="container mx-auto px-4">
            <div className="flex items-center justify-between mb-4 md:mb-6">
              <h2 className="text-lg md:text-2xl font-bold text-foreground">Best Sellers</h2>
              <Button variant="ghost" asChild size="sm">
                <Link to="/products?bestseller=true">View All <ArrowRight className="h-4 w-4 ml-1" /></Link>
              </Button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 md:gap-3">
              {bestsellerProducts.map((product) => (
                <ProductCard key={product.id} product={product} onAddToCart={handleAddToCart} onAddToWishlist={handleAddToWishlist} productOffer={getProductOffer(product)} variant="compact" />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Middle Banners */}
      {middleBanners.length > 0 && (
        <section className="container mx-auto px-4 py-6 md:py-10">
          <div className={`grid gap-3 md:gap-6 ${middleBanners.length === 1 ? 'grid-cols-1' : 'md:grid-cols-2'}`}>
            {middleBanners.map((banner) => (
              <Card key={banner.id} className="overflow-hidden group cursor-pointer">
                <CardContent className="p-0">
                  <Link to={banner.redirect_url || '/products'}>
                    <div className="aspect-[2/1] overflow-hidden">
                      <img src={banner.media_url} alt={banner.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                    </div>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      {middleBanners.length === 0 && (
        <section className="container mx-auto px-4 py-6 md:py-10">
          <div className="grid md:grid-cols-2 gap-3 md:gap-6">
            <Card className="overflow-hidden">
              <CardContent className="p-0 relative">
                <div className="aspect-[2/1] bg-gradient-to-r from-primary to-primary/80 flex items-center p-4 md:p-8">
                  <div className="text-primary-foreground">
                    <p className="text-[10px] md:text-sm font-medium mb-1">SPECIAL OFFER</p>
                    <h3 className="text-base md:text-2xl font-bold mb-1 md:mb-2">Up to 50% OFF</h3>
                    <p className="text-[10px] md:text-sm opacity-90 mb-2 md:mb-4">On selected items</p>
                    <Button variant="secondary" size="sm" asChild><Link to="/products?offer=true">Shop Now</Link></Button>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="overflow-hidden">
              <CardContent className="p-0 relative">
                <div className="aspect-[2/1] bg-gradient-to-r from-amber-500 to-orange-500 flex items-center p-4 md:p-8">
                  <div className="text-white">
                    <p className="text-[10px] md:text-sm font-medium mb-1">NEW ARRIVALS</p>
                    <h3 className="text-base md:text-2xl font-bold mb-1 md:mb-2">Fresh Collection</h3>
                    <p className="text-[10px] md:text-sm opacity-90 mb-2 md:mb-4">Just dropped this week</p>
                    <Button variant="secondary" size="sm" asChild><Link to="/products?new=true">Explore</Link></Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>
      )}

      {/* Featured Products */}
      {featuredProducts.length > 0 && (
        <section className="container mx-auto px-4 py-6 md:py-10">
          <div className="flex items-center justify-between mb-4 md:mb-6">
            <h2 className="text-lg md:text-2xl font-bold text-foreground">Featured Products</h2>
            <Button variant="ghost" asChild size="sm">
              <Link to="/products?featured=true">View All <ArrowRight className="h-4 w-4 ml-1" /></Link>
            </Button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 md:gap-3">
            {featuredProducts.map((product) => (
              <ProductCard key={product.id} product={product} onAddToCart={handleAddToCart} onAddToWishlist={handleAddToWishlist} productOffer={getProductOffer(product)} variant="compact" />
            ))}
          </div>
        </section>
      )}
      {/* Bundles */}
      {bundles.length > 0 && (
        <section className="container mx-auto px-4 py-6 md:py-10">
          <div className="flex items-center justify-between mb-4 md:mb-6">
            <h2 className="text-lg md:text-2xl font-bold text-foreground">Bundle Deals</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {bundles.map((bundle: any) => {
              const discount = bundle.compare_price && bundle.compare_price > bundle.bundle_price
                ? Math.round(((bundle.compare_price - bundle.bundle_price) / bundle.compare_price) * 100)
                : 0;
              const bundleImage = bundle.image_url || bundle.items?.[0]?.product?.images?.[0]?.image_url || '/placeholder.svg';
              return (
                <Card key={bundle.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                  <CardContent className="p-0">
                    <div className="aspect-[2/1] relative overflow-hidden bg-muted">
                      <img src={bundleImage} alt={bundle.name} className="w-full h-full object-cover" loading="lazy" />
                      {discount > 0 && (
                        <Badge variant="destructive" className="absolute top-2 left-2">{discount}% OFF</Badge>
                      )}
                    </div>
                    <div className="p-4">
                      <h3 className="font-semibold text-foreground">{bundle.name}</h3>
                      {bundle.description && <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{bundle.description}</p>}
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-lg font-bold text-foreground">₹{Number(bundle.bundle_price).toFixed(0)}</span>
                        {bundle.compare_price && bundle.compare_price > bundle.bundle_price && (
                          <span className="text-sm text-muted-foreground line-through">₹{Number(bundle.compare_price).toFixed(0)}</span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">{bundle.items?.length || 0} products included</p>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>
      )}

      {/* Check All Products (was New Arrivals) */}
      {newArrivals.length > 0 && (
        <section className="bg-muted py-6 md:py-10">
          <div className="container mx-auto px-4">
            <div className="flex items-center justify-between mb-4 md:mb-6">
              <h2 className="text-lg md:text-2xl font-bold text-foreground">Check All Products</h2>
              <Button variant="ghost" asChild size="sm">
                <Link to="/products">View All <ArrowRight className="h-4 w-4 ml-1" /></Link>
              </Button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
              {newArrivals.slice(0, 8).map((product) => (
                <ProductCard key={product.id} product={product} onAddToCart={handleAddToCart} onAddToWishlist={handleAddToWishlist} productOffer={getProductOffer(product)} />
              ))}
            </div>
          </div>
        </section>
      )}
    </StorefrontLayout>
  );
}