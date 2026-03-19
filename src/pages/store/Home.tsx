import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, X, ChevronRight as ArrowRight, Info } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { StorefrontLayout } from '@/components/storefront/StorefrontLayout';
import { Button } from '@/components/ui/button';
import { Shimmer } from '@/components/ui/shimmer';
import { ResponsiveImage } from '@/components/ui/responsive-image';
import { useGlobalStore } from '@/hooks/useGlobalStore';
import { SEOHead } from '@/components/seo/SEOHead';
import HomeBestsellers from '@/components/home/HomeBestsellers';
import HomeMiddleBanners from '@/components/home/HomeMiddleBanners';
import HomeFeatured from '@/components/home/HomeFeatured';
import HomeBundles from '@/components/home/HomeBundles';
import HomeNewArrivals from '@/components/home/HomeNewArrivals';

function HeroBannerShimmer() {
  return (
    <div className="relative">
      <Shimmer className="w-full aspect-[2/1] sm:aspect-[2.5/1] lg:aspect-[3/1] rounded-none" />
    </div>
  );
}

function CategoryShimmer() {
  return (
    <section className="container mx-auto px-4 py-6">
      <Shimmer className="h-7 w-40 mb-5" />
      <div className="grid grid-cols-2 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Shimmer key={i} className="h-24 rounded-2xl" />
        ))}
      </div>
    </section>
  );
}

