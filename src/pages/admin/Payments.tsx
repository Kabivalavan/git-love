import { useEffect, useState, useCallback } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { DataTable, Column } from '@/components/admin/DataTable';
import { DetailPanel, DetailField, DetailSection } from '@/components/admin/DetailPanel';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { usePaginatedFetch } from '@/hooks/usePaginatedFetch';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { fetchPayments as fetchPaymentsApi } from '@/api/admin';

interface Payment {
  id: string;
  order_id: string;
  amount: number;
  method: string;
  status: string;
  transaction_id: string | null;
  gateway_response: Record<string, unknown> | null;
  refund_amount: number | null;
  refund_reason: string | null;
  created_at: string;
  order?: { order_number: string };
}

const PAYMENT_STATUSES = [
  { value: 'pending', label: 'Pending', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'paid', label: 'Paid', color: 'bg-green-100 text-green-800' },
  { value: 'failed', label: 'Failed', color: 'bg-red-100 text-red-800' },
  { value: 'refunded', label: 'Refunded', color: 'bg-purple-100 text-purple-800' },
  { value: 'partial', label: 'Partial', color: 'bg-orange-100 text-orange-800' },
];

const PAYMENT_METHODS = [
  { value: 'online', label: 'Online' },
  { value: 'cod', label: 'Cash on Delivery' },
  { value: 'wallet', label: 'Wallet' },
];

