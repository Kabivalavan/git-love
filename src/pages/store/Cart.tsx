import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Minus, Plus, Trash2, ShoppingBag, ArrowRight } from 'lucide-react';
import { StorefrontLayout } from '@/components/storefront/StorefrontLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { Shimmer } from '@/components/ui/shimmer';
import { useOffers } from '@/hooks/useOffers';
import type { CartItem, Product, Coupon, ProductVariant } from '@/types/database';

interface CartItemWithProduct extends CartItem {
  product: Product;
  variant?: ProductVariant;
  bundle_id?: string | null;
  bundle_name?: string | null;
}


export default function CartPage() {
  const [cartItems, setCartItems] = useState<CartItemWithProduct[]>([]);
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<Coupon | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isApplyingCoupon, setIsApplyingCoupon] = useState(false);
  const [checkoutSettings, setCheckoutSettings] = useState<{ free_shipping_threshold: number; default_shipping_charge: number }>({
    free_shipping_threshold: 500,
    default_shipping_charge: 50,
  });
  const { toast } = useToast();
  const { user } = useAuth();
  const { getProductOffer, calculateCartDiscount } = useOffers();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      fetchCart();
    } else {
      setIsLoading(false);
    }
  }, [user]);

  const fetchCart = async () => {
    if (!user) return;
    setIsLoading(true);

    const [cartRes, settingsRes] = await Promise.all([
      supabase.from('cart').select('id').eq('user_id', user.id).single(),
      supabase.from('store_settings').select('value').eq('key', 'checkout').single(),
    ]);

    if (settingsRes.data?.value) {
      const cs = settingsRes.data.value as any;
      setCheckoutSettings({
        free_shipping_threshold: cs.free_shipping_threshold ?? 500,
        default_shipping_charge: cs.default_shipping_charge ?? 50,
      });
    }

    if (cartRes.data) {
      const { data: items } = await supabase
        .from('cart_items')
        .select('*, product:products(*, images:product_images(*)), variant:product_variants(*)')
        .eq('cart_id', cartRes.data.id);
      setCartItems((items || []) as CartItemWithProduct[]);
    }
    setIsLoading(false);
  };

  const updateQuantity = async (itemId: string, newQuantity: number) => {
    if (newQuantity < 1) return;

    const item = cartItems.find(i => i.id === itemId);
    if (!item || newQuantity > item.product.stock_quantity) {
      toast({ title: 'Error', description: 'Not enough stock available', variant: 'destructive' });
      return;
    }

    await supabase.from('cart_items').update({ quantity: newQuantity }).eq('id', itemId);
    setCartItems(cartItems.map(i => i.id === itemId ? { ...i, quantity: newQuantity } : i));
  };

  const removeItem = async (itemId: string) => {
    await supabase.from('cart_items').delete().eq('id', itemId);
    setCartItems(cartItems.filter(i => i.id !== itemId));
    toast({ title: 'Removed', description: 'Item removed from cart' });
  };

  const applyCoupon = async () => {
    if (!couponCode.trim()) return;
    setIsApplyingCoupon(true);

    const now = new Date().toISOString();
    const { data: coupon, error } = await supabase
      .from('coupons')
      .select('*')
      .eq('code', couponCode.toUpperCase())
      .eq('is_active', true)
      .single();

    if (error || !coupon) {
      toast({ title: 'Invalid coupon', description: 'This coupon code is not valid', variant: 'destructive' });
    } else {
      const couponData = coupon as unknown as Coupon;
      // Check expiry
      if (couponData.end_date && new Date(couponData.end_date) < new Date()) {
        toast({ title: 'Coupon expired', description: 'This coupon has expired', variant: 'destructive' });
      } else if (couponData.min_order_value && subtotal < couponData.min_order_value) {
        toast({
          title: 'Minimum order not met',
          description: `Minimum order value is ₹${couponData.min_order_value}`,
          variant: 'destructive'
        });
      } else {
        setAppliedCoupon(couponData);
        localStorage.setItem('applied_coupon', JSON.stringify(couponData));
        toast({ title: 'Coupon applied', description: `Coupon ${couponData.code} applied successfully` });
      }
    }
    setIsApplyingCoupon(false);
  };

  const removeCoupon = () => {
    setAppliedCoupon(null);
    setCouponCode('');
    localStorage.removeItem('applied_coupon');
  };

  const subtotal = cartItems.reduce((sum, item) => {
    const price = item.variant?.price || item.product.price;
    return sum + (price * item.quantity);
  }, 0);

  // Calculate offer discounts
  const offerDiscount = calculateCartDiscount(
    cartItems.map(item => ({ product: item.product, quantity: item.quantity }))
  );
  
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
          <Button asChild>
            <Link to="/auth">Login to Continue</Link>
          </Button>
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
              {[1, 2, 3].map(i => <Shimmer key={i} className="h-32" />)}
            </div>
            <Shimmer className="h-64" />
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
          <p className="text-muted-foreground mb-6">Looks like you haven't added anything to your cart yet</p>
          <Button asChild>
            <Link to="/products">Continue Shopping</Link>
          </Button>
        </div>
      </StorefrontLayout>
    );
  }

  // Group items: bundles together, individual items separate
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
        <h1 className="text-xl md:text-2xl font-bold mb-4 md:mb-6">Shopping Cart ({totalItems} {totalItems === 1 ? 'item' : 'items'})</h1>

        <div className="grid lg:grid-cols-3 gap-6 md:gap-8">
          {/* Cart Items */}
          <div className="lg:col-span-2 space-y-3 md:space-y-4">
            {/* Bundle groups - unified display */}
            {Object.entries(bundleGroups).map(([bundleId, items]) => {
              const bundleTotal = items.reduce((sum, item) => {
                const p = item.variant?.price || item.product.price;
                return sum + p * item.quantity;
              }, 0);
              const bundleName = items[0]?.bundle_name || 'Bundle Deal';
              const firstImage = items[0]?.product.images?.find(img => img.is_primary)?.image_url
                || items[0]?.product.images?.[0]?.image_url
                || '/placeholder.svg';

              return (
                <Card key={bundleId} className="border-primary/30 bg-primary/5">
                  <CardContent className="p-3 md:p-4">
                    <div className="flex gap-3 md:gap-4">
                      <div className="w-20 h-20 md:w-24 md:h-24 bg-muted rounded-lg overflow-hidden flex-shrink-0 relative">
                        <img src={firstImage} alt={bundleName} className="w-full h-full object-cover" />
                        <div className="absolute top-1 left-1">
                          <Badge className="bg-primary text-[9px] px-1 py-0">Bundle</Badge>
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-sm md:text-base">{'🎁'} {bundleName}</h3>
                        <p className="text-xs text-muted-foreground mt-0.5">{items.length} items included</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {items.map(i => i.product.name).join(' + ')}
                        </p>
                        <div className="mt-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive text-xs h-7"
                            onClick={async () => {
                              for (const item of items) {
                                await supabase.from('cart_items').delete().eq('id', item.id);
                              }
                              setCartItems(cartItems.filter(i => i.bundle_id !== bundleId));
                              toast({ title: 'Removed', description: 'Bundle removed from cart' });
                            }}
                          >
                            <Trash2 className="h-3 w-3 mr-1" />
                            Remove Bundle
                          </Button>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="font-bold text-sm md:text-base">₹{bundleTotal.toFixed(0)}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}

            {/* Individual items */}
            {individualItems.map((item) => {
              const primaryImage = item.product.images?.find(img => img.is_primary)?.image_url
                || item.product.images?.[0]?.image_url
                || '/placeholder.svg';
              const itemPrice = item.variant?.price || item.product.price;
              const itemMrp = item.variant?.mrp || item.product.mrp;
              const itemOffer = getProductOffer(item.product);
              const effectivePrice = itemOffer?.discountedPrice ?? itemPrice;

              return (
                <Card key={item.id}>
                  <CardContent className="p-3 md:p-4">
                    <div className="flex gap-3 md:gap-4">
                      <Link to={`/product/${item.product.slug}`} className="w-20 h-20 md:w-24 md:h-24 bg-muted rounded-lg overflow-hidden flex-shrink-0">
                        <img src={primaryImage} alt={item.product.name} className="w-full h-full object-cover" />
                      </Link>
                      <div className="flex-1 min-w-0">
                        <Link to={`/product/${item.product.slug}`}>
                          <h3 className="font-medium text-sm md:text-base truncate">{item.product.name}</h3>
                        </Link>
                        {item.variant && (
                          <Badge variant="outline" className="text-[10px] mt-0.5">
                            {item.variant.name}
                          </Badge>
                        )}
                        <p className="text-sm text-muted-foreground mt-0.5">
                          {(itemOffer && itemOffer.discountAmount > 0) ? (
                            <>
                              <span className="line-through mr-2">₹{Number(itemPrice).toFixed(0)}</span>
                              <span className="font-semibold text-foreground">₹{Number(effectivePrice).toFixed(0)}</span>
                              <Badge variant="destructive" className="ml-2 text-[10px]">{itemOffer.discountLabel}</Badge>
                            </>
                          ) : (
                            <>
                              {itemMrp && itemMrp > itemPrice && (
                                <span className="line-through mr-2">₹{Number(itemMrp).toFixed(0)}</span>
                              )}
                              <span className="font-semibold text-foreground">₹{Number(itemPrice).toFixed(0)}</span>
                            </>
                          )}
                        </p>
                        <div className="flex items-center gap-3 md:gap-4 mt-2">
                          <div className="flex items-center border rounded-md">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 md:h-8 md:w-8"
                              onClick={() => updateQuantity(item.id, item.quantity - 1)}
                              disabled={item.quantity <= 1}
                            >
                              <Minus className="h-3 w-3" />
                            </Button>
                            <span className="w-8 md:w-10 text-center text-sm">{item.quantity}</span>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 md:h-8 md:w-8"
                              onClick={() => updateQuantity(item.id, item.quantity + 1)}
                              disabled={item.quantity >= item.product.stock_quantity}
                            >
                              <Plus className="h-3 w-3" />
                            </Button>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive text-xs h-7"
                            onClick={() => removeItem(item.id)}
                          >
                            <Trash2 className="h-3 w-3 mr-1" />
                            Remove
                          </Button>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="font-bold text-sm md:text-base">₹{(effectivePrice * item.quantity).toFixed(0)}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Order Summary */}
          <div>
            <Card className="sticky top-24">
              <CardHeader className="pb-3">
                <CardTitle className="text-base md:text-lg">Order Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Coupon */}
                <div>
                  <label className="text-sm font-medium">Have a coupon?</label>
                  {appliedCoupon ? (
                    <div className="flex items-center justify-between mt-2 p-2 bg-accent rounded-md">
                      <span className="text-sm font-medium">{appliedCoupon.code}</span>
                      <Button variant="ghost" size="sm" onClick={removeCoupon}>Remove</Button>
                    </div>
                  ) : (
                    <div className="flex gap-2 mt-2">
                      <Input
                        placeholder="Enter coupon code"
                        value={couponCode}
                        onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                        className="text-sm"
                      />
                      <Button variant="secondary" size="sm" onClick={applyCoupon} disabled={isApplyingCoupon}>
                        Apply
                      </Button>
                    </div>
                  )}
                </div>

                <Separator />

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Subtotal ({totalItems} items)</span>
                    <span>₹{subtotal.toFixed(0)}</span>
                  </div>
                  {offerDiscount.totalDiscount > 0 && (
                    <div className="flex justify-between text-sm text-green-600">
                      <span>Offer Discount</span>
                      <span>-₹{offerDiscount.totalDiscount.toFixed(0)}</span>
                    </div>
                  )}
                  {couponDiscount > 0 && (
                    <div className="flex justify-between text-sm text-green-600">
                      <span>Coupon Discount</span>
                      <span>-₹{couponDiscount.toFixed(0)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Shipping</span>
                    <span>{shippingCharge === 0 ? 'Free' : `₹${shippingCharge}`}</span>
                  </div>
                  {shippingCharge > 0 && freeThreshold > 0 && subtotal < freeThreshold && (
                    <p className="text-xs text-muted-foreground">
                      Add ₹{freeThreshold - subtotal} more for free shipping
                    </p>
                  )}
                </div>

                <Separator />

                <div className="flex justify-between font-bold text-base md:text-lg">
                  <span>Total</span>
                  <span>₹{total.toFixed(0)}</span>
                </div>

                <Button className="w-full" size="lg" onClick={() => navigate('/checkout')}>
                  Proceed to Checkout
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>

                <Button variant="outline" className="w-full" asChild>
                  <Link to="/products">Continue Shopping</Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </StorefrontLayout>
  );
}