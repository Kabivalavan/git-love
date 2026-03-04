import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Truck, Shield, RefreshCw, Headphones, X } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { StorefrontLayout } from '@/components/storefront/StorefrontLayout';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/hooks/useAuth';
import { useGlobalStore } from '@/hooks/useGlobalStore';
import { SEOHead } from '@/components/seo/SEOHead';
import HomeBestsellers from '@/components/home/HomeBestsellers';
import HomeMiddleBanners from '@/components/home/HomeMiddleBanners';
import HomeFeatured from '@/components/home/HomeFeatured';
import HomeBundles from '@/components/home/HomeBundles';
import HomeNewArrivals from '@/components/home/HomeNewArrivals';

function FullPageShimmer() {
  return (
    <StorefrontLayout>
      <div className="min-h-screen">
        <Skeleton className="w-full aspect-[16/9] lg:aspect-[1920/900]" />
        <div className="py-4 bg-muted">
          <div className="container mx-auto px-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-14 rounded-xl" />)}
            </div>
          </div>
        </div>
      </div>
    </StorefrontLayout>
  );
}

const features = [
  { icon: Truck, title: 'Free Shipping', desc: 'On orders above ₹500' },
  { icon: Shield, title: 'Secure Payment', desc: '100% secure checkout' },
  { icon: RefreshCw, title: 'Easy Returns', desc: '7-day return policy' },
  { icon: Headphones, title: '24/7 Support', desc: 'Dedicated support' },
];

export default function HomePage() {
  const [currentBanner, setCurrentBanner] = useState(0);
  const [showPopup, setShowPopup] = useState(false);
  const { isLoading: isAuthLoading } = useAuth();
  const { categories, banners, middleBanners, popupBanner, isLoading: isGlobalLoading } = useGlobalStore();

  useEffect(() => {
    if (banners.length > 1) {
      const interval = setInterval(() => {
        setCurrentBanner((prev) => (prev + 1) % banners.length);
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [banners.length]);

  useEffect(() => {
    if (popupBanner) {
      const popupDismissed = sessionStorage.getItem('popup_banner_dismissed');
      if (!popupDismissed) {
        const timer = setTimeout(() => setShowPopup(true), 4000);
        return () => clearTimeout(timer);
      }
    }
  }, [popupBanner]);

  if (isGlobalLoading && isAuthLoading) return <FullPageShimmer />;

  return (
    <StorefrontLayout>
      <SEOHead
        title="Decon Fashions - Premium Men's Clothing Store"
        description="Shop premium men's shirts, pants & fashion at Decon Fashions. Free shipping on orders above ₹500."
        jsonLd={{
          '@type': 'Store',
          name: 'Decon Fashions',
          description: 'Premium men\'s clothing store',
          url: window.location.origin,
          priceRange: '₹₹',
        }}
      />

      {/* Hero Banner - CRITICAL LCP ELEMENT */}
      {banners.length > 0 && (
        <section className="relative">
          <div className="relative overflow-hidden aspect-[16/9] sm:aspect-[16/9] md:aspect-[16/9] lg:aspect-[1920/900]">
            {banners.map((banner, index) => {
              const isFirst = index === 0;
              return (
                <div key={banner.id} className={`absolute inset-0 transition-all duration-700 ${index === currentBanner ? 'opacity-100 z-10 scale-100' : 'opacity-0 z-0 scale-105'}`}>
                  <Link to={banner.redirect_url || '/products'}>
                    <img
                      src={banner.media_url_mobile || banner.media_url}
                      alt={banner.title}
                      className="w-full h-full object-cover block sm:hidden"
                      loading={isFirst ? 'eager' : 'lazy'}
                      {...(isFirst ? { fetchPriority: 'high' as any } : {})}
                      width={800}
                      height={450}
                    />
                    <img
                      src={banner.media_url_tablet || banner.media_url}
                      alt={banner.title}
                      className="w-full h-full object-cover hidden sm:block lg:hidden"
                      loading={isFirst ? 'eager' : 'lazy'}
                      width={1200}
                      height={675}
                    />
                    <img
                      src={banner.media_url}
                      alt={banner.title}
                      className="w-full h-full object-cover hidden lg:block"
                      loading={isFirst ? 'eager' : 'lazy'}
                      {...(isFirst ? { fetchPriority: 'high' as any } : {})}
                      width={1920}
                      height={900}
                    />
                  </Link>
                </div>
              );
            })}
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
      <section className="bg-primary text-primary-foreground py-3 md:py-4">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
            {features.map((f, i) => (
              <div key={i} className="flex items-center gap-2 md:gap-3 justify-center">
                <div className="h-8 w-8 md:h-10 md:w-10 rounded-full bg-primary-foreground/15 flex items-center justify-center flex-shrink-0">
                  <f.icon className="h-4 w-4 md:h-5 md:w-5" />
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-[10px] md:text-sm truncate">{f.title}</p>
                  <p className="text-[9px] md:text-xs opacity-80 truncate hidden md:block">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Categories */}
      {categories.length > 0 && (
        <section className="container mx-auto px-4 py-8 md:py-12">
          <div className="flex items-center gap-3 mb-6 md:mb-8">
            <h2 className="text-xl md:text-3xl font-bold text-foreground">Shop by Category</h2>
            <div className="flex-1 h-px bg-border" />
          </div>
          <div className="grid grid-cols-4 sm:grid-cols-4 lg:grid-cols-8 gap-4 md:gap-6">
            {categories.map((category) => (
              <Link key={category.id} to={`/products?category=${category.slug}`} className="group text-center block">
                <div className="aspect-square rounded-2xl overflow-hidden bg-muted border-2 border-transparent group-hover:border-primary transition-all duration-300 mx-auto w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 group-hover:shadow-lg group-hover:scale-105">
                  {category.image_url ? (
                    <img src={category.image_url} alt={category.name} className="w-full h-full object-cover" loading="lazy" width={96} height={96} />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/20 to-primary/5">
                      <span className="text-lg md:text-2xl font-bold text-primary">{category.name.charAt(0)}</span>
                    </div>
                  )}
                </div>
                <p className="mt-2 text-[10px] md:text-sm font-semibold text-foreground group-hover:text-primary transition-colors truncate">{category.name}</p>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ALL sections render immediately - no lazy loading */}
      <HomeBestsellers />
      <HomeMiddleBanners middleBanners={middleBanners} />
      <HomeFeatured />
      <HomeBundles />
      <HomeNewArrivals />

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
                <img src={popupBanner.media_url} alt={popupBanner.title} className="w-full h-auto" loading="lazy" />
              </Link>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </StorefrontLayout>
  );
}
