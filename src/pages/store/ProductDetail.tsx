import { useEffect, useState, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Minus, Plus, Heart, ShoppingCart, Truck, Shield, RefreshCw, ChevronLeft, ChevronRight, Star, Share2, Loader2, ChevronDown, Clock, Tag, Copy, Home, Package, Check, MapPin, Undo2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQueryClient } from '@tanstack/react-query';
import { StorefrontLayout } from '@/components/storefront/StorefrontLayout';
import { ProductCard } from '@/components/storefront/ProductCard';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useAnalytics } from '@/hooks/useAnalytics';
import { useGlobalStore } from '@/hooks/useGlobalStore';
import { Shimmer } from '@/components/ui/shimmer';
import { ResponsiveImage } from '@/components/ui/responsive-image';
import { SEOHead } from '@/components/seo/SEOHead';
import { ContentSections, type ContentSection } from '@/components/product/ContentSections';
import { CrossSellUpsell } from '@/components/storefront/CrossSellUpsell';
import { cn } from '@/lib/utils';
import { useProductPageData } from '@/hooks/useProductQuery';
import { useCartMutations } from '@/hooks/useCartQuery';
import type { Product, ProductVariant, Review } from '@/types/database';

function FAQAccordionItem({ title, children, defaultOpen = false }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  return (
    <div className="border border-border rounded-2xl overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between w-full px-4 py-3 text-left font-semibold text-foreground hover:bg-muted/50 transition-colors"
      >
        <span className="text-sm">{title}</span>
        <motion.div animate={{ rotate: isOpen ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </motion.div>
      </button>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0, 0, 0.2, 1] }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-1">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function OfferCountdown({ endDate }: { endDate: string }) {
  const [timeLeft, setTimeLeft] = useState('');
  useEffect(() => {
    const calc = () => {
      const diff = new Date(endDate).getTime() - Date.now();
      if (diff <= 0) { setTimeLeft('Expired'); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setTimeLeft(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`);
    };
    calc();
    const interval = setInterval(calc, 1000);
    return () => clearInterval(interval);
  }, [endDate]);
  if (!timeLeft || timeLeft === 'Expired') return null;
  return <span>{timeLeft}</span>;
}

export default function ProductDetailPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [reviewForm, setReviewForm] = useState({ rating: 5, title: '', comment: '' });
  const [visibleReviewCount, setVisibleReviewCount] = useState(5);
  const [couponsExpanded, setCouponsExpanded] = useState(false);
  const [showStickyBar, setShowStickyBar] = useState(false);
  const buyNowRef = useRef<HTMLButtonElement>(null);
  const { toast } = useToast();
  const { user } = useAuth();
  const { trackEvent } = useAnalytics();
  const { getProductOffer } = useGlobalStore();
  const { addToCart } = useCartMutations();

  // ⚡ SINGLE RPC CALL — replaces 5 separate queries
  const { data: pageData, isLoading, error: pageError } = useProductPageData(slug);

  const product = pageData?.product ?? null;
  const variants = pageData?.variants ?? [];
  const reviews = pageData?.reviews ?? [];
  const relatedProducts = pageData?.related_products ?? [];
  const storeCoupons = pageData?.coupons ?? [];

  const isAddingToCart = addToCart.isPending;

  useEffect(() => {
    if (variants.length > 0 && !selectedVariant) {
      // Auto-select variant with offer if available, otherwise first variant
      const variantWithOffer = variants.find(v => {
        const offer = getProductOffer(product!, v.id);
        return offer && offer.discountAmount > 0;
      });
      setSelectedVariant(variantWithOffer || variants[0]);
    }
  }, [variants]);

  useEffect(() => {
    setCurrentImageIndex(0);
    setQuantity(1);
    setSelectedVariant(null);
    setVisibleReviewCount(5);
  }, [slug]);

  useEffect(() => {
    if (product) {
      trackEvent('product_view', {
        product_id: product.id,
        category_id: product.category_id || undefined,
        metadata: { product_name: product.name, price: product.price, category: product.category?.name || null },
      });
    }
  }, [product?.id]);

  useEffect(() => {
    if (pageError) navigate('/products');
  }, [pageError]);

  useEffect(() => {
    if (!buyNowRef.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => setShowStickyBar(!entry.isIntersecting),
      { threshold: 0 }
    );
    observer.observe(buyNowRef.current);
    return () => observer.disconnect();
  }, [isLoading, product]);

  const [variantError, setVariantError] = useState(false);

  const handleAddToCart = async () => {
    if (!user) {
      toast({ title: 'Please login', description: 'You need to login to add items to cart' });
      navigate('/auth');
      return;
    }
    if (!product) return;
    if ((product as any).variant_required && variants.length > 0 && !selectedVariant) {
      setVariantError(true);
      toast({ title: 'Select a variant', description: 'Please select a variant before adding to cart', variant: 'destructive' });
      return;
    }
    setVariantError(false);
    addToCart.mutate(
      { product, quantity, variantId: selectedVariant?.id || null },
      {
        onSuccess: () => {
          trackEvent('add_to_cart', { product_id: product.id, metadata: { product_name: product.name, price: selectedVariant?.price || product.price, quantity, variant: selectedVariant?.name || null } });
        },
      }
    );
  };

  const handleAddToWishlist = async () => {
    if (!user) { toast({ title: 'Please login', description: 'You need to login to add items to wishlist' }); return; }
    if (!product) return;
    try {
      await supabase.from('wishlist').insert({ user_id: user.id, product_id: product.id });
      trackEvent('wishlist_add', { product_id: product.id, metadata: { product_name: product.name } });
      toast({ title: 'Added to wishlist', description: `${product.name} has been added to your wishlist` });
    } catch (error: any) {
      if (error.code === '23505') toast({ title: 'Already in wishlist', description: 'This item is already in your wishlist' });
      else toast({ title: 'Error', description: 'Failed to add item to wishlist', variant: 'destructive' });
    }
  };

  const handleBuyNow = async () => {
    await handleAddToCart();
    navigate('/cart');
  };

  const handleShare = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title: product?.name, text: product?.short_description || '', url });
      } catch { /* user cancelled */ }
    } else {
      navigator.clipboard.writeText(url);
      toast({ title: 'Link copied!', description: 'Product link copied to clipboard' });
    }
  };

  const handleSubmitReview = async () => {
    if (!user || !product) { toast({ title: 'Please login', description: 'You need to login to submit a review' }); return; }
    setIsSubmittingReview(true);
    const { error } = await supabase.from('reviews').insert({
      product_id: product.id, user_id: user.id, rating: reviewForm.rating, title: reviewForm.title || null, comment: reviewForm.comment || null, is_approved: true, is_verified: true,
    });
    if (error) toast({ title: 'Error', description: error.message, variant: 'destructive' });
    else {
      toast({ title: 'Review submitted', description: 'Thank you for your feedback!' });
      setReviewForm({ rating: 5, title: '', comment: '' });
      queryClient.invalidateQueries({ queryKey: ['product-page', slug] });
    }
    setIsSubmittingReview(false);
  };

  if (isLoading) {
    return (
      <StorefrontLayout>
        <div className="container mx-auto px-4 py-6">
          <div className="grid md:grid-cols-2 gap-8">
            <Shimmer className="aspect-square rounded-2xl" />
            <div className="space-y-4">
              <Shimmer className="h-6 w-24" />
              <Shimmer className="h-8 w-3/4" />
              <Shimmer className="h-5 w-1/3" />
              <Shimmer className="h-10 w-1/2" />
              <Shimmer className="h-12 w-full" />
            </div>
          </div>
        </div>
      </StorefrontLayout>
    );
  }

  if (!product) return null;

  const images = product.images || [];
  const currentImage = images[currentImageIndex]?.image_url || '/placeholder.svg';
  const currentPrice = selectedVariant?.price || product.price;
  // Stock: when variant_required, use selected variant stock; if none selected, aggregate from all variants
  const computeAvailableStock = () => {
    if (selectedVariant) {
      return Math.max(0, (selectedVariant.stock_quantity ?? 0) - ((selectedVariant as any).in_hold || 0));
    }
    if ((product as any).variant_required && variants.length > 0) {
      return variants.reduce((sum, v) => sum + Math.max(0, (v.stock_quantity ?? 0) - ((v as any).in_hold || 0)), 0);
    }
    return Math.max(0, (product.stock_quantity ?? 0) - ((product as any).in_hold || 0));
  };
  const availableStock = computeAvailableStock();
  
  // Offer pricing - apply offer to the CURRENT variant/product price
  const productOffer = getProductOffer(product, selectedVariant?.id);
  let offerPrice: number | null = null;
  let showOfferDiscount = false;
  let discount = 0;
  if (productOffer && productOffer.discountAmount > 0) {
    // Recalculate discount based on current variant price
    if (productOffer.offer.type === 'flat') {
      offerPrice = Math.max(0, currentPrice - productOffer.offer.value);
    } else if (productOffer.offer.type === 'percentage') {
      let discAmt = (currentPrice * productOffer.offer.value) / 100;
      if (productOffer.offer.max_discount && discAmt > productOffer.offer.max_discount) {
        discAmt = productOffer.offer.max_discount;
      }
      offerPrice = currentPrice - discAmt;
    }
    if (offerPrice !== null && offerPrice < currentPrice) {
      showOfferDiscount = true;
      discount = Math.round(((currentPrice - offerPrice) / currentPrice) * 100);
    }
  }
  const displayPrice = offerPrice ?? currentPrice;
  const avgRating = reviews.length > 0 ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length) : 0;
  const ratingDist = [5, 4, 3, 2, 1].map(star => ({
    star,
    count: reviews.filter(r => r.rating === star).length,
    percent: reviews.length > 0 ? (reviews.filter(r => r.rating === star).length / reviews.length) * 100 : 0,
  }));
  const contentSections: ContentSection[] = (product as any).content_sections || [];
  const hasMRP = product.mrp && product.mrp > currentPrice;

  const roundedDisplayPrice = Math.round(displayPrice);
  const priceWhole = roundedDisplayPrice;
  const showDecimal = false;

  const productJsonLd = {
    '@type': 'Product', name: product.name, description: product.description || product.short_description || '',
    image: images.map(i => i.image_url), sku: product.sku || undefined,
    offers: { '@type': 'Offer', price: currentPrice, priceCurrency: 'INR', availability: availableStock > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock' },
    ...(reviews.length > 0 && { aggregateRating: { '@type': 'AggregateRating', ratingValue: avgRating.toFixed(1), reviewCount: reviews.length } }),
  };

  return (
    <StorefrontLayout>
      <SEOHead
        title={`${product.name} - Buy Online`}
        description={product.short_description || product.description?.slice(0, 160) || `Buy ${product.name} online at best price.`}
        image={images[0]?.image_url}
        jsonLd={productJsonLd}
      />
      <div className="container mx-auto px-4 py-4 md:py-6 max-w-full overflow-hidden">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-3 mb-4">
          <button onClick={() => navigate(-1)} className="h-9 w-9 rounded-full border border-border bg-card flex items-center justify-center flex-shrink-0 hover:bg-muted transition-colors">
            <ChevronLeft className="h-5 w-5 text-foreground" />
          </button>
          <span className="text-base font-semibold text-foreground lg:hidden">Product Details</span>
          <span className="text-sm text-muted-foreground hidden lg:block">
            <Link to="/" className="hover:text-primary">Home</Link> / <Link to="/products" className="hover:text-primary">Shop</Link> / <span className="text-foreground">{product.name}</span>
          </span>
          <button onClick={handleShare} className="ml-auto h-9 w-9 rounded-full border border-border bg-card flex items-center justify-center flex-shrink-0 hover:bg-muted transition-colors">
            <Share2 className="h-4 w-4 text-muted-foreground" />
          </button>
        </nav>

        {/* Product Hero */}
        <div className="grid md:grid-cols-2 gap-6 md:gap-10 mb-8">
          {/* Images */}
          <div className="space-y-3 min-w-0 md:self-start md:sticky md:top-20" style={{ maxHeight: 'calc(100vh - 6rem)' }}>
            <div className="relative aspect-square bg-muted rounded-2xl overflow-hidden w-full">
              <ResponsiveImage
                src={currentImage}
                alt={product.name}
                className="w-full h-full object-contain"
                widths={[480, 768, 960, 1280]}
                sizes="(max-width: 768px) 100vw, 50vw"
                loading="eager"
                fetchPriority="high"
              />
              {images.length > 1 && (
                <>
                  <Button variant="secondary" size="icon" className="absolute left-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-card/80 backdrop-blur-sm" onClick={() => setCurrentImageIndex((prev) => (prev - 1 + images.length) % images.length)}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button variant="secondary" size="icon" className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-card/80 backdrop-blur-sm" onClick={() => setCurrentImageIndex((prev) => (prev + 1) % images.length)}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </>
              )}
              {discount > 0 && (
                <Badge className="absolute top-3 left-3 bg-primary text-primary-foreground border-0 rounded-lg text-xs">{discount}% OFF</Badge>
              )}
              {product.badge && (
                <Badge className="absolute top-3 right-3 bg-[hsl(var(--success))] text-[hsl(var(--success-foreground))] border-0 rounded-lg text-xs">{product.badge}</Badge>
              )}
            </div>
            {images.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
                {images.map((img, index) => (
                  <button
                    key={img.id}
                    onClick={() => setCurrentImageIndex(index)}
                    className={cn(
                      "w-16 h-16 rounded-xl overflow-hidden border-2 flex-shrink-0 transition-all",
                      index === currentImageIndex ? 'border-primary shadow-md' : 'border-border opacity-70 hover:opacity-100'
                    )}
                  >
                    <ResponsiveImage
                      src={img.image_url}
                      alt={`${product.name} image ${index + 1}`}
                      className="w-full h-full object-cover"
                      widths={[64, 96, 128]}
                      sizes="64px"
                      loading="lazy"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Product Info */}
          <div className="space-y-4 min-w-0">
            <div className="flex items-start gap-3">
              <div className="flex-1">
                <h1 className="text-xl md:text-2xl font-bold text-foreground leading-tight">{product.name}</h1>
                {product.short_description && (
                  <p className="text-sm text-muted-foreground mt-1">{product.short_description}</p>
                )}
              </div>
              <button onClick={handleAddToWishlist} className="h-10 w-10 rounded-full border border-border bg-card flex items-center justify-center flex-shrink-0 hover:bg-muted transition-colors">
                <Heart className="h-5 w-5 text-muted-foreground" />
              </button>
            </div>

            {reviews.length > 0 && (
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1 bg-[hsl(var(--success))] text-[hsl(var(--success-foreground))] px-2.5 py-1 rounded-lg">
                  <span className="text-sm font-bold">{avgRating.toFixed(1)}</span>
                  <Star className="h-3.5 w-3.5 fill-current" />
                </div>
                <span className="text-sm text-muted-foreground">{reviews.length.toLocaleString()} Rating{reviews.length !== 1 ? 's' : ''} & Review{reviews.length !== 1 ? 's' : ''}</span>
              </div>
            )}

            {/* Price block */}
            <div className="bg-muted/50 rounded-2xl p-4">
              <div className="flex items-baseline gap-3 flex-wrap">
                <span className="text-3xl md:text-4xl font-bold text-foreground">
                  ₹{priceWhole}
                </span>
                {hasMRP && (
                  <span className="text-lg text-muted-foreground line-through">MRP ₹{Number(product.mrp).toFixed(0)}</span>
                )}
                {showOfferDiscount && !hasMRP && (
                  <span className="text-lg text-muted-foreground line-through">₹{Number(currentPrice).toFixed(0)}</span>
                )}
                {discount > 0 && (
                  <span className="text-sm font-bold text-[hsl(var(--success))]">{discount}% off</span>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Inclusive of all taxes</p>
            </div>

            {/* Availability */}
            <div className="flex items-center gap-4 flex-wrap">
              {availableStock > 0 ? (
                <span className="flex items-center gap-1.5 text-sm">
                  <Check className="h-4 w-4 text-[hsl(var(--success))]" />
                  <span className="text-[hsl(var(--success))] font-medium">In Stock</span>
                </span>
              ) : (
                <span className="text-destructive text-sm font-medium">Out of stock</span>
              )}
            </div>

            {/* Variants */}
            {variants.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Label className={cn("text-sm font-semibold", variantError && 'text-destructive')}>
                    Select Variant {(product as any).variant_required && <span className="text-destructive">*</span>}
                  </Label>
                </div>
                {variantError && <p className="text-xs text-destructive mb-1">⚠️ Please select a variant</p>}
                <RadioGroup
                  value={selectedVariant?.id || ''}
                  onValueChange={(val) => setSelectedVariant(variants.find(v => v.id === val) || null)}
                  className="flex flex-wrap gap-2"
                >
                  {variants.map((variant) => {
                    const isSelected = selectedVariant?.id === variant.id;
                    return (
                      <div key={variant.id}>
                        <RadioGroupItem value={variant.id} id={variant.id} className="peer sr-only" />
                        <Label
                          htmlFor={variant.id}
                          className={cn(
                            "flex items-center gap-1.5 px-4 py-2 border-2 rounded-full cursor-pointer text-sm font-medium transition-all",
                            isSelected ? "border-primary bg-primary/10 text-primary" : "border-border text-foreground hover:border-primary/50"
                          )}
                        >
                          {variant.name}
                          {variant.price && <span className="text-xs text-muted-foreground ml-1">₹{variant.price}</span>}
                        </Label>
                      </div>
                    );
                  })}
                </RadioGroup>
              </div>
            )}

            {/* Offer Timer */}
            {productOffer?.offer?.end_date && (productOffer.offer as any).show_timer && (
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 bg-destructive text-destructive-foreground text-sm px-3 py-1 rounded-full font-bold animate-pulse">
                  <Clock className="h-4 w-4" />
                  <OfferCountdown endDate={productOffer.offer.end_date} />
                </div>
                <span className="text-sm text-muted-foreground">Offer ends soon!</span>
              </div>
            )}

            {/* Offer info */}
            {productOffer && (
              <div className="bg-accent border border-border rounded-2xl p-3">
                <p className="text-sm font-medium text-accent-foreground">{productOffer.offer.name}</p>
                {productOffer.offer.description && (
                  <p className="text-xs text-muted-foreground mt-0.5">{productOffer.offer.description}</p>
                )}
              </div>
            )}

            {/* Delivery & Trust Section */}
            <div className="border border-border rounded-2xl divide-y divide-border overflow-hidden">
              <div className="flex items-start gap-3 p-3.5">
                <Truck className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-foreground">Free Delivery</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Estimated delivery in 3-7 business days</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3.5">
                <Undo2 className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-foreground">Easy Returns</p>
                  <p className="text-xs text-muted-foreground mt-0.5">7-day return & exchange policy. No questions asked.</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3.5">
                <Shield className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-foreground">Secure Payment</p>
                  <p className="text-xs text-muted-foreground mt-0.5">100% secure checkout. Your data is protected.</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3.5">
                <Package className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-foreground">Quality Guaranteed</p>
                  <p className="text-xs text-muted-foreground mt-0.5">100% original products. If any issue, we'll make it right.</p>
                </div>
              </div>
            </div>

            {/* Desktop quantity + action buttons */}
            <div className="hidden lg:block space-y-4">
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-muted-foreground">Qty:</span>
                <div className="flex items-center border border-border rounded-full overflow-hidden">
                  <Button variant="ghost" size="icon" className="h-9 w-9 rounded-none" onClick={() => setQuantity(Math.max(1, quantity - 1))} disabled={quantity <= 1}>
                    <Minus className="h-4 w-4" />
                  </Button>
                  <span className="w-10 text-center font-medium">{quantity}</span>
                  <Button variant="ghost" size="icon" className="h-9 w-9 rounded-none" onClick={() => setQuantity(Math.min(availableStock, quantity + 1))} disabled={quantity >= availableStock}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="flex gap-3">
                <Button className="flex-1 h-12 text-base rounded-xl gap-2" onClick={handleAddToCart} disabled={availableStock <= 0 || isAddingToCart}>
                  {isAddingToCart ? <Loader2 className="h-5 w-5 animate-spin" /> : <ShoppingCart className="h-5 w-5" />}
                  Add to Cart
                </Button>
                <Button ref={buyNowRef} variant="secondary" className="flex-1 h-12 text-base rounded-xl border-2 border-primary text-primary hover:bg-primary hover:text-primary-foreground" onClick={handleBuyNow} disabled={availableStock <= 0 || isAddingToCart}>
                  Buy Now
                </Button>
              </div>
            </div>

            {/* Available Coupons */}
            {storeCoupons.length > 0 && (
              <FAQAccordionItem title={`Available Coupons (${storeCoupons.length})`}>
                <div className="space-y-2">
                  {storeCoupons.slice(0, couponsExpanded ? undefined : 2).map((coupon: any) => (
                    <div key={coupon.id} className="flex items-center justify-between p-2.5 border border-dashed border-primary/40 rounded-xl bg-primary/5">
                      <div className="flex items-center gap-2">
                        <Tag className="h-4 w-4 text-primary" />
                        <div>
                          <p className="text-sm font-bold text-primary">{coupon.code}</p>
                          <p className="text-xs text-muted-foreground">{coupon.description || `${coupon.type === 'percentage' ? `${coupon.value}% off` : `₹${coupon.value} off`}`}</p>
                        </div>
                      </div>
                      <Button variant="outline" size="sm" className="rounded-full text-xs h-7 gap-1" onClick={() => { navigator.clipboard.writeText(coupon.code); toast({ title: 'Copied!', description: `Coupon ${coupon.code} copied` }); }}>
                        <Copy className="h-3 w-3" /> Copy
                      </Button>
                    </div>
                  ))}
                  {storeCoupons.length > 2 && (
                    <button className="text-xs text-primary font-medium" onClick={() => setCouponsExpanded(!couponsExpanded)}>
                      {couponsExpanded ? 'Show less' : `+ ${storeCoupons.length - 2} more coupons`}
                    </button>
                  )}
                </div>
              </FAQAccordionItem>
            )}
          </div>
        </div>

        {/* Content Sections */}
        {contentSections.length > 0 && (
          <ContentSections sections={contentSections} />
        )}

        {/* Cross-Sell / Upsell */}
        <CrossSellUpsell product={product} />

        {/* Reviews Section */}
        <section className="mt-10">
          <h2 className="text-lg md:text-xl font-bold text-foreground mb-4">Ratings & Reviews</h2>
          {reviews.length > 0 && (
            <div className="grid md:grid-cols-3 gap-6 mb-6">
              <div className="flex flex-col items-center gap-1 p-4 bg-muted/50 rounded-2xl">
                <span className="text-4xl font-bold text-foreground">{avgRating.toFixed(1)}</span>
                <div className="flex gap-0.5">{[1, 2, 3, 4, 5].map(s => <Star key={s} className={cn("h-4 w-4", s <= Math.round(avgRating) ? "fill-amber-400 text-amber-400" : "text-muted")} />)}</div>
                <span className="text-sm text-muted-foreground">{reviews.length} reviews</span>
              </div>
              <div className="md:col-span-2 space-y-1.5">
                {ratingDist.map(({ star, count, percent }) => (
                  <div key={star} className="flex items-center gap-2">
                    <span className="text-sm w-4 text-right">{star}</span>
                    <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                    <Progress value={percent} className="flex-1 h-2.5" />
                    <span className="text-xs text-muted-foreground w-8">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Review Form */}
          <div className="bg-card border border-border rounded-2xl p-4 mb-6">
            <h3 className="font-semibold mb-3">Write a Review</h3>
            <div className="space-y-3">
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map(s => (
                  <button key={s} onClick={() => setReviewForm({ ...reviewForm, rating: s })}>
                    <Star className={cn("h-6 w-6 transition-colors", s <= reviewForm.rating ? "fill-amber-400 text-amber-400" : "text-muted hover:text-amber-300")} />
                  </button>
                ))}
              </div>
              <Input placeholder="Review title (optional)" value={reviewForm.title} onChange={(e) => setReviewForm({ ...reviewForm, title: e.target.value })} />
              <Textarea placeholder="Your review..." value={reviewForm.comment} onChange={(e) => setReviewForm({ ...reviewForm, comment: e.target.value })} rows={3} />
              <Button onClick={handleSubmitReview} disabled={isSubmittingReview} className="rounded-xl">
                {isSubmittingReview ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                Submit Review
              </Button>
            </div>
          </div>

          {/* Reviews List */}
          {reviews.slice(0, visibleReviewCount).map((review) => (
            <div key={review.id} className="border-b border-border py-4 last:border-0">
              <div className="flex items-center gap-2 mb-1">
                <div className="flex gap-0.5">{[1, 2, 3, 4, 5].map(s => <Star key={s} className={cn("h-3.5 w-3.5", s <= review.rating ? "fill-amber-400 text-amber-400" : "text-muted")} />)}</div>
                {review.is_verified && <Badge variant="secondary" className="text-[10px]">Verified</Badge>}
              </div>
              {review.title && <p className="font-semibold text-sm text-foreground">{review.title}</p>}
              {review.comment && <p className="text-sm text-muted-foreground mt-0.5">{review.comment}</p>}
              <p className="text-xs text-muted-foreground mt-1">{new Date(review.created_at).toLocaleDateString()}</p>
            </div>
          ))}
          {reviews.length > visibleReviewCount && (
            <Button variant="ghost" className="w-full mt-2" onClick={() => setVisibleReviewCount(prev => prev + 10)}>
              Show More Reviews ({reviews.length - visibleReviewCount} remaining)
            </Button>
          )}
        </section>

        {/* Related Products */}
        {relatedProducts.length > 0 && (
          <section className="mt-10">
            <h2 className="text-lg md:text-xl font-bold text-foreground mb-4">You May Also Like</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {relatedProducts.map((rp) => (
                <ProductCard key={rp.id} product={rp} onAddToCart={async (p) => {
                  if (!user) { toast({ title: 'Please login' }); return; }
                  addToCart.mutate({ product: p, quantity: 1 });
                }} productOffer={getProductOffer(rp)} />
              ))}
            </div>
          </section>
        )}
      </div>

      {/* Mobile Sticky Bottom Bar */}
      <AnimatePresence>
        {showStickyBar && (
          <motion.div
            initial={{ y: 100 }}
            animate={{ y: 0 }}
            exit={{ y: 100 }}
            transition={{ type: 'spring', damping: 25 }}
            className="fixed bottom-[60px] left-0 right-0 z-40 bg-card border-t border-border px-4 py-3 flex items-center gap-3 lg:hidden shadow-lg"
          >
            <div className="flex-1 min-w-0">
              <p className="text-lg font-bold text-foreground">₹{displayPrice.toFixed(0)}</p>
              {discount > 0 && <p className="text-xs text-[hsl(var(--success))] font-medium">{discount}% off</p>}
            </div>
            <div className="flex items-center border border-border rounded-full overflow-hidden mr-2">
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-none" onClick={() => setQuantity(Math.max(1, quantity - 1))} disabled={quantity <= 1}>
                <Minus className="h-3 w-3" />
              </Button>
              <span className="w-6 text-center text-sm font-medium">{quantity}</span>
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-none" onClick={() => setQuantity(Math.min(availableStock, quantity + 1))} disabled={quantity >= availableStock}>
                <Plus className="h-3 w-3" />
              </Button>
            </div>
            <Button className="h-10 px-6 rounded-xl gap-2" onClick={handleAddToCart} disabled={availableStock <= 0 || isAddingToCart}>
              {isAddingToCart ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShoppingCart className="h-4 w-4" />}
              Add
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </StorefrontLayout>
  );
}
