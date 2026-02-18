import { useState, useEffect } from 'react';
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
}

function OfferTimer({ endDate }: { endDate: string }) {
  const [timeLeft, setTimeLeft] = useState('');

  useEffect(() => {
    const calc = () => {
      const diff = new Date(endDate).getTime() - Date.now();
      if (diff <= 0) { setTimeLeft('Expired'); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      if (h > 24) {
        const d = Math.floor(h / 24);
        setTimeLeft(`${d}d ${h % 24}h`);
      } else {
        setTimeLeft(`${h}h ${m}m ${s}s`);
      }
    };
    calc();
    const interval = setInterval(calc, 1000);
    return () => clearInterval(interval);
  }, [endDate]);

  if (!timeLeft || timeLeft === 'Expired') return null;

  return (
    <div className="flex items-center gap-1 bg-destructive/90 text-destructive-foreground text-[9px] px-1.5 py-0.5 rounded font-medium">
      <Clock className="h-2.5 w-2.5" />
      {timeLeft}
    </div>
  );
}

export function ProductCard({
  product,
  onAddToCart,
  onAddToWishlist,
  variant = 'default',
  showQuickAdd = true,
  productOffer,
  avgRating = 0,
  reviewCount = 0,
}: ProductCardProps) {
  const isOutOfStock = product.stock_quantity <= 0;
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
          "flex gap-4 p-4 bg-card rounded-lg border border-border hover:shadow-md transition-shadow group",
          isOutOfStock && "opacity-60"
        )}
      >
        <div className="w-24 h-24 rounded-lg overflow-hidden bg-muted flex-shrink-0 relative">
          <img src={primaryImage} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
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
                <Badge variant="destructive" className="text-xs">{discountLabel}</Badge>
              </>
            )}
          </div>
        </div>
      </Link>
    );
  }

  return (
    <div className={cn(
      "group bg-card rounded-lg border border-border overflow-hidden hover:shadow-lg transition-all duration-300",
      variant === 'compact' && "text-sm",
      isOutOfStock && "opacity-60"
    )}>
      {/* Image */}
      <Link to={`/product/${product.slug}`} className="block relative aspect-square overflow-hidden bg-muted">
        <img src={primaryImage} alt={product.name} className={cn("w-full h-full object-cover transition-transform duration-500", !isOutOfStock && "group-hover:scale-105")} />

        {/* Badges */}
        <div className="absolute top-2 left-2 right-8 flex flex-wrap gap-1">
          {isOutOfStock && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0.5 bg-background/80">Sold Out</Badge>
          )}
          {product.badge && !isOutOfStock && (
            <Badge className="bg-primary text-[10px] px-1.5 py-0.5">{product.badge}</Badge>
          )}
          {productOffer && !isOutOfStock && (
            <Badge variant="secondary" className="bg-green-500 text-white text-[10px] px-1.5 py-0.5">{productOffer.discountLabel}</Badge>
          )}
          {!productOffer && hasDiscount && discountLabel && !isOutOfStock && (
            <Badge variant="destructive" className="text-[10px] px-1.5 py-0.5">{discountLabel}</Badge>
          )}
          {product.is_bestseller && !isOutOfStock && (
            <Badge className="bg-amber-500 text-white text-[10px] px-1.5 py-0.5">Bestseller</Badge>
          )}
        </div>

        {/* Timer */}
        {showTimer && productOffer?.offer?.end_date && !isOutOfStock && (
          <div className="absolute bottom-2 left-2">
            <OfferTimer endDate={productOffer.offer.end_date} />
          </div>
        )}

        {/* Wishlist button */}
        {onAddToWishlist && !isOutOfStock && (
          <Button
            variant="secondary"
            size="icon"
            className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity h-7 w-7"
            onClick={(e) => { e.preventDefault(); onAddToWishlist(product); }}
          >
            <Heart className="h-3.5 w-3.5" />
          </Button>
        )}

        {/* Out of stock overlay */}
        {isOutOfStock && (
          <div className="absolute inset-0 bg-background/50 flex items-center justify-center">
            <Badge variant="secondary" className="text-sm font-semibold">Out of Stock</Badge>
          </div>
        )}
      </Link>

      {/* Content */}
      <div className="p-2.5">
        <Link to={`/product/${product.slug}`}>
          <h3 className={cn("font-medium text-foreground hover:text-primary transition-colors line-clamp-1", variant === 'compact' ? "text-xs" : "text-sm")}>
            {product.name}
          </h3>
        </Link>

        {product.category && (
          <p className="text-[10px] text-muted-foreground mt-0.5">{product.category.name}</p>
        )}

        {/* Short description */}
        {product.short_description && (
          <p className="text-[10px] text-muted-foreground line-clamp-1 mt-0.5">{product.short_description}</p>
        )}

        {/* Rating stars */}
        {avgRating > 0 && (
          <div className="flex items-center gap-1 mt-1">
            <div className="flex items-center">
              {[1, 2, 3, 4, 5].map((star) => (
                <Star key={star} className={cn("h-3 w-3", star <= Math.round(avgRating) ? 'fill-amber-400 text-amber-400' : 'text-muted')} />
              ))}
            </div>
            <span className="text-[10px] text-muted-foreground">({reviewCount})</span>
          </div>
        )}

        {/* Price */}
        <div className="flex items-center gap-1.5 mt-1.5">
          <span className={cn("font-bold text-foreground", variant === 'compact' ? "text-sm" : "text-base")}>
            ₹{Number(displayPrice).toFixed(0)}
          </span>
          {hasDiscount && originalPrice && (
            <span className="text-xs text-muted-foreground line-through">₹{Number(originalPrice).toFixed(0)}</span>
          )}
        </div>

        {/* Quick add button */}
        {showQuickAdd && onAddToCart && !isOutOfStock && (
          <Button className="w-full mt-2" size="sm" variant="outline" onClick={() => onAddToCart(product)}>
            <ShoppingCart className="h-3.5 w-3.5 mr-1.5" />
            Add to Cart
          </Button>
        )}
        {isOutOfStock && (
          <Button className="w-full mt-2" size="sm" variant="secondary" disabled>
            Out of Stock
          </Button>
        )}
      </div>
    </div>
  );
}