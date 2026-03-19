import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Minus, Plus, Trash2, ShoppingBag, ArrowRight, Star, Truck, RefreshCw, Tag, Copy, Check } from 'lucide-react';
import { StorefrontLayout } from '@/components/storefront/StorefrontLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { Shimmer } from '@/components/ui/shimmer';
import { useGlobalStore } from '@/hooks/useGlobalStore';
import { useCartQuery, useCartMutations, type CartItemWithProduct } from '@/hooks/useCartQuery';
import { useCheckoutSettings } from '@/hooks/useProductQuery';
import { CartValueOptimizer } from '@/components/storefront/CartValueOptimizer';
import { cn } from '@/lib/utils';
import type { Product, Coupon, ProductVariant } from '@/types/database';

export default function CartPage() {
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<Coupon | null>(null);
  const [isApplyingCoupon, setIsApplyingCoupon] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();
  const { getProductOffer, calculateCartDiscount } = useGlobalStore();
  const navigate = useNavigate();

  // Centralized cart query - no duplicate fetches
  const { data: cartItems = [], isLoading } = useCartQuery();
  const { updateQuantity: updateQtyMutation, removeItem: removeItemMutation } = useCartMutations();
  const { data: checkoutSettingsData } = useCheckoutSettings();
  const checkoutSettings = {
    free_shipping_threshold: checkoutSettingsData?.free_shipping_threshold ?? 500,
    default_shipping_charge: checkoutSettingsData?.default_shipping_charge ?? 50,
  };

  // Restore saved coupon
  useEffect(() => {
    const savedCoupon = localStorage.getItem('applied_coupon');
    if (savedCoupon) {
      try {
        const coupon = JSON.parse(savedCoupon) as Coupon;
        if (coupon.end_date && new Date(coupon.end_date) < new Date()) {
          localStorage.removeItem('applied_coupon');
        } else {
          setAppliedCoupon(coupon);
          setCouponCode(coupon.code);
        }
      } catch { localStorage.removeItem('applied_coupon'); }
    }
  }, []);

  const updateQuantity = async (itemId: string, newQuantity: number) => {
    if (newQuantity < 1) return;
    const item = cartItems.find(i => i.id === itemId);
    if (!item || newQuantity > (item.product.stock_quantity ?? 0)) {
      toast({ title: 'Error', description: 'Not enough stock available', variant: 'destructive' });
      return;
    }
    updateQtyMutation.mutate({ itemId, quantity: newQuantity });
  };

  const removeItem = async (itemId: string) => {
    removeItemMutation.mutate(itemId, {
      onSuccess: () => toast({ title: 'Removed', description: 'Item removed from cart' }),
    });
  };

  const applyCoupon = async () => {
    if (!couponCode.trim()) return;
    setIsApplyingCoupon(true);
    const { data: coupon, error } = await supabase
      .from('coupons').select('*').eq('code', couponCode.toUpperCase()).eq('is_active', true).single();
    if (error || !coupon) {
      toast({ title: 'Invalid coupon', description: 'This coupon code is not valid', variant: 'destructive' });
    } else {
      const couponData = coupon as unknown as Coupon;
      if (couponData.end_date && new Date(couponData.end_date) < new Date()) {
        toast({ title: 'Coupon expired', description: 'This coupon has expired', variant: 'destructive' });
      } else if (couponData.min_order_value && subtotal < couponData.min_order_value) {
        toast({ title: 'Minimum order not met', description: `Minimum order value is ₹${couponData.min_order_value}`, variant: 'destructive' });
      } else {
        setAppliedCoupon(couponData);
        localStorage.setItem('applied_coupon', JSON.stringify(couponData));
        toast({ title: 'Coupon applied', description: `Coupon ${couponData.code} applied successfully` });
      }
    }
    setIsApplyingCoupon(false);
  };

  const removeCoupon = () => { setAppliedCoupon(null); setCouponCode(''); localStorage.removeItem('applied_coupon'); };

  // Fetch coupons with show_on_cart enabled
  const [cartCoupons, setCartCoupons] = useState<Coupon[]>([]);
  const [copiedCouponId, setCopiedCouponId] = useState<string | null>(null);
  useEffect(() => {
    supabase
      .from('coupons')
      .select('*')
      .eq('is_active', true)
      .eq('show_on_cart', true)
      .then(({ data }) => {
        if (data) {
          const now = new Date();
          const valid = (data as unknown as Coupon[]).filter(c => {
            if (c.start_date && new Date(c.start_date) > now) return false;
            if (c.end_date && new Date(c.end_date) < now) return false;
            if (c.usage_limit && (c.used_count ?? 0) >= c.usage_limit) return false;
            return true;
          });
          setCartCoupons(valid);
        }
      });
  }, []);

  const handleCopyCoupon = (coupon: Coupon) => {
    setCouponCode(coupon.code);
    setCopiedCouponId(coupon.id);
    setTimeout(() => setCopiedCouponId(null), 1500);
  };

  const subtotal = cartItems.reduce((sum, item) => {
    const price = item.variant?.price || item.product.price;
    return sum + (price * item.quantity);
  }, 0);

  const offerDiscount = calculateCartDiscount(cartItems.map(item => ({ product: item.product, quantity: item.quantity })));
  const couponDiscount = appliedCoupon
    ? appliedCoupon.type === 'percentage'
      ? Math.min((subtotal * appliedCoupon.value) / 100, appliedCoupon.max_discount || Infinity)
      : appliedCoupon.value
    : 0;
  const totalDiscount = offerDiscount.totalDiscount + couponDiscount;
  const freeThreshold = checkoutSettings.free_shipping_threshold;
  const defaultShipping = checkoutSettings.default_shipping_charge;
  const shippingCharge = (freeThreshold > 0 && subtotal >= freeThreshold) ? 0 : defaultShipping;
  const total = subtotal - totalDiscount + shippingCharge;
  const totalItems = cartItems.reduce((sum, item) => sum + item.quantity, 0);

  if (!user) {
    return (
      <StorefrontLayout>
        <div className="container mx-auto px-4 py-16 text-center">
          <ShoppingBag className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
          <h1 className="text-2xl font-bold mb-2">Please login to view your cart</h1>
          <p className="text-muted-foreground mb-6">You need to be logged in to add items to your cart</p>
          <Button asChild className="rounded-xl"><Link to="/auth">Login to Continue</Link></Button>
        </div>
      </StorefrontLayout>
    );
  }

  if (isLoading) {
    return (
      <StorefrontLayout>
        <div className="container mx-auto px-4 py-8">
          <div className="grid lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-4">
              {[1, 2, 3].map(i => <Shimmer key={i} className="h-32 rounded-xl" />)}
            </div>
            <Shimmer className="h-64 rounded-xl" />
          </div>
        </div>
      </StorefrontLayout>
    );
  }

  if (cartItems.length === 0) {
    return (
      <StorefrontLayout>
        <div className="container mx-auto px-4 py-16 text-center">
          <ShoppingBag className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
          <h1 className="text-2xl font-bold mb-2">Your cart is empty</h1>
          <p className="text-muted-foreground mb-6">Looks like you haven't added anything yet</p>
          <Button asChild className="rounded-xl"><Link to="/products">Continue Shopping</Link></Button>
        </div>
      </StorefrontLayout>
    );
  }

  const bundleGroups: Record<string, CartItemWithProduct[]> = {};
  const individualItems: CartItemWithProduct[] = [];
  cartItems.forEach(item => {
    if (item.bundle_id) {
      if (!bundleGroups[item.bundle_id]) bundleGroups[item.bundle_id] = [];
      bundleGroups[item.bundle_id].push(item);
    } else {
      individualItems.push(item);
    }
  });

  return (
    <StorefrontLayout>
      <div className="container mx-auto px-4 py-6 md:py-8">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-1.5 text-sm text-muted-foreground mb-4">
          <Link to="/" className="hover:text-primary">← Back</Link>
          <span>·</span>
          <span className="text-foreground">Cart</span>
        </nav>

        <h1 className="text-xl md:text-2xl font-bold mb-5">Shopping Cart ({totalItems})</h1>

        <div className="grid lg:grid-cols-3 gap-6 md:gap-8">
          {/* Cart Items - Cartsy card style */}
          <div className="lg:col-span-2 space-y-3">
            {/* Bundle groups */}
            {Object.entries(bundleGroups).map(([bundleId, items]) => {
              const bundleTotal = items.reduce((sum, item) => {
                const p = item.variant?.price || item.product.price;
                return sum + p * item.quantity;
              }, 0);
              const bundleName = items[0]?.bundle_name || 'Bundle Deal';
              const firstImage = items[0]?.product.images?.find(img => img.is_primary)?.image_url || items[0]?.product.images?.[0]?.image_url || '/placeholder.svg';

              return (
                <div key={bundleId} className="bg-card rounded-xl border border-primary/20 p-4">
                  <div className="flex gap-4">
                    <div className="w-20 h-20 md:w-24 md:h-24 bg-muted rounded-xl overflow-hidden flex-shrink-0 relative">
                      <img src={firstImage} alt={bundleName} className="w-full h-full object-cover" />
                      <Badge className="absolute top-1 left-1 text-[9px] px-1 py-0 rounded">Bundle</Badge>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-sm md:text-base">🎁 {bundleName}</h3>
                      <p className="text-xs text-muted-foreground mt-0.5">{items.length} items included</p>
                      <p className="text-xs text-muted-foreground mt-1">{items.map(i => i.product.name).join(' + ')}</p>
                      <div className="flex items-center gap-3 mt-2">
                        <span className="font-bold">₹{bundleTotal.toFixed(0)}</span>
                        <Button variant="ghost" size="sm" className="text-destructive text-xs h-7" onClick={() => {
                          for (const item of items) { removeItemMutation.mutate(item.id); }
                          toast({ title: 'Removed', description: 'Bundle removed from cart' });
                        }}>
                          <Trash2 className="h-3 w-3 mr-1" /> Remove
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Individual items - Cartsy style cards */}
            {individualItems.map((item) => {
              const primaryImage = item.product.images?.find(img => img.is_primary)?.image_url || item.product.images?.[0]?.image_url || '/placeholder.svg';
              const itemPrice = item.variant?.price || item.product.price;
              const itemOffer = getProductOffer(item.product);
              const effectivePrice = itemOffer?.discountedPrice ?? itemPrice;

              return (
                <div key={item.id} className="bg-card rounded-xl border border-border p-4">
                  <div className="flex gap-4">
                    <Link to={`/product/${item.product.slug}`} className="w-20 h-20 md:w-24 md:h-24 bg-muted rounded-xl overflow-hidden flex-shrink-0">
                      <img src={primaryImage} alt={item.product.name} className="w-full h-full object-cover" />
                    </Link>
                    <div className="flex-1 min-w-0">
                      <Link to={`/product/${item.product.slug}`}>
                        <h3 className="font-semibold text-sm md:text-base text-foreground hover:text-primary transition-colors line-clamp-1">{item.product.name}</h3>
                      </Link>
                      {item.variant && <Badge variant="outline" className="text-[10px] mt-0.5 rounded-full">{item.variant.name}</Badge>}

                      {/* Stock + shipping info like Cartsy */}
                      <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-xs text-muted-foreground">
                        <span className="text-green-600 font-medium">✓ In Stock</span>
                        <span className="flex items-center gap-1"><RefreshCw className="h-3 w-3" /> Free returns</span>
                        <span className="flex items-center gap-1"><Truck className="h-3 w-3" /> Free shipping</span>
                      </div>

                      <div className="flex items-center justify-between mt-2">
                        {/* Price */}
                        <div className="font-bold text-lg">
                          ₹{Number(effectivePrice * item.quantity).toFixed(0)}
                          {itemOffer && itemOffer.discountAmount > 0 && (
                            <Badge variant="destructive" className="ml-2 text-[10px] rounded-full">{itemOffer.discountLabel}</Badge>
                          )}
                        </div>

                        {/* Quantity control - pill style */}
                        <div className="flex items-center border border-border rounded-full overflow-hidden">
                          <Button variant="ghost" size="icon" className="h-7 w-7 rounded-none" onClick={() => updateQuantity(item.id, item.quantity - 1)} disabled={item.quantity <= 1}>
                            <Minus className="h-3 w-3" />
                          </Button>
                          <span className="w-8 text-center text-sm font-medium">{String(item.quantity).padStart(2, '0')}</span>
                          <Button variant="ghost" size="icon" className="h-7 w-7 rounded-none" onClick={() => updateQuantity(item.id, item.quantity + 1)} disabled={item.quantity >= item.product.stock_quantity}>
                            <Plus className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>

                      {/* Remove + Save actions */}
                      <div className="flex gap-3 mt-2 text-xs">
                        <button className="text-destructive hover:underline" onClick={() => removeItem(item.id)}>Remove</button>
                        <button className="text-muted-foreground hover:underline">Save</button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Order Summary + Cart Optimizer */}
          <div className="space-y-4">
            <CartValueOptimizer
              subtotal={subtotal}
              cartProductIds={cartItems.map(i => i.product_id || i.product?.id).filter(Boolean)}
            />

            {/* Available Coupons - Above Order Summary */}
            {cartCoupons.length > 0 && (
              <div className="bg-card rounded-xl border border-border p-4 space-y-3">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <Tag className="h-4 w-4 text-primary" />
                  Available Coupons
                </h3>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {cartCoupons.map((coupon) => (
                    <div key={coupon.id} className="flex items-center justify-between p-2.5 bg-accent/50 rounded-lg border border-dashed border-primary/30">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-sm text-primary">{coupon.code}</span>
                          <Badge variant="secondary" className="text-[10px] rounded-full">
                            {coupon.type === 'percentage' ? `${coupon.value}% OFF` : `₹${Math.round(coupon.value)} OFF`}
                          </Badge>
                        </div>
                        {coupon.description && <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">{coupon.description}</p>}
                        {coupon.min_order_value && <p className="text-[10px] text-muted-foreground">Min. order ₹{Math.round(coupon.min_order_value)}</p>}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs flex-shrink-0"
                        onClick={() => handleCopyCoupon(coupon)}
                      >
                        {copiedCouponId === coupon.id ? <Check className="h-3 w-3 mr-1" /> : <Copy className="h-3 w-3 mr-1" />}
                        {copiedCouponId === coupon.id ? 'Copied' : 'Copy'}
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="bg-card rounded-xl border border-border p-5 sticky top-24 space-y-4">
              <h2 className="text-lg font-bold">Order Summary</h2>

              {/* Coupon input */}
              <div>
                {appliedCoupon ? (
                  <div className="flex items-center justify-between p-2.5 bg-accent rounded-xl">
                    <span className="text-sm font-medium">{appliedCoupon.code}</span>
                    <Button variant="ghost" size="sm" className="text-xs h-7" onClick={removeCoupon}>Remove</Button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <Input
                      placeholder="Enter Coupon code"
                      value={couponCode}
                      onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                      className="text-sm rounded-xl"
                    />
                    <Button size="sm" onClick={applyCoupon} disabled={isApplyingCoupon} className="rounded-xl px-4">
                      Apply
                    </Button>
                  </div>
                )}
              </div>

              <Separator />

              <div className="space-y-2.5">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Sub Total ({totalItems} items)</span>
                  <span className="font-medium">₹{Math.round(subtotal)}</span>
                </div>
                {offerDiscount.totalDiscount > 0 && (
                  <div className="flex justify-between text-sm text-green-600">
                    <span>Offer Discount</span>
                    <span>-₹{Math.round(offerDiscount.totalDiscount)}</span>
                  </div>
                )}
                {couponDiscount > 0 && (
                  <div className="flex justify-between text-sm text-green-600">
                    <span>Coupon Discount</span>
                    <span>-₹{Math.round(couponDiscount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Delivery</span>
                  <span className={cn("font-medium", shippingCharge === 0 && "text-green-600")}>{shippingCharge === 0 ? 'Free' : `₹${Math.round(shippingCharge)}`}</span>
                </div>
                {shippingCharge > 0 && freeThreshold > 0 && subtotal < freeThreshold && (
                  <p className="text-xs text-muted-foreground">
                    Add ₹{Math.round(freeThreshold - subtotal)} more for free shipping
                  </p>
                )}
              </div>

              <Separator />

              <div className="flex justify-between font-bold text-lg">
                <span>Total</span>
                <span>₹{Math.round(total)}</span>
              </div>

              <Button className="w-full h-12 text-base font-semibold rounded-xl" onClick={() => navigate('/checkout')}>
                Checkout
              </Button>

              <Button variant="outline" className="w-full rounded-xl" asChild>
                <Link to="/products">Continue Shopping</Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </StorefrontLayout>
  );
}
