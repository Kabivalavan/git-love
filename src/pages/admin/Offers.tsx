import { useEffect, useState } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { DataTable, Column } from '@/components/admin/DataTable';
import { DetailPanel, DetailField, DetailSection } from '@/components/admin/DetailPanel';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus } from 'lucide-react';
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
  created_at: string;
}

const OFFER_TYPES = [
  { value: 'percentage', label: 'Percentage Off' },
  { value: 'flat', label: 'Flat Discount' },
  { value: 'buy_x_get_y', label: 'Buy X Get Y' },
];

export default function AdminOffers() {
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
    const { data, error } = await supabase
      .from('offers')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      setOffers((data || []) as Offer[]);
    }
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

  const handleRowClick = (offer: Offer) => {
    setSelectedOffer(offer);
    setIsDetailOpen(true);
  };

  const handleEdit = () => {
    if (selectedOffer) {
      setFormData(selectedOffer);
      setIsDetailOpen(false);
      setIsFormOpen(true);
    }
  };

  const handleCreate = () => {
    setFormData({
      type: 'percentage',
      is_active: true,
      auto_apply: false,
      value: 0,
    });
    setSelectedOffer(null);
    setIsFormOpen(true);
  };

  const handleDelete = async () => {
    if (!selectedOffer) return;
    setIsDeleting(true);

    const { error } = await supabase.from('offers').delete().eq('id', selectedOffer.id);

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Success', description: 'Offer deleted successfully' });
      setIsDetailOpen(false);
      fetchOffers();
    }
    setIsDeleting(false);
  };

  const handleSave = async () => {
    if (!formData.name || !formData.value) {
      toast({ title: 'Error', description: 'Name and value are required', variant: 'destructive' });
      return;
    }

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
      show_timer: (formData as any).show_timer ?? false,
    };

    if (selectedOffer) {
      const { error } = await supabase.from('offers').update(offerData).eq('id', selectedOffer.id);
      if (error) {
        toast({ title: 'Error', description: error.message, variant: 'destructive' });
      } else {
        toast({ title: 'Success', description: 'Offer updated successfully' });
        setIsFormOpen(false);
        fetchOffers();
      }
    } else {
      const { error } = await supabase.from('offers').insert([offerData]);
      if (error) {
        toast({ title: 'Error', description: error.message, variant: 'destructive' });
      } else {
        toast({ title: 'Success', description: 'Offer created successfully' });
        setIsFormOpen(false);
        fetchOffers();
      }
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
    {
      key: 'type',
      header: 'Type',
      render: (o) => OFFER_TYPES.find(t => t.value === o.type)?.label || o.type,
    },
    {
      key: 'value',
      header: 'Value',
      render: formatValue,
    },
    {
      key: 'auto_apply',
      header: 'Auto Apply',
      render: (o) => o.auto_apply ? 'Yes' : 'No',
    },
    {
      key: 'is_active',
      header: 'Status',
      render: (o) => (
        <Badge variant={o.is_active ? 'default' : 'secondary'}>
          {o.is_active ? 'Active' : 'Inactive'}
        </Badge>
      ),
    },
  ];

  return (
    <AdminLayout
      title="Offers"
      description="Manage promotional offers and discounts"
      actions={
        <Button onClick={handleCreate} className="bg-primary hover:bg-primary/90">
          <Plus className="h-4 w-4 mr-2" />
          Add Offer
        </Button>
      }
    >
      <DataTable<Offer>
        columns={columns}
        data={offers}
        isLoading={isLoading}
        onRowClick={handleRowClick}
        searchable
        searchPlaceholder="Search offers..."
        searchKeys={['name', 'description']}
        getRowId={(o) => o.id}
        emptyMessage="No offers found."
      />

      <DetailPanel
        isOpen={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
        title={selectedOffer?.name || 'Offer Details'}
        onEdit={handleEdit}
        onDelete={handleDelete}
        isDeleting={isDeleting}
      >
        {selectedOffer && (
          <div className="space-y-6">
            <DetailSection title="Offer Info">
              <DetailField label="Name" value={selectedOffer.name} />
              <DetailField label="Type" value={OFFER_TYPES.find(t => t.value === selectedOffer.type)?.label} />
              <DetailField label="Value" value={formatValue(selectedOffer)} />
              <DetailField label="Auto Apply" value={selectedOffer.auto_apply ? 'Yes' : 'No'} />
            </DetailSection>
            <DetailSection title="Conditions">
              <DetailField label="Min Order Value" value={selectedOffer.min_order_value ? `₹${selectedOffer.min_order_value}` : '-'} />
              <DetailField label="Max Discount" value={selectedOffer.max_discount ? `₹${selectedOffer.max_discount}` : '-'} />
            </DetailSection>
            <DetailSection title="Schedule">
              <DetailField label="Start Date" value={selectedOffer.start_date ? new Date(selectedOffer.start_date).toLocaleDateString() : 'Not set'} />
              <DetailField label="End Date" value={selectedOffer.end_date ? new Date(selectedOffer.end_date).toLocaleDateString() : 'Not set'} />
            </DetailSection>
            <div className="col-span-2">
              <DetailField label="Description" value={selectedOffer.description} />
            </div>
          </div>
        )}
      </DetailPanel>

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedOffer ? 'Edit Offer' : 'Create Offer'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  value={formData.name || ''}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
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
                    {OFFER_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {formData.type === 'buy_x_get_y' ? (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="buy_quantity">Buy Quantity *</Label>
                  <Input
                    id="buy_quantity"
                    type="number"
                    value={formData.buy_quantity || ''}
                    onChange={(e) => setFormData({ ...formData, buy_quantity: parseInt(e.target.value) })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="get_quantity">Get Quantity *</Label>
                  <Input
                    id="get_quantity"
                    type="number"
                    value={formData.get_quantity || ''}
                    onChange={(e) => setFormData({ ...formData, get_quantity: parseInt(e.target.value) })}
                  />
                </div>
              </div>
            ) : (
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
            )}

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
                <Label htmlFor="category">Apply to Category</Label>
                <Select
                  value={formData.category_id || 'none'}
                  onValueChange={(value) => setFormData({ ...formData, category_id: value === 'none' ? null : value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All categories" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">All Categories</SelectItem>
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="product">Apply to Product</Label>
                <Select
                  value={formData.product_id || 'none'}
                  onValueChange={(value) => setFormData({ ...formData, product_id: value === 'none' ? null : value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All products" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">All Products</SelectItem>
                    {products.map((prod) => (
                      <SelectItem key={prod.id} value={prod.id}>{prod.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
                rows={3}
                value={formData.description || ''}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>

            <div className="flex flex-wrap gap-6">
              <div className="flex items-center gap-2">
                <Switch
                  id="is_active"
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                />
                <Label htmlFor="is_active">Active</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="auto_apply"
                  checked={formData.auto_apply}
                  onCheckedChange={(checked) => setFormData({ ...formData, auto_apply: checked })}
                />
                <Label htmlFor="auto_apply">Auto Apply</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="show_timer"
                  checked={(formData as any).show_timer || false}
                  onCheckedChange={(checked) => setFormData({ ...formData, show_timer: checked } as any)}
                />
                <Label htmlFor="show_timer">Show Timer on Product Card</Label>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button variant="outline" onClick={() => setIsFormOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={isSaving}>
                {isSaving ? 'Saving...' : 'Save Offer'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
