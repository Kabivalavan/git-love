import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { RotateCcw, ChevronRight } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { ShimmerList } from '@/components/ui/shimmer';
import { format } from 'date-fns';

type ReturnStatus = 'requested' | 'approved' | 'rejected' | 'in_transit' | 'received' | 'refunded' | 'completed';

const statusColors: Record<ReturnStatus, string> = {
  requested: 'bg-amber-100 text-amber-800',
  approved: 'bg-blue-100 text-blue-800',
  rejected: 'bg-red-100 text-red-800',
  in_transit: 'bg-purple-100 text-purple-800',
  received: 'bg-teal-100 text-teal-800',
  refunded: 'bg-green-100 text-green-800',
  completed: 'bg-gray-100 text-gray-800',
};

const statusSteps = ['requested', 'approved', 'in_transit', 'received', 'refunded', 'completed'];

export default function MyReturnsPage() {
  const { user } = useAuth();

  const { data: returns = [], isLoading } = useQuery({
    queryKey: ['my-returns', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase
        .from('returns')
        .select('*, return_items(*)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      // Enrich with order numbers
      if (!data || data.length === 0) return [];
      const orderIds = [...new Set(data.map(r => r.order_id))];
      const { data: orders } = await supabase.from('orders').select('id, order_number').in('id', orderIds);
      const orderMap = new Map((orders || []).map(o => [o.id, o.order_number]));

      // Get refund info
      const returnIds = data.map(r => r.id);
      const { data: refunds } = await supabase.from('refunds').select('return_id, amount, status, refund_number').in('return_id', returnIds);
      const refundMap = new Map((refunds || []).map(r => [r.return_id, r]));

      return data.map(r => ({
        ...r,
        images: (r.images as any) || [],
        items: r.return_items || [],
        order_number: orderMap.get(r.order_id) || '—',
        refund: refundMap.get(r.id) || null,
      }));
    },
    enabled: !!user,
    staleTime: 60_000,
  });

  if (isLoading) return <ShimmerList items={3} />;

  if (returns.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <RotateCcw className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No returns yet</h3>
          <p className="text-muted-foreground mb-4">You haven't raised any return requests</p>
          <Button asChild><Link to="/account">Go to Orders</Link></Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">My Returns</h2>
      {returns.map((ret: any) => {
        const currentStep = statusSteps.indexOf(ret.status);
        const isRejected = ret.status === 'rejected';
        const totalAmount = (ret.items || []).reduce((s: number, i: any) => s + i.price * i.quantity, 0);

        return (
          <Card key={ret.id}>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm">{ret.return_number}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColors[ret.status as ReturnStatus]}`}>
                      {ret.status.replace('_', ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">Order: {ret.order_number}</p>
                  <p className="text-xs text-muted-foreground">{format(new Date(ret.created_at), 'dd MMM yyyy')}</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold">₹{totalAmount.toFixed(0)}</p>
                  <p className="text-xs text-muted-foreground">{(ret.items || []).length} item(s)</p>
                </div>
              </div>

              {/* Progress tracker */}
              {!isRejected && (
                <div className="flex items-center gap-1 overflow-x-auto pb-1">
                  {statusSteps.map((step, i) => (
                    <div key={step} className="flex items-center">
                      <div className={`h-2 w-2 rounded-full flex-shrink-0 ${i <= currentStep ? 'bg-green-500' : 'bg-gray-200 dark:bg-gray-700'}`} />
                      {i < statusSteps.length - 1 && (
                        <div className={`h-0.5 w-6 flex-shrink-0 ${i < currentStep ? 'bg-green-500' : 'bg-gray-200 dark:bg-gray-700'}`} />
                      )}
                    </div>
                  ))}
                </div>
              )}

              {isRejected && ret.reject_reason && (
                <p className="text-xs text-destructive bg-destructive/10 p-2 rounded">
                  Rejected: {ret.reject_reason}
                </p>
              )}

              {ret.refund && (
                <p className="text-xs text-green-700 bg-green-50 p-2 rounded">
                  Refund {ret.refund.refund_number}: ₹{Number(ret.refund.amount).toFixed(0)} — {ret.refund.status}
                </p>
              )}

              {/* Items */}
              <div className="space-y-1">
                {(ret.items || []).map((item: any) => (
                  <div key={item.id} className="text-xs text-muted-foreground flex justify-between">
                    <span>{item.product_name} {item.variant_name ? `(${item.variant_name})` : ''} × {item.quantity}</span>
                    <span>₹{(item.price * item.quantity).toFixed(0)}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
