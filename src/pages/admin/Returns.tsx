import { useState, useEffect, useCallback } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useActivityLog } from '@/hooks/useActivityLog';
import { RotateCcw, Search, Eye, Check, X, Truck, Package, DollarSign, Loader2, Image as ImageIcon } from 'lucide-react';
import { format } from 'date-fns';

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

const statusTabs: { value: ReturnStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'requested', label: 'Requested' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'in_transit', label: 'In Transit' },
  { value: 'received', label: 'Received' },
  { value: 'refunded', label: 'Refunded' },
  { value: 'completed', label: 'Completed' },
];

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
  const [returns, setReturns] = useState<ReturnRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>('all');
  const [search, setSearch] = useState('');
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

  const fetchReturns = useCallback(async () => {
    setIsLoading(true);
    const { data } = await supabase
      .from('returns')
      .select('*')
      .order('created_at', { ascending: false });

    if (!data) { setIsLoading(false); return; }

    // Fetch related data
    const orderIds = [...new Set(data.map(r => r.order_id))];
    const userIds = [...new Set(data.map(r => r.user_id))];
    const returnIds = data.map(r => r.id);

    const [ordersRes, profilesRes, itemsRes, refundsRes] = await Promise.all([
      supabase.from('orders').select('id, order_number, total, payment_method').in('id', orderIds),
      supabase.from('profiles').select('user_id, full_name, email, mobile_number').in('user_id', userIds),
      supabase.from('return_items').select('*').in('return_id', returnIds),
      supabase.from('refunds').select('*').in('return_id', returnIds),
    ]);

    const ordersMap = new Map((ordersRes.data || []).map(o => [o.id, o]));
    const profilesMap = new Map((profilesRes.data || []).map(p => [p.user_id, p]));
    const itemsMap = new Map<string, ReturnItemRecord[]>();
    (itemsRes.data || []).forEach(item => {
      const list = itemsMap.get(item.return_id) || [];
      list.push(item as any);
      itemsMap.set(item.return_id, list);
    });
    const refundsMap = new Map((refundsRes.data || []).map(r => [r.return_id, r]));

    const enriched: ReturnRecord[] = data.map(r => ({
      ...r,
      images: (r.images as any) || [],
      order: ordersMap.get(r.order_id) as any,
      profile: profilesMap.get(r.user_id) as any,
      items: itemsMap.get(r.id) || [],
      refund: refundsMap.get(r.id) as any || null,
    }));

    setReturns(enriched);
    setIsLoading(false);
  }, []);

  useEffect(() => { fetchReturns(); }, [fetchReturns]);

  const filtered = returns.filter(r => {
    if (activeTab !== 'all' && r.status !== activeTab) return false;
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
      toast({ title: 'Return updated', description: `Status changed to ${status}` });
      log({ action: 'status_change', entityType: 'order', entityId: selectedReturn.id, details: { return_number: selectedReturn.return_number, new_status: status } });
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
          await supabase.rpc('release_stock_hold', { p_user_id: selectedReturn.user_id }); // cleanup
          await supabase.from('product_variants').update({
            stock_quantity: (await supabase.from('product_variants').select('stock_quantity').eq('id', item.variant_id).single()).data?.stock_quantity + item.quantity
          } as any).eq('id', item.variant_id);
        }
        if (item.product_id) {
          await supabase.from('products').update({
            stock_quantity: (await supabase.from('products').select('stock_quantity').eq('id', item.product_id).single()).data?.stock_quantity + item.quantity
          } as any).eq('id', item.product_id);
        }
      }
    }

    await updateStatus('refunded', { item_condition: itemCondition });
    log({ action: 'refund', entityType: 'order', entityId: selectedReturn.id, details: { refund_number: refundNumber, amount: totalAmount } });
  };

  const tabCounts = statusTabs.reduce((acc, tab) => {
    acc[tab.value] = tab.value === 'all' ? returns.length : returns.filter(r => r.status === tab.value).length;
    return acc;
  }, {} as Record<string, number>);

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
        </div>

        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search returns..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="flex-wrap h-auto gap-1">
            {statusTabs.map(tab => (
              <TabsTrigger key={tab.value} value={tab.value} className="text-xs">
                {tab.label}
                {tabCounts[tab.value] > 0 && (
                  <span className="ml-1.5 text-[10px] bg-muted-foreground/20 rounded-full px-1.5">{tabCounts[tab.value]}</span>
                )}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value={activeTab} className="mt-4">
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => <div key={i} className="h-20 bg-muted animate-pulse rounded-lg" />)}
              </div>
            ) : filtered.length === 0 ? (
              <Card><CardContent className="py-12 text-center text-muted-foreground">No returns found</CardContent></Card>
            ) : (
              <div className="space-y-3">
                {filtered.map(r => (
                  <Card key={r.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => openDetail(r)}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="space-y-1 min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-sm">{r.return_number}</span>
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColors[r.status]}`}>
                              {r.status.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Order: {r.order?.order_number || '—'} • {r.profile?.full_name || 'Unknown'}
                          </p>
                          <p className="text-xs text-muted-foreground">{r.reason}</p>
                          <p className="text-xs text-muted-foreground">{format(new Date(r.created_at), 'dd MMM yyyy, hh:mm a')}</p>
                        </div>
                        <div className="text-right space-y-1">
                          <p className="font-semibold text-sm">
                            ₹{(r.items || []).reduce((s, i) => s + i.price * i.quantity, 0).toFixed(0)}
                          </p>
                          <p className="text-xs text-muted-foreground">{(r.items || []).length} item(s)</p>
                          {r.images && r.images.length > 0 && (
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <ImageIcon className="h-3 w-3" /> {r.images.length} proof(s)
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Detail Dialog */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {selectedReturn && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  Return {selectedReturn.return_number}
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColors[selectedReturn.status]}`}>
                    {selectedReturn.status.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}
                  </span>
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-4">
                {/* Customer & Order Info */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs text-muted-foreground">Customer</Label>
                    <p className="text-sm font-medium">{selectedReturn.profile?.full_name || 'Unknown'}</p>
                    <p className="text-xs text-muted-foreground">{selectedReturn.profile?.email}</p>
                    <p className="text-xs text-muted-foreground">{selectedReturn.profile?.mobile_number}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Order</Label>
                    <p className="text-sm font-medium">{selectedReturn.order?.order_number}</p>
                    <p className="text-xs text-muted-foreground">Total: ₹{Number(selectedReturn.order?.total || 0).toFixed(0)}</p>
                    <p className="text-xs text-muted-foreground">Payment: {selectedReturn.order?.payment_method || '—'}</p>
                  </div>
                </div>

                <Separator />

                {/* Reason */}
                <div>
                  <Label className="text-xs text-muted-foreground">Return Reason</Label>
                  <p className="text-sm font-medium">{selectedReturn.reason}</p>
                  {selectedReturn.reason_details && <p className="text-xs text-muted-foreground mt-1">{selectedReturn.reason_details}</p>}
                </div>

                {/* Items */}
                <div>
                  <Label className="text-xs text-muted-foreground">Return Items</Label>
                  <div className="space-y-2 mt-1">
                    {(selectedReturn.items || []).map(item => (
                      <div key={item.id} className="flex justify-between items-center p-2 bg-muted/50 rounded-lg text-sm">
                        <div>
                          <p className="font-medium">{item.product_name}</p>
                          {item.variant_name && <p className="text-xs text-muted-foreground">{item.variant_name}</p>}
                        </div>
                        <div className="text-right">
                          <p>Qty: {item.quantity}</p>
                          <p className="text-xs">₹{(item.price * item.quantity).toFixed(0)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Proof Images */}
                {selectedReturn.images && selectedReturn.images.length > 0 && (
                  <div>
                    <Label className="text-xs text-muted-foreground">Proof Images</Label>
                    <div className="grid grid-cols-3 gap-2 mt-1">
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
                  </div>
                )}

                {/* Refund Info */}
                {selectedReturn.refund && (
                  <div className="p-3 bg-green-50 rounded-lg">
                    <Label className="text-xs text-muted-foreground">Refund</Label>
                    <p className="text-sm font-medium">{selectedReturn.refund.refund_number} — ₹{Number(selectedReturn.refund.amount).toFixed(0)}</p>
                    <p className="text-xs">Mode: {selectedReturn.refund.mode} | Status: {selectedReturn.refund.status}</p>
                  </div>
                )}

                <Separator />

                {/* Admin Notes */}
                <div>
                  <Label>Admin Notes</Label>
                  <Textarea value={adminNotes} onChange={e => setAdminNotes(e.target.value)} placeholder="Internal notes..." rows={2} />
                </div>

                {/* Actions based on status */}
                {selectedReturn.status === 'requested' && (
                  <div className="space-y-3">
                    <div className="flex gap-2">
                      <Button className="flex-1" onClick={() => updateStatus('approved')} disabled={isProcessing}>
                        <Check className="h-4 w-4 mr-1" /> Approve
                      </Button>
                      <Dialog>
                        <Button variant="destructive" className="flex-1" onClick={() => {}} disabled={isProcessing}>
                          <X className="h-4 w-4 mr-1" /> Reject
                        </Button>
                      </Dialog>
                    </div>
                    <div>
                      <Label>Reject Reason (if rejecting)</Label>
                      <Textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)} placeholder="Reason for rejection..." rows={2} />
                      <Button variant="destructive" size="sm" className="mt-2" onClick={() => updateStatus('rejected', { reject_reason: rejectReason })} disabled={isProcessing || !rejectReason}>
                        Confirm Reject
                      </Button>
                    </div>
                  </div>
                )}

                {selectedReturn.status === 'approved' && (
                  <div className="space-y-3">
                    <Label>Pickup Details</Label>
                    <div className="grid grid-cols-2 gap-2">
                      <Input placeholder="Partner name" value={pickupPartner} onChange={e => setPickupPartner(e.target.value)} />
                      <Input placeholder="Tracking number" value={pickupTracking} onChange={e => setPickupTracking(e.target.value)} />
                    </div>
                    <Button onClick={() => updateStatus('in_transit', { pickup_partner: pickupPartner, pickup_tracking: pickupTracking })} disabled={isProcessing}>
                      <Truck className="h-4 w-4 mr-1" /> Mark In Transit
                    </Button>
                  </div>
                )}

                {selectedReturn.status === 'in_transit' && (
                  <Button onClick={() => updateStatus('received')} disabled={isProcessing}>
                    <Package className="h-4 w-4 mr-1" /> Mark Received
                  </Button>
                )}

                {selectedReturn.status === 'received' && (
                  <div className="space-y-3">
                    <div>
                      <Label>Item Condition</Label>
                      <Select value={itemCondition} onValueChange={setItemCondition}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="good">Good — Restock</SelectItem>
                          <SelectItem value="damaged">Damaged — Do not restock</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Button onClick={processRefund} disabled={isProcessing}>
                      {isProcessing ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <DollarSign className="h-4 w-4 mr-1" />}
                      Process Refund
                    </Button>
                  </div>
                )}

                {selectedReturn.status === 'refunded' && (
                  <Button onClick={() => updateStatus('completed')} disabled={isProcessing}>
                    <Check className="h-4 w-4 mr-1" /> Mark Completed
                  </Button>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Image Preview */}
      <Dialog open={!!imagePreview} onOpenChange={() => setImagePreview(null)}>
        <DialogContent className="max-w-lg p-2">
          {imagePreview && <img src={imagePreview} alt="Proof" className="w-full rounded-lg" />}
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
