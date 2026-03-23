import { useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useActivityLog } from '@/hooks/useActivityLog';
import { RotateCcw, Search, Check, X, Truck, Package, DollarSign, Loader2, Image as ImageIcon } from 'lucide-react';
import { format } from 'date-fns';
import { useAdminReturns, ADMIN_KEYS } from '@/hooks/useAdminQueries';

type ReturnStatus = 'requested' | 'approved' | 'rejected' | 'in_transit' | 'received' | 'refunded' | 'completed';

interface ReturnRecord {
  id: string;
  return_number: string;
  order_id: string;
  user_id: string;
  status: ReturnStatus;
  reason: string;
  reason_details: string | null;
  images: string[];
  admin_notes: string | null;
  reject_reason: string | null;
  pickup_partner: string | null;
  pickup_tracking: string | null;
  item_condition: string | null;
  created_at: string;
  updated_at: string;
  order?: { order_number: string; total: number; payment_method: string | null };
  profile?: { full_name: string | null; email: string | null; mobile_number: string | null };
  items?: ReturnItemRecord[];
  refund?: { id: string; amount: number; status: string; mode: string; refund_number: string } | null;
}

interface ReturnItemRecord {
  id: string;
  product_name: string;
  variant_name: string | null;
  quantity: number;
  price: number;
  product_id: string | null;
  variant_id: string | null;
}

const statusColors: Record<ReturnStatus, string> = {
  requested: 'bg-amber-100 text-amber-800',
  approved: 'bg-blue-100 text-blue-800',
  rejected: 'bg-red-100 text-red-800',
  in_transit: 'bg-purple-100 text-purple-800',
  received: 'bg-teal-100 text-teal-800',
  refunded: 'bg-green-100 text-green-800',
  completed: 'bg-gray-100 text-gray-800',
};

