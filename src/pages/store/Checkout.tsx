import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CreditCard, Truck, MapPin, Plus, Loader2 } from 'lucide-react';
import { StorefrontLayout } from '@/components/storefront/StorefrontLayout';
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
import type { Address, CartItem, Product, PaymentMethod } from '@/types/database';

interface CartItemWithProduct extends CartItem {
  product: Product;
}

export default function CheckoutPage() {
  const [cartItems, setCartItems] = useState<CartItemWithProduct[]>([]);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [selectedAddress, setSelectedAddress] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cod');
  const [isLoading, setIsLoading] = useState(true);
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [isAddressDialogOpen, setIsAddressDialogOpen] = useState(false);
  const [isSavingAddress, setIsSavingAddress] = useState(false);
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
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      fetchData();
    } else {
      navigate('/auth');
    }
  }, [user]);

  const fetchData = async () => {
    if (!user) return;
    setIsLoading(true);

    // Fetch cart
    const { data: cart } = await supabase.from('cart').select('id').eq('user_id', user.id).single();
    if (cart) {
      const { data: items } = await supabase
        .from('cart_items')
        .select('*, product:products(*)')
        .eq('cart_id', cart.id);
      setCartItems((items || []) as CartItemWithProduct[]);
    }

    // Fetch addresses
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

    setIsLoading(false);
  };

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
    
    const address = addresses.find(a => a.id === selectedAddress);
    if (!address) return;

    setIsPlacingOrder(true);

    try {
      // Generate order number
      const { data: orderNumberData } = await supabase.rpc('generate_order_number');
      const orderNumber = orderNumberData || `ORD${Date.now()}`;

      const subtotal = cartItems.reduce((sum, item) => sum + (item.product.price * item.quantity), 0);
      const shippingCharge = subtotal >= 500 ? 0 : 50;
      const total = subtotal + shippingCharge;

      // Create order with pending payment status
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({
          order_number: orderNumber,
          user_id: user.id,
          status: 'new',
          payment_status: 'pending',
          payment_method: paymentMethod,
          subtotal,
          discount: 0,
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

      // Create order items
      const orderItems = cartItems.map(item => ({
        order_id: order.id,
        product_id: item.product_id,
        variant_id: item.variant_id,
        product_name: item.product.name,
        sku: item.product.sku,
        price: item.product.price,
        quantity: item.quantity,
        total: item.product.price * item.quantity,
      }));

      await supabase.from('order_items').insert(orderItems);

      // Create delivery record
      await supabase.from('deliveries').insert({
        order_id: order.id,
        status: 'pending',
        is_cod: paymentMethod === 'cod',
        cod_amount: paymentMethod === 'cod' ? total : null,
        delivery_charge: shippingCharge,
      });

      // Handle payment based on method
      if (paymentMethod === 'cod') {
        // Create COD payment record
        await supabase.from('payments').insert({
          order_id: order.id,
          amount: total,
          method: 'cod',
          status: 'pending',
        });

        // Clear cart and redirect
        await clearCartAndRedirect(orderNumber);
      } else if (paymentMethod === 'online') {
        // Initiate Razorpay payment
        initiatePayment({
          amount: total,
          orderId: order.id,
          orderNumber: orderNumber,
          customerName: address.full_name,
          customerEmail: user.email || undefined,
          customerPhone: address.mobile_number,
          onSuccess: async () => {
            await clearCartAndRedirect(orderNumber);
          },
          onFailure: async (error) => {
            // Update order status to payment failed
            await supabase
              .from('orders')
              .update({ payment_status: 'failed' })
              .eq('id', order.id);
            
            toast({ 
              title: 'Payment Failed', 
              description: error || 'Please try again or choose a different payment method', 
              variant: 'destructive' 
            });
            setIsPlacingOrder(false);
          },
        });
        return; // Don't reset isPlacingOrder yet - wait for payment result
      }
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Failed to place order', variant: 'destructive' });
      setIsPlacingOrder(false);
    }
  };

  const clearCartAndRedirect = async (orderNumber: string) => {
    // Auto-create/update customer profile if not exists
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

    // Clear cart
    const { data: cart } = await supabase.from('cart').select('id').eq('user_id', user!.id).single();
    if (cart) {
      await supabase.from('cart_items').delete().eq('cart_id', cart.id);
    }

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
              <Card>
                <CardHeader>
                  <Skeleton className="h-6 w-40" />
                </CardHeader>
                <CardContent className="space-y-3">
                  <Skeleton className="h-20 w-full" />
                  <Skeleton className="h-20 w-full" />
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <Skeleton className="h-6 w-40" />
                </CardHeader>
                <CardContent className="space-y-3">
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                </CardContent>
              </Card>
            </div>
            <Card>
              <CardHeader>
                <Skeleton className="h-6 w-32" />
              </CardHeader>
              <CardContent className="space-y-4">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-10 w-full" />
              </CardContent>
            </Card>
          </div>
        </div>
      </StorefrontLayout>
    );
  }

  if (cartItems.length === 0) {
    navigate('/cart');
    return null;
  }

  const subtotal = cartItems.reduce((sum, item) => sum + (item.product.price * item.quantity), 0);
  const shippingCharge = subtotal >= 500 ? 0 : 50;
  const total = subtotal + shippingCharge;

  return (
    <StorefrontLayout>
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-6">Checkout</h1>

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
                          <Input
                            value={newAddress.full_name}
                            onChange={(e) => setNewAddress({ ...newAddress, full_name: e.target.value })}
                          />
                        </div>
                        <div>
                          <Label>Mobile Number *</Label>
                          <Input
                            value={newAddress.mobile_number}
                            onChange={(e) => setNewAddress({ ...newAddress, mobile_number: e.target.value })}
                          />
                        </div>
                      </div>
                      <div>
                        <Label>Address Line 1 *</Label>
                        <Input
                          value={newAddress.address_line1}
                          onChange={(e) => setNewAddress({ ...newAddress, address_line1: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label>Address Line 2</Label>
                        <Input
                          value={newAddress.address_line2}
                          onChange={(e) => setNewAddress({ ...newAddress, address_line2: e.target.value })}
                        />
                      </div>
                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <Label>City *</Label>
                          <Input
                            value={newAddress.city}
                            onChange={(e) => setNewAddress({ ...newAddress, city: e.target.value })}
                          />
                        </div>
                        <div>
                          <Label>State *</Label>
                          <Input
                            value={newAddress.state}
                            onChange={(e) => setNewAddress({ ...newAddress, state: e.target.value })}
                          />
                        </div>
                        <div>
                          <Label>Pincode *</Label>
                          <Input
                            value={newAddress.pincode}
                            onChange={(e) => setNewAddress({ ...newAddress, pincode: e.target.value })}
                          />
                        </div>
                      </div>
                      <div>
                        <Label>Landmark</Label>
                        <Input
                          value={newAddress.landmark}
                          onChange={(e) => setNewAddress({ ...newAddress, landmark: e.target.value })}
                        />
                      </div>
                      <Button 
                        className="w-full" 
                        onClick={handleAddAddress}
                        disabled={isSavingAddress}
                      >
                        {isSavingAddress ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Saving...
                          </>
                        ) : 'Save Address'}
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
                    <div className="flex items-center gap-3">
                      <RadioGroupItem value="cod" id="cod" />
                      <Label htmlFor="cod" className="flex-1 cursor-pointer">
                        <div className="p-3 border rounded-lg hover:border-primary transition-colors">
                          <p className="font-medium">Cash on Delivery</p>
                          <p className="text-sm text-muted-foreground">Pay when you receive your order</p>
                        </div>
                      </Label>
                    </div>
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
                {/* Items */}
                <div className="space-y-3 max-h-60 overflow-y-auto">
                  {cartItems.map((item) => (
                    <div key={item.id} className="flex justify-between text-sm">
                      <span className="flex-1">
                        {item.product.name} × {item.quantity}
                      </span>
                      <span>₹{(item.product.price * item.quantity).toFixed(0)}</span>
                    </div>
                  ))}
                </div>

                <Separator />

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span>₹{subtotal.toFixed(0)}</span>
                  </div>
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

                <Button
                  className="w-full"
                  size="lg"
                  onClick={placeOrder}
                  disabled={!selectedAddress || isPlacingOrder}
                >
                  {isPlacingOrder ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Placing Order...
                    </>
                  ) : 'Place Order'}
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </StorefrontLayout>
  );
}
