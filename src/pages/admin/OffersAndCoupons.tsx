import { useState } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import AdminOffers from './Offers';
import AdminCoupons from './Coupons';

export default function AdminOffersAndCoupons() {
  const [activeTab, setActiveTab] = useState('offers');

  return (
    <AdminLayout title="Offers & Coupons" description="Manage promotional offers and coupon codes">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="offers">Offers</TabsTrigger>
          <TabsTrigger value="coupons">Coupons</TabsTrigger>
        </TabsList>
        <TabsContent value="offers">
          <OffersContent />
        </TabsContent>
        <TabsContent value="coupons">
          <CouponsContent />
        </TabsContent>
      </Tabs>
    </AdminLayout>
  );
}

// We'll inline the offers content without the AdminLayout wrapper
import { useEffect } from 'react';
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

// Offers Content
interface Offer {
  id: string;
  name: string;
  description: string | null;
  type: string;
  value: number;
  buy_quantity: number | null;
  get_quantity: number | null;
  min_order_value: number | null;
  max_discount: number | null;
  category_id: string | null;
  product_id: string | null;
  start_date: string | null;
  end_date: string | null;
  is_active: boolean;
  auto_apply: boolean;
  show_timer?: boolean;
  created_at: string;
}

const OFFER_TYPES = [
  { value: 'percentage', label: 'Percentage Off' },
  { value: 'flat', label: 'Flat Discount' },
  { value: 'buy_x_get_y', label: 'Buy X Get Y' },
];