export default function AdminReturns() {
  const queryClient = useQueryClient();
  const { data: returns = [], isLoading } = useAdminReturns();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedReturn, setSelectedReturn] = useState<ReturnRecord | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [adminNotes, setAdminNotes] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [pickupPartner, setPickupPartner] = useState('');
  const [pickupTracking, setPickupTracking] = useState('');
  const [itemCondition, setItemCondition] = useState('good');
  const [isProcessing, setIsProcessing] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const { toast } = useToast();
  const { log } = useActivityLog();

  const refetchReturns = () => queryClient.invalidateQueries({ queryKey: ADMIN_KEYS.returns });

  const filtered = returns.filter(r => {
    if (statusFilter !== 'all' && r.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        r.return_number.toLowerCase().includes(q) ||
        r.order?.order_number?.toLowerCase().includes(q) ||
        r.profile?.full_name?.toLowerCase().includes(q) ||
        r.reason.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const openDetail = (r: ReturnRecord) => {
    setSelectedReturn(r);
    setAdminNotes(r.admin_notes || '');
    setRejectReason(r.reject_reason || '');
    setPickupPartner(r.pickup_partner || '');
    setPickupTracking(r.pickup_tracking || '');
    setIsDetailOpen(true);
  };

  const updateStatus = async (status: ReturnStatus, extra: Record<string, any> = {}) => {
    if (!selectedReturn) return;
    setIsProcessing(true);
    const updates: any = { status, admin_notes: adminNotes, ...extra };

    const { error } = await supabase
      .from('returns')
      .update(updates)
      .eq('id', selectedReturn.id);

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      // Update order status to 'returned' when return is completed or refunded
      if (status === 'refunded' || status === 'completed') {
        await supabase.from('orders').update({ status: 'returned' as any }).eq('id', selectedReturn.order_id);
      }
      toast({ title: 'Return updated', description: `Status changed to ${status}` });
      log({ action: 'status_change', entityType: 'return', entityId: selectedReturn.id, details: { return_number: selectedReturn.return_number, new_status: status } });
      await fetchReturns();
      setIsDetailOpen(false);
    }
    setIsProcessing(false);
  };

  const processRefund = async () => {
    if (!selectedReturn) return;
    setIsProcessing(true);

    const totalAmount = (selectedReturn.items || []).reduce((sum, item) => sum + item.price * item.quantity, 0);
    const refundNumber = 'RF' + format(new Date(), 'yyyyMMdd') + Math.floor(Math.random() * 10000).toString().padStart(4, '0');

    const { error } = await supabase.from('refunds').insert({
      refund_number: refundNumber,
      return_id: selectedReturn.id,
      order_id: selectedReturn.order_id,
      user_id: selectedReturn.user_id,
      amount: totalAmount,
      mode: selectedReturn.order?.payment_method === 'cod' ? 'wallet' : 'original',
      status: 'success' as any,
      processed_at: new Date().toISOString(),
    });

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      setIsProcessing(false);
      return;
    }

    // Restock if condition is good
    if (itemCondition === 'good') {
      for (const item of selectedReturn.items || []) {
        if (item.variant_id) {
          const { data: vd } = await supabase.from('product_variants').select('stock_quantity').eq('id', item.variant_id).single();
          if (vd) {
            await supabase.from('product_variants').update({
              stock_quantity: (vd.stock_quantity || 0) + item.quantity
            } as any).eq('id', item.variant_id);
          }
        }
        if (item.product_id) {
          const { data: pd } = await supabase.from('products').select('stock_quantity').eq('id', item.product_id).single();
          if (pd) {
            await supabase.from('products').update({
              stock_quantity: (pd.stock_quantity || 0) + item.quantity
            } as any).eq('id', item.product_id);
          }
        }
      }
    }

    // Update order status to returned
    await supabase.from('orders').update({ status: 'returned' as any }).eq('id', selectedReturn.order_id);

    await updateStatus('refunded', { item_condition: itemCondition });
    log({ action: 'refund', entityType: 'return', entityId: selectedReturn.id, details: { refund_number: refundNumber, amount: totalAmount } });
  };

  const statusCounts = returns.reduce((acc, r) => {
    acc[r.status] = (acc[r.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Detail view
  if (selectedReturn && isDetailOpen) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-between mb-4">
          <Button variant="ghost" size="sm" onClick={() => { setIsDetailOpen(false); setSelectedReturn(null); }}>
            <X className="h-4 w-4 mr-1" /> Back to Returns
          </Button>
          <span className={`text-xs px-2 py-1 rounded-full font-medium ${statusColors[selectedReturn.status]}`}>
            {selectedReturn.status.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}
          </span>
        </div>

        <div className="grid lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 space-y-4">
            {/* Return Items */}
            <Card>
              <CardContent className="p-4">
                <Label className="text-sm font-semibold">Return Items</Label>
                <div className="space-y-2 mt-2">
                  {(selectedReturn.items || []).map(item => (
                    <div key={item.id} className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                      <div>
                        <p className="font-medium text-sm">{item.product_name}</p>
                        {item.variant_name && <p className="text-xs text-muted-foreground">{item.variant_name}</p>}
                      </div>
                      <div className="text-right">
                        <p className="text-sm">Qty: {item.quantity}</p>
                        <p className="text-xs font-medium">₹{(item.price * item.quantity).toFixed(0)}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex justify-between pt-3 border-t mt-3">
                  <span className="font-semibold text-sm">Total Refund</span>
                  <span className="font-bold">₹{(selectedReturn.items || []).reduce((s, i) => s + i.price * i.quantity, 0).toFixed(0)}</span>
                </div>
              </CardContent>
            </Card>

            {/* Reason */}
            <Card>
              <CardContent className="p-4">
                <Label className="text-sm font-semibold">Return Reason</Label>
                <p className="text-sm mt-1">{selectedReturn.reason}</p>
                {selectedReturn.reason_details && <p className="text-xs text-muted-foreground mt-1">{selectedReturn.reason_details}</p>}
              </CardContent>
            </Card>

            {/* Images */}
            {selectedReturn.images && selectedReturn.images.length > 0 && (
              <Card>
                <CardContent className="p-4">
                  <Label className="text-sm font-semibold">Proof Images</Label>
                  <div className="grid grid-cols-3 gap-2 mt-2">
                    {selectedReturn.images.map((img, i) => (
                      <img
                        key={i}
                        src={img}
                        alt={`Proof ${i + 1}`}
                        className="w-full aspect-square object-cover rounded-lg cursor-pointer border"
                        onClick={() => setImagePreview(img)}
                      />
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Refund Info */}
            {selectedReturn.refund && (
              <Card>
                <CardContent className="p-4 bg-green-50 dark:bg-green-950/20">
                  <Label className="text-sm font-semibold">Refund Details</Label>
                  <p className="text-sm font-medium mt-1">{selectedReturn.refund.refund_number} — ₹{Number(selectedReturn.refund.amount).toFixed(0)}</p>
                  <p className="text-xs text-muted-foreground">Mode: {selectedReturn.refund.mode} | Status: {selectedReturn.refund.status}</p>
                </CardContent>
              </Card>
            )}

            {/* Admin Notes */}
            <Card>
              <CardContent className="p-4 space-y-3">
                <Label className="text-sm font-semibold">Admin Notes</Label>
                <Textarea value={adminNotes} onChange={e => setAdminNotes(e.target.value)} placeholder="Internal notes..." rows={2} />
              </CardContent>
            </Card>

            {/* Actions */}
            {selectedReturn.status === 'requested' && (
              <Card>
                <CardContent className="p-4 space-y-3">
                  <div className="flex gap-2">
                    <Button className="flex-1" onClick={() => updateStatus('approved')} disabled={isProcessing}>
                      <Check className="h-4 w-4 mr-1" /> Approve
                    </Button>
                  </div>
                  <div>
                    <Label className="text-xs">Reject Reason</Label>
                    <Textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)} placeholder="Reason for rejection..." rows={2} />
                    <Button variant="destructive" size="sm" className="mt-2" onClick={() => updateStatus('rejected', { reject_reason: rejectReason })} disabled={isProcessing || !rejectReason}>
                      <X className="h-4 w-4 mr-1" /> Reject
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {selectedReturn.status === 'approved' && (
              <Card>
                <CardContent className="p-4 space-y-3">
                  <Label className="text-sm font-semibold">Pickup Details</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <Input placeholder="Partner name" value={pickupPartner} onChange={e => setPickupPartner(e.target.value)} />
                    <Input placeholder="Tracking number" value={pickupTracking} onChange={e => setPickupTracking(e.target.value)} />
                  </div>
                  <Button onClick={() => updateStatus('in_transit', { pickup_partner: pickupPartner, pickup_tracking: pickupTracking })} disabled={isProcessing}>
                    <Truck className="h-4 w-4 mr-1" /> Mark In Transit
                  </Button>
                </CardContent>
              </Card>
            )}

            {selectedReturn.status === 'in_transit' && (
              <Card>
                <CardContent className="p-4">
                  <Button onClick={() => updateStatus('received')} disabled={isProcessing}>
                    <Package className="h-4 w-4 mr-1" /> Mark Received
                  </Button>
                </CardContent>
              </Card>
            )}

            {selectedReturn.status === 'received' && (
              <Card>
                <CardContent className="p-4 space-y-3">
                  <Label className="text-sm font-semibold">Item Condition</Label>
                  <Select value={itemCondition} onValueChange={setItemCondition}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="good">Good — Restock</SelectItem>
                      <SelectItem value="damaged">Damaged — Do not restock</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button onClick={processRefund} disabled={isProcessing}>
                    {isProcessing ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <DollarSign className="h-4 w-4 mr-1" />}
                    Process Refund
                  </Button>
                </CardContent>
              </Card>
            )}

            {selectedReturn.status === 'refunded' && (
              <Card>
                <CardContent className="p-4">
                  <Button onClick={() => updateStatus('completed')} disabled={isProcessing}>
                    <Check className="h-4 w-4 mr-1" /> Mark Completed
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            <Card>
              <CardContent className="p-4 space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Return #</span><span className="font-medium">{selectedReturn.return_number}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Order #</span><span className="font-medium">{selectedReturn.order?.order_number || '—'}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Date</span><span>{format(new Date(selectedReturn.created_at), 'dd MMM yyyy')}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Order Total</span><span>₹{Number(selectedReturn.order?.total || 0).toFixed(0)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Payment</span><span>{selectedReturn.order?.payment_method || '—'}</span></div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 space-y-1">
                <Label className="text-xs text-muted-foreground">Customer</Label>
                <p className="text-sm font-medium">{selectedReturn.profile?.full_name || 'Unknown'}</p>
                <p className="text-xs text-muted-foreground">{selectedReturn.profile?.email}</p>
                <p className="text-xs text-muted-foreground">{selectedReturn.profile?.mobile_number}</p>
              </CardContent>
            </Card>

            {/* Status Timeline */}
            <Card>
              <CardContent className="p-4">
                <Label className="text-xs text-muted-foreground mb-2 block">Status Flow</Label>
                <div className="space-y-2">
                  {(['requested', 'approved', 'in_transit', 'received', 'refunded', 'completed'] as ReturnStatus[]).map((s, i) => {
                    const statusIdx = ['requested', 'approved', 'in_transit', 'received', 'refunded', 'completed'].indexOf(selectedReturn.status);
                    const isActive = i <= statusIdx;
                    const isRejected = selectedReturn.status === 'rejected';
                    return (
                      <div key={s} className="flex items-center gap-2">
                        <div className={`h-3 w-3 rounded-full flex-shrink-0 ${isRejected ? 'bg-muted' : isActive ? 'bg-green-500' : 'bg-muted'}`} />
                        <span className={`text-xs ${isActive && !isRejected ? 'font-medium text-foreground' : 'text-muted-foreground'}`}>
                          {s.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}
                        </span>
                      </div>
                    );
                  })}
                  {selectedReturn.status === 'rejected' && (
                    <div className="flex items-center gap-2">
                      <div className="h-3 w-3 rounded-full flex-shrink-0 bg-red-500" />
                      <span className="text-xs font-medium text-destructive">Rejected</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Image Preview */}
        <Dialog open={!!imagePreview} onOpenChange={() => setImagePreview(null)}>
          <DialogContent className="max-w-lg p-2">
            {imagePreview && <img src={imagePreview} alt="Proof" className="w-full rounded-lg" />}
          </DialogContent>
        </Dialog>
      </AdminLayout>
    );
  }

  // Grid view
  return (
    <AdminLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <RotateCcw className="h-6 w-6" /> Returns & Refunds
            </h1>
            <p className="text-sm text-muted-foreground">Manage customer returns and process refunds</p>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {Object.entries(statusCounts).map(([status, count]) => (
              <span key={status} className={`px-2 py-0.5 rounded-full font-medium ${statusColors[status as ReturnStatus] || ''}`}>
                {status.replace('_', ' ')}: {count}
              </span>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search returns..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              {(['requested', 'approved', 'rejected', 'in_transit', 'received', 'refunded', 'completed'] as ReturnStatus[]).map(s => (
                <SelectItem key={s} value={s}>{s.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map(i => <div key={i} className="h-32 bg-muted animate-pulse rounded-xl" />)}
          </div>
        ) : filtered.length === 0 ? (
          <Card><CardContent className="py-12 text-center text-muted-foreground">No returns found</CardContent></Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(r => (
              <Card key={r.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => openDetail(r)}>
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm">{r.return_number}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColors[r.status]}`}>
                      {r.status.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Order: {r.order?.order_number || '—'}
                  </p>
                  <p className="text-xs text-muted-foreground">{r.profile?.full_name || 'Unknown'}</p>
                  <p className="text-xs text-muted-foreground truncate">{r.reason}</p>
                  <div className="flex items-center justify-between pt-1">
                    <p className="font-semibold text-sm">
                      ₹{(r.items || []).reduce((s, i) => s + i.price * i.quantity, 0).toFixed(0)}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{(r.items || []).length} item(s)</span>
                      {r.images && r.images.length > 0 && (
                        <span className="flex items-center gap-0.5"><ImageIcon className="h-3 w-3" />{r.images.length}</span>
                      )}
                    </div>
                  </div>
                  <p className="text-[10px] text-muted-foreground">{format(new Date(r.created_at), 'dd MMM yyyy, hh:mm a')}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}