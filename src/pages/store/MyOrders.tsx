import { Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Package, ChevronRight } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { ShimmerList } from '@/components/ui/shimmer';
import type { Order, OrderStatus } from '@/types/database';

const statusConfig: Record<OrderStatus, { label: string; bg: string; text: string }> = {
  new: { label: 'New', bg: 'bg-blue-100', text: 'text-blue-800' },
  confirmed: { label: 'Confirmed', bg: 'bg-amber-100', text: 'text-amber-800' },
  packed: { label: 'Packed', bg: 'bg-purple-100', text: 'text-purple-800' },
  shipped: { label: 'Shipped', bg: 'bg-indigo-100', text: 'text-indigo-800' },
  delivered: { label: 'Delivered', bg: 'bg-green-100', text: 'text-green-800' },
  cancelled: { label: 'Cancelled', bg: 'bg-red-100', text: 'text-red-800' },
  returned: { label: 'Returned', bg: 'bg-gray-100', text: 'text-gray-800' },
};

export default function MyOrdersPage() {
  const { user } = useAuth();

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['my-orders', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase
        .from('orders')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      return (data || []) as unknown as Order[];
    },
    enabled: !!user,
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  if (isLoading) {
    return <ShimmerList items={3} />;
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
      {orders.map((order) => {
        const cfg = statusConfig[order.status] || statusConfig.new;
        return (
          <Card key={order.id} className="hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="space-y-1 min-w-0 flex-1">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="font-semibold text-sm break-all">{order.order_number}</span>
                    <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${cfg.bg} ${cfg.text}`}>
                      {cfg.label}
                    </span>
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
                <Button variant="ghost" size="sm" asChild className="flex-shrink-0">
                  <Link to={`/account/order/${order.id}`}>
                    View Details
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
