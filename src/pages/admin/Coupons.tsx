import { useEffect, useState } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { DataTable, Column } from '@/components/admin/DataTable';
import { DetailPanel, DetailField, DetailSection } from '@/components/admin/DetailPanel';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Copy } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
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
  created_at: string;
}

const COUPON_TYPES = [
  { value: 'percentage', label: 'Percentage Off' },
  { value: 'flat', label: 'Flat Discount' },
];

export default function AdminCoupons() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCoupon, setSelectedCoupon] = useState<Coupon | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState<Partial<Coupon>>({});
  const { toast } = useToast();

  useEffect(() => {
    fetchCoupons();
  }, []);

  const fetchCoupons = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('coupons')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      setCoupons((data || []) as Coupon[]);
    }
    setIsLoading(false);
  };

  const handleRowClick = (coupon: Coupon) => {
    setSelectedCoupon(coupon);
    setIsDetailOpen(true);
  };

  const handleEdit = () => {
    if (selectedCoupon) {
      setFormData(selectedCoupon);
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
      setIsDetailOpen(false);
      fetchCoupons();
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
      start_date: formData.start_date,
      end_date: formData.end_date,
      is_active: formData.is_active ?? true,
    };

    if (selectedCoupon) {
      const { error } = await supabase.from('coupons').update(couponData).eq('id', selectedCoupon.id);
      if (error) {
        toast({ title: 'Error', description: error.message, variant: 'destructive' });
      } else {
        toast({ title: 'Success', description: 'Coupon updated successfully' });
        setIsFormOpen(false);
        fetchCoupons();
      }
    } else {
      const { error } = await supabase.from('coupons').insert([couponData]);
      if (error) {
        toast({ title: 'Error', description: error.message, variant: 'destructive' });
      } else {
        toast({ title: 'Success', description: 'Coupon created successfully' });
        setIsFormOpen(false);
        fetchCoupons();
      }
    }
    setIsSaving(false);
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast({ title: 'Copied', description: 'Coupon code copied to clipboard' });
  };

  const formatValue = (coupon: Coupon) => {
    return coupon.type === 'percentage' ? `${coupon.value}%` : `₹${coupon.value}`;
  };

  const columns: Column<Coupon>[] = [
    {
      key: 'code',
      header: 'Code',
      render: (c) => (
        <div className="flex items-center gap-2">
          <span className="font-mono font-medium">{c.code}</span>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); copyCode(c.code); }}>
            <Copy className="h-3 w-3" />
          </Button>
        </div>
      ),
    },
    {
      key: 'type',
      header: 'Type',
      render: (c) => COUPON_TYPES.find(t => t.value === c.type)?.label || c.type,
    },
    {
      key: 'value',
      header: 'Value',
      render: formatValue,
    },
    {
      key: 'used_count',
      header: 'Usage',
      render: (c) => `${c.used_count}${c.usage_limit ? ` / ${c.usage_limit}` : ''}`,
    },
    {
      key: 'is_active',
      header: 'Status',
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
              <DetailField label="Type" value={COUPON_TYPES.find(t => t.value === selectedCoupon.type)?.label} />
              <DetailField label="Value" value={formatValue(selectedCoupon)} />
              <DetailField label="Status" value={selectedCoupon.is_active ? 'Active' : 'Inactive'} />
            </DetailSection>
            <DetailSection title="Conditions">
              <DetailField label="Min Order Value" value={selectedCoupon.min_order_value ? `₹${selectedCoupon.min_order_value}` : '-'} />
              <DetailField label="Max Discount" value={selectedCoupon.max_discount ? `₹${selectedCoupon.max_discount}` : '-'} />
            </DetailSection>
            <DetailSection title="Usage Limits">
              <DetailField label="Total Limit" value={selectedCoupon.usage_limit || 'Unlimited'} />
              <DetailField label="Per User Limit" value={selectedCoupon.per_user_limit} />
              <DetailField label="Times Used" value={selectedCoupon.used_count} />
            </DetailSection>
            <DetailSection title="Schedule">
              <DetailField label="Start Date" value={selectedCoupon.start_date ? new Date(selectedCoupon.start_date).toLocaleDateString() : 'Not set'} />
              <DetailField label="End Date" value={selectedCoupon.end_date ? new Date(selectedCoupon.end_date).toLocaleDateString() : 'Not set'} />
            </DetailSection>
            <div className="col-span-2">
              <DetailField label="Description" value={selectedCoupon.description} />
            </div>
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
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {COUPON_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
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
                step={formData.type === 'percentage' ? '1' : '0.01'}
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
                  step="0.01"
                  value={formData.min_order_value || ''}
                  onChange={(e) => setFormData({ ...formData, min_order_value: parseFloat(e.target.value) })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="max_discount">Max Discount</Label>
                <Input
                  id="max_discount"
                  type="number"
                  step="0.01"
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
                <Label htmlFor="start_date">Start Date</Label>
                <Input
                  id="start_date"
                  type="datetime-local"
                  value={formData.start_date?.slice(0, 16) || ''}
                  onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="end_date">End Date</Label>
                <Input
                  id="end_date"
                  type="datetime-local"
                  value={formData.end_date?.slice(0, 16) || ''}
                  onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
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

            <div className="flex items-center gap-2">
              <Switch
                id="is_active"
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
              />
              <Label htmlFor="is_active">Active</Label>
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
