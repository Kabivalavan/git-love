import { useEffect, useRef } from 'react';
import { TrendingUp, ShoppingBag, ChevronLeft, ChevronRight } from 'lucide-react';
import { ProductCard } from './ProductCard';
import { useConversionSettings, useUpsellProducts, useCrossSellProducts, trackConversionEvent } from '@/hooks/useConversionOptimization';
import { Button } from '@/components/ui/button';
import type { Product } from '@/types/database';

interface CrossSellUpsellProps {
  product: Product;
}

export function CrossSellUpsell({ product }: CrossSellUpsellProps) {
  const { data: settings } = useConversionSettings();
  const { data: upsellProducts = [] } = useUpsellProducts(product, settings?.upsell.enabled ?? false);
  const { data: crossSellProducts = [] } = useCrossSellProducts(product, settings?.cross_sell.enabled ?? false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (upsellProducts.length > 0) {
      trackConversionEvent('upsell_shown', { source_product_id: product.id, metadata: { count: upsellProducts.length } });
    }
  }, [upsellProducts.length, product.id]);

  useEffect(() => {
    if (crossSellProducts.length > 0) {
      trackConversionEvent('cross_sell_shown', { source_product_id: product.id, metadata: { count: crossSellProducts.length } });
    }
  }, [crossSellProducts.length, product.id]);

  if (upsellProducts.length === 0 && crossSellProducts.length === 0) return null;

  const scroll = (dir: 'left' | 'right') => {
    if (!scrollRef.current) return;
    const amount = scrollRef.current.clientWidth * 0.7;
    scrollRef.current.scrollBy({ left: dir === 'left' ? -amount : amount, behavior: 'smooth' });
  };

  return (
    <div className="space-y-8">
      {/* Upsell Section */}
      {upsellProducts.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="h-5 w-5 text-primary" />
            <h2 className="text-lg md:text-xl font-bold text-foreground">Upgrade Your Choice</h2>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            Customers who viewed this also considered these premium alternatives
          </p>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
            {upsellProducts.slice(0, settings?.upsell.max_items || 3).map((p) => (
              <div key={p.id} onClick={() => trackConversionEvent('upsell_clicked', { product_id: p.id, source_product_id: product.id })}>
                <ProductCard product={p} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Cross-sell Section - Swipeable single row */}
      {crossSellProducts.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <ShoppingBag className="h-5 w-5 text-primary" />
              <h2 className="text-lg md:text-xl font-bold text-foreground">Frequently Bought Together</h2>
            </div>
            <div className="hidden md:flex gap-1">
              <Button variant="outline" size="icon" className="h-8 w-8 rounded-full" onClick={() => scroll('left')}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" className="h-8 w-8 rounded-full" onClick={() => scroll('right')}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div
            ref={scrollRef}
            className="flex gap-3 overflow-x-auto scrollbar-hide snap-x snap-mandatory pb-2 -mx-1 px-1"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            {crossSellProducts.slice(0, settings?.cross_sell.max_items || 6).map((p) => (
              <div
                key={p.id}
                className="flex-shrink-0 w-[140px] md:w-[180px] snap-start"
                onClick={() => trackConversionEvent('cross_sell_clicked', { product_id: p.id, source_product_id: product.id })}
              >
                <ProductCard product={p} variant="compact" />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