export default function HomePage() {
  const [currentBanner, setCurrentBanner] = useState(0);
  const [showPopup, setShowPopup] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const { categories, banners: allBanners, middleBanners, popupBanner, storeInfo, announcement, isLoading: isGlobalLoading } = useGlobalStore();

  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  // Filter banners by device visibility
  const banners = allBanners.filter(b => isMobile ? (b as any).show_on_mobile !== false : (b as any).show_on_desktop !== false);

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

  return (
    <StorefrontLayout>
      <SEOHead
        title={`${storeInfo?.name || 'Store'} - Shop Online`}
        description={storeInfo?.tagline || 'Shop premium products online. Free shipping available.'}
        jsonLd={{
          '@type': 'Store',
          name: storeInfo?.name || 'Store',
          description: storeInfo?.tagline || 'Online Store',
          url: window.location.origin,
          priceRange: '₹₹',
        }}
      />

      {/* Hero Banner */}
      {isGlobalLoading ? (
        <HeroBannerShimmer />
      ) : banners.length > 0 ? (
        <section className="relative">
          <div className="relative overflow-hidden aspect-[2/1] sm:aspect-[2.5/1] lg:aspect-[3/1]">
            {banners.map((banner, index) => {
              const isFirst = index === 0;
              return (
                <div key={banner.id} className={`absolute inset-0 transition-all duration-700 ${index === currentBanner ? 'opacity-100 z-10 scale-100' : 'opacity-0 z-0 scale-105'}`}>
                  <Link to={banner.redirect_url || '/products'}>
                    <ResponsiveImage
                      src={banner.media_url_mobile || banner.media_url}
                      alt={banner.title}
                      className="w-full h-full object-cover block sm:hidden"
                      widths={[320, 480, 640, 800]}
                      sizes="100vw"
                      loading={isFirst ? 'eager' : 'lazy'}
                      {...(isFirst ? { fetchPriority: 'high' as const } : {})}
                      width={800}
                      height={400}
                    />
                    <ResponsiveImage
                      src={banner.media_url_tablet || banner.media_url}
                      alt={banner.title}
                      className="w-full h-full object-cover hidden sm:block"
                      widths={[768, 1024, 1280, 1600, 1920]}
                      sizes="100vw"
                      loading={isFirst ? 'eager' : 'lazy'}
                      {...(isFirst ? { fetchPriority: 'high' as const } : {})}
                      width={1920}
                      height={640}
                    />
                  </Link>
                </div>
              );
            })}
          </div>
          {banners.length > 1 && (
            <>
              <Button variant="secondary" size="icon" className="absolute left-2 md:left-4 top-1/2 -translate-y-1/2 z-20 bg-card/80 backdrop-blur-sm hover:bg-card shadow-lg h-8 w-8 md:h-10 md:w-10 rounded-full" onClick={() => setCurrentBanner((prev) => (prev - 1 + banners.length) % banners.length)}>
                <ChevronLeft className="h-4 w-4 md:h-5 md:w-5" />
              </Button>
              <Button variant="secondary" size="icon" className="absolute right-2 md:right-4 top-1/2 -translate-y-1/2 z-20 bg-card/80 backdrop-blur-sm hover:bg-card shadow-lg h-8 w-8 md:h-10 md:w-10 rounded-full" onClick={() => setCurrentBanner((prev) => (prev + 1) % banners.length)}>
                <ChevronRight className="h-4 w-4 md:h-5 md:w-5" />
              </Button>
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 z-20">
                {banners.map((_, index) => (
                  <button key={index} className={`rounded-full transition-all ${index === currentBanner ? 'bg-primary w-5 h-2' : 'bg-card/60 w-2 h-2'}`} onClick={() => setCurrentBanner(index)} />
                ))}
              </div>
            </>
          )}
        </section>
      ) : null}

      {/* Promo/Announcement inline banner */}
      {announcement?.is_active && announcement?.text && (
        <div className="container mx-auto px-4 mt-4">
          <div className="bg-primary/10 border border-primary/20 rounded-2xl px-4 py-3">
            <p className="text-sm font-semibold text-primary">{announcement.text}</p>
            {announcement.link && (
              <Link to={announcement.link} className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                <Info className="h-3 w-3" /> Learn more
              </Link>
            )}
          </div>
        </div>
      )}

      {/* All Categories - 2-column grid cards like reference */}
      {isGlobalLoading ? (
        <CategoryShimmer />
      ) : categories.length > 0 ? (
        <section className="container mx-auto px-4 py-6 md:py-10">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg md:text-2xl font-bold text-foreground">All Categories</h2>
            <Link to="/products" className="text-sm font-medium text-primary flex items-center gap-1 hover:underline">
              View All <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          {/* Mobile: 2-column grid cards with image */}
          <div className="grid grid-cols-2 gap-3 lg:hidden">
            {categories.filter(c => !c.parent_id).map((category) => (
              <Link
                key={category.id}
                to={`/category/${category.slug}`}
                className="group flex items-center gap-3 p-3 bg-card rounded-2xl border border-border hover:shadow-md transition-all"
              >
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-sm text-foreground group-hover:text-primary transition-colors truncate">{category.name}</h3>
                  <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                    {category.description || 'Shop now'}
                  </p>
                </div>
                <div className="w-14 h-14 rounded-xl overflow-hidden bg-muted flex-shrink-0">
                  {category.image_url ? (
                    <img src={category.image_url} alt={category.name} className="w-full h-full object-cover" loading="lazy" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/20 to-primary/5">
                      <span className="text-lg font-bold text-primary">{category.name.charAt(0)}</span>
                    </div>
                  )}
                </div>
              </Link>
            ))}
          </div>

          {/* Desktop: Horizontal scroll with circle icons */}
          <div className="hidden lg:flex gap-8 overflow-x-auto pb-2 scrollbar-thin">
            {categories.filter(c => !c.parent_id).map((category) => (
              <Link key={category.id} to={`/products?category=${category.slug}`} className="group text-center flex flex-col items-center flex-shrink-0">
                <div className="w-24 h-24 rounded-full overflow-hidden bg-muted border-2 border-transparent group-hover:border-primary transition-all duration-300 group-hover:shadow-lg">
                  {category.image_url ? (
                    <img src={category.image_url} alt={category.name} className="w-full h-full object-cover" loading="lazy" width={96} height={96} />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/20 to-primary/5">
                      <span className="text-2xl font-bold text-primary">{category.name.charAt(0)}</span>
                    </div>
                  )}
                </div>
                <p className="mt-2 text-sm font-medium text-foreground group-hover:text-primary transition-colors w-24 truncate text-center">{category.name}</p>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {/* Product sections */}
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
                <ResponsiveImage
                  src={popupBanner.media_url}
                  alt={popupBanner.title}
                  className="w-full h-auto"
                  widths={[320, 480, 640, 960]}
                  sizes="(max-width: 768px) 90vw, 32rem"
                  loading="lazy"
                />
              </Link>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </StorefrontLayout>
  );
}
