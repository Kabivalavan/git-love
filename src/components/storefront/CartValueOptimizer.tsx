import { useRef } from 'react';
import { Truck, ChevronLeft, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useConversionSettings, useCartUpsellProducts, trackConversionEvent } from '@/hooks/useConversionOptimization';
import { useCheckoutSettings } from '@/hooks/useProductQuery';
import { ProductCard } from './ProductCard';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
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
  const scrollRef = useRef<HTMLDivElement>(null);

  const freeThreshold = checkoutSettings?.free_shipping_threshold ?? 500;
  const remaining = Math.max(0, freeThreshold - subtotal);
  const progress = freeThreshold > 0 ? Math.min((subtotal / freeThreshold) * 100, 100) : 100;
  const hasFreeShipping = remaining <= 0;

  if (!settings?.cart_optimizer.enabled) return null;

  const scroll = (dir: 'left' | 'right') => {
    if (!scrollRef.current) return;
    const amount = scrollRef.current.clientWidth * 0.7;
    scrollRef.current.scrollBy({ left: dir === 'left' ? -amount : amount, behavior: 'smooth' });
  };

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
                Add <span className="font-bold text-primary">₹{Math.round(remaining)}</span> more for <span className="font-bold text-[hsl(var(--success))]">FREE shipping</span>
              </span>
            )}
          </div>
          <Progress value={progress} className="h-2.5" />
        </div>
      )}

      {/* Upsell Suggestions - Swipeable compact cards */}
      {suggestions.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
              🛒 {settings.cart_optimizer.upsell_headline || 'Customers also bought'}
            </h3>
            {suggestions.length > 2 && (
              <div className="hidden md:flex gap-1">
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => scroll('left')}>
                  <ChevronLeft className="h-3 w-3" />
                </Button>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => scroll('right')}>
                  <ChevronRight className="h-3 w-3" />
                </Button>
              </div>
            )}
          </div>
          <div
            ref={scrollRef}
            className="flex gap-2.5 overflow-x-auto scrollbar-hide snap-x snap-mandatory pb-1"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            {suggestions.slice(0, 6).map((product) => (
              <div
                key={product.id}
                className="flex-shrink-0 w-[120px] snap-start"
                onClick={() => trackConversionEvent('cart_optimizer_clicked', { product_id: product.id })}
              >
                <ProductCard product={product} variant="compact" showQuickAdd={false} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
