import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Heart, ShoppingCart, Star, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { Product, Offer } from '@/types/database';

interface ProductOffer {
  offer: Offer;
  discountedPrice: number;
  discountAmount: number;
  discountLabel: string;
}

interface ProductCardProps {
  product: Product;
  onAddToCart?: (product: Product) => void;
  onAddToWishlist?: (product: Product) => void;
  variant?: 'default' | 'compact' | 'horizontal';
  showQuickAdd?: boolean;
  productOffer?: ProductOffer | null;
  avgRating?: number;
  reviewCount?: number;
  lowStockSettings?: { show_low_stock_badge: boolean; low_stock_threshold: number } | null;
}

function OfferTimer({ endDate }: { endDate: string }) {
  const [timeLeft, setTimeLeft] = useState('');

  useEffect(() => {
    const calc = () => {
      const diff = new Date(endDate).getTime() - Date.now();
      if (diff <= 0) { setTimeLeft('Expired'); return; }
      const totalH = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setTimeLeft(
        `${String(totalH).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
      );
    };
    calc();
    const interval = setInterval(calc, 1000);
    return () => clearInterval(interval);
  }, [endDate]);

  if (!timeLeft || timeLeft === 'Expired') return null;

  return (
    <div className="flex items-center gap-1 bg-destructive text-destructive-foreground text-[10px] px-2 py-0.5 rounded-full font-bold animate-pulse">
      <Clock className="h-3 w-3" />
      {timeLeft}
    </div>
  );
}

export const ProductCard = React.memo(function ProductCard({
  product,
  onAddToCart,
  onAddToWishlist,
  variant = 'default',
  showQuickAdd = true,
  productOffer,
  avgRating = 0,
  reviewCount = 0,
  lowStockSettings,
}: ProductCardProps) {
  const isOutOfStock = product.stock_quantity <= 0;
  const isLowStock = lowStockSettings?.show_low_stock_badge && product.stock_quantity > 0 && product.stock_quantity <= lowStockSettings.low_stock_threshold;
  const displayPrice = productOffer?.discountedPrice ?? product.price;
  const originalPrice = productOffer ? product.price : product.mrp;
  const hasDiscount = productOffer
    ? productOffer.discountAmount > 0
    : (product.mrp && product.mrp > product.price);
  const discountLabel = productOffer?.discountLabel || (
    product.mrp && product.mrp > product.price
      ? `${Math.round(((product.mrp - product.price) / product.mrp) * 100)}% OFF`
      : ''
  );

  const showTimer = productOffer?.offer?.end_date && (productOffer.offer as any).show_timer;

  const primaryImage = product.images?.find(img => img.is_primary)?.image_url
    || product.images?.[0]?.image_url
    || '/placeholder.svg';

  if (variant === 'horizontal') {
    return (
      <Link
        to={`/product/${product.slug}`}
        className={cn(
          "flex gap-4 p-4 bg-card rounded-xl border border-border md:hover:shadow-md transition-shadow group",
          isOutOfStock && "opacity-60"
        )}
      >
        <div className="w-24 h-24 rounded-xl overflow-hidden bg-muted flex-shrink-0 relative">
          <img src={primaryImage} alt={product.name} className="w-full h-full object-cover md:group-hover:scale-105 transition-transform duration-300" />
          {isOutOfStock && (
            <div className="absolute inset-0 bg-background/60 flex items-center justify-center">
              <Badge variant="secondary" className="text-[10px]">Sold Out</Badge>
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-foreground truncate group-hover:text-primary transition-colors">{product.name}</h3>
          <p className="text-sm text-muted-foreground line-clamp-2 mt-1">{product.short_description || product.description}</p>
          <div className="flex items-center gap-2 mt-2">
            <span className="font-bold text-lg">₹{Number(displayPrice).toFixed(0)}</span>
            {hasDiscount && originalPrice && (
              <>
                <span className="text-sm text-muted-foreground line-through">₹{Number(originalPrice).toFixed(0)}</span>
                <Badge variant="destructive" className="text-xs rounded-full">{discountLabel}</Badge>
              </>
            )}
          </div>
        </div>
      </Link>
    );
  }

  return (
    <div className={cn(
      "group bg-card rounded-xl border border-border overflow-hidden transition-all duration-300",
      "md:hover:shadow-lg",
      variant === 'compact' && "text-sm",
      isOutOfStock && "opacity-60"
    )}>
      {/* Image */}
      <Link to={`/product/${product.slug}`} className="block relative aspect-square overflow-hidden bg-muted">
        <img src={primaryImage} alt={product.name} className={cn("w-full h-full object-cover transition-transform duration-500", !isOutOfStock && "md:group-hover:scale-105")} />

        {/* Discount badge - top left like Cartsy "Save 20%" */}
        {hasDiscount && discountLabel && !isOutOfStock && (
          <div className="absolute top-2 left-2">
            <Badge className="bg-green-500 text-white text-[10px] px-2 py-0.5 rounded-md font-semibold border-0">
              Save {discountLabel.replace(' OFF', '')}
            </Badge>
          </div>
        )}

        {/* Timer */}
        {showTimer && productOffer?.offer?.end_date && !isOutOfStock && (
          <div className="absolute bottom-2 left-2">
            <OfferTimer endDate={productOffer.offer.end_date} />
          </div>
        )}

        {/* Wishlist button - top right like Cartsy */}
        {onAddToWishlist && !isOutOfStock && (
          <button
            className="absolute top-2 right-2 h-8 w-8 rounded-full bg-card/90 backdrop-blur-sm shadow-sm flex items-center justify-center opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity border border-border"
            onClick={(e) => { e.preventDefault(); onAddToWishlist(product); }}
          >
            <Heart className="h-4 w-4 text-muted-foreground" />
          </button>
        )}

        {/* Out of stock overlay */}
        {isOutOfStock && (
          <div className="absolute inset-0 bg-background/50 flex items-center justify-center">
            <Badge variant="secondary" className="text-sm font-semibold">Out of Stock</Badge>
          </div>
        )}
      </Link>

      {/* Content */}
      <div className="p-3">
        <Link to={`/product/${product.slug}`}>
          <h3 className={cn("font-medium text-foreground hover:text-primary transition-colors line-clamp-2", variant === 'compact' ? "text-xs" : "text-sm")}>
            {product.name}
          </h3>
        </Link>

        {/* Rating stars - Cartsy style */}
        {avgRating > 0 && (
          <div className="flex items-center gap-1 mt-1.5">
            <div className="flex items-center">
              {[1, 2, 3, 4, 5].map((star) => (
                <Star key={star} className={cn("h-3 w-3", star <= Math.round(avgRating) ? 'fill-amber-400 text-amber-400' : 'text-muted')} />
              ))}
            </div>
            <span className="text-[11px] text-muted-foreground">({reviewCount.toLocaleString()})</span>
          </div>
        )}

        {/* Price - Cartsy style with currency */}
        <div className="flex items-baseline gap-1.5 mt-2">
          <span className={cn("font-bold text-foreground", variant === 'compact' ? "text-sm" : "text-base")}>
            ₹{Number(displayPrice).toFixed(0)}
          </span>
          {hasDiscount && originalPrice && (
            <span className="text-xs text-muted-foreground line-through">₹{Number(originalPrice).toFixed(0)}</span>
          )}
        </div>

        {/* Quick add button */}
        {showQuickAdd && onAddToCart && !isOutOfStock && (
          <Button className="w-full mt-2.5 h-9 text-sm rounded-lg" size="sm" onClick={() => onAddToCart(product)}>
            <ShoppingCart className="h-4 w-4 mr-1.5" />
            Add to Cart
          </Button>
        )}
        {isOutOfStock && (
          <Button className="w-full mt-2.5 h-9 text-sm rounded-lg" size="sm" variant="secondary" disabled>
            Out of Stock
          </Button>
        )}
      </div>
    </div>
  );
});
