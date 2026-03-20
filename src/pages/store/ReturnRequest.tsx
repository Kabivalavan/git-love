import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Upload, X, Loader2, AlertCircle, CheckCircle } from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import type { Order, OrderItem } from '@/types/database';

const RETURN_REASONS = [
  'Damaged product',
  'Wrong item received',
  'Quality issue',
  'Not as expected',
  'Size/fit issue',
  'Other',
];

interface ReturnSettings {
  defaultReturnWindow: number;
  requireReason: boolean;
  requireImageProof: boolean;
  autoApprove: boolean;
  pickupEnabled: boolean;
  refundMode: string;
  returnShippingCharges: string;
  restockingFee: number;
}

export default function ReturnRequestPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  const [order, setOrder] = useState<Order | null>(null);
  const [items, setItems] = useState<OrderItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedItems, setSelectedItems] = useState<Record<string, { selected: boolean; qty: number }>>({});
  const [reason, setReason] = useState('');
  const [reasonDetails, setReasonDetails] = useState('');
  const [proofImages, setProofImages] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [returnSettings, setReturnSettings] = useState<ReturnSettings>({
    defaultReturnWindow: 7,
    requireReason: true,
    requireImageProof: true,
    autoApprove: false,
    pickupEnabled: true,
    refundMode: 'original',
    returnShippingCharges: 'customer',
    restockingFee: 0,
  });
  const [existingReturns, setExistingReturns] = useState<string[]>([]);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (user && orderId) fetchData();
  }, [user, orderId]);

  const fetchData = async () => {
    if (!user || !orderId) return;
    setIsLoading(true);

    const [orderRes, itemsRes, settingsRes, returnsRes] = await Promise.all([
      supabase.from('orders').select('*').eq('id', orderId).eq('user_id', user.id).single(),
      supabase.from('order_items').select('*').eq('order_id', orderId),
      supabase.from('store_settings').select('value').eq('key', 'return_settings').single(),
      supabase.from('returns').select('id, return_items(order_item_id)').eq('order_id', orderId).eq('user_id', user.id).neq('status', 'rejected' as any),
    ]);

    setOrder(orderRes.data as unknown as Order);
    setItems((itemsRes.data || []) as unknown as OrderItem[]);

    if (settingsRes.data?.value) {
      setReturnSettings(settingsRes.data.value as unknown as ReturnSettings);
    }

    const returned: string[] = [];
    (returnsRes.data || []).forEach((r: any) => {
      (r.return_items || []).forEach((ri: any) => { if (ri.order_item_id) returned.push(ri.order_item_id); });
    });
    setExistingReturns(returned);

    setIsLoading(false);
  };

  const isWithinWindow = order && order.status === 'delivered' &&
    differenceInDays(new Date(), new Date(order.updated_at)) <= returnSettings.defaultReturnWindow;

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !user) return;
    setIsUploading(true);

    for (const file of Array.from(files)) {
      const ext = file.name.split('.').pop();
      const path = `${user.id}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from('returns').upload(path, file);
      if (!error) {
        const { data } = supabase.storage.from('returns').getPublicUrl(path);
        setProofImages(prev => [...prev, data.publicUrl]);
      }
    }
    setIsUploading(false);
  };

  const toggleItem = (itemId: string, item: OrderItem) => {
    setSelectedItems(prev => ({
      ...prev,
      [itemId]: prev[itemId]?.selected
        ? { ...prev[itemId], selected: false }
        : { selected: true, qty: item.quantity },
    }));
  };

  const handleSubmit = async () => {
    if (!user || !order) return;

    const selected = Object.entries(selectedItems).filter(([, v]) => v.selected);
    if (selected.length === 0) {
      toast({ title: 'Select items', description: 'Please select at least one item to return', variant: 'destructive' });
      return;
    }
    if (returnSettings.requireReason && !reason) {
      toast({ title: 'Select reason', description: 'Please select a return reason', variant: 'destructive' });
      return;
    }
    if (returnSettings.requireImageProof && proofImages.length === 0) {
      toast({ title: 'Upload proof', description: 'Please upload at least one proof image', variant: 'destructive' });
      return;
    }

    setIsSubmitting(true);
    const returnNumber = 'RET' + format(new Date(), 'yyyyMMdd') + Math.floor(Math.random() * 10000).toString().padStart(4, '0');

    const { data: returnData, error: returnError } = await supabase.from('returns').insert({
      return_number: returnNumber,
      order_id: order.id,
      user_id: user.id,
      status: returnSettings.autoApprove ? 'approved' as any : 'requested' as any,
      reason,
      reason_details: reasonDetails || null,
      images: proofImages as any,
    }).select('id').single();

    if (returnError || !returnData) {
      toast({ title: 'Error', description: returnError?.message || 'Failed to submit', variant: 'destructive' });
      setIsSubmitting(false);
      return;
    }

    const returnItems = selected.map(([itemId, { qty }]) => {
      const item = items.find(i => i.id === itemId)!;
      return {
        return_id: returnData.id,
        order_item_id: itemId,
        product_id: item.product_id,
        variant_id: item.variant_id,
        product_name: item.product_name,
        variant_name: item.variant_name,
        quantity: qty,
        price: item.price,
      };
    });

    await supabase.from('return_items').insert(returnItems);

    setSubmitted(true);
    setIsSubmitting(false);
    toast({ title: 'Return submitted', description: `Return ${returnNumber} has been created` });
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map(i => <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />)}
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="py-12 max-w-lg mx-auto text-center">
        <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
        <h2 className="text-2xl font-bold mb-2">Return Request Submitted</h2>
        <p className="text-muted-foreground mb-6">
          Your return request has been submitted. You'll be notified once it's reviewed.
        </p>
        <div className="flex gap-3 justify-center">
          <Button asChild variant="outline"><Link to="/account">My Orders</Link></Button>
          <Button asChild><Link to="/account/returns">Track Returns</Link></Button>
        </div>
      </div>
    );
  }

  if (!order || order.status !== 'delivered') {
    return (
      <div className="py-12 max-w-lg mx-auto text-center">
        <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
        <h2 className="text-xl font-bold mb-2">Return Not Available</h2>
        <p className="text-muted-foreground">Returns can only be raised for delivered orders.</p>
        <Button asChild className="mt-4"><Link to="/account">Back to Orders</Link></Button>
      </div>
    );
  }

  if (!isWithinWindow) {
    return (
      <div className="py-12 max-w-lg mx-auto text-center">
        <AlertCircle className="h-12 w-12 text-amber-500 mx-auto mb-4" />
        <h2 className="text-xl font-bold mb-2">Return Window Expired</h2>
        <p className="text-muted-foreground">
          The {returnSettings.defaultReturnWindow}-day return window for this order has passed.
        </p>
        <Button asChild className="mt-4"><Link to="/account">Back to Orders</Link></Button>
      </div>
    );
  }

  const returnableItems = items.filter(i => !existingReturns.includes(i.id));

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" asChild>
        <Link to={`/account/order/${orderId}`}><ArrowLeft className="h-4 w-4 mr-1" /> Back to Order</Link>
      </Button>

      <h1 className="text-2xl font-bold mb-1">Request Return / Refund</h1>
      <p className="text-sm text-muted-foreground mb-6">Order {order.order_number}</p>

      {/* Step 1: Select Items */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">1. Select Items to Return</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {returnableItems.length === 0 ? (
            <p className="text-sm text-muted-foreground">All items from this order are already in a return request.</p>
          ) : (
            returnableItems.map(item => (
              <div key={item.id} className="flex items-start gap-3 p-3 border rounded-lg">
                <Checkbox
                  checked={selectedItems[item.id]?.selected || false}
                  onCheckedChange={() => toggleItem(item.id, item)}
                />
                <div className="flex-1">
                  <p className="text-sm font-medium">{item.product_name}</p>
                  {item.variant_name && <p className="text-xs text-muted-foreground">{item.variant_name}</p>}
                  <p className="text-xs text-muted-foreground">₹{Number(item.price).toFixed(0)} × {item.quantity}</p>
                </div>
                {selectedItems[item.id]?.selected && item.quantity > 1 && (
                  <Select
                    value={String(selectedItems[item.id]?.qty || item.quantity)}
                    onValueChange={v => setSelectedItems(prev => ({ ...prev, [item.id]: { ...prev[item.id], qty: Number(v) } }))}
                  >
                    <SelectTrigger className="w-20 h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: item.quantity }, (_, i) => i + 1).map(n => (
                        <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Step 2: Reason */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">2. Select Reason</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Select value={reason} onValueChange={setReason}>
            <SelectTrigger><SelectValue placeholder="Select a reason..." /></SelectTrigger>
            <SelectContent>
              {RETURN_REASONS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
            </SelectContent>
          </Select>
          {reason === 'Other' && (
            <Textarea placeholder="Please describe..." value={reasonDetails} onChange={e => setReasonDetails(e.target.value)} rows={3} />
          )}
        </CardContent>
      </Card>

      {/* Step 3: Proof */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">3. Upload Proof Images {returnSettings.requireImageProof && <span className="text-destructive">*</span>}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-2 mb-3">
            {proofImages.map((img, i) => (
              <div key={i} className="relative aspect-square">
                <img src={img} alt="" className="w-full h-full object-cover rounded-lg border" />
                <button
                  onClick={() => setProofImages(prev => prev.filter((_, idx) => idx !== i))}
                  className="absolute -top-1 -right-1 bg-destructive text-white rounded-full h-5 w-5 flex items-center justify-center"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
          <label className="flex items-center gap-2 cursor-pointer text-sm text-primary hover:underline">
            {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {isUploading ? 'Uploading...' : 'Upload Images'}
            <input type="file" accept="image/*" multiple onChange={handleImageUpload} className="hidden" disabled={isUploading} />
          </label>
        </CardContent>
      </Card>

      {/* Summary & Submit */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-medium">Refund Amount</span>
            <span className="text-lg font-bold">
              ₹{Object.entries(selectedItems)
                .filter(([, v]) => v.selected)
                .reduce((sum, [id, { qty }]) => {
                  const item = items.find(i => i.id === id);
                  return sum + (item ? item.price * qty : 0);
                }, 0)
                .toFixed(0)}
            </span>
          </div>
          <Button
            className="w-full"
            size="lg"
            onClick={handleSubmit}
            disabled={isSubmitting || Object.values(selectedItems).filter(v => v.selected).length === 0}
          >
            {isSubmitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
            Submit Return Request
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}