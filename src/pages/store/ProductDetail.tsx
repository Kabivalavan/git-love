import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Minus, Plus, Heart, ShoppingCart, Truck, Shield, RefreshCw, ChevronLeft, ChevronRight, Star, Share2, Loader2, ChevronDown, Clock, Tag, Copy, Home, Package, Check } from 'lucide-react';
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
import { cn } from '@/lib/utils';
import { useProductBySlug, useProductVariants, useProductReviews, useRelatedProducts, useStorefrontCoupons } from '@/hooks/useProductQuery';
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

  const { data: product, isLoading: isProductLoading, error: productError } = useProductBySlug(slug);
  const { data: variants = [] } = useProductVariants(product?.id);
  const { data: reviews = [] } = useProductReviews(product?.id);
  const { data: relatedProducts = [] } = useRelatedProducts(product?.category_id || undefined, product?.id);
  const { data: storeCoupons = [] } = useStorefrontCoupons();

  const isLoading = isProductLoading;
  const isAddingToCart = addToCart.isPending;

  useEffect(() => {
    if (variants.length > 0 && !selectedVariant) {
      setSelectedVariant(variants[0]);
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
    if (productError) navigate('/products');
  }, [productError]);

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
      queryClient.invalidateQueries({ queryKey: ['product-reviews', product.id] });
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
  const currentStock = selectedVariant?.stock_quantity ?? product.stock_quantity;
  const productOffer = getProductOffer(product);
  const offerPrice = productOffer?.discountedPrice;
  const displayPrice = offerPrice ?? currentPrice;
  const showOfferDiscount = productOffer && productOffer.discountAmount > 0;
  const discount = showOfferDiscount ? Math.round(((currentPrice - displayPrice) / currentPrice) * 100) : 0;
  const avgRating = reviews.length > 0 ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length) : 0;
  const ratingDist = [5, 4, 3, 2, 1].map(star => ({
    star,
    count: reviews.filter(r => r.rating === star).length,
    percent: reviews.length > 0 ? (reviews.filter(r => r.rating === star).length / reviews.length) * 100 : 0,
  }));
  const contentSections: ContentSection[] = (product as any).content_sections || [];

  const priceWhole = Math.floor(displayPrice);
  const priceDecimal = Math.round((displayPrice - priceWhole) * 100);

  const productJsonLd = {
    '@type': 'Product', name: product.name, description: product.description || product.short_description || '',
    image: images.map(i => i.image_url), sku: product.sku || undefined,
    offers: { '@type': 'Offer', price: currentPrice, priceCurrency: 'INR', availability: currentStock > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock' },
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
        {/* Breadcrumb - mobile: back arrow + Product Details title */}
        <nav className="flex items-center gap-3 mb-4">
          <button onClick={() => navigate(-1)} className="h-9 w-9 rounded-full border border-border bg-card flex items-center justify-center flex-shrink-0 hover:bg-muted transition-colors">
            <ChevronLeft className="h-5 w-5 text-foreground" />
          </button>
          <span className="text-base font-semibold text-foreground lg:hidden">Product Details</span>
          <span className="text-sm text-muted-foreground hidden lg:block">
            <Link to="/" className="hover:text-primary">Home</Link> / <Link to="/products" className="hover:text-primary">Shop</Link> / <span className="text-foreground">{product.name}</span>
          </span>
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
                    <img src={img.image_url} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Product Info */}
          <div className="space-y-4 min-w-0">
            {/* Name + Wishlist */}
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

            {/* Price - large with superscript */}
            <div className="flex items-baseline gap-3 flex-wrap">
              <span className="text-3xl md:text-4xl font-bold text-foreground">
                ₹{priceWhole}<span className="text-lg align-super font-semibold">.{String(priceDecimal).padStart(2, '0')}</span>
              </span>
              {showOfferDiscount && (
                <span className="text-lg text-muted-foreground line-through">₹{Number(currentPrice).toFixed(0)}</span>
              )}
            </div>

            {/* Availability + Rating inline */}
            <div className="flex items-center gap-4 flex-wrap">
              {currentStock > 0 ? (
                <span className="flex items-center gap-1.5 text-sm">
                  <span className="h-2 w-2 rounded-full bg-[hsl(var(--success))]" />
                  <span className="text-[hsl(var(--success))] font-medium">Available on fast delivery</span>
                </span>
              ) : (
                <span className="text-destructive text-sm font-medium">Out of stock</span>
              )}
              {reviews.length > 0 && (
                <span className="flex items-center gap-1.5 text-sm">
                  <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                  <span className="font-semibold">{avgRating.toFixed(1)} Rating</span>
                </span>
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

            {/* Guarantee text */}
            <div className="bg-muted rounded-2xl p-3">
              <p className="text-sm text-muted-foreground">
                100% satisfaction guarantee. If you experience any issues, missing, poor item, late arrival, or unprofessional service, we'll make it right.
              </p>
            </div>

            {/* Desktop quantity + action buttons */}
            <div className="hidden lg:block space-y-4">
              {/* Quantity */}
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-muted-foreground">Qty:</span>
                <div className="flex items-center border border-border rounded-full overflow-hidden">
                  <Button variant="ghost" size="icon" className="h-9 w-9 rounded-none" onClick={() => setQuantity(Math.max(1, quantity - 1))} disabled={quantity <= 1}>
                    <Minus className="h-4 w-4" />
                  </Button>
                  <span className="w-10 text-center font-semibold text-sm">{String(quantity).padStart(2, '0')}</span>
                  <Button variant="ghost" size="icon" className="h-9 w-9 rounded-none" onClick={() => setQuantity(Math.min(currentStock, quantity + 1))} disabled={quantity >= currentStock}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                {currentStock <= 5 && currentStock > 0 && (
                  <span className="text-xs text-destructive font-medium">Only {currentStock} left!</span>
                )}
              </div>

              {/* Action buttons */}
              <div className="flex gap-3">
                <Button
                  className="flex-1 h-12 text-base font-semibold rounded-xl"
                  variant="outline"
                  onClick={handleAddToCart}
                  disabled={isAddingToCart || currentStock === 0}
                >
                  {isAddingToCart ? <Loader2 className="h-5 w-5 mr-2 animate-spin" /> : <ShoppingCart className="h-5 w-5 mr-2" />}
                  Add to Cart
                </Button>
                <Button
                  ref={buyNowRef}
                  className="flex-1 h-12 text-base font-semibold rounded-xl"
                  onClick={handleBuyNow}
                  disabled={currentStock === 0}
                >
                  Buy Now
                </Button>
              </div>
            </div>

            {/* Mobile: buyNow ref for sticky bar trigger */}
            <div className="lg:hidden">
              <Button ref={buyNowRef} className="sr-only" tabIndex={-1}>trigger</Button>
            </div>

            {/* Trust features */}
            <div className="flex items-center gap-4 pt-2 text-sm text-muted-foreground flex-wrap">
              <span className="flex items-center gap-1.5"><Truck className="h-4 w-4 text-primary" /> Free Shipping</span>
              <span className="flex items-center gap-1.5"><RefreshCw className="h-4 w-4 text-primary" /> Easy Returns</span>
              <span className="flex items-center gap-1.5"><Shield className="h-4 w-4 text-primary" /> Secure</span>
            </div>

            {/* Coupons */}
            {storeCoupons.length > 0 && (
              <div className="border border-dashed border-border rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Tag className="h-4 w-4 text-primary" />
                  <span className="text-sm font-semibold text-foreground">Available Coupons</span>
                </div>
                <div className="space-y-2">
                  {(couponsExpanded ? storeCoupons : storeCoupons.slice(0, 3)).map((coupon) => (
                    <div key={coupon.id} className="flex items-center justify-between bg-muted rounded-xl px-3 py-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-mono font-bold text-primary text-sm bg-primary/10 px-2 py-0.5 rounded">{coupon.code}</span>
                        <span className="text-xs text-muted-foreground truncate">
                          {coupon.description || (coupon.type === 'percentage' ? `${coupon.value}% off` : `₹${coupon.value} off`)}
                        </span>
                      </div>
                      <Button variant="ghost" size="sm" className="h-7 px-2 text-xs flex-shrink-0" onClick={() => {
                        navigator.clipboard.writeText(coupon.code);
                        toast({ title: 'Copied!', description: `${coupon.code} copied to clipboard` });
                      }}>
                        <Copy className="h-3 w-3 mr-1" /> Copy
                      </Button>
                    </div>
                  ))}
                </div>
                {storeCoupons.length > 3 && (
                  <button onClick={() => setCouponsExpanded(!couponsExpanded)} className="flex items-center gap-1 text-xs text-primary mt-2 hover:underline">
                    <motion.div animate={{ rotate: couponsExpanded ? 180 : 0 }} transition={{ duration: 0.2 }}><ChevronDown className="h-3.5 w-3.5" /></motion.div>
                    {couponsExpanded ? 'Show less' : `Show ${storeCoupons.length - 3} more`}
                  </button>
                )}
              </div>
            )}

            {/* Description */}
            <div className="space-y-3 pt-2">
              {product.description && (
                <FAQAccordionItem title="Description" defaultOpen>
                  <div className="prose prose-sm max-w-none text-muted-foreground whitespace-pre-wrap">{product.description}</div>
                </FAQAccordionItem>
              )}
              {contentSections.length > 0 && <ContentSections sections={contentSections} />}
            </div>
          </div>
        </div>

        {/* Reviews Section */}
        <div className="mb-8">
          <h2 className="text-lg md:text-xl font-bold mb-4">Ratings and reviews</h2>
          {reviews.length > 0 && (
            <div className="grid md:grid-cols-3 gap-6 mb-6">
              <div className="bg-card border border-border rounded-2xl p-6 text-center">
                <p className="text-5xl font-bold text-foreground">{avgRating.toFixed(1)}</p>
                <div className="flex justify-center my-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star key={star} className={cn("h-5 w-5", star <= Math.round(avgRating) ? 'fill-amber-400 text-amber-400' : 'text-muted')} />
                  ))}
                </div>
                <p className="text-sm text-muted-foreground">{reviews.length.toLocaleString()} rating{reviews.length !== 1 ? 's' : ''}</p>
                <div className="mt-4 space-y-2">
                  {ratingDist.map(rd => (
                    <div key={rd.star} className="flex items-center gap-2">
                      <span className="text-xs w-3">{rd.star}</span>
                      <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                      <Progress value={rd.percent} className="flex-1 h-2" />
                      <span className="text-xs text-muted-foreground w-6">{rd.count}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="md:col-span-2 space-y-3">
                {reviews.slice(0, visibleReviewCount).map((review) => (
                  <div key={review.id} className="bg-card border border-border rounded-2xl px-4 py-3">
                    <div className="flex items-center gap-2 mb-1.5">
                      <div className="flex">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Star key={star} className={cn("h-3 w-3", star <= review.rating ? 'fill-amber-400 text-amber-400' : 'text-muted')} />
                        ))}
                      </div>
                      <span className="text-sm font-medium">{(review as any).profile?.full_name || 'Customer'}</span>
                      {review.is_verified && <Badge variant="secondary" className="text-[10px]">Verified</Badge>}
                      <span className="text-xs text-muted-foreground ml-auto">{new Date(review.created_at).toLocaleDateString()}</span>
                    </div>
                    {review.title && <p className="font-medium text-sm">{review.title}</p>}
                    {review.comment && <p className="text-sm text-muted-foreground mt-0.5">{review.comment}</p>}
                  </div>
                ))}
                {reviews.length > visibleReviewCount && (
                  <Button variant="outline" className="w-full rounded-xl" onClick={() => setVisibleReviewCount(prev => prev + 10)}>
                    Show More Reviews ({reviews.length - visibleReviewCount} remaining)
                  </Button>
                )}
              </div>
            </div>
          )}

          {user && (
            <div className="bg-card border border-border rounded-2xl px-4 py-4">
              <h3 className="font-semibold mb-3">Write a Review</h3>
              <div className="space-y-3">
                <div>
                  <Label>Rating</Label>
                  <div className="flex gap-1 mt-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button key={star} onClick={() => setReviewForm({ ...reviewForm, rating: star })}>
                        <Star className={cn("h-6 w-6", star <= reviewForm.rating ? 'fill-amber-400 text-amber-400' : 'text-muted')} />
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <Label>Title (optional)</Label>
                  <Input value={reviewForm.title} onChange={(e) => setReviewForm({ ...reviewForm, title: e.target.value })} placeholder="Great product!" className="rounded-xl" />
                </div>
                <div>
                  <Label>Comment (optional)</Label>
                  <Textarea value={reviewForm.comment} onChange={(e) => setReviewForm({ ...reviewForm, comment: e.target.value })} placeholder="Share your experience..." rows={3} className="rounded-xl" />
                </div>
                <Button onClick={handleSubmitReview} disabled={isSubmittingReview} className="rounded-xl">
                  {isSubmittingReview ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Submitting...</> : 'Submit Review'}
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Related Products */}
        {relatedProducts.length > 0 && (
          <div className="mb-8">
            <h2 className="text-lg md:text-xl font-bold mb-4">You May Also Like</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
              {relatedProducts.map((rp) => <ProductCard key={rp.id} product={rp} />)}
            </div>
          </div>
        )}
      </div>

      {/* Mobile Sticky Bottom Bar - App style with quantity + Add to Cart */}
      <AnimatePresence>
        {showStickyBar && product && currentStock > 0 && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className="fixed bottom-[60px] left-0 right-0 z-40 bg-card border-t border-border px-4 py-3 lg:hidden shadow-lg"
          >
            <div className="flex items-center gap-3">
              {/* Quantity controls */}
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  disabled={quantity <= 1}
                  className="h-10 w-10 rounded-full border-2 border-primary text-primary flex items-center justify-center disabled:opacity-40"
                >
                  <Minus className="h-4 w-4" />
                </button>
                <span className="w-8 text-center font-bold text-base">{quantity}</span>
                <button
                  onClick={() => setQuantity(Math.min(currentStock, quantity + 1))}
                  disabled={quantity >= currentStock}
                  className="h-10 w-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-40"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
              {/* Add to cart */}
              <Button className="flex-1 h-12 text-base font-semibold rounded-2xl" onClick={handleAddToCart} disabled={isAddingToCart}>
                {isAddingToCart ? <Loader2 className="h-5 w-5 mr-2 animate-spin" /> : <ShoppingCart className="h-5 w-5 mr-2" />}
                Add to Cart
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </StorefrontLayout>
  );
}