function OffersContent() {
  const [offers, setOffers] = useState<Offer[]>([]);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [products, setProducts] = useState<{ id: string; name: string }[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedOffer, setSelectedOffer] = useState<Offer | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState<Partial<Offer>>({});
  const { toast } = useToast();

  useEffect(() => {
    fetchOffers();
    fetchCategories();
    fetchProducts();
  }, []);

  const fetchOffers = async () => {
    setIsLoading(true);
    const { data, error } = await supabase.from('offers').select('*').order('created_at', { ascending: false });
    if (error) toast({ title: 'Error', description: error.message, variant: 'destructive' });
    else setOffers((data || []) as Offer[]);
    setIsLoading(false);
  };

  const fetchCategories = async () => {
    const { data } = await supabase.from('categories').select('id, name').eq('is_active', true);
    setCategories(data || []);
  };

  const fetchProducts = async () => {
    const { data } = await supabase.from('products').select('id, name').eq('is_active', true);
    setProducts(data || []);
  };

  const handleRowClick = (offer: Offer) => { setSelectedOffer(offer); setIsDetailOpen(true); };
  const handleEdit = () => { if (selectedOffer) { setFormData(selectedOffer); setIsDetailOpen(false); setIsFormOpen(true); } };
  const handleCreate = () => { setFormData({ type: 'percentage', is_active: true, auto_apply: false, value: 0 }); setSelectedOffer(null); setIsFormOpen(true); };

  const handleDelete = async () => {
    if (!selectedOffer) return;
    setIsDeleting(true);
    const { error } = await supabase.from('offers').delete().eq('id', selectedOffer.id);
    if (error) toast({ title: 'Error', description: error.message, variant: 'destructive' });
    else { toast({ title: 'Deleted' }); setIsDetailOpen(false); fetchOffers(); }
    setIsDeleting(false);
  };

  const handleSave = async () => {
    if (!formData.name || !formData.value) { toast({ title: 'Error', description: 'Name and value required', variant: 'destructive' }); return; }
    setIsSaving(true);
    const offerData = {
      name: formData.name,
      description: formData.description,
      type: (formData.type || 'percentage') as 'percentage' | 'flat' | 'buy_x_get_y',
      value: formData.value,
      buy_quantity: formData.buy_quantity,
      get_quantity: formData.get_quantity,
      min_order_value: formData.min_order_value,
      max_discount: formData.max_discount,
      category_id: formData.category_id,
      product_id: formData.product_id,
      start_date: formData.start_date,
      end_date: formData.end_date,
      is_active: formData.is_active ?? true,
      auto_apply: formData.auto_apply ?? false,
      show_timer: formData.show_timer ?? false,
    };

    if (selectedOffer) {
      const { error } = await supabase.from('offers').update(offerData).eq('id', selectedOffer.id);
      if (error) toast({ title: 'Error', description: error.message, variant: 'destructive' });
      else { toast({ title: 'Updated' }); setIsFormOpen(false); fetchOffers(); }
    } else {
      const { error } = await supabase.from('offers').insert([offerData]);
      if (error) toast({ title: 'Error', description: error.message, variant: 'destructive' });
      else { toast({ title: 'Created' }); setIsFormOpen(false); fetchOffers(); }
    }
    setIsSaving(false);
  };

  const formatValue = (offer: Offer) => {
    if (offer.type === 'percentage') return `${offer.value}%`;
    if (offer.type === 'flat') return `₹${offer.value}`;
    return `Buy ${offer.buy_quantity} Get ${offer.get_quantity}`;
  };

  const columns: Column<Offer>[] = [
    { key: 'name', header: 'Name' },
    { key: 'type', header: 'Type', render: (o) => OFFER_TYPES.find(t => t.value === o.type)?.label || o.type },
    { key: 'value', header: 'Value', render: formatValue },
    { key: 'auto_apply', header: 'Auto Apply', render: (o) => o.auto_apply ? 'Yes' : 'No' },
    { key: 'is_active', header: 'Status', render: (o) => <Badge variant={o.is_active ? 'default' : 'secondary'}>{o.is_active ? 'Active' : 'Inactive'}</Badge> },
  ];

  return (
    <>
      <div className="flex justify-end mb-4">
        <Button onClick={handleCreate}><Plus className="h-4 w-4 mr-2" />Add Offer</Button>
      </div>
      <DataTable<Offer> columns={columns} data={offers} isLoading={isLoading} onRowClick={handleRowClick} searchable searchPlaceholder="Search offers..." searchKeys={['name', 'description']} getRowId={(o) => o.id} emptyMessage="No offers found." />

      <DetailPanel isOpen={isDetailOpen} onClose={() => setIsDetailOpen(false)} title={selectedOffer?.name || 'Offer'} onEdit={handleEdit} onDelete={handleDelete} isDeleting={isDeleting}>
        {selectedOffer && (
          <div className="space-y-6">
            <DetailSection title="Info">
              <DetailField label="Name" value={selectedOffer.name} />
              <DetailField label="Type" value={OFFER_TYPES.find(t => t.value === selectedOffer.type)?.label} />
              <DetailField label="Value" value={formatValue(selectedOffer)} />
              <DetailField label="Auto Apply" value={selectedOffer.auto_apply ? 'Yes' : 'No'} />
              <DetailField label="Show Timer" value={selectedOffer.show_timer ? 'Yes' : 'No'} />
            </DetailSection>
            <DetailSection title="Conditions">
              <DetailField label="Min Order" value={selectedOffer.min_order_value ? `₹${selectedOffer.min_order_value}` : '-'} />
              <DetailField label="Max Discount" value={selectedOffer.max_discount ? `₹${selectedOffer.max_discount}` : '-'} />
            </DetailSection>
            <DetailSection title="Schedule">
              <DetailField label="Start" value={selectedOffer.start_date ? new Date(selectedOffer.start_date).toLocaleDateString() : '-'} />
              <DetailField label="End" value={selectedOffer.end_date ? new Date(selectedOffer.end_date).toLocaleDateString() : '-'} />
            </DetailSection>
          </div>
        )}
      </DetailPanel>

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{selectedOffer ? 'Edit Offer' : 'Create Offer'}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Name *</Label><Input value={formData.name || ''} onChange={(e) => setFormData({ ...formData, name: e.target.value })} /></div>
              <div className="space-y-2"><Label>Type</Label>
                <Select value={formData.type || 'percentage'} onValueChange={(v) => setFormData({ ...formData, type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{OFFER_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            {formData.type === 'buy_x_get_y' ? (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Buy Qty *</Label><Input type="number" value={formData.buy_quantity || ''} onChange={e => setFormData({ ...formData, buy_quantity: parseInt(e.target.value) })} /></div>
                <div className="space-y-2"><Label>Get Qty *</Label><Input type="number" value={formData.get_quantity || ''} onChange={e => setFormData({ ...formData, get_quantity: parseInt(e.target.value) })} /></div>
              </div>
            ) : (
              <div className="space-y-2"><Label>{formData.type === 'percentage' ? 'Percentage Off *' : 'Flat Discount *'}</Label><Input type="number" value={formData.value || ''} onChange={e => setFormData({ ...formData, value: parseFloat(e.target.value) })} /></div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Min Order</Label><Input type="number" value={formData.min_order_value || ''} onChange={e => setFormData({ ...formData, min_order_value: parseFloat(e.target.value) })} /></div>
              <div className="space-y-2"><Label>Max Discount</Label><Input type="number" value={formData.max_discount || ''} onChange={e => setFormData({ ...formData, max_discount: parseFloat(e.target.value) })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Category</Label>
                <Select value={formData.category_id || 'none'} onValueChange={v => setFormData({ ...formData, category_id: v === 'none' ? null : v })}>
                  <SelectTrigger><SelectValue placeholder="All" /></SelectTrigger>
                  <SelectContent><SelectItem value="none">All</SelectItem>{categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>Product</Label>
                <Select value={formData.product_id || 'none'} onValueChange={v => setFormData({ ...formData, product_id: v === 'none' ? null : v })}>
                  <SelectTrigger><SelectValue placeholder="All" /></SelectTrigger>
                  <SelectContent><SelectItem value="none">All</SelectItem>{products.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Start Date</Label><Input type="datetime-local" value={formData.start_date?.slice(0, 16) || ''} onChange={e => setFormData({ ...formData, start_date: e.target.value })} /></div>
              <div className="space-y-2"><Label>End Date</Label><Input type="datetime-local" value={formData.end_date?.slice(0, 16) || ''} onChange={e => setFormData({ ...formData, end_date: e.target.value })} /></div>
            </div>
            <div className="space-y-2"><Label>Description</Label><Textarea rows={2} value={formData.description || ''} onChange={e => setFormData({ ...formData, description: e.target.value })} /></div>
            <div className="flex flex-wrap gap-6">
              <div className="flex items-center gap-2"><Switch checked={formData.is_active} onCheckedChange={c => setFormData({ ...formData, is_active: c })} /><Label>Active</Label></div>
              <div className="flex items-center gap-2"><Switch checked={formData.auto_apply} onCheckedChange={c => setFormData({ ...formData, auto_apply: c })} /><Label>Auto Apply</Label></div>
              <div className="flex items-center gap-2"><Switch checked={formData.show_timer || false} onCheckedChange={c => setFormData({ ...formData, show_timer: c })} /><Label>Show Timer</Label></div>
            </div>
            <div className="flex justify-end gap-3 pt-4">
              <Button variant="outline" onClick={() => setIsFormOpen(false)}>Cancel</Button>
              <Button onClick={handleSave} disabled={isSaving}>{isSaving ? 'Saving...' : 'Save'}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

// Coupons Content
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

function CouponsContent() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCoupon, setSelectedCoupon] = useState<Coupon | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState<Partial<Coupon>>({});
  const { toast } = useToast();

  useEffect(() => { fetchCoupons(); }, []);

  const fetchCoupons = async () => {
    setIsLoading(true);
    const { data, error } = await supabase.from('coupons').select('*').order('created_at', { ascending: false });
    if (error) toast({ title: 'Error', description: error.message, variant: 'destructive' });
    else setCoupons((data || []) as Coupon[]);
    setIsLoading(false);
  };

  const handleRowClick = (c: Coupon) => { setSelectedCoupon(c); setIsDetailOpen(true); };
  const handleEdit = () => { if (selectedCoupon) { setFormData(selectedCoupon); setIsDetailOpen(false); setIsFormOpen(true); } };
  const handleCreate = () => { setFormData({ type: 'percentage', is_active: true, value: 0, per_user_limit: 1, used_count: 0 }); setSelectedCoupon(null); setIsFormOpen(true); };

  const handleDelete = async () => {
    if (!selectedCoupon) return;
    setIsDeleting(true);
    const { error } = await supabase.from('coupons').delete().eq('id', selectedCoupon.id);
    if (error) toast({ title: 'Error', description: error.message, variant: 'destructive' });
    else { toast({ title: 'Deleted' }); setIsDetailOpen(false); fetchCoupons(); }
    setIsDeleting(false);
  };

  const handleSave = async () => {
    if (!formData.code || !formData.value) { toast({ title: 'Error', description: 'Code and value required', variant: 'destructive' }); return; }
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
      if (error) toast({ title: 'Error', description: error.message, variant: 'destructive' });
      else { toast({ title: 'Updated' }); setIsFormOpen(false); fetchCoupons(); }
    } else {
      const { error } = await supabase.from('coupons').insert([couponData]);
      if (error) toast({ title: 'Error', description: error.message, variant: 'destructive' });
      else { toast({ title: 'Created' }); setIsFormOpen(false); fetchCoupons(); }
    }
    setIsSaving(false);
  };

  const copyCode = (code: string) => { navigator.clipboard.writeText(code); toast({ title: 'Copied' }); };
  const formatValue = (c: Coupon) => c.type === 'percentage' ? `${c.value}%` : `₹${c.value}`;

  const columns: Column<Coupon>[] = [
    { key: 'code', header: 'Code', render: (c) => (
      <div className="flex items-center gap-2">
        <span className="font-mono font-medium">{c.code}</span>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); copyCode(c.code); }}><Copy className="h-3 w-3" /></Button>
      </div>
    ) },
    { key: 'type', header: 'Type', render: (c) => COUPON_TYPES.find(t => t.value === c.type)?.label || c.type },
    { key: 'value', header: 'Value', render: formatValue },
    { key: 'used_count', header: 'Usage', render: (c) => `${c.used_count}${c.usage_limit ? ` / ${c.usage_limit}` : ''}` },
    { key: 'is_active', header: 'Status', render: (c) => <Badge variant={c.is_active ? 'default' : 'secondary'}>{c.is_active ? 'Active' : 'Inactive'}</Badge> },
  ];

  return (
    <>
      <div className="flex justify-end mb-4">
        <Button onClick={handleCreate}><Plus className="h-4 w-4 mr-2" />Add Coupon</Button>
      </div>
      <DataTable<Coupon> columns={columns} data={coupons} isLoading={isLoading} onRowClick={handleRowClick} searchable searchPlaceholder="Search coupons..." searchKeys={['code', 'description']} getRowId={(c) => c.id} emptyMessage="No coupons found." />

      <DetailPanel isOpen={isDetailOpen} onClose={() => setIsDetailOpen(false)} title={selectedCoupon?.code || 'Coupon'} onEdit={handleEdit} onDelete={handleDelete} isDeleting={isDeleting}>
        {selectedCoupon && (
          <div className="space-y-6">
            <DetailSection title="Info">
              <DetailField label="Code" value={selectedCoupon.code} />
              <DetailField label="Type" value={COUPON_TYPES.find(t => t.value === selectedCoupon.type)?.label} />
              <DetailField label="Value" value={formatValue(selectedCoupon)} />
            </DetailSection>
            <DetailSection title="Limits">
              <DetailField label="Min Order" value={selectedCoupon.min_order_value ? `₹${selectedCoupon.min_order_value}` : '-'} />
              <DetailField label="Max Discount" value={selectedCoupon.max_discount ? `₹${selectedCoupon.max_discount}` : '-'} />
              <DetailField label="Usage" value={`${selectedCoupon.used_count}${selectedCoupon.usage_limit ? ` / ${selectedCoupon.usage_limit}` : ''}`} />
              <DetailField label="Per User" value={selectedCoupon.per_user_limit} />
            </DetailSection>
          </div>
        )}
      </DetailPanel>

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{selectedCoupon ? 'Edit Coupon' : 'Create Coupon'}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Code *</Label><Input value={formData.code || ''} onChange={e => setFormData({ ...formData, code: e.target.value.toUpperCase() })} className="font-mono" /></div>
              <div className="space-y-2"><Label>Type</Label>
                <Select value={formData.type || 'percentage'} onValueChange={v => setFormData({ ...formData, type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{COUPON_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2"><Label>{formData.type === 'percentage' ? 'Percentage Off *' : 'Flat Discount *'}</Label><Input type="number" value={formData.value || ''} onChange={e => setFormData({ ...formData, value: parseFloat(e.target.value) })} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Min Order</Label><Input type="number" value={formData.min_order_value || ''} onChange={e => setFormData({ ...formData, min_order_value: parseFloat(e.target.value) })} /></div>
              <div className="space-y-2"><Label>Max Discount</Label><Input type="number" value={formData.max_discount || ''} onChange={e => setFormData({ ...formData, max_discount: parseFloat(e.target.value) })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Usage Limit</Label><Input type="number" value={formData.usage_limit || ''} onChange={e => setFormData({ ...formData, usage_limit: parseInt(e.target.value) })} placeholder="Unlimited" /></div>
              <div className="space-y-2"><Label>Per User Limit</Label><Input type="number" value={formData.per_user_limit || 1} onChange={e => setFormData({ ...formData, per_user_limit: parseInt(e.target.value) })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Start Date</Label><Input type="datetime-local" value={formData.start_date?.slice(0, 16) || ''} onChange={e => setFormData({ ...formData, start_date: e.target.value })} /></div>
              <div className="space-y-2"><Label>End Date</Label><Input type="datetime-local" value={formData.end_date?.slice(0, 16) || ''} onChange={e => setFormData({ ...formData, end_date: e.target.value })} /></div>
            </div>
            <div className="space-y-2"><Label>Description</Label><Textarea rows={2} value={formData.description || ''} onChange={e => setFormData({ ...formData, description: e.target.value })} /></div>
            <div className="flex items-center gap-2"><Switch checked={formData.is_active} onCheckedChange={c => setFormData({ ...formData, is_active: c })} /><Label>Active</Label></div>
            <div className="flex justify-end gap-3 pt-4">
              <Button variant="outline" onClick={() => setIsFormOpen(false)}>Cancel</Button>
              <Button onClick={handleSave} disabled={isSaving}>{isSaving ? 'Saving...' : 'Save'}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}