import { Link } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { StorefrontLayout } from '@/components/storefront/StorefrontLayout';
import { ResponsiveImage } from '@/components/ui/responsive-image';
import { Shimmer } from '@/components/ui/shimmer';
import { useGlobalStore } from '@/hooks/useGlobalStore';
import { SEOHead } from '@/components/seo/SEOHead';

export default function AllBundlesPage() {
  const { bundles, isFullLoading: isLoading } = useGlobalStore();

  return (
    <StorefrontLayout>
      <SEOHead title="Bundle Deals - Save More" description="Browse our exclusive bundle deals and combo offers. Save more when you buy together." />
      <div className="container mx-auto px-4 py-6 md:py-8">
        <nav className="flex items-center gap-3 mb-5">
          <Link to="/" className="h-9 w-9 rounded-full border border-border bg-card flex items-center justify-center hover:bg-muted transition-colors">
            <ChevronLeft className="h-5 w-5 text-foreground" />
          </Link>
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-foreground">Bundle Deals</h1>
            <p className="text-sm text-muted-foreground">Save more with our combo offers</p>
          </div>
        </nav>

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="rounded-xl border bg-card overflow-hidden">
                <Shimmer className="aspect-[2/1] w-full rounded-none" />
                <div className="p-4 space-y-2">
                  <Shimmer className="h-5 w-2/3" />
                  <Shimmer className="h-3 w-full" />
                  <Shimmer className="h-6 w-24" />
                </div>
              </div>
            ))}
          </div>
        ) : bundles.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-lg text-muted-foreground">No bundle deals available right now.</p>
            <Link to="/products" className="text-primary font-medium text-sm mt-2 inline-block hover:underline">Browse Products →</Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {bundles.map((bundle: any) => {
              const discount = bundle.compare_price && bundle.compare_price > bundle.bundle_price
                ? Math.round(((bundle.compare_price - bundle.bundle_price) / bundle.compare_price) * 100)
                : 0;
              const bundleImages = Array.isArray(bundle.images) && bundle.images.length > 0
                ? bundle.images
                : bundle.image_url ? [bundle.image_url] : [];
              const bundleImage = bundleImages[0] || bundle.items?.[0]?.product?.images?.[0]?.image_url || '/placeholder.svg';

              return (
                <Link key={bundle.id} to={`/bundles/${bundle.slug}`} className="block group">
                  <div className="overflow-hidden rounded-xl border border-border bg-card hover:shadow-lg transition-all duration-300">
                    <div className="aspect-[2/1] relative overflow-hidden bg-muted">
                      <ResponsiveImage
                        src={bundleImage}
                        alt={bundle.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        widths={[480, 768, 1024]}
                        sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 33vw"
                        loading="lazy"
                      />
                      {discount > 0 && (
                        <Badge className="absolute top-3 left-3 bg-green-500 text-white text-xs border-0 rounded-md">{discount}% OFF</Badge>
                      )}
                    </div>
                    <div className="p-4">
                      <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">{bundle.name}</h3>
                      {bundle.description && <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{bundle.description}</p>}
                      <div className="flex items-center gap-2 mt-3">
                        <span className="text-lg font-bold text-foreground">₹{Number(bundle.bundle_price).toFixed(0)}</span>
                        {bundle.compare_price && bundle.compare_price > bundle.bundle_price && (
                          <span className="text-sm text-muted-foreground line-through">₹{Number(bundle.compare_price).toFixed(0)}</span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">{bundle.items?.length || 0} products included</p>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </StorefrontLayout>
  );
}
