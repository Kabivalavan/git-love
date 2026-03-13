import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Shimmer } from '@/components/ui/shimmer';
import { ResponsiveImage } from '@/components/ui/responsive-image';
import { useGlobalStore } from '@/hooks/useGlobalStore';
import { useLazySection } from '@/hooks/useLazySection';

function BundleShimmer() {
  return (
    <section className="container mx-auto px-4 py-6 md:py-10">
      <div className="flex items-center justify-between mb-5">
        <Shimmer className="h-7 w-36" />
        <Shimmer className="h-5 w-20" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
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
    </section>
  );
}

export default function HomeBundles() {
  const { bundles, isLoading } = useGlobalStore();
  const { ref, isVisible } = useLazySection();

  if (bundles.length === 0 && !isLoading) return null;

  return (
    <div ref={ref}>
      {!isVisible ? (
        <BundleShimmer />
      ) : isLoading ? (
        <BundleShimmer />
      ) : (
        <section className="container mx-auto px-4 py-6 md:py-10">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg md:text-2xl font-bold text-foreground">Bundle Deals</h2>
            <span className="text-sm font-medium text-primary flex items-center gap-1">
              View All <ChevronRight className="h-3.5 w-3.5" />
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {bundles.map((bundle: any) => {
              const discount = bundle.compare_price && bundle.compare_price > bundle.bundle_price
                ? Math.round(((bundle.compare_price - bundle.bundle_price) / bundle.compare_price) * 100)
                : 0;
              const bundleImage = bundle.image_url || bundle.items?.[0]?.product?.images?.[0]?.image_url || '/placeholder.svg';
              return (
                <Link key={bundle.id} to={`/bundles/${bundle.slug}`} className="block group">
                  <div className="overflow-hidden rounded-xl border border-border bg-card hover:shadow-lg transition-all duration-300">
                    <div className="aspect-[2/1] relative overflow-hidden bg-muted">
                      <img src={bundleImage} alt={bundle.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" />
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
        </section>
      )}
    </div>
  );
}
