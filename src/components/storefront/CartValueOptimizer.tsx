import { Truck, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useConversionSettings, useCartUpsellProducts, trackConversionEvent } from '@/hooks/useConversionOptimization';
import { useCheckoutSettings } from '@/hooks/useProductQuery';
import { ProductCard } from './ProductCard';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

interface CartValueOptimizerProps {
  subtotal: number;
  cartProductIds: string[];
}

export function CartValueOptimizer({ subtotal, cartProductIds }: CartValueOptimizerProps) {
  const { data: settings } = useConversionSettings();
  const { data: checkoutSettings } = useCheckoutSettings();
  const { data: suggestions = [] } = useCartUpsellProducts(
    cartProductIds,
    settings?.cart_optimizer.enabled ?? false
  );

  const freeThreshold = checkoutSettings?.free_shipping_threshold ?? 500;
  const remaining = Math.max(0, freeThreshold - subtotal);
  const progress = freeThreshold > 0 ? Math.min((subtotal / freeThreshold) * 100, 100) : 100;
  const hasFreeShipping = remaining <= 0;

  if (!settings?.cart_optimizer.enabled) return null;

  return (
    <div className="space-y-4">
      {/* Free Shipping Progress Bar */}
      {settings.cart_optimizer.show_free_shipping_bar && freeThreshold > 0 && (
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Truck className={cn("h-5 w-5", hasFreeShipping ? "text-[hsl(var(--success))]" : "text-primary")} />
            {hasFreeShipping ? (
              <span className="text-sm font-semibold text-[hsl(var(--success))]">
                🎉 You've unlocked FREE shipping!
              </span>
            ) : (
              <span className="text-sm font-medium text-foreground">
                Add <span className="font-bold text-primary">₹{remaining.toFixed(0)}</span> more for <span className="font-bold text-[hsl(var(--success))]">FREE shipping</span>
              </span>
            )}
          </div>
          <Progress value={progress} className="h-2.5" />
        </div>
      )}

      {/* Upsell Suggestions */}
      {suggestions.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-4">
          <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
            🛒 {settings.cart_optimizer.upsell_headline || 'Customers also bought'}
          </h3>
          <div className="grid grid-cols-2 gap-3">
            {suggestions.slice(0, 4).map((product) => (
              <div
                key={product.id}
                onClick={() => trackConversionEvent('cart_optimizer_clicked', { product_id: product.id })}
              >
                <ProductCard product={product} variant="compact" />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
