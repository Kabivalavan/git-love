 import { useState, useEffect } from 'react';
 import { useParams, Link } from 'react-router-dom';
 import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
 import { Badge } from '@/components/ui/badge';
 import { Button } from '@/components/ui/button';
 import { Separator } from '@/components/ui/separator';
 import { supabase } from '@/integrations/supabase/client';
 import { useAuth } from '@/hooks/useAuth';
 import { ArrowLeft, Package, Truck, CheckCircle, MapPin } from 'lucide-react';
 import type { Order, OrderItem, Delivery, ShippingAddress, OrderStatus } from '@/types/database';
 import { cn } from '@/lib/utils';
 
 const orderSteps = [
   { status: 'new', label: 'Order Placed', icon: Package },
   { status: 'confirmed', label: 'Confirmed', icon: CheckCircle },
   { status: 'packed', label: 'Packed', icon: Package },
   { status: 'shipped', label: 'Shipped', icon: Truck },
   { status: 'delivered', label: 'Delivered', icon: CheckCircle },
 ];
 
 const statusIndex: Record<string, number> = {
   new: 0, confirmed: 1, packed: 2, shipped: 3, delivered: 4, cancelled: -1, returned: -1,
 };
 
 export default function OrderTrackingPage() {
   const { orderId } = useParams<{ orderId: string }>();
   const [order, setOrder] = useState<Order | null>(null);
   const [items, setItems] = useState<OrderItem[]>([]);
   const [delivery, setDelivery] = useState<Delivery | null>(null);
   const [isLoading, setIsLoading] = useState(true);
   const { user } = useAuth();
 
   useEffect(() => {
     if (user && orderId) fetchOrderDetails();
   }, [user, orderId]);
 
   const fetchOrderDetails = async () => {
     if (!user || !orderId) return;
     setIsLoading(true);
 
     const [orderRes, itemsRes, deliveryRes] = await Promise.all([
       supabase.from('orders').select('*').eq('id', orderId).eq('user_id', user.id).single(),
       supabase.from('order_items').select('*').eq('order_id', orderId),
       supabase.from('deliveries').select('*').eq('order_id', orderId).single(),
     ]);
 
     setOrder(orderRes.data as unknown as Order);
     setItems((itemsRes.data || []) as unknown as OrderItem[]);
     setDelivery(deliveryRes.data as unknown as Delivery);
     setIsLoading(false);
   };
 
   if (isLoading) {
     return <div className="animate-pulse space-y-4"><div className="h-64 bg-muted rounded"></div></div>;
   }
 
   if (!order) {
     return (
       <Card><CardContent className="py-12 text-center">
         <p className="text-muted-foreground">Order not found</p>
         <Button asChild className="mt-4"><Link to="/account">Back to Orders</Link></Button>
       </CardContent></Card>
     );
   }
 
   const currentStep = statusIndex[order.status];
   const address = order.shipping_address as ShippingAddress;
 
   return (
     <div className="space-y-6">
       <div className="flex items-center gap-4">
         <Button variant="ghost" size="sm" asChild>
           <Link to="/account"><ArrowLeft className="h-4 w-4 mr-1" />Back</Link>
         </Button>
         <h2 className="text-xl font-semibold">Order #{order.order_number}</h2>
       </div>
 
       {order.status !== 'cancelled' && order.status !== 'returned' && (
         <Card>
           <CardHeader><CardTitle className="text-lg">Order Status</CardTitle></CardHeader>
           <CardContent>
             <div className="flex justify-between relative">
               <div className="absolute top-5 left-0 right-0 h-0.5 bg-muted">
                 <div className="h-full bg-primary transition-all" style={{ width: `${(currentStep / 4) * 100}%` }} />
               </div>
               {orderSteps.map((step, index) => (
                 <div key={step.status} className="flex flex-col items-center relative z-10">
                   <div className={cn("w-10 h-10 rounded-full flex items-center justify-center", index <= currentStep ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
                     <step.icon className="h-5 w-5" />
                   </div>
                   <span className={cn("text-xs mt-2", index === currentStep ? "font-semibold text-primary" : "text-muted-foreground")}>{step.label}</span>
                 </div>
               ))}
             </div>
           </CardContent>
         </Card>
       )}
 
       <div className="grid md:grid-cols-2 gap-6">
         <Card>
           <CardHeader><CardTitle className="text-lg">Order Items</CardTitle></CardHeader>
           <CardContent className="space-y-3">
             {items.map((item) => (
               <div key={item.id} className="flex justify-between">
                 <div>
                   <p className="font-medium">{item.product_name}</p>
                   <p className="text-sm text-muted-foreground">Qty: {item.quantity}</p>
                 </div>
                 <p className="font-medium">₹{Number(item.total).toFixed(0)}</p>
               </div>
             ))}
             <Separator />
             <div className="flex justify-between font-semibold"><span>Total</span><span>₹{Number(order.total).toFixed(0)}</span></div>
           </CardContent>
         </Card>
 
         <Card>
           <CardHeader><CardTitle className="text-lg flex items-center gap-2"><MapPin className="h-5 w-5" />Shipping Address</CardTitle></CardHeader>
           <CardContent>
             {address && (
               <div className="text-sm space-y-1">
                 <p className="font-medium">{address.full_name}</p>
                 <p>{address.address_line1}</p>
                 <p>{address.city}, {address.state} - {address.pincode}</p>
                 <p className="text-muted-foreground">Phone: {address.mobile_number}</p>
               </div>
             )}
           </CardContent>
         </Card>
       </div>
     </div>
   );
 }