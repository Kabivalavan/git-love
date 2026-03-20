import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CreditCard, Truck, MapPin, Plus, Loader2, Clock } from 'lucide-react';
import { StorefrontLayout } from '@/components/storefront/StorefrontLayout';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useRazorpay } from '@/hooks/useRazorpay';
import { useAnalytics } from '@/hooks/useAnalytics';
import { useGlobalStore } from '@/hooks/useGlobalStore';
import type { Address, CartItem, Product, PaymentMethod, CheckoutSettings, Coupon } from '@/types/database';

interface CartItemWithProduct extends CartItem {
  product: Product;
  variant?: any;
  bundle_id?: string | null;
  bundle_name?: string | null;
}

const CHECKOUT_HOLD_WINDOW_MS = 2 * 60 * 1000;
const HOLD_EXPIRY_STORAGE_KEY = 'checkout_hold_expires_at';

function CheckoutTimer({ expiresAt }: { expiresAt: number }) {
  const [remaining, setRemaining] = useState(Math.max(0, expiresAt - Date.now()));

  useEffect(() => {
    const interval = setInterval(() => {
      setRemaining(Math.max(0, expiresAt - Date.now()));
    }, 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  const totalSec = Math.ceil(remaining / 1000);
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
  const isLow = totalSec <= 30;

  return (
    <div className={cn(
      "flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-mono font-semibold border",
      isLow
        ? "bg-destructive/10 border-destructive/30 text-destructive animate-pulse"
        : "bg-accent border-border text-foreground"
    )}>
      <Clock className="h-4 w-4" />
      <span>{String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}</span>
    </div>
  );
}

export default function CheckoutPage() {
  const [cartItems, setCartItems] = useState<CartItemWithProduct[]>([]);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [selectedAddress, setSelectedAddress] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cod');
  const [isLoading, setIsLoading] = useState(true);
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const dataLoadedRef = useRef(false);
  const [appliedCoupon, setAppliedCoupon] = useState<Coupon | null>(null);
  const [checkoutSettings, setCheckoutSettings] = useState<CheckoutSettings>({
    cod_enabled: true,
    min_order_value: 0,
    free_shipping_threshold: 500,
    default_shipping_charge: 50,
  });
  const [isAddressDialogOpen, setIsAddressDialogOpen] = useState(false);
  const [isSavingAddress, setIsSavingAddress] = useState(false);
  const [holdExpiresAt, setHoldExpiresAt] = useState<number | null>(null);
  const holdExpiryHandledRef = useRef(false);
  const [newAddress, setNewAddress] = useState({
    full_name: '',
    mobile_number: '',
    address_line1: '',
    address_line2: '',
    city: '',
    state: '',
    pincode: '',
    landmark: '',
  });
  const { toast } = useToast();
  const { user, profile } = useAuth();
  const { initiatePayment, isLoading: isPaymentLoading } = useRazorpay();
  const { trackEvent } = useAnalytics();
  const { calculateCartDiscount } = useGlobalStore();
  const navigate = useNavigate();

  const isBlocked = profile?.is_blocked === true;

  const holdItems = useMemo(
    () =>
      cartItems.map((item) => ({
        product_id: item.product_id,
        variant_id: item.variant_id || null,
        quantity: item.quantity,
      })),
    [cartItems],
  );

  const holdSignature = useMemo(
    () => holdItems.map((item) => `${item.product_id}:${item.variant_id ?? 'none'}:${item.quantity}`).sort().join('|'),
    [holdItems],
  );

  const releaseActiveCheckoutHold = useCallback(async () => {
    if (!user) return;
    await supabase.rpc('release_stock_hold', { p_user_id: user.id });
  }, [user]);

  useEffect(() => {
    if (user) {
      // Skip re-fetching if data was already loaded (e.g. returning from an external tab)
      if (!dataLoadedRef.current) {
        fetchData();
      }
      // Load and validate coupon from cart
      const savedCoupon = localStorage.getItem('applied_coupon');
      if (savedCoupon) {
        try {
          const coupon = JSON.parse(savedCoupon) as Coupon;
          if (coupon.end_date && new Date(coupon.end_date) < new Date()) {
            localStorage.removeItem('applied_coupon');
          } else {
            // Validate coupon still exists and is active in DB
            supabase
              .from('coupons')
              .select('*')
              .eq('id', coupon.id)
              .eq('is_active', true)
              .single()
              .then(({ data, error }) => {
                if (error || !data) {
                  localStorage.removeItem('applied_coupon');
                  setAppliedCoupon(null);
                } else {
                  const validCoupon = data as unknown as Coupon;
                  if (validCoupon.end_date && new Date(validCoupon.end_date) < new Date()) {
                    localStorage.removeItem('applied_coupon');
                    setAppliedCoupon(null);
                  } else {
                    setAppliedCoupon(validCoupon);
                  }
                }
              });
          }
        } catch {
          localStorage.removeItem('applied_coupon');
        }
      }
    } else {
      navigate('/auth');
    }
  }, [user, navigate]);

  // Place stock hold when cart items load and release it when user leaves checkout
  // Persist expiry in localStorage so external tab switches don't reset the timer
  useEffect(() => {
    if (!user || holdItems.length === 0) return;

    let isCancelled = false;
    holdExpiryHandledRef.current = false;

    const reserveStockForCheckout = async () => {
      // Check if a valid hold already exists from a previous mount (e.g. tab switch)
      const storedExpiry = localStorage.getItem(HOLD_EXPIRY_STORAGE_KEY);
      if (storedExpiry) {
        const expiry = parseInt(storedExpiry, 10);
        if (expiry > Date.now()) {
          // Still valid — resume the existing timer
          if (!isCancelled) setHoldExpiresAt(expiry);
          return;
        } else {
          // Expired while away
          localStorage.removeItem(HOLD_EXPIRY_STORAGE_KEY);
        }
      }

      const { data, error } = await supabase.rpc('place_stock_hold', {
        p_user_id: user.id,
        p_items: holdItems as any,
      });

      if (isCancelled) return;

      if (error || (data && !(data as any).success)) {
        toast({
          title: 'Stock unavailable',
          description: 'Some items are out of stock. Please update your cart.',
          variant: 'destructive',
        });
        navigate('/cart');
        return;
      }

      const expiry = Date.now() + CHECKOUT_HOLD_WINDOW_MS;
      localStorage.setItem(HOLD_EXPIRY_STORAGE_KEY, String(expiry));
      setHoldExpiresAt(expiry);
    };

    void reserveStockForCheckout();

    // Only release hold on unmount if navigating INTERNALLY (not tab switch)
    // We detect this: if document is visible at unmount time, user navigated away internally
    return () => {
      isCancelled = true;
      if (document.visibilityState === 'visible') {
        // Internal navigation — release hold
        setHoldExpiresAt(null);
        localStorage.removeItem(HOLD_EXPIRY_STORAGE_KEY);
        void releaseActiveCheckoutHold();
      }
      // If hidden (tab switch / external), keep the hold alive
    };
  }, [user, holdItems, holdSignature, navigate, releaseActiveCheckoutHold, toast]);

  // Expire checkout strictly after 2 minutes and send user back to cart
  useEffect(() => {
    if (!user || !holdExpiresAt) return;

    const interval = window.setInterval(() => {
      if (isPlacingOrder || holdExpiryHandledRef.current) return;
      if (Date.now() < holdExpiresAt) return;

      holdExpiryHandledRef.current = true;
      setHoldExpiresAt(null);
      localStorage.removeItem(HOLD_EXPIRY_STORAGE_KEY);

      void (async () => {
        await releaseActiveCheckoutHold();
        toast({
          title: 'Checkout expired',
          description: 'Your checkout has expired after 2 minutes. Please review your cart again.',
          variant: 'destructive',
        });
        navigate('/cart');
      })();
    }, 1000);

    return () => window.clearInterval(interval);
  }, [user, holdExpiresAt, isPlacingOrder, navigate, releaseActiveCheckoutHold, toast]);

  // Track checkout_started when cart items load
  useEffect(() => {
    if (cartItems.length > 0) {
      const subtotal = cartItems.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
      trackEvent('checkout_started', {
        metadata: {
          cart_value: subtotal,
          items_count: cartItems.length,
        },
      });
    }
  }, [cartItems.length > 0, trackEvent]);

  const fetchData = async () => {
    if (!user) return;
    setIsLoading(true);

    const { data: cart } = await supabase.from('cart').select('id').eq('user_id', user.id).single();
    if (cart) {
      const { data: items } = await supabase
        .from('cart_items')
        .select('*, product:products(*), variant:product_variants(*), bundle_id, bundle_name')
        .eq('cart_id', cart.id);
      setCartItems((items || []) as CartItemWithProduct[]);

    }

    const { data: addressesData } = await supabase
      .from('addresses')
      .select('*')
      .eq('user_id', user.id)
      .order('is_default', { ascending: false });
    const addressList = (addressesData || []) as Address[];
    setAddresses(addressList);
    if (addressList.length > 0) {
      setSelectedAddress(addressList.find(a => a.is_default)?.id || addressList[0].id);
    }

    const { data: settingsData } = await supabase
      .from('store_settings')
      .select('value')
      .eq('key', 'checkout')
      .single();
    if (settingsData?.value) {
      const cs = settingsData.value as unknown as CheckoutSettings;
      setCheckoutSettings(cs);
      if (!cs.cod_enabled && paymentMethod === 'cod') {
        setPaymentMethod('online');
      }
    }

    setIsLoading(false);
  };

  const getAvailableStockForItem = (item: CartItemWithProduct) => {
    const variantStock = item.variant?.stock_quantity ?? null;
    const variantInHold = (item.variant as any)?.in_hold ?? 0;
    const productStock = item.product.stock_quantity ?? 0;
    const productInHold = (item.product as any)?.in_hold ?? 0;

    const baseAvailable = item.variant_id && variantStock !== null
      ? Math.max(0, Number(variantStock) - Number(variantInHold))
      : Math.max(0, Number(productStock) - Number(productInHold));

    // Include this cart row's own reserved qty to avoid false negatives after hold placement
    return Math.max(0, baseAvailable + Number(item.quantity || 0));
  };

  const getQuantityIssues = () =>
    cartItems
      .map((item) => ({
        name: item.bundle_name || item.product.name,
        requested: Number(item.quantity || 0),
        available: getAvailableStockForItem(item),
      }))
      .filter((entry) => entry.requested > entry.available);

  const handleAddAddress = async () => {
    if (!user) return;
    setIsSavingAddress(true);
    
    const { data, error } = await supabase
      .from('addresses')
      .insert({ ...newAddress, user_id: user.id, is_default: addresses.length === 0 })
      .select()
      .single();

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      const newAddr = data as unknown as Address;
      setAddresses([...addresses, newAddr]);
      setSelectedAddress(newAddr.id);
      setIsAddressDialogOpen(false);
      setNewAddress({
        full_name: '',
        mobile_number: '',
        address_line1: '',
        address_line2: '',
        city: '',
        state: '',
        pincode: '',
        landmark: '',
      });
      toast({ title: 'Success', description: 'Address added successfully' });
    }
    setIsSavingAddress(false);
  };

  const placeOrder = async () => {
    if (!user || !selectedAddress || cartItems.length === 0) return;

    const quantityIssues = getQuantityIssues();
    if (quantityIssues.length > 0) {
      toast({
        title: 'Quantity exceeds stock',
        description: quantityIssues
          .slice(0, 2)
          .map((issue) => `${issue.name}: only ${issue.available} available`)
          .join(' | '),
        variant: 'destructive',
      });
      return;
    }
    
    const address = addresses.find(a => a.id === selectedAddress);
    if (!address) return;

    setIsPlacingOrder(true);

    try {
      const holdItems = cartItems.map((item) => ({
        product_id: item.product_id,
        variant_id: item.variant_id || null,
        quantity: item.quantity,
      }));

      const { data: holdResult, error: holdError } = await supabase.rpc('place_stock_hold', {
        p_user_id: user.id,
        p_items: holdItems as any,
      });

      if (holdError || (holdResult && !(holdResult as any).success)) {
        toast({
          title: 'Stock hold failed',
          description: 'Some products are no longer available in requested quantity.',
          variant: 'destructive',
        });
        navigate('/cart');
        setIsPlacingOrder(false);
        return;
      }

      const { data: orderNumberData } = await supabase.rpc('generate_order_number');
      const orderNumber = orderNumberData || `ORD${Date.now()}`;

      const subtotal = cartItems.reduce((sum, item) => sum + ((item.variant?.price ?? item.product.price) * item.quantity), 0);
      const orderOfferDiscount = calculateCartDiscount(
        cartItems.map(item => ({ product: item.product, quantity: item.quantity }))
      );
      const orderCouponDiscount = appliedCoupon
        ? appliedCoupon.type === 'percentage'
          ? Math.min((subtotal * appliedCoupon.value) / 100, appliedCoupon.max_discount || Infinity)
          : appliedCoupon.value
        : 0;
      const orderTotalDiscount = orderOfferDiscount.totalDiscount + orderCouponDiscount;
      const freeThreshold = checkoutSettings.free_shipping_threshold;
      const defaultShipping = checkoutSettings.default_shipping_charge;
      const shippingCharge = (freeThreshold > 0 && subtotal >= freeThreshold) ? 0 : defaultShipping;
      const total = subtotal - orderTotalDiscount + shippingCharge;

      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({
          order_number: orderNumber,
          user_id: user.id,
          status: 'new',
          payment_status: 'pending',
          payment_method: paymentMethod,
          subtotal,
          discount: orderTotalDiscount,
          coupon_id: appliedCoupon?.id || null,
          coupon_code: appliedCoupon?.code || null,
          tax: 0,
          shipping_charge: shippingCharge,
          total,
          shipping_address: {
            full_name: address.full_name,
            mobile_number: address.mobile_number,
            address_line1: address.address_line1,
            address_line2: address.address_line2,
            city: address.city,
            state: address.state,
            pincode: address.pincode,
            landmark: address.landmark,
          },
        })
        .select()
        .single();

      if (orderError) throw orderError;

      const orderItems = cartItems.map(item => {
        const effectivePrice = item.variant?.price ?? item.product.price;
        const effectiveSku = item.variant?.sku ?? item.product.sku;
        const variantName = item.variant?.name ?? null;
        return {
          order_id: order.id,
          product_id: item.product_id,
          variant_id: item.variant_id,
          product_name: item.product.name,
          variant_name: variantName,
          sku: effectiveSku,
          price: effectivePrice,
          quantity: item.quantity,
          total: effectivePrice * item.quantity,
          bundle_id: item.bundle_id ?? null,
          bundle_name: item.bundle_name ?? null,
        };
      });

      await supabase.from('order_items').insert(orderItems);

      // Link current holds to this order so stock finalization/release remains aligned
      await supabase
        .from('stock_holds')
        .update({ order_id: order.id })
        .eq('user_id', user.id)
        .is('order_id', null);

      await supabase.from('deliveries').insert({
        order_id: order.id,
        status: 'pending',
        is_cod: paymentMethod === 'cod',
        cod_amount: paymentMethod === 'cod' ? total : null,
        delivery_charge: shippingCharge,
      });

      if (paymentMethod === 'cod') {
        await supabase.from('payments').insert({
          order_id: order.id,
          amount: total,
          method: 'cod',
          status: 'pending',
        });

        // Track order completed
        trackEvent('order_completed', {
          metadata: {
            order_id: order.id,
            order_number: orderNumber,
            total_amount: total,
            payment_mode: 'cod',
            items_count: cartItems.length,
          },
        });

        await clearCartAndRedirect(orderNumber);
      } else if (paymentMethod === 'online') {
        initiatePayment({
          amount: total,
          orderId: order.id,
          orderNumber: orderNumber,
          customerName: address.full_name,
          customerEmail: user.email || undefined,
          customerPhone: address.mobile_number,
          onSuccess: async () => {
            trackEvent('order_completed', {
              metadata: {
                order_id: order.id,
                order_number: orderNumber,
                total_amount: total,
                payment_mode: 'online',
                items_count: cartItems.length,
              },
            });
            await clearCartAndRedirect(orderNumber);
          },
          onFailure: async (error) => {
            await supabase
              .from('orders')
              .update({ payment_status: 'failed' })
              .eq('id', order.id);

            // Release linked hold if payment fails
            await supabase.rpc('release_stock_hold', {
              p_user_id: user.id,
              p_order_id: order.id,
            });
            
            trackEvent('payment_failed', {
              metadata: { order_id: order.id, error: error || 'unknown' },
            });

            toast({ 
              title: 'Payment Failed', 
              description: error || 'Please try again or choose a different payment method', 
              variant: 'destructive' 
            });
            setIsPlacingOrder(false);
          },
        });
        return;
      }
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Failed to place order', variant: 'destructive' });
      setIsPlacingOrder(false);
    }
  };

  const clearCartAndRedirect = async (orderNumber: string) => {
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('id')
      .eq('user_id', user!.id)
      .single();

    if (!existingProfile) {
      const address = addresses.find(a => a.id === selectedAddress);
      if (address) {
        await supabase.from('profiles').insert({
          user_id: user!.id,
          full_name: address.full_name,
          mobile_number: address.mobile_number,
          email: user!.email,
        });
      }
    }

    const { data: cart } = await supabase.from('cart').select('id').eq('user_id', user!.id).single();
    if (cart) {
      await supabase.from('cart_items').delete().eq('cart_id', cart.id);
    }

    // Clear coupon and hold timer from localStorage
    localStorage.removeItem('applied_coupon');
    localStorage.removeItem(HOLD_EXPIRY_STORAGE_KEY);

    toast({ title: 'Order placed!', description: `Order #${orderNumber} has been placed successfully` });
    setIsPlacingOrder(false);
    navigate(`/order-success?order=${orderNumber}`);
  };

  if (isLoading) {
    return (
      <StorefrontLayout>
        <div className="container mx-auto px-4 py-8">
          <Skeleton className="h-8 w-40 mb-6" />
          <div className="grid lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              <Card><CardHeader><Skeleton className="h-6 w-40" /></CardHeader><CardContent className="space-y-3"><Skeleton className="h-20 w-full" /><Skeleton className="h-20 w-full" /></CardContent></Card>
              <Card><CardHeader><Skeleton className="h-6 w-40" /></CardHeader><CardContent className="space-y-3"><Skeleton className="h-16 w-full" /><Skeleton className="h-16 w-full" /></CardContent></Card>
            </div>
            <Card><CardHeader><Skeleton className="h-6 w-32" /></CardHeader><CardContent className="space-y-4"><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-full" /><Skeleton className="h-10 w-full" /></CardContent></Card>
          </div>
        </div>
      </StorefrontLayout>
    );
  }

  if (cartItems.length === 0) {
    navigate('/cart');
    return null;
  }

  const subtotal = cartItems.reduce((sum, item) => sum + ((item.variant?.price ?? item.product.price) * item.quantity), 0);
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
  const quantityIssues = getQuantityIssues();

  return (
    <StorefrontLayout>
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">Checkout</h1>
          {holdExpiresAt && !isPlacingOrder && <CheckoutTimer expiresAt={holdExpiresAt} />}
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            {/* Shipping Address */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="h-5 w-5" />
                  Shipping Address
                </CardTitle>
                <Dialog open={isAddressDialogOpen} onOpenChange={setIsAddressDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm">
                      <Plus className="h-4 w-4 mr-1" />
                      Add New
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>Add New Address</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 mt-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>Full Name *</Label>
                          <Input value={newAddress.full_name} onChange={(e) => setNewAddress({ ...newAddress, full_name: e.target.value })} />
                        </div>
                        <div>
                          <Label>Mobile Number *</Label>
                          <Input value={newAddress.mobile_number} onChange={(e) => setNewAddress({ ...newAddress, mobile_number: e.target.value })} />
                        </div>
                      </div>
                      <div>
                        <Label>Address Line 1 *</Label>
                        <Input value={newAddress.address_line1} onChange={(e) => setNewAddress({ ...newAddress, address_line1: e.target.value })} />
                      </div>
                      <div>
                        <Label>Address Line 2</Label>
                        <Input value={newAddress.address_line2} onChange={(e) => setNewAddress({ ...newAddress, address_line2: e.target.value })} />
                      </div>
                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <Label>City *</Label>
                          <Input value={newAddress.city} onChange={(e) => setNewAddress({ ...newAddress, city: e.target.value })} />
                        </div>
                        <div>
                          <Label>State *</Label>
                          <Input value={newAddress.state} onChange={(e) => setNewAddress({ ...newAddress, state: e.target.value })} />
                        </div>
                        <div>
                          <Label>Pincode *</Label>
                          <Input value={newAddress.pincode} onChange={(e) => setNewAddress({ ...newAddress, pincode: e.target.value })} />
                        </div>
                      </div>
                      <div>
                        <Label>Landmark</Label>
                        <Input value={newAddress.landmark} onChange={(e) => setNewAddress({ ...newAddress, landmark: e.target.value })} />
                      </div>
                      <Button className="w-full" onClick={handleAddAddress} disabled={isSavingAddress}>
                        {isSavingAddress ? (<><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving...</>) : 'Save Address'}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent>
                {addresses.length === 0 ? (
                  <p className="text-muted-foreground">No addresses saved. Please add a new address.</p>
                ) : (
                  <RadioGroup value={selectedAddress} onValueChange={setSelectedAddress}>
                    <div className="space-y-3">
                      {addresses.map((addr) => (
                        <div key={addr.id} className="flex items-start gap-3">
                          <RadioGroupItem value={addr.id} id={addr.id} className="mt-1" />
                          <Label htmlFor={addr.id} className="flex-1 cursor-pointer">
                            <div className="p-3 border rounded-lg hover:border-primary transition-colors">
                              <p className="font-medium">{addr.full_name}</p>
                              <p className="text-sm text-muted-foreground">
                                {addr.address_line1}, {addr.address_line2 && `${addr.address_line2}, `}
                                {addr.city}, {addr.state} - {addr.pincode}
                              </p>
                              <p className="text-sm text-muted-foreground">Phone: {addr.mobile_number}</p>
                            </div>
                          </Label>
                        </div>
                      ))}
                    </div>
                  </RadioGroup>
                )}
              </CardContent>
            </Card>

            {/* Payment Method */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5" />
                  Payment Method
                </CardTitle>
              </CardHeader>
              <CardContent>
                <RadioGroup value={paymentMethod} onValueChange={(val) => setPaymentMethod(val as PaymentMethod)}>
                  <div className="space-y-3">
                    {checkoutSettings.cod_enabled && (
                      <div className="flex items-center gap-3">
                        <RadioGroupItem value="cod" id="cod" />
                        <Label htmlFor="cod" className="flex-1 cursor-pointer">
                          <div className="p-3 border rounded-lg hover:border-primary transition-colors">
                            <p className="font-medium">Cash on Delivery</p>
                            <p className="text-sm text-muted-foreground">Pay when you receive your order</p>
                          </div>
                        </Label>
                      </div>
                    )}
                    <div className="flex items-center gap-3">
                      <RadioGroupItem value="online" id="online" />
                      <Label htmlFor="online" className="flex-1 cursor-pointer">
                        <div className="p-3 border rounded-lg hover:border-primary transition-colors">
                          <p className="font-medium">Online Payment</p>
                          <p className="text-sm text-muted-foreground">Pay securely with Razorpay (UPI, Cards, Netbanking)</p>
                        </div>
                      </Label>
                    </div>
                  </div>
                </RadioGroup>
              </CardContent>
            </Card>
          </div>

          {/* Order Summary */}
          <div>
            <Card className="sticky top-24">
              <CardHeader>
                <CardTitle>Order Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3 max-h-64 overflow-y-auto">
                  {(() => {
                    // Group bundle items together
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
                      <>
                        {Object.entries(bundleGroups).map(([bundleId, items]) => {
                          const bundleTotal = items.reduce((s, i) => s + (i.variant?.price ?? i.product.price) * i.quantity, 0);
                          return (
                            <div key={bundleId} className="flex justify-between text-sm gap-2">
                              <div className="flex-1 min-w-0">
                                <p className="truncate font-medium">{'🎁'} {items[0]?.bundle_name || 'Bundle Deal'}</p>
                                <p className="text-xs text-muted-foreground">{items.length} items</p>
                              </div>
                              <span className="font-medium flex-shrink-0">₹{bundleTotal.toFixed(0)}</span>
                            </div>
                          );
                        })}
                        {individualItems.map((item) => {
                          const effectivePrice = item.variant?.price ?? item.product.price;
                          return (
                            <div key={item.id} className="flex justify-between text-sm gap-2">
                              <div className="flex-1 min-w-0">
                                <p className="truncate font-medium">{item.product.name}</p>
                                {item.variant && (
                                  <p className="text-xs text-muted-foreground">{item.variant.name}{item.variant.sku ? ` · ${item.variant.sku}` : ''}</p>
                                )}
                                <p className="text-xs text-muted-foreground">₹{effectivePrice} × {item.quantity}</p>
                              </div>
                              <span className="font-medium flex-shrink-0">₹{(effectivePrice * item.quantity).toFixed(0)}</span>
                            </div>
                          );
                        })}
                      </>
                    );
                  })()}
                </div>

                <Separator />

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Subtotal</span>
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
                      <span>Coupon ({appliedCoupon?.code})</span>
                      <span>-₹{couponDiscount.toFixed(0)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Shipping</span>
                    <span>{shippingCharge === 0 ? 'Free' : `₹${shippingCharge}`}</span>
                  </div>
                </div>

                <Separator />

                <div className="flex justify-between font-bold text-lg">
                  <span>Total</span>
                  <span>₹{total.toFixed(0)}</span>
                </div>

                {checkoutSettings.min_order_value > 0 && subtotal < checkoutSettings.min_order_value && (
                  <p className="text-sm text-destructive text-center">
                    Minimum order value is ₹{checkoutSettings.min_order_value}
                  </p>
                )}

                {quantityIssues.length > 0 && (
                  <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                    <p className="text-sm text-destructive font-medium">Some items exceed available stock</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {quantityIssues.slice(0, 2).map((issue) => `${issue.name}: ${issue.available} left`).join(' | ')}
                    </p>
                  </div>
                )}

                {isBlocked && (
                  <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-center">
                    <p className="text-sm text-destructive font-medium">Your account has been restricted</p>
                    <p className="text-xs text-muted-foreground mt-1">Please contact support to resolve this issue</p>
                  </div>
                )}

                <Button
                  className="w-full"
                  size="lg"
                  onClick={placeOrder}
                  disabled={!selectedAddress || isPlacingOrder || isBlocked || quantityIssues.length > 0 || (checkoutSettings.min_order_value > 0 && subtotal < checkoutSettings.min_order_value)}
                >
                  {isPlacingOrder ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Placing Order...</>
                  ) : isBlocked ? 'Account Restricted' : 'Place Order'}
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </StorefrontLayout>
  );
}
