import { useEffect, useState } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { DataTable, Column } from '@/components/admin/DataTable';
import { DetailPanel, DetailField, DetailSection } from '@/components/admin/DetailPanel';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Loader2, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { ShimmerTable } from '@/components/ui/shimmer';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { ImageUpload } from '@/components/ui/image-upload';
import type { Product } from '@/types/database';

interface Bundle {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  bundle_price: number;
  compare_price: number | null;
  is_active: boolean;
  image_url: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
  items?: BundleItem[];
}

interface BundleItem {
  id: string;
  bundle_id: string;
  product_id: string;
  quantity: number;
  sort_order: number;
  product?: Product;
}

interface BundleItemForm {
  product_id: string;
  quantity: string;
}

export default function AdminBundles() {
  const [bundles, setBundles] = useState<Bundle[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedBundle, setSelectedBundle] = useState<Bundle | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState<Partial<Bundle>>({});
  const [itemForms, setItemForms] = useState<BundleItemForm[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    fetchBundles();
    fetchProducts();
  }, []);

  const fetchBundles = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('bundles')
      .select('*, items:bundle_items(*, product:products(name, price, images:product_images(*)))')
      .order('created_at', { ascending: false });

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      setBundles((data || []) as unknown as Bundle[]);
    }
    setIsLoading(false);
  };

  const fetchProducts = async () => {
    const { data } = await supabase.from('products').select('*').eq('is_active', true).order('name');
    setProducts((data || []) as unknown as Product[]);
  };

  const handleRowClick = (bundle: Bundle) => {
    setSelectedBundle(bundle);
    setIsDetailOpen(true);
  };

  const handleCreate = () => {
    setFormData({ is_active: true, sort_order: 0 });
    setItemForms([{ product_id: '', quantity: '1' }]);
    setSelectedBundle(null);
    setIsFormOpen(true);
  };

  const handleEdit = () => {
    if (!selectedBundle) return;
    setFormData({ ...selectedBundle });
    setItemForms(
      selectedBundle.items?.map(i => ({
        product_id: i.product_id,
        quantity: i.quantity.toString(),
      })) || [{ product_id: '', quantity: '1' }]
    );
    setIsDetailOpen(false);
    setIsFormOpen(true);
  };

  const handleDelete = async () => {
    if (!selectedBundle) return;
    setIsDeleting(true);
    const { error } = await supabase.from('bundles').delete().eq('id', selectedBundle.id);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Deleted', description: 'Bundle deleted' });
      setIsDetailOpen(false);
      fetchBundles();
    }
    setIsDeleting(false);
  };

  const handleSave = async () => {
    if (!formData.name || !formData.bundle_price) {
      toast({ title: 'Error', description: 'Name and price are required', variant: 'destructive' });
      return;
    }
    const validItems = itemForms.filter(i => i.product_id);
    if (validItems.length === 0) {
      toast({ title: 'Error', description: 'Add at least one product', variant: 'destructive' });
      return;
    }

    setIsSaving(true);
    const slug = formData.slug || formData.name!.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

    const bundleData = {
      name: formData.name!,
      slug,
      description: formData.description || null,
      bundle_price: formData.bundle_price!,
      compare_price: formData.compare_price || null,
      is_active: formData.is_active ?? true,
      image_url: formData.image_url || null,
      sort_order: formData.sort_order ?? 0,
    };

    try {
      let bundleId: string;
      if (selectedBundle) {
        const { error } = await supabase.from('bundles').update(bundleData).eq('id', selectedBundle.id);
        if (error) throw error;
        bundleId = selectedBundle.id;
        await supabase.from('bundle_items').delete().eq('bundle_id', bundleId);
      } else {
        const { data, error } = await supabase.from('bundles').insert([bundleData]).select().single();
        if (error) throw error;
        bundleId = data.id;
      }

      const itemRecords = validItems.map((item, idx) => ({
        bundle_id: bundleId,
        product_id: item.product_id,
        quantity: parseInt(item.quantity) || 1,
        sort_order: idx,
      }));
      await supabase.from('bundle_items').insert(itemRecords);

      toast({ title: 'Success', description: `Bundle ${selectedBundle ? 'updated' : 'created'}` });
      setIsFormOpen(false);
      fetchBundles();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
    setIsSaving(false);
  };

  const columns: Column<Bundle>[] = [
    {
      key: 'name',
      header: 'Bundle',
      render: (b) => (
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-md overflow-hidden bg-muted">
            {b.image_url ? (
              <img src={b.image_url} alt={b.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">📦</div>
            )}
          </div>
          <span className="font-medium">{b.name}</span>
        </div>
      ),
    },
    {
      key: 'bundle_price',
      header: 'Price',
      render: (b) => (
        <div>
          <span className="font-medium">₹{Number(b.bundle_price).toFixed(0)}</span>
          {b.compare_price && b.compare_price > b.bundle_price && (
            <span className="text-xs text-muted-foreground line-through ml-2">₹{Number(b.compare_price).toFixed(0)}</span>
          )}
        </div>
      ),
    },
    {
      key: 'items',
      header: 'Products',
      render: (b) => <Badge variant="secondary">{b.items?.length || 0} items</Badge>,
    },
    {
      key: 'is_active',
      header: 'Status',
      render: (b) => <Badge variant={b.is_active ? 'default' : 'secondary'}>{b.is_active ? 'Active' : 'Inactive'}</Badge>,
    },
  ];

  return (
    <AdminLayout
      title="Bundles"
      description="Create and manage product bundles"
      actions={<Button onClick={handleCreate}><Plus className="h-4 w-4 mr-2" />Create Bundle</Button>}
    >
      {isLoading ? <ShimmerTable rows={4} columns={4} /> : (
        <DataTable<Bundle>
          columns={columns}
          data={bundles}
          isLoading={false}
          onRowClick={handleRowClick}
          searchable
          searchPlaceholder="Search bundles..."
          searchKeys={['name']}
          getRowId={(b) => b.id}
          emptyMessage="No bundles yet. Create one to offer combo deals."
        />
      )}

      <DetailPanel
        isOpen={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
        title={selectedBundle?.name || 'Bundle Details'}
        onEdit={handleEdit}
        onDelete={handleDelete}
        isDeleting={isDeleting}
        deleteConfirmMessage="Delete this bundle?"
      >
        {selectedBundle && (
          <div className="space-y-6">
            <DetailSection title="Info">
              <DetailField label="Name" value={selectedBundle.name} />
              <DetailField label="Price" value={`₹${Number(selectedBundle.bundle_price).toFixed(0)}`} />
              {selectedBundle.compare_price && (
                <DetailField label="Compare Price" value={`₹${Number(selectedBundle.compare_price).toFixed(0)}`} />
              )}
              <DetailField label="Active" value={selectedBundle.is_active ? 'Yes' : 'No'} />
            </DetailSection>
            <DetailSection title="Products in Bundle">
              {selectedBundle.items?.map((item, i) => (
                <DetailField
                  key={i}
                  label={`#${i + 1}`}
                  value={`${(item.product as any)?.name || item.product_id.slice(0, 8)} × ${item.quantity}`}
                />
              ))}
            </DetailSection>
          </div>
        )}
      </DetailPanel>

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedBundle ? 'Edit Bundle' : 'Create Bundle'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Bundle Name *</Label>
                <Input value={formData.name || ''} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="e.g., Starter Kit" />
              </div>
              <div className="space-y-2">
                <Label>Image</Label>
                <ImageUpload bucket="products" value={formData.image_url || undefined} onChange={(url) => setFormData({ ...formData, image_url: url })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea value={formData.description || ''} onChange={(e) => setFormData({ ...formData, description: e.target.value })} rows={2} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Bundle Price *</Label>
                <Input type="number" step="0.01" value={formData.bundle_price || ''} onChange={(e) => setFormData({ ...formData, bundle_price: parseFloat(e.target.value) })} />
              </div>
              <div className="space-y-2">
                <Label>Compare/Original Price</Label>
                <Input type="number" step="0.01" value={formData.compare_price || ''} onChange={(e) => setFormData({ ...formData, compare_price: parseFloat(e.target.value) || null })} />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={formData.is_active} onCheckedChange={(c) => setFormData({ ...formData, is_active: c })} />
              <Label>Active</Label>
            </div>

            {/* Bundle items */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-base font-semibold">Products in Bundle *</Label>
                <Button variant="outline" size="sm" onClick={() => setItemForms([...itemForms, { product_id: '', quantity: '1' }])}>
                  <Plus className="h-4 w-4 mr-1" /> Add Product
                </Button>
              </div>
              {itemForms.map((item, idx) => (
                <div key={idx} className="flex gap-2 items-end">
                  <div className="flex-1 space-y-1">
                    <Label className="text-xs">Product</Label>
                    <Select value={item.product_id} onValueChange={(v) => { const u = [...itemForms]; u[idx].product_id = v; setItemForms(u); }}>
                      <SelectTrigger><SelectValue placeholder="Select product" /></SelectTrigger>
                      <SelectContent>
                        {products.map(p => <SelectItem key={p.id} value={p.id}>{p.name} - ₹{Number(p.price).toFixed(0)}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="w-20 space-y-1">
                    <Label className="text-xs">Qty</Label>
                    <Input type="number" min="1" value={item.quantity} onChange={(e) => { const u = [...itemForms]; u[idx].quantity = e.target.value; setItemForms(u); }} className="h-10" />
                  </div>
                  <Button variant="ghost" size="icon" className="h-10 w-10 text-destructive" onClick={() => setItemForms(itemForms.filter((_, i) => i !== idx))}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button variant="outline" onClick={() => setIsFormOpen(false)}>Cancel</Button>
              <Button onClick={handleSave} disabled={isSaving}>
                {isSaving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving...</> : 'Save Bundle'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