export default function AdminPayments() {
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [refundAmount, setRefundAmount] = useState('');
  const [refundReason, setRefundReason] = useState('');
  const { toast } = useToast();

  const fetchPaymentsFn = useCallback(async (from: number, to: number) => {
    const { data, error, count } = await supabase
      .from('payments')
      .select('*, order:orders(order_number)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to);
    if (error) toast({ title: 'Error', description: error.message, variant: 'destructive' });
    return { data: (data || []) as unknown as Payment[], count: count || 0 };
  }, []);

  const { items: payments, isLoading, isLoadingMore, hasMore, sentinelRef, fetchInitial: fetchPayments } = usePaginatedFetch<Payment>({
    pageSize: 30,
    fetchFn: fetchPaymentsFn,
  });

  useEffect(() => { fetchPayments(); }, []);

  const handleRowClick = (payment: Payment) => {
    setSelectedPayment(payment);
    setRefundAmount(payment.refund_amount?.toString() || '');
    setRefundReason(payment.refund_reason || '');
    setIsDetailOpen(true);
  };

  const handleStatusUpdate = async (newStatus: string) => {
    if (!selectedPayment) return;
    setIsUpdating(true);

    const typedStatus = newStatus as 'pending' | 'paid' | 'failed' | 'refunded' | 'partial';

    const { error } = await supabase
      .from('payments')
      .update({ status: typedStatus })
      .eq('id', selectedPayment.id);

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Success', description: 'Payment status updated' });
      setSelectedPayment({ ...selectedPayment, status: typedStatus });
      fetchPayments();
    }
    setIsUpdating(false);
  };

  const handleRefund = async () => {
    if (!selectedPayment || !refundAmount) return;
    setIsUpdating(true);

    const { error } = await supabase
      .from('payments')
      .update({
        status: parseFloat(refundAmount) >= selectedPayment.amount ? 'refunded' : 'partial',
        refund_amount: parseFloat(refundAmount),
        refund_reason: refundReason,
      })
      .eq('id', selectedPayment.id);

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Success', description: 'Refund processed' });
      fetchPayments();
      setIsDetailOpen(false);
    }
    setIsUpdating(false);
  };

  const getStatusColor = (status: string) => {
    const found = PAYMENT_STATUSES.find(s => s.value === status);
    return found?.color || 'bg-gray-100 text-gray-800';
  };

  const columns: Column<Payment>[] = [
    {
      key: 'order_id',
      header: 'Order',
      render: (p) => p.order?.order_number || p.order_id.slice(0, 8),
    },
    {
      key: 'amount',
      header: 'Amount',
      render: (p) => `₹${p.amount.toFixed(2)}`,
    },
    {
      key: 'method',
      header: 'Method',
      render: (p) => PAYMENT_METHODS.find(m => m.value === p.method)?.label || p.method,
    },
    {
      key: 'status',
      header: 'Status',
      render: (p) => (
        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${getStatusColor(p.status)}`}>
          {PAYMENT_STATUSES.find(s => s.value === p.status)?.label || p.status}
        </span>
      ),
    },
    { key: 'transaction_id', header: 'Transaction ID' },
    {
      key: 'created_at',
      header: 'Date',
      render: (p) => new Date(p.created_at).toLocaleDateString(),
    },
  ];

  return (
    <AdminLayout
      title="Payments"
      description="View and manage payment transactions"
    >
      <DataTable<Payment>
        columns={columns}
        data={payments}
        isLoading={isLoading}
        onRowClick={handleRowClick}
        searchable
        searchPlaceholder="Search by transaction ID..."
        searchKeys={['transaction_id']}
        getRowId={(p) => p.id}
        emptyMessage="No payments found."
        isLoadingMore={isLoadingMore}
        hasMore={hasMore}
        sentinelRef={sentinelRef}
      />

      <DetailPanel
        isOpen={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
        title={`Payment for ${selectedPayment?.order?.order_number || 'Order'}`}
        canEdit={false}
        canDelete={false}
      >
        {selectedPayment && (
          <div className="space-y-6">
            <DetailSection title="Payment Info">
              <DetailField label="Amount" value={`₹${selectedPayment.amount.toFixed(2)}`} />
              <DetailField label="Method" value={PAYMENT_METHODS.find(m => m.value === selectedPayment.method)?.label} />
              <DetailField label="Transaction ID" value={selectedPayment.transaction_id || '-'} />
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={selectedPayment.status}
                  onValueChange={handleStatusUpdate}
                  disabled={isUpdating || selectedPayment.status === 'paid' || selectedPayment.status === 'refunded'}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_STATUSES.map((status) => (
                      <SelectItem key={status.value} value={status.value}>
                        {status.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {(selectedPayment.status === 'paid' || selectedPayment.status === 'refunded') && (
                  <p className="text-[10px] text-muted-foreground mt-1">🔒 Status locked</p>
                )}
              </div>
            </DetailSection>

            {selectedPayment.refund_amount && (
              <DetailSection title="Refund Info">
                <DetailField label="Refund Amount" value={`₹${selectedPayment.refund_amount.toFixed(2)}`} />
                <DetailField label="Reason" value={selectedPayment.refund_reason || '-'} />
              </DetailSection>
            )}

            <DetailSection title="Timestamps">
              <DetailField label="Created" value={new Date(selectedPayment.created_at).toLocaleString()} />
            </DetailSection>

            {selectedPayment.status === 'paid' && !selectedPayment.refund_amount && (
              <div className="space-y-4 border-t border-border pt-4">
                <h3 className="font-semibold text-sm">Process Refund</h3>
                <div className="space-y-2">
                  <Label>Refund Amount</Label>
                  <Input
                    type="number"
                    step="0.01"
                    max={selectedPayment.amount}
                    value={refundAmount}
                    onChange={(e) => setRefundAmount(e.target.value)}
                    placeholder={`Max: ₹${selectedPayment.amount}`}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Reason</Label>
                  <Textarea
                    rows={2}
                    value={refundReason}
                    onChange={(e) => setRefundReason(e.target.value)}
                    placeholder="Enter refund reason..."
                  />
                </div>
                <Button
                  onClick={handleRefund}
                  disabled={isUpdating || !refundAmount}
                  variant="destructive"
                  className="w-full"
                >
                  {isUpdating ? 'Processing...' : 'Process Refund'}
                </Button>
              </div>
            )}
          </div>
        )}
      </DetailPanel>
    </AdminLayout>
  );
}
