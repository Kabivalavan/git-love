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
import type { CartItem, Product, Coupon, ProductVariant } from '@/types/database';

interface CartItemWithProduct extends CartItem {
  product: Product;
  variant?: ProductVariant;
}

export default function CartPage() {
  const [cartItems, setCartItems] = useState<CartItemWithProduct[]>([]);
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<Coupon | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isApplyingCoupon, setIsApplyingCoupon] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();
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

    const { data: cart } = await supabase.from('cart').select('id').eq('user_id', user.id).single();
    if (cart) {
      const { data: items } = await supabase
        .from('cart_items')
        .select('*, product:products(*, images:product_images(*)), variant:product_variants(*)')
        .eq('cart_id', cart.id);
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
      if (couponData.min_order_value && subtotal < couponData.min_order_value) {
        toast({
          title: 'Minimum order not met',
          description: `Minimum order value is ₹${couponData.min_order_value}`,
          variant: 'destructive'
        });
      } else {
        setAppliedCoupon(couponData);
        toast({ title: 'Coupon applied', description: `Coupon ${couponData.code} applied successfully` });
      }
    }
    setIsApplyingCoupon(false);
  };

  const removeCoupon = () => {
    setAppliedCoupon(null);
    setCouponCode('');
  };

  const subtotal = cartItems.reduce((sum, item) => {
    const price = item.variant?.price || item.product.price;
    return sum + (price * item.quantity);
  }, 0);
  
  const discount = appliedCoupon
    ? appliedCoupon.type === 'percentage'
      ? Math.min((subtotal * appliedCoupon.value) / 100, appliedCoupon.max_discount || Infinity)
      : appliedCoupon.value
    : 0;

  const shippingCharge = subtotal >= 500 ? 0 : 50;
  const total = subtotal - discount + shippingCharge;

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

  return (
    <StorefrontLayout>
      <div className="container mx-auto px-4 py-6 md:py-8">
        <h1 className="text-xl md:text-2xl font-bold mb-4 md:mb-6">Shopping Cart ({totalItems} {totalItems === 1 ? 'item' : 'items'})</h1>

        <div className="grid lg:grid-cols-3 gap-6 md:gap-8">
          {/* Cart Items */}
          <div className="lg:col-span-2 space-y-3 md:space-y-4">
            {cartItems.map((item) => {
              const primaryImage = item.product.images?.find(img => img.is_primary)?.image_url
                || item.product.images?.[0]?.image_url
                || '/placeholder.svg';
              const itemPrice = item.variant?.price || item.product.price;
              const itemMrp = item.variant?.mrp || item.product.mrp;

              return (
                <Card key={item.id}>
                  <CardContent className="p-3 md:p-4">
                    <div className="flex gap-3 md:gap-4">
                      <Link to={`/product/${item.product.slug}`} className="w-20 h-20 md:w-24 md:h-24 bg-muted rounded-lg overflow-hidden flex-shrink-0">
                        <img src={primaryImage} alt={item.product.name} className="w-full h-full object-cover" />
                      </Link>
                      <div className="flex-1 min-w-0">
                        <Link to={`/product/${item.product.slug}`}>
                          <h3 className="font-medium text-sm md:text-base hover:text-primary transition-colors truncate">{item.product.name}</h3>
                        </Link>
                        {item.variant && (
                          <Badge variant="outline" className="text-[10px] mt-0.5">
                            Variant: {item.variant.name}
                          </Badge>
                        )}
                        <p className="text-sm text-muted-foreground mt-0.5">
                          {itemMrp && itemMrp > itemPrice && (
                            <span className="line-through mr-2">₹{Number(itemMrp).toFixed(0)}</span>
                          )}
                          <span className="font-semibold text-foreground">₹{Number(itemPrice).toFixed(0)}</span>
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
                            className="text-destructive hover:text-destructive text-xs h-7"
                            onClick={() => removeItem(item.id)}
                          >
                            <Trash2 className="h-3 w-3 mr-1" />
                            Remove
                          </Button>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="font-bold text-sm md:text-base">₹{(itemPrice * item.quantity).toFixed(0)}</p>
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
                  {discount > 0 && (
                    <div className="flex justify-between text-sm text-green-600">
                      <span>Discount</span>
                      <span>-₹{discount.toFixed(0)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Shipping</span>
                    <span>{shippingCharge === 0 ? 'Free' : `₹${shippingCharge}`}</span>
                  </div>
                  {shippingCharge > 0 && (
                    <p className="text-xs text-muted-foreground">
                      Add ₹{500 - subtotal} more for free shipping
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