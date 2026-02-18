import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, ArrowRight, Truck, Shield, RefreshCw, Headphones, Sparkles, Flame, Star, X } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
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

import type { Easing } from 'framer-motion';

const easeOut: Easing = [0, 0, 0.2, 1];

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: easeOut } },
};

const staggerContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1 } },
};

const scaleIn = {
  hidden: { opacity: 0, scale: 0.9 },
  visible: { opacity: 1, scale: 1, transition: { duration: 0.4, ease: easeOut } },
};

function FullPageShimmer() {
  return (
    <StorefrontLayout>
      <div className="min-h-screen">
        <Skeleton className="w-full aspect-[3/1] md:aspect-[3/1]" />
        <div className="py-4 bg-muted">
          <div className="container mx-auto px-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-14 rounded-xl" />)}
            </div>
          </div>
        </div>
        <div className="container mx-auto px-4 py-10">
          <Skeleton className="h-8 w-48 mb-6" />
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-card rounded-xl border border-border overflow-hidden">
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
  const [bannersRes, middleBannersRes, popupBannersRes, categoriesRes, featuredRes, bestsellersRes, newRes, bundlesRes] = await Promise.all([
    supabase.from('banners').select('*').eq('is_active', true).eq('position', 'home_top').order('sort_order'),
    supabase.from('banners').select('*').eq('is_active', true).eq('position', 'home_middle').order('sort_order'),
    supabase.from('banners').select('*').eq('is_active', true).eq('position', 'popup').order('sort_order').limit(1),
    supabase.from('categories').select('*').eq('is_active', true).is('parent_id', null).order('sort_order').limit(8),
    supabase.from('products').select('*, category:categories(*), images:product_images(*)').eq('is_active', true).eq('is_featured', true).limit(8),
    supabase.from('products').select('*, category:categories(*), images:product_images(*)').eq('is_active', true).eq('is_bestseller', true).limit(8),
    supabase.from('products').select('*, category:categories(*), images:product_images(*)').eq('is_active', true).order('created_at', { ascending: false }).limit(8),
    supabase.from('bundles').select('*, items:bundle_items(*, product:products(name, price, images:product_images(*)))').eq('is_active', true).order('sort_order').limit(6),
  ]);
  return {
    banners: (bannersRes.data || []) as Banner[],
    middleBanners: (middleBannersRes.data || []) as Banner[],
    popupBanner: ((popupBannersRes.data || [])[0] || null) as Banner | null,
    categories: (categoriesRes.data || []) as Category[],
    featuredProducts: (featuredRes.data || []) as Product[],
    bestsellerProducts: (bestsellersRes.data || []) as Product[],
    newArrivals: (newRes.data || []) as Product[],
    bundles: bundlesRes.data || [],
  };
};

