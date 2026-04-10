import { useEffect, useRef } from 'react';
import { TrendingUp, ShoppingBag, ChevronLeft, ChevronRight, ShoppingCart } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { ResponsiveImage } from '@/components/ui/responsive-image';
import { supabase } from '@/integrations/supabase/client';
import { useConversionSettings, useUpsellProducts, useCrossSellProducts, trackConversionEvent } from '@/hooks/useConversionOptimization';
import { useCartMutations } from '@/hooks/useCartQuery';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { Product } from '@/types/database';

interface CrossSellUpsellProps {
  product: Product;
}

function RecommendationCard({ product: p, onTrack }: { product: Product; onTrack: () => void }) {
  const primaryImage = p.images?.find(img => img.is_primary)?.image_url || p.images?.[0]?.image_url || '/placeholder.svg';
  const price = Math.round(p.price);
  const { addToCart } = useCartMutations();
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleAddToCart = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) {
      toast({ title: 'Please login', description: 'You need to login to add items to cart' });
      navigate('/auth');
      return;
    }
    onTrack();
    // Fetch default variant (first active variant sorted by sort_order)
    let defaultVariantId: string | null = null;
    try {
      const { data: variants } = await supabase
        .from('product_variants')
        .select('id')
        .eq('product_id', p.id)
        .eq('is_active', true)
        .order('sort_order', { ascending: true })
        .limit(1);
      if (variants && variants.length > 0) {
        defaultVariantId = variants[0].id;
      }
    } catch { /* fallback to null */ }
    addToCart.mutate({ product: p, quantity: 1, variantId: defaultVariantId });
  };

  return (
    <div className="flex-shrink-0 w-[160px] md:w-[200px] snap-start">
      <div className="block bg-card rounded-2xl border border-border overflow-hidden group">
        <Link to={`/product/${p.slug}`} className="block">
          <div className="aspect-square overflow-hidden bg-muted relative">
            <ResponsiveImage
              src={primaryImage}
              alt={p.name}
              className="w-full h-full object-cover md:group-hover:scale-105 transition-transform duration-300"
              widths={[160, 240, 320]}
              sizes="160px"
              loading="lazy"
            />
            {p.badge && (
              <Badge className="absolute top-2 left-2 text-[10px] px-1.5 py-0.5 bg-primary text-primary-foreground border-0">
                {p.badge}
              </Badge>
            )}
          </div>
        </Link>
        <div className="p-2.5">
          <Link to={`/product/${p.slug}`}>
            <h3 className="text-xs font-medium text-foreground line-clamp-2 group-hover:text-primary transition-colors">{p.name}</h3>
          </Link>
          {p.short_description && (
            <p className="text-[10px] text-muted-foreground line-clamp-1 mt-0.5">{p.short_description}</p>
          )}
          <div className="flex items-center justify-between mt-2">
            <span className="text-sm font-bold text-foreground">₹{price}</span>
            <Button size="sm" className="h-7 px-2.5 text-xs rounded-lg gap-1" onClick={handleAddToCart}>
              <ShoppingCart className="h-3 w-3" /> Add
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SwipeableRow({ children, label }: { children: React.ReactNode; label: string }) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (dir: 'left' | 'right') => {
    if (!scrollRef.current) return;
    const amount = scrollRef.current.clientWidth * 0.7;
    scrollRef.current.scrollBy({ left: dir === 'left' ? -amount : amount, behavior: 'smooth' });
  };

  return (
    <div className="relative">
      <div className="hidden md:flex absolute -left-3 top-1/2 -translate-y-1/2 z-10">
        <Button variant="outline" size="icon" className="h-8 w-8 rounded-full shadow-md bg-card" onClick={() => scroll('left')}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
      </div>
      <div className="hidden md:flex absolute -right-3 top-1/2 -translate-y-1/2 z-10">
        <Button variant="outline" size="icon" className="h-8 w-8 rounded-full shadow-md bg-card" onClick={() => scroll('right')}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
      <div
        ref={scrollRef}
        className="flex gap-3 overflow-x-auto scrollbar-hide snap-x snap-mandatory pb-2 -mx-1 px-1"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {children}
      </div>
    </div>
  );
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
    <div className="space-y-8 mt-8">
      {upsellProducts.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="h-5 w-5 text-primary" />
            <h2 className="text-lg md:text-xl font-bold text-foreground">Upgrade Your Choice</h2>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            Customers who viewed this also considered these premium alternatives
          </p>
          <SwipeableRow label="upsell">
            {upsellProducts.slice(0, settings?.upsell.max_items || 3).map((p) => (
              <RecommendationCard
                key={p.id}
                product={p}
                onTrack={() => trackConversionEvent('upsell_clicked', { product_id: p.id, source_product_id: product.id })}
              />
            ))}
          </SwipeableRow>
        </div>
      )}

      {crossSellProducts.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <ShoppingBag className="h-5 w-5 text-primary" />
            <h2 className="text-lg md:text-xl font-bold text-foreground">Frequently Bought Together</h2>
          </div>
          <SwipeableRow label="cross-sell">
            {crossSellProducts.slice(0, settings?.cross_sell.max_items || 6).map((p) => (
              <RecommendationCard
                key={p.id}
                product={p}
                onTrack={() => trackConversionEvent('cross_sell_clicked', { product_id: p.id, source_product_id: product.id })}
              />
            ))}
          </SwipeableRow>
        </div>
      )}
    </div>
  );
}
