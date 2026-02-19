import { useEffect, useState, memo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Minus, Plus, Heart, ShoppingCart, Truck, Shield, RefreshCw, ChevronLeft, ChevronRight, Star, Share2, Loader2, ChevronDown, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
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
import { useOffers } from '@/hooks/useOffers';
import { Shimmer } from '@/components/ui/shimmer';
import { SEOHead } from '@/components/seo/SEOHead';
import { ContentSections, type ContentSection } from '@/components/product/ContentSections';
import type { Product, ProductVariant, Review } from '@/types/database';

// FAQ Accordion Item Component
function FAQAccordionItem({ title, children, defaultOpen = false }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  return (
    <div className="border rounded-lg overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between w-full px-4 py-3 text-left font-semibold text-foreground hover:bg-muted/50 transition-colors"
      >
        <span className="text-base">{title}</span>
        <motion.div animate={{ rotate: isOpen ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronDown className="h-5 w-5 text-muted-foreground" />
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
            <div className="px-4 pb-4 pt-1">
              {children}
            </div>
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
  const [product, setProduct] = useState<Product | null>(null);
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [relatedProducts, setRelatedProducts] = useState<Product[]>([]);
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddingToCart, setIsAddingToCart] = useState(false);
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [reviewForm, setReviewForm] = useState({ rating: 5, title: '', comment: '' });
  const { toast } = useToast();
  const { user } = useAuth();
  const { trackEvent } = useAnalytics();
  const { getProductOffer } = useOffers();

  useEffect(() => {
    if (slug) fetchProduct();
  }, [slug]);

  const fetchProduct = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('products')
      .select('*, category:categories(*), images:product_images(*)')
      .eq('slug', slug)
      .eq('is_active', true)
      .single();

    if (error || !data) {
      navigate('/products');
      return;
    }

    const productData = data as unknown as Product;
    setProduct(productData);

    // Track product view
    trackEvent('product_view', {
      product_id: productData.id,
      category_id: productData.category_id || undefined,
      metadata: {
        product_name: productData.name,
        price: productData.price,
        category: productData.category?.name || null,
      },
    });

    const [variantsRes, reviewsRes] = await Promise.all([
      supabase.from('product_variants').select('*').eq('product_id', productData.id).eq('is_active', true),
      supabase.from('reviews').select('*, profile:profiles(full_name)').eq('product_id', productData.id).order('created_at', { ascending: false }).limit(50),
    ]);

    const variantList = (variantsRes.data || []) as ProductVariant[];
    setVariants(variantList);
    // Auto-select first variant by default
    if (variantList.length > 0) setSelectedVariant(variantList[0]);
    const reviewsList = (reviewsRes.data || []) as unknown as Review[];
    setReviews(reviewsList);

    if (productData.category_id) {
      const { data: relatedData } = await supabase
        .from('products')
        .select('*, category:categories(*), images:product_images(*)')
        .eq('category_id', productData.category_id)
        .eq('is_active', true)
        .neq('id', productData.id)
        .limit(4);
      setRelatedProducts((relatedData || []) as Product[]);
    }

    setIsLoading(false);
  };

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
    setIsAddingToCart(true);

    try {
      let { data: cart } = await supabase.from('cart').select('id').eq('user_id', user.id).single();
      if (!cart) {
        const { data: newCart } = await supabase.from('cart').insert({ user_id: user.id }).select().single();
        cart = newCart;
      }

      if (cart) {
        const { data: existingItem } = await supabase
          .from('cart_items')
          .select('id, quantity')
          .eq('cart_id', cart.id)
          .eq('product_id', product.id)
          .eq('variant_id', selectedVariant?.id || null)
          .single();

        if (existingItem) {
          await supabase.from('cart_items').update({ quantity: existingItem.quantity + quantity }).eq('id', existingItem.id);
        } else {
          await supabase.from('cart_items').insert({
            cart_id: cart.id,
            product_id: product.id,
            variant_id: selectedVariant?.id || null,
            quantity,
          });
        }

        // Track add to cart
        trackEvent('add_to_cart', {
          product_id: product.id,
          metadata: {
            product_name: product.name,
            price: selectedVariant?.price || product.price,
            quantity,
            variant: selectedVariant?.name || null,
          },
        });

        toast({ title: 'Added to cart', description: `${product.name} has been added to your cart` });
      }
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to add item to cart', variant: 'destructive' });
    } finally {
      setIsAddingToCart(false);
    }
  };

  const handleAddToWishlist = async () => {
    if (!user) {
      toast({ title: 'Please login', description: 'You need to login to add items to wishlist' });
      return;
    }
    if (!product) return;

    try {
      await supabase.from('wishlist').insert({ user_id: user.id, product_id: product.id });
      trackEvent('wishlist_add', { product_id: product.id, metadata: { product_name: product.name } });
      toast({ title: 'Added to wishlist', description: `${product.name} has been added to your wishlist` });
    } catch (error: any) {
      if (error.code === '23505') {
        toast({ title: 'Already in wishlist', description: 'This item is already in your wishlist' });
      } else {
        toast({ title: 'Error', description: 'Failed to add item to wishlist', variant: 'destructive' });
      }
    }
  };

  const handleBuyNow = async () => {
    await handleAddToCart();
    navigate('/cart');
  };

  const handleSubmitReview = async () => {
    if (!user || !product) {
      toast({ title: 'Please login', description: 'You need to login to submit a review' });
      return;
    }

    setIsSubmittingReview(true);
    const { error } = await supabase.from('reviews').insert({
      product_id: product.id,
      user_id: user.id,
      rating: reviewForm.rating,
      title: reviewForm.title || null,
      comment: reviewForm.comment || null,
      is_approved: true,
      is_verified: true,
    });

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Review submitted', description: 'Thank you for your feedback!' });
      setReviewForm({ rating: 5, title: '', comment: '' });
      const { data } = await supabase
        .from('reviews')
        .select('*, profile:profiles(full_name)')
        .eq('product_id', product.id)
        .order('created_at', { ascending: false })
        .limit(50);
      setReviews((data || []) as unknown as Review[]);
    }
    setIsSubmittingReview(false);
  };

  if (isLoading) {
    return (
      <StorefrontLayout>
        <div className="container mx-auto px-4 py-8">
          <div className="grid md:grid-cols-2 gap-8">
            <Shimmer className="aspect-square" />
            <div className="space-y-4">
              <Shimmer className="h-8 w-3/4" />
              <Shimmer className="h-6 w-1/2" />
              <Shimmer className="h-24 w-full" />
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

  // Get offer for this product
  const productOffer = getProductOffer(product);
  const offerPrice = productOffer?.discountedPrice;
  const displayPrice = offerPrice ?? currentPrice;
  const showOfferDiscount = productOffer && productOffer.discountAmount > 0;
  const discount = showOfferDiscount
    ? Math.round(((currentPrice - displayPrice) / currentPrice) * 100)
    : 0;

  const avgRating = reviews.length > 0
    ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length)
    : 0;

  const ratingDist = [5, 4, 3, 2, 1].map(star => ({
    star,
    count: reviews.filter(r => r.rating === star).length,
    percent: reviews.length > 0 ? (reviews.filter(r => r.rating === star).length / reviews.length) * 100 : 0,
  }));

  const contentSections: ContentSection[] = (product as any).content_sections || [];

  const productJsonLd = {
    '@type': 'Product',
    name: product.name,
    description: product.description || product.short_description || '',
    image: images.map(i => i.image_url),
    sku: product.sku || undefined,
    offers: {
      '@type': 'Offer',
      price: currentPrice,
      priceCurrency: 'INR',
      availability: currentStock > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
    },
    ...(reviews.length > 0 && {
      aggregateRating: {
        '@type': 'AggregateRating',
        ratingValue: avgRating.toFixed(1),
        reviewCount: reviews.length,
      },
    }),
  };

  return (
    <StorefrontLayout>
      <SEOHead
        title={`${product.name} - Buy Online | Decon Fashions`}
        description={product.short_description || product.description?.slice(0, 160) || `Buy ${product.name} online at best price.`}
        image={images[0]?.image_url}
        jsonLd={productJsonLd}
      />
      <div className="container mx-auto px-4 py-6 md:py-8 max-w-full overflow-hidden">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-4 md:mb-6 overflow-x-auto whitespace-nowrap">
          <Link to="/" className="hover:text-primary flex-shrink-0">Home</Link>
          <span>/</span>
          <Link to="/products" className="hover:text-primary flex-shrink-0">Products</Link>
          {product.category && (
            <>
              <span>/</span>
              <Link to={`/products?category=${product.category.slug}`} className="hover:text-primary flex-shrink-0">
                {product.category.name}
              </Link>
            </>
          )}
          <span>/</span>
          <span className="text-foreground truncate">{product.name}</span>
        </nav>

        <div className="grid md:grid-cols-2 gap-4 md:gap-8 mb-8 md:mb-12">
          {/* Images - sticky on desktop */}
          <div className="space-y-3 min-w-0 md:self-start md:sticky md:top-20">
            <div className="relative aspect-square bg-muted rounded-lg overflow-hidden w-full">
              <img src={currentImage} alt={product.name} className="w-full h-full object-contain" />
              {images.length > 1 && (
                <>
                  <Button variant="secondary" size="icon" className="absolute left-2 top-1/2 -translate-y-1/2 h-8 w-8" onClick={() => setCurrentImageIndex((prev) => (prev - 1 + images.length) % images.length)}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button variant="secondary" size="icon" className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8" onClick={() => setCurrentImageIndex((prev) => (prev + 1) % images.length)}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </>
              )}
              {discount > 0 && (
                <Badge variant="destructive" className="absolute top-3 left-3">{discount}% OFF</Badge>
              )}
            </div>
            {images.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
                {images.map((img, index) => (
                  <button
                    key={img.id}
                    onClick={() => setCurrentImageIndex(index)}
                    className={`w-14 h-14 rounded-md overflow-hidden border-2 flex-shrink-0 ${index === currentImageIndex ? 'border-primary' : 'border-transparent'}`}
                  >
                    <img src={img.image_url} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Product Info - scrollable right side on desktop */}
          <div className="space-y-4 md:space-y-6 min-w-0">
            <div>
              {product.badge && <Badge className="mb-2">{product.badge}</Badge>}
              <h1 className="text-xl md:text-3xl font-bold text-foreground">{product.name}</h1>
              {product.short_description && (
                <p className="text-muted-foreground mt-2 text-sm md:text-base">{product.short_description}</p>
              )}
            </div>

            {/* Rating */}
            {reviews.length > 0 && (
              <div className="flex items-center gap-2">
                <div className="flex items-center">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star key={star} className={`h-4 w-4 md:h-5 md:w-5 ${star <= Math.round(avgRating) ? 'fill-amber-400 text-amber-400' : 'text-muted'}`} />
                  ))}
                </div>
                <span className="font-medium text-sm">{avgRating.toFixed(1)}</span>
                <span className="text-muted-foreground text-sm">({reviews.length} reviews)</span>
              </div>
            )}

            {/* Price */}
            <div className="flex items-baseline gap-3 flex-wrap">
              <span className="text-2xl md:text-3xl font-bold text-foreground">₹{Number(displayPrice).toFixed(0)}</span>
              {showOfferDiscount && (
                <>
                  <span className="text-lg md:text-xl text-muted-foreground line-through">₹{Number(currentPrice).toFixed(0)}</span>
                  <Badge variant="destructive" className="animate-pulse">{productOffer.discountLabel}</Badge>
                </>
              )}
              <span className="text-xs text-muted-foreground">(Tax Inclusive)</span>
            </div>

            {/* Offer Timer */}
            {productOffer?.offer?.end_date && (productOffer.offer as any).show_timer && (
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 bg-destructive text-destructive-foreground text-sm px-3 py-1 rounded font-bold animate-pulse">
                  <Clock className="h-4 w-4" />
                  <OfferCountdown endDate={productOffer.offer.end_date} />
                </div>
                <span className="text-sm text-muted-foreground">Offer ends soon!</span>
              </div>
            )}

            {/* Offer name */}
            {productOffer && (
              <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg p-3">
                <p className="text-sm font-medium text-green-700 dark:text-green-400">{productOffer.offer.name}</p>
                {productOffer.offer.description && (
                  <p className="text-xs text-green-600 dark:text-green-500 mt-0.5">{productOffer.offer.description}</p>
                )}
              </div>
            )}

            {/* Variants */}
            {variants.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Label className={`text-sm md:text-base font-semibold ${variantError ? 'text-destructive' : ''}`}>
                    Select Variant {(product as any).variant_required && <span className="text-destructive">*</span>}
                  </Label>
                  <span className="text-xs text-muted-foreground">(First variant selected by default)</span>
                </div>
                {variantError && (
                  <p className="text-xs text-destructive mt-1 mb-1">⚠️ Please select a variant to continue</p>
                )}
                <RadioGroup
                  value={selectedVariant?.id || ''}
                  onValueChange={(val) => setSelectedVariant(variants.find(v => v.id === val) || null)}
                  className="flex flex-wrap gap-2 mt-2"
                >
                  {variants.map((variant) => (
                    <div key={variant.id}>
                      <RadioGroupItem value={variant.id} id={variant.id} className="peer sr-only" />
                      <Label
                        htmlFor={variant.id}
                        className="flex items-center gap-1.5 px-3 py-1.5 border rounded-md cursor-pointer text-sm peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5"
                      >
                        {variant.name}
                        {variant.price && <span className="text-xs">₹{variant.price}</span>}
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              </div>
            )}

            {/* Quantity */}
            <div>
              <Label className="text-sm md:text-base font-semibold">Quantity</Label>
              <div className="flex items-center gap-3 mt-2">
                <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setQuantity(Math.max(1, quantity - 1))} disabled={quantity <= 1}>
                  <Minus className="h-4 w-4" />
                </Button>
                <span className="w-10 text-center font-medium">{quantity}</span>
                <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setQuantity(Math.min(currentStock, quantity + 1))} disabled={quantity >= currentStock}>
                  <Plus className="h-4 w-4" />
                </Button>
                <span className="text-sm text-muted-foreground">{currentStock} available</span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                size="lg"
                className="flex-1 h-14 text-lg font-semibold"
                onClick={handleAddToCart}
                disabled={isAddingToCart || currentStock === 0}
                data-action="add-to-cart"
                data-product-id={product.id}
              >
                {isAddingToCart ? <Loader2 className="h-6 w-6 mr-2 animate-spin" /> : <ShoppingCart className="h-6 w-6 mr-2" />}
                {currentStock === 0 ? 'Out of Stock' : 'Add to Cart'}
              </Button>
              <Button size="lg" variant="outline" className="flex-1 h-14 text-lg font-semibold border-2" onClick={handleBuyNow} disabled={currentStock === 0}>
                Buy Now
              </Button>
            </div>

            {/* Wishlist & Share */}
            <div className="flex gap-3">
              <Button variant="outline" size="sm" onClick={handleAddToWishlist} data-action="add-to-wishlist" data-product-id={product.id}>
                <Heart className="h-4 w-4 mr-2" />
                Wishlist
              </Button>
              <Button variant="outline" size="sm" onClick={() => {
                navigator.share?.({ title: product.name, url: window.location.href }).catch(() => {
                  navigator.clipboard.writeText(window.location.href);
                  toast({ title: 'Link copied!' });
                });
              }}>
                <Share2 className="h-4 w-4 mr-2" />
                Share
              </Button>
            </div>

            {/* Trust Badges */}
            <div className="grid grid-cols-3 gap-2 pt-2">
              <div className="text-center p-2 bg-muted rounded-lg">
                <Truck className="h-5 w-5 mx-auto mb-1 text-primary" />
                <p className="text-[10px] md:text-xs font-medium">Free Shipping</p>
              </div>
              <div className="text-center p-2 bg-muted rounded-lg">
                <Shield className="h-5 w-5 mx-auto mb-1 text-primary" />
                <p className="text-[10px] md:text-xs font-medium">Secure Payment</p>
              </div>
              <div className="text-center p-2 bg-muted rounded-lg">
                <RefreshCw className="h-5 w-5 mx-auto mb-1 text-primary" />
                <p className="text-[10px] md:text-xs font-medium">Easy Returns</p>
              </div>
            </div>

            {/* Product Details Sections - inside right column on desktop */}
            <div className="space-y-3">
              {product.description && (
                <FAQAccordionItem title="Product Description">
                  <div className="prose prose-sm max-w-none text-muted-foreground whitespace-pre-wrap">{product.description}</div>
                </FAQAccordionItem>
              )}
              {contentSections.length > 0 && <ContentSections sections={contentSections} />}
            </div>
          </div>
        </div>

        {/* Reviews Section */}
        <div className="mb-8 md:mb-12">
          <h2 className="text-lg md:text-xl font-bold mb-4">Customer Reviews</h2>

          {reviews.length > 0 && (
            <div className="grid md:grid-cols-3 gap-6 mb-6">
              <Card className="md:col-span-1">
                <CardContent className="py-6 text-center">
                  <p className="text-4xl font-bold">{avgRating.toFixed(1)}</p>
                  <div className="flex justify-center my-2">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star key={star} className={`h-5 w-5 ${star <= Math.round(avgRating) ? 'fill-amber-400 text-amber-400' : 'text-muted'}`} />
                    ))}
                  </div>
                  <p className="text-sm text-muted-foreground">{reviews.length} reviews</p>
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
                </CardContent>
              </Card>

              <div className="md:col-span-2 space-y-4 max-h-96 overflow-y-auto">
                {reviews.map((review) => (
                  <Card key={review.id}>
                    <CardContent className="py-4">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="flex">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <Star key={star} className={`h-3 w-3 ${star <= review.rating ? 'fill-amber-400 text-amber-400' : 'text-muted'}`} />
                          ))}
                        </div>
                        <span className="text-sm font-medium">{(review as any).profile?.full_name || 'Customer'}</span>
                        {review.is_verified && <Badge variant="secondary" className="text-[10px]">Verified</Badge>}
                      </div>
                      {review.title && <p className="font-medium text-sm">{review.title}</p>}
                      {review.comment && <p className="text-sm text-muted-foreground mt-1">{review.comment}</p>}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Write Review */}
          {user && (
            <Card>
              <CardContent className="py-4">
                <h3 className="font-semibold mb-3">Write a Review</h3>
                <div className="space-y-3">
                  <div>
                    <Label>Rating</Label>
                    <div className="flex gap-1 mt-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button key={star} onClick={() => setReviewForm({ ...reviewForm, rating: star })}>
                          <Star className={`h-6 w-6 ${star <= reviewForm.rating ? 'fill-amber-400 text-amber-400' : 'text-muted'}`} />
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <Label>Title (optional)</Label>
                    <Input value={reviewForm.title} onChange={(e) => setReviewForm({ ...reviewForm, title: e.target.value })} placeholder="Great product!" />
                  </div>
                  <div>
                    <Label>Comment (optional)</Label>
                    <Textarea value={reviewForm.comment} onChange={(e) => setReviewForm({ ...reviewForm, comment: e.target.value })} placeholder="Share your experience..." rows={3} />
                  </div>
                  <Button onClick={handleSubmitReview} disabled={isSubmittingReview}>
                    {isSubmittingReview ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Submitting...</> : 'Submit Review'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Related Products */}
        {relatedProducts.length > 0 && (
          <div>
            <h2 className="text-lg md:text-xl font-bold mb-4">You May Also Like</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
              {relatedProducts.map((rp) => (
                <ProductCard key={rp.id} product={rp} />
              ))
            }
            </div>
          </div>
        )}
      </div>
    </StorefrontLayout>
  );
}

// Card component used inline
function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`bg-card border border-border rounded-lg ${className}`}>{children}</div>;
}

function CardContent({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`px-4 ${className}`}>{children}</div>;
}
