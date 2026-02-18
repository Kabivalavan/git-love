 import { useState, useEffect } from 'react';
 import { Link } from 'react-router-dom';
 import { Card, CardContent } from '@/components/ui/card';
 import { Badge } from '@/components/ui/badge';
 import { Button } from '@/components/ui/button';
 import { supabase } from '@/integrations/supabase/client';
 import { useAuth } from '@/hooks/useAuth';
 import { Package, ChevronRight } from 'lucide-react';
 import type { Order, OrderStatus } from '@/types/database';
 
 const statusColors: Record<OrderStatus, 'default' | 'secondary' | 'destructive'> = {
   new: 'secondary',
   confirmed: 'default',
   packed: 'default',
   shipped: 'default',
   delivered: 'default',
   cancelled: 'destructive',
   returned: 'destructive',
 };
 
 export default function MyOrdersPage() {
   const [orders, setOrders] = useState<Order[]>([]);
   const [isLoading, setIsLoading] = useState(true);
   const { user } = useAuth();
 
   useEffect(() => {
     if (user) fetchOrders();
   }, [user]);
 
   const fetchOrders = async () => {
     if (!user) return;
     setIsLoading(true);
     
     const { data } = await supabase
       .from('orders')
       .select('*')
       .eq('user_id', user.id)
       .order('created_at', { ascending: false });
     
     setOrders((data || []) as unknown as Order[]);
     setIsLoading(false);
   };
 
   if (isLoading) {
     return (
       <div className="space-y-4">
         {[1, 2, 3].map((i) => (
           <div key={i} className="animate-pulse h-32 bg-muted rounded-lg"></div>
         ))}
       </div>
     );
   }
 
   if (orders.length === 0) {
     return (
       <Card>
         <CardContent className="py-12 text-center">
           <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
           <h3 className="text-lg font-semibold mb-2">No orders yet</h3>
           <p className="text-muted-foreground mb-4">Start shopping to see your orders here</p>
           <Button asChild>
             <Link to="/products">Browse Products</Link>
           </Button>
         </CardContent>
       </Card>
     );
   }
 
   return (
     <div className="space-y-4">
       <h2 className="text-xl font-semibold">My Orders</h2>
       {orders.map((order) => (
         <Card key={order.id} className="hover:shadow-md transition-shadow">
           <CardContent className="p-4">
             <div className="flex items-center justify-between">
               <div className="space-y-1">
                 <div className="flex items-center gap-3">
                   <span className="font-semibold">{order.order_number}</span>
                   <Badge variant={statusColors[order.status]}>
                     {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                   </Badge>
                 </div>
                 <p className="text-sm text-muted-foreground">
                   Placed on {new Date(order.created_at).toLocaleDateString('en-IN', {
                     day: 'numeric',
                     month: 'short',
                     year: 'numeric'
                   })}
                 </p>
                 <p className="font-medium">₹{Number(order.total).toFixed(0)}</p>
               </div>
               <Button variant="ghost" size="sm" asChild>
                 <Link to={`/account/order/${order.id}`}>
                   View Details
                   <ChevronRight className="h-4 w-4 ml-1" />
                 </Link>
               </Button>
             </div>
           </CardContent>
         </Card>
       ))}
     </div>
   );
 }