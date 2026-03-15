import { useEffect } from 'react';
import { ArrowUpRight, TrendingUp, ShoppingBag } from 'lucide-react';
import { ProductCard } from './ProductCard';
import { useConversionSettings, useUpsellProducts, useCrossSellProducts, trackConversionEvent } from '@/hooks/useConversionOptimization';
import type { Product } from '@/types/database';

interface CrossSellUpsellProps {
  product: Product;
}

export function CrossSellUpsell({ product }: CrossSellUpsellProps) {
  const { data: settings } = useConversionSettings();
  const { data: upsellProducts = [] } = useUpsellProducts(product, settings?.upsell.enabled ?? false);
  const { data: crossSellProducts = [] } = useCrossSellProducts(product, settings?.cross_sell.enabled ?? false);

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

      {/* Cross-sell Section */}
      {crossSellProducts.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <ShoppingBag className="h-5 w-5 text-primary" />
            <h2 className="text-lg md:text-xl font-bold text-foreground">Frequently Bought Together</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
            {crossSellProducts.slice(0, settings?.cross_sell.max_items || 4).map((p) => (
              <div key={p.id} onClick={() => trackConversionEvent('cross_sell_clicked', { product_id: p.id, source_product_id: product.id })}>
                <ProductCard product={p} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
