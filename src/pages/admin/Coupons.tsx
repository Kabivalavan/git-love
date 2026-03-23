import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState, useCallback } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { DataTable, Column } from '@/components/admin/DataTable';
import { DetailPanel, DetailField, DetailSection } from '@/components/admin/DetailPanel';
import { supabase } from '@/integrations/supabase/client';
import { useAdminRealtimeInvalidation, ADMIN_KEYS } from '@/hooks/useAdminQueries';
import { fetchAdminCouponsPaginated } from '@/api/admin';
import { usePaginatedFetch } from '@/hooks/usePaginatedFetch';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Copy } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useActivityLog } from '@/hooks/useActivityLog';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface Coupon {
  id: string;
  code: string;
  description: string | null;
  type: string;
  value: number;
  min_order_value: number | null;
  max_discount: number | null;
  usage_limit: number | null;
  used_count: number;
  per_user_limit: number;
  start_date: string | null;
  end_date: string | null;
  is_active: boolean;
  show_on_storefront: boolean;
  show_on_cart: boolean;
  created_at: string;
}

const COUPON_TYPES = [
  { value: 'percentage', label: 'Percentage Off' },
  { value: 'flat', label: 'Flat Discount' },
];

function utcToISTLocal(utcStr: string | null): string {
  if (!utcStr) return '';
  const d = new Date(utcStr);
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(d);
  const get = (type: string) => parts.find(p => p.type === type)?.value || '';
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`;
}

function istLocalToUTC(localStr: string): string {
  if (!localStr) return '';
  const d = new Date(localStr + ':00+05:30');
  return d.toISOString();
}

function formatIST(utcStr: string | null): string {
  if (!utcStr) return 'Not set';
  return new Date(utcStr).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' });
}

export default function AdminCoupons() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const fetchCouponsFn = useCallback(async (from: number, to: number) => {
    try {
      return await fetchAdminCouponsPaginated(from, to);
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
      return { data: [], count: 0 };
    }
  }, [toast]);

  const { items: couponsRaw, isLoading, isLoadingMore, hasMore, sentinelRef, fetchInitial } = usePaginatedFetch<Coupon>({
    pageSize: 30,
    fetchFn: fetchCouponsFn,
    cacheKey: 'admin-coupons-paginated',
    cacheTimeMs: 3 * 60 * 1000,
  });

  useEffect(() => { fetchInitial(); }, []);

  const coupons = couponsRaw as Coupon[];

  useAdminRealtimeInvalidation(['coupons', 'coupon_usage'], [ADMIN_KEYS.coupons as unknown as string[]]);

  const [selectedCoupon, setSelectedCoupon] = useState<Coupon | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState<Partial<Coupon> & { start_date_local?: string; end_date_local?: string }>({});
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { log } = useActivityLog();
  const deactivatedCouponIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const now = new Date().toISOString();
    const toDeactivate = coupons.filter((c) =>
      c.is_active &&
      ((c.end_date && c.end_date < now) || (c.usage_limit !== null && c.used_count >= c.usage_limit)) &&
      !deactivatedCouponIdsRef.current.has(c.id)
    );

    if (toDeactivate.length === 0) return;

    const ids = toDeactivate.map((c) => c.id);
    ids.forEach((id) => deactivatedCouponIdsRef.current.add(id));

    supabase
      .from('coupons')
      .update({ is_active: false })
      .in('id', ids)
      .then(({ error }) => {
        if (error) {
          ids.forEach((id) => deactivatedCouponIdsRef.current.delete(id));
          return;
        }
        queryClient.invalidateQueries({ queryKey: ADMIN_KEYS.coupons });
      });
  }, [coupons, queryClient]);

  const handleRowClick = (coupon: Coupon) => {
    setSelectedCoupon(coupon);
    setIsDetailOpen(true);
  };

  const handleEdit = () => {
    if (selectedCoupon) {
      setFormData({
        ...selectedCoupon,
        start_date_local: utcToISTLocal(selectedCoupon.start_date),
        end_date_local: utcToISTLocal(selectedCoupon.end_date),
      });
      setIsDetailOpen(false);
      setIsFormOpen(true);
    }
  };

  const handleCreate = () => {
    setFormData({
      type: 'percentage',
      is_active: true,
      value: 0,
      per_user_limit: 1,
      used_count: 0,
      show_on_storefront: false,
      show_on_cart: false,
      start_date_local: '',
      end_date_local: '',
    });
    setSelectedCoupon(null);
    setIsFormOpen(true);
  };

  const handleDelete = async () => {
    if (!selectedCoupon) return;
    setIsDeleting(true);
    const { error } = await supabase.from('coupons').delete().eq('id', selectedCoupon.id);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Success', description: 'Coupon deleted successfully' });
      log({ action: 'delete', entityType: 'coupon', entityId: selectedCoupon.id, details: { name: selectedCoupon.code } });
      setIsDetailOpen(false);
      queryClient.invalidateQueries({ queryKey: ADMIN_KEYS.coupons });
    }
    setIsDeleting(false);
  };

  const handleSave = async () => {
    if (!formData.code || !formData.value) {
      toast({ title: 'Error', description: 'Code and value are required', variant: 'destructive' });
      return;
    }
    setIsSaving(true);

    const couponData = {
      code: formData.code.toUpperCase(),
      description: formData.description,
      type: (formData.type || 'percentage') as 'percentage' | 'flat' | 'buy_x_get_y',
      value: formData.value,
      min_order_value: formData.min_order_value,
      max_discount: formData.max_discount,
      usage_limit: formData.usage_limit,
      per_user_limit: formData.per_user_limit ?? 1,
      start_date: formData.start_date_local ? istLocalToUTC(formData.start_date_local) : null,
      end_date: formData.end_date_local ? istLocalToUTC(formData.end_date_local) : null,
      is_active: formData.is_active ?? true,
      show_on_storefront: formData.show_on_storefront ?? false,
      show_on_cart: formData.show_on_cart ?? false,
    };

    if (selectedCoupon) {
      const { error } = await supabase.from('coupons').update(couponData).eq('id', selectedCoupon.id);
      if (error) {
        toast({ title: 'Error', description: error.message, variant: 'destructive' });
      } else {
        toast({ title: 'Success', description: 'Coupon updated successfully' });
        log({ action: 'update', entityType: 'coupon', entityId: selectedCoupon.id, details: { name: formData.code } });
        setIsFormOpen(false);
        queryClient.invalidateQueries({ queryKey: ADMIN_KEYS.coupons });
      }
    } else {
      const { error } = await supabase.from('coupons').insert([couponData]);
      if (error) {
        toast({ title: 'Error', description: error.message, variant: 'destructive' });
      } else {
        toast({ title: 'Success', description: 'Coupon created successfully' });
        log({ action: 'create', entityType: 'coupon', details: { name: formData.code } });
        setIsFormOpen(false);
        queryClient.invalidateQueries({ queryKey: ADMIN_KEYS.coupons });
      }
    }
    setIsSaving(false);
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast({ title: 'Copied', description: 'Coupon code copied to clipboard' });
  };

  const formatValue = (coupon: Coupon) => {
    return coupon.type === 'percentage' ? `${coupon.value}%` : `₹${Math.round(coupon.value)}`;
  };

  const columns: Column<Coupon>[] = [
    {
      key: 'code', header: 'Code',
      render: (c) => (
        <div className="flex items-center gap-2">
          <span className="font-mono font-medium">{c.code}</span>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); copyCode(c.code); }}>
            <Copy className="h-3 w-3" />
          </Button>
        </div>
      ),
    },
    { key: 'type', header: 'Type', render: (c) => COUPON_TYPES.find(t => t.value === c.type)?.label || c.type },
    { key: 'value', header: 'Value', render: formatValue },
    { key: 'used_count', header: 'Usage', render: (c) => `${c.used_count}${c.usage_limit ? ` / ${c.usage_limit}` : ''}` },
    {
      key: 'show_on_storefront', header: 'Display',
      render: (c) => (
        <div className="flex gap-1 flex-wrap">
          {c.show_on_storefront && <Badge variant="outline" className="text-[10px]">Products</Badge>}
          {c.show_on_cart && <Badge variant="outline" className="text-[10px]">Cart</Badge>}
          {!c.show_on_storefront && !c.show_on_cart && <span className="text-muted-foreground text-xs">Hidden</span>}
        </div>
      ),
    },
    {
      key: 'is_active', header: 'Status',
      render: (c) => (
        <Badge variant={c.is_active ? 'default' : 'secondary'}>
          {c.is_active ? 'Active' : 'Inactive'}
        </Badge>
      ),
    },
  ];

  return (
    <AdminLayout
      title="Coupons"
      description="Manage discount coupon codes"
      actions={
        <Button onClick={handleCreate} className="bg-primary hover:bg-primary/90">
          <Plus className="h-4 w-4 mr-2" />
          Add Coupon
        </Button>
      }
    >
      <DataTable<Coupon>
        columns={columns}
        data={coupons}
        isLoading={isLoading}
        onRowClick={handleRowClick}
        searchable
        searchPlaceholder="Search coupons..."
        searchKeys={['code', 'description']}
        getRowId={(c) => c.id}
        emptyMessage="No coupons found."
      />

      <DetailPanel
        isOpen={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
        title={selectedCoupon?.code || 'Coupon Details'}
        onEdit={handleEdit}
        onDelete={handleDelete}
        isDeleting={isDeleting}
      >
        {selectedCoupon && (
          <div className="space-y-6">
            <DetailSection title="Coupon Info">
              <DetailField label="Code" value={selectedCoupon.code} />
              <DetailField label="Description" value={selectedCoupon.description || '-'} />
              <DetailField label="Type" value={COUPON_TYPES.find(t => t.value === selectedCoupon.type)?.label || selectedCoupon.type} />
              <DetailField label="Value" value={formatValue(selectedCoupon)} />
              <DetailField label="Status" value={selectedCoupon.is_active ? 'Active ✓' : 'Inactive'} />
            </DetailSection>
            <DetailSection title="Display Settings">
              <DetailField label="Show on Product Pages" value={selectedCoupon.show_on_storefront ? 'Yes ✓' : 'No'} />
              <DetailField label="Show on Cart Page" value={selectedCoupon.show_on_cart ? 'Yes ✓' : 'No'} />
            </DetailSection>
            <DetailSection title="Conditions">
              <DetailField label="Min Order Value" value={selectedCoupon.min_order_value ? `₹${Math.round(selectedCoupon.min_order_value)}` : '-'} />
              <DetailField label="Max Discount" value={selectedCoupon.max_discount ? `₹${Math.round(selectedCoupon.max_discount)}` : '-'} />
            </DetailSection>
            <DetailSection title="Usage Limits">
              <DetailField label="Total Limit" value={selectedCoupon.usage_limit ?? 'Unlimited'} />
              <DetailField label="Per User Limit" value={selectedCoupon.per_user_limit} />
              <DetailField label="Times Used" value={selectedCoupon.used_count} />
            </DetailSection>
            <DetailSection title="Schedule (IST)">
              <DetailField label="Start Date" value={formatIST(selectedCoupon.start_date)} />
              <DetailField label="End Date" value={formatIST(selectedCoupon.end_date)} />
            </DetailSection>
          </div>
        )}
      </DetailPanel>

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedCoupon ? 'Edit Coupon' : 'Create Coupon'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="code">Coupon Code *</Label>
                <Input
                  id="code"
                  value={formData.code || ''}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                  placeholder="e.g., SAVE20"
                  className="font-mono"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="type">Type</Label>
                <Select
                  value={formData.type || 'percentage'}
                  onValueChange={(value) => setFormData({ ...formData, type: value })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {COUPON_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="value">
                {formData.type === 'percentage' ? 'Percentage Off *' : 'Flat Discount Amount *'}
              </Label>
              <Input
                id="value"
                type="number"
                step={formData.type === 'percentage' ? '1' : '1'}
                value={formData.value || ''}
                onChange={(e) => setFormData({ ...formData, value: parseFloat(e.target.value) })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="min_order_value">Min Order Value</Label>
                <Input
                  id="min_order_value"
                  type="number"
                  step="1"
                  value={formData.min_order_value || ''}
                  onChange={(e) => setFormData({ ...formData, min_order_value: parseFloat(e.target.value) })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="max_discount">Max Discount</Label>
                <Input
                  id="max_discount"
                  type="number"
                  step="1"
                  value={formData.max_discount || ''}
                  onChange={(e) => setFormData({ ...formData, max_discount: parseFloat(e.target.value) })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="usage_limit">Total Usage Limit</Label>
                <Input
                  id="usage_limit"
                  type="number"
                  value={formData.usage_limit || ''}
                  onChange={(e) => setFormData({ ...formData, usage_limit: parseInt(e.target.value) })}
                  placeholder="Unlimited"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="per_user_limit">Per User Limit</Label>
                <Input
                  id="per_user_limit"
                  type="number"
                  value={formData.per_user_limit || 1}
                  onChange={(e) => setFormData({ ...formData, per_user_limit: parseInt(e.target.value) })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="start_date">Start Date (IST)</Label>
                <Input
                  id="start_date"
                  type="datetime-local"
                  value={formData.start_date_local || ''}
                  onChange={(e) => setFormData({ ...formData, start_date_local: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="end_date">End Date (IST)</Label>
                <Input
                  id="end_date"
                  type="datetime-local"
                  value={formData.end_date_local || ''}
                  onChange={(e) => setFormData({ ...formData, end_date_local: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                rows={2}
                value={formData.description || ''}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>

            <div className="space-y-3 border border-border rounded-xl p-4">
              <p className="text-sm font-semibold text-foreground">Display & Status</p>
              <div className="flex items-center gap-2">
                <Switch
                  id="is_active"
                  checked={formData.is_active ?? true}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                />
                <Label htmlFor="is_active">Active</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="show_on_storefront"
                  checked={formData.show_on_storefront ?? false}
                  onCheckedChange={(checked) => setFormData({ ...formData, show_on_storefront: checked })}
                />
                <div>
                  <Label htmlFor="show_on_storefront">Show on Product Pages</Label>
                  <p className="text-xs text-muted-foreground">Display coupon on all product detail pages</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="show_on_cart"
                  checked={formData.show_on_cart ?? false}
                  onCheckedChange={(checked) => setFormData({ ...formData, show_on_cart: checked })}
                />
                <div>
                  <Label htmlFor="show_on_cart">Show on Cart Page</Label>
                  <p className="text-xs text-muted-foreground">Display coupon in cart page for easy apply</p>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button variant="outline" onClick={() => setIsFormOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={isSaving}>
                {isSaving ? 'Saving...' : 'Save Coupon'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