export default function HomePage() {
  const [currentBanner, setCurrentBanner] = useState(0);
  const [showPopup, setShowPopup] = useState(false);
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
  const popupBanner = data?.popupBanner || null;
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

  // Popup banner - show after 4 seconds
  useEffect(() => {
    if (popupBanner) {
      const popupDismissed = sessionStorage.getItem('popup_banner_dismissed');
      if (!popupDismissed) {
        const timer = setTimeout(() => setShowPopup(true), 4000);
        return () => clearTimeout(timer);
      }
    }
  }, [popupBanner]);

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
          <div className="relative overflow-hidden aspect-[3/1] md:aspect-[3/1]">
            {banners.map((banner, index) => (
              <div key={banner.id} className={`absolute inset-0 transition-all duration-700 ${index === currentBanner ? 'opacity-100 z-10 scale-100' : 'opacity-0 z-0 scale-105'}`}>
                <Link to={banner.redirect_url || '/products'}>
                  <img src={banner.media_url} alt={banner.title} className="w-full h-full object-cover" />
                </Link>
              </div>
            ))}
          </div>
          {banners.length > 1 && (
            <>
              <Button variant="secondary" size="icon" className="absolute left-3 md:left-6 top-1/2 -translate-y-1/2 z-20 bg-card/80 backdrop-blur-sm hover:bg-card shadow-lg h-10 w-10 md:h-12 md:w-12 rounded-full" onClick={() => setCurrentBanner((prev) => (prev - 1 + banners.length) % banners.length)}>
                <ChevronLeft className="h-5 w-5 md:h-6 md:w-6" />
              </Button>
              <Button variant="secondary" size="icon" className="absolute right-3 md:right-6 top-1/2 -translate-y-1/2 z-20 bg-card/80 backdrop-blur-sm hover:bg-card shadow-lg h-10 w-10 md:h-12 md:w-12 rounded-full" onClick={() => setCurrentBanner((prev) => (prev + 1) % banners.length)}>
                <ChevronRight className="h-5 w-5 md:h-6 md:w-6" />
              </Button>
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 z-20">
                {banners.map((_, index) => (
                  <button key={index} className={`rounded-full transition-all ${index === currentBanner ? 'bg-primary w-6 h-2.5' : 'bg-card/60 w-2.5 h-2.5'}`} onClick={() => setCurrentBanner(index)} />
                ))}
              </div>
            </>
          )}
        </section>
      )}

      {/* Features Strip */}
      <motion.section
        className="bg-primary text-primary-foreground py-3 md:py-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
      >
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
            {[
              { icon: Truck, title: 'Free Shipping', desc: 'On orders above ₹500' },
              { icon: Shield, title: 'Secure Payment', desc: '100% secure checkout' },
              { icon: RefreshCw, title: 'Easy Returns', desc: '7-day return policy' },
              { icon: Headphones, title: '24/7 Support', desc: 'Dedicated support' },
            ].map((f, i) => (
              <motion.div
                key={i}
                className="flex items-center gap-2 md:gap-3 justify-center"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 + i * 0.1 }}
              >
                <div className="h-8 w-8 md:h-10 md:w-10 rounded-full bg-primary-foreground/15 flex items-center justify-center flex-shrink-0">
                  <f.icon className="h-4 w-4 md:h-5 md:w-5" />
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-[10px] md:text-sm truncate">{f.title}</p>
                  <p className="text-[9px] md:text-xs opacity-80 truncate hidden md:block">{f.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </motion.section>

      {/* Categories */}
      {categories.length > 0 && (
        <motion.section
          className="container mx-auto px-4 py-8 md:py-12"
          variants={fadeUp}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-50px' }}
        >
          <div className="flex items-center gap-3 mb-6 md:mb-8">
            <h2 className="text-xl md:text-3xl font-bold text-foreground">Shop by Category</h2>
            <div className="flex-1 h-px bg-border" />
          </div>
          <motion.div
            className="grid grid-cols-4 sm:grid-cols-4 lg:grid-cols-8 gap-4 md:gap-6"
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
          >
            {categories.map((category) => (
              <motion.div key={category.id} variants={scaleIn}>
                <Link to={`/products?category=${category.slug}`} className="group text-center block">
                  <div className="aspect-square rounded-2xl overflow-hidden bg-muted border-2 border-transparent group-hover:border-primary transition-all duration-300 mx-auto w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 group-hover:shadow-lg group-hover:scale-105">
                    {category.image_url ? (
                      <img src={category.image_url} alt={category.name} className="w-full h-full object-cover" loading="lazy" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/20 to-primary/5">
                        <span className="text-lg md:text-2xl font-bold text-primary">{category.name.charAt(0)}</span>
                      </div>
                    )}
                  </div>
                  <p className="mt-2 text-[10px] md:text-sm font-semibold text-foreground group-hover:text-primary transition-colors truncate">{category.name}</p>
                </Link>
              </motion.div>
            ))}
          </motion.div>
        </motion.section>
      )}

      {/* Best Sellers */}
      {bestsellerProducts.length > 0 && (
        <motion.section
          className="bg-muted/50 py-8 md:py-12"
          variants={fadeUp}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-50px' }}
        >
          <div className="container mx-auto px-4">
            <div className="flex items-center justify-between mb-6 md:mb-8">
              <div className="flex items-center gap-2">
                <Flame className="h-5 w-5 md:h-6 md:w-6 text-amber-500" />
                <h2 className="text-xl md:text-3xl font-bold text-foreground">Best Sellers</h2>
              </div>
              <Button variant="outline" asChild size="sm" className="rounded-full">
                <Link to="/products?bestseller=true">View All <ArrowRight className="h-4 w-4 ml-1" /></Link>
              </Button>
            </div>
            <motion.div
              className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 md:gap-4"
              variants={staggerContainer}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
            >
              {bestsellerProducts.map((product) => (
                <motion.div key={product.id} variants={scaleIn}>
                  <ProductCard product={product} onAddToCart={handleAddToCart} onAddToWishlist={handleAddToWishlist} productOffer={getProductOffer(product)} variant="compact" />
                </motion.div>
              ))}
            </motion.div>
          </div>
        </motion.section>
      )}

      {/* Middle Banners */}
      {middleBanners.length > 0 && (
        <motion.section
          className="container mx-auto px-4 py-8 md:py-12"
          variants={fadeUp}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-50px' }}
        >
          <div className={`grid gap-4 md:gap-6 ${middleBanners.length === 1 ? 'grid-cols-1' : 'md:grid-cols-2'}`}>
            {middleBanners.map((banner) => (
              <Card key={banner.id} className="overflow-hidden group cursor-pointer border-0 shadow-lg">
                <CardContent className="p-0">
                  <Link to={banner.redirect_url || '/products'}>
                    <div className="aspect-[2/1] overflow-hidden">
                      <img src={banner.media_url} alt={banner.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                    </div>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        </motion.section>
      )}

      {middleBanners.length === 0 && (
        <motion.section
          className="container mx-auto px-4 py-8 md:py-12"
          variants={fadeUp}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-50px' }}
        >
          <div className="grid md:grid-cols-2 gap-4 md:gap-6">
            <Card className="overflow-hidden border-0 shadow-lg">
              <CardContent className="p-0 relative">
                <div className="aspect-[2/1] bg-gradient-to-br from-primary via-primary/90 to-accent flex items-center p-6 md:p-10">
                  <div className="text-primary-foreground">
                    <Badge className="bg-primary-foreground/20 text-primary-foreground border-0 mb-3">SPECIAL OFFER</Badge>
                    <h3 className="text-xl md:text-3xl font-bold mb-2">Up to 50% OFF</h3>
                    <p className="text-sm opacity-90 mb-4">On selected items this season</p>
                    <Button className="bg-primary-foreground text-primary hover:bg-primary-foreground/90 rounded-full" size="sm" asChild><Link to="/products?offer=true">Shop Now <ArrowRight className="h-4 w-4 ml-1" /></Link></Button>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="overflow-hidden border-0 shadow-lg">
              <CardContent className="p-0 relative">
                <div className="aspect-[2/1] bg-gradient-to-br from-amber-500 via-orange-500 to-red-500 flex items-center p-6 md:p-10">
                  <div className="text-white">
                    <Badge className="bg-white/20 text-white border-0 mb-3">NEW ARRIVALS</Badge>
                    <h3 className="text-xl md:text-3xl font-bold mb-2">Fresh Collection</h3>
                    <p className="text-sm opacity-90 mb-4">Just dropped this week</p>
                    <Button className="bg-white text-orange-600 hover:bg-white/90 rounded-full" size="sm" asChild><Link to="/products?new=true">Explore <ArrowRight className="h-4 w-4 ml-1" /></Link></Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </motion.section>
      )}

      {/* Featured Products */}
      {featuredProducts.length > 0 && (
        <motion.section
          className="container mx-auto px-4 py-8 md:py-12"
          variants={fadeUp}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-50px' }}
        >
          <div className="flex items-center justify-between mb-6 md:mb-8">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 md:h-6 md:w-6 text-primary" />
              <h2 className="text-xl md:text-3xl font-bold text-foreground">Featured Products</h2>
            </div>
            <Button variant="outline" asChild size="sm" className="rounded-full">
              <Link to="/products?featured=true">View All <ArrowRight className="h-4 w-4 ml-1" /></Link>
            </Button>
          </div>
          <motion.div
            className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 md:gap-4"
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
          >
            {featuredProducts.map((product) => (
              <motion.div key={product.id} variants={scaleIn}>
                <ProductCard product={product} onAddToCart={handleAddToCart} onAddToWishlist={handleAddToWishlist} productOffer={getProductOffer(product)} variant="compact" />
              </motion.div>
            ))}
          </motion.div>
        </motion.section>
      )}

      {/* Bundles */}
      {bundles.length > 0 && (
        <motion.section
          className="container mx-auto px-4 py-8 md:py-12"
          variants={fadeUp}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-50px' }}
        >
          <div className="flex items-center gap-3 mb-6 md:mb-8">
            <h2 className="text-xl md:text-3xl font-bold text-foreground">Bundle Deals</h2>
            <div className="flex-1 h-px bg-border" />
          </div>
          <motion.div
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
          >
            {bundles.map((bundle: any) => {
              const discount = bundle.compare_price && bundle.compare_price > bundle.bundle_price
                ? Math.round(((bundle.compare_price - bundle.bundle_price) / bundle.compare_price) * 100)
                : 0;
              const bundleImage = bundle.image_url || bundle.items?.[0]?.product?.images?.[0]?.image_url || '/placeholder.svg';
              return (
                <motion.div key={bundle.id} variants={scaleIn}>
                  <Card className="overflow-hidden hover:shadow-xl transition-all duration-300 group border-0 shadow-md">
                    <CardContent className="p-0">
                      <div className="aspect-[2/1] relative overflow-hidden bg-muted">
                        <img src={bundleImage} alt={bundle.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" />
                        {discount > 0 && (
                          <Badge variant="destructive" className="absolute top-3 left-3 text-xs">{discount}% OFF</Badge>
                        )}
                      </div>
                      <div className="p-4">
                        <h3 className="font-semibold text-foreground">{bundle.name}</h3>
                        {bundle.description && <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{bundle.description}</p>}
                        <div className="flex items-center gap-2 mt-3">
                          <span className="text-lg font-bold text-foreground">₹{Number(bundle.bundle_price).toFixed(0)}</span>
                          {bundle.compare_price && bundle.compare_price > bundle.bundle_price && (
                            <span className="text-sm text-muted-foreground line-through">₹{Number(bundle.compare_price).toFixed(0)}</span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">{bundle.items?.length || 0} products included</p>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </motion.div>
        </motion.section>
      )}

      {/* New Arrivals / All Products */}
      {newArrivals.length > 0 && (
        <motion.section
          className="bg-muted/50 py-8 md:py-12"
          variants={fadeUp}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-50px' }}
        >
          <div className="container mx-auto px-4">
            <div className="flex items-center justify-between mb-6 md:mb-8">
              <div className="flex items-center gap-2">
                <Star className="h-5 w-5 md:h-6 md:w-6 text-primary" />
                <h2 className="text-xl md:text-3xl font-bold text-foreground">Check All Products</h2>
              </div>
              <Button variant="outline" asChild size="sm" className="rounded-full">
                <Link to="/products">View All <ArrowRight className="h-4 w-4 ml-1" /></Link>
              </Button>
            </div>
            <motion.div
              className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4"
              variants={staggerContainer}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
            >
              {newArrivals.slice(0, 8).map((product) => (
                <motion.div key={product.id} variants={scaleIn}>
                  <ProductCard product={product} onAddToCart={handleAddToCart} onAddToWishlist={handleAddToWishlist} productOffer={getProductOffer(product)} />
                </motion.div>
              ))}
            </motion.div>
          </div>
        </motion.section>
      )}

      {/* Popup Banner */}
      <AnimatePresence>
        {showPopup && popupBanner && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            onClick={() => { setShowPopup(false); sessionStorage.setItem('popup_banner_dismissed', 'true'); }}
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="relative max-w-lg w-full rounded-2xl overflow-hidden shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => { setShowPopup(false); sessionStorage.setItem('popup_banner_dismissed', 'true'); }}
                className="absolute top-3 right-3 z-10 h-8 w-8 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
              <Link
                to={popupBanner.redirect_url || '/products'}
                onClick={() => { setShowPopup(false); sessionStorage.setItem('popup_banner_dismissed', 'true'); }}
              >
                <img src={popupBanner.media_url} alt={popupBanner.title} className="w-full h-auto" />
              </Link>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </StorefrontLayout>
  );
}
