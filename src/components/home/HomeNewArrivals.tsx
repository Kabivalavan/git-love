import { Link } from 'react-router-dom';
import { Star, ArrowRight } from 'lucide-react';
import { ProductCard } from '@/components/storefront/ProductCard';
import { Button } from '@/components/ui/button';
import { Shimmer } from '@/components/ui/shimmer';
import { useGlobalStore } from '@/hooks/useGlobalStore';
import { useNewArrivals, useReviewStats, useHomeAddToCart } from './useHomeProducts';

function NewArrivalsShimmer() {
  return (
    <section className="bg-muted/50 py-8 md:py-12">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between mb-6 md:mb-8">
          <div className="flex items-center gap-2">
            <Star className="h-5 w-5 md:h-6 md:w-6 text-primary" />
            <Shimmer className="h-7 w-44" />
          </div>
          <Shimmer className="h-8 w-24 rounded-full" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
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

export default function HomeNewArrivals() {
  const { data: products = [], isLoading } = useNewArrivals();
  const { data: reviewStats = {} } = useReviewStats(products.map(p => p.id));
  const { storefrontDisplay, getProductOffer } = useGlobalStore();
  const { handleAddToCart, handleAddToWishlist } = useHomeAddToCart();

  if (isLoading) return <NewArrivalsShimmer />;
  if (products.length === 0) return null;

  return (
    <section className="bg-muted/50 py-8 md:py-12">
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
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
          {products.slice(0, 8).map((product) => (
            <ProductCard key={product.id} product={product} onAddToCart={handleAddToCart} onAddToWishlist={handleAddToWishlist} productOffer={getProductOffer(product)} lowStockSettings={storefrontDisplay} avgRating={reviewStats[product.id]?.avgRating || 0} reviewCount={reviewStats[product.id]?.reviewCount || 0} />
          ))}
        </div>
      </div>
    </section>
  );
}
