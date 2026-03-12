import { Link } from 'react-router-dom';
import { Flame, ArrowRight } from 'lucide-react';
import { ProductCard } from '@/components/storefront/ProductCard';
import { Button } from '@/components/ui/button';
import { Shimmer } from '@/components/ui/shimmer';
import { useGlobalStore } from '@/hooks/useGlobalStore';
import { useHomeAddToCart } from './useHomeProducts';

function BestsellerShimmer() {
  return (
    <section className="bg-muted/50 py-8 md:py-12">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between mb-6 md:mb-8">
          <div className="flex items-center gap-2">
            <Flame className="h-5 w-5 md:h-6 md:w-6 text-amber-500" />
            <Shimmer className="h-7 w-40" />
          </div>
          <Shimmer className="h-8 w-24 rounded-full" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 md:gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="rounded-lg border bg-card overflow-hidden">
              <Shimmer className="aspect-square w-full rounded-none" />
              <div className="p-3 space-y-2">
                <Shimmer className="h-4 w-3/4" />
                <Shimmer className="h-3 w-1/2" />
                <Shimmer className="h-8 w-full rounded-lg" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default function HomeBestsellers() {
  const { bestsellers: products, reviewStats, storefrontDisplay, getProductOffer, isLoading } = useGlobalStore();
  const { handleAddToCart, handleAddToWishlist } = useHomeAddToCart();

  if (isLoading) return <BestsellerShimmer />;
  if (products.length === 0) return null;

  return (
    <section className="bg-muted/50 py-8 md:py-12">
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
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 md:gap-4">
          {products.map((product) => {
            const stats = reviewStats[product.id];
            return (
              <ProductCard key={product.id} product={product} onAddToCart={handleAddToCart} onAddToWishlist={handleAddToWishlist} productOffer={getProductOffer(product)} variant="compact" lowStockSettings={storefrontDisplay} avgRating={stats?.avg_rating || 0} reviewCount={stats?.review_count || 0} />
            );
          })}
        </div>
      </div>
    </section>
  );
}
