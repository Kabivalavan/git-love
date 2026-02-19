import { useEffect, useState, useMemo } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { DataTable, Column } from '@/components/admin/DataTable';
import { DetailPanel, DetailField, DetailSection } from '@/components/admin/DetailPanel';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Loader2, Trash2, Info } from 'lucide-react';
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
import { MultiImageUpload } from '@/components/ui/image-upload';
import type { Product, ProductVariant } from '@/types/database';

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
  variant_id: string;
  quantity: string;
}

interface ProductWithVariants extends Product {
  variants?: ProductVariant[];
}

export default function AdminBundles() {
  const [bundles, setBundles] = useState<Bundle[]>([]);
  const [products, setProducts] = useState<ProductWithVariants[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedBundle, setSelectedBundle] = useState<Bundle | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState<Partial<Bundle> & { imageUrls?: string[] }>({});
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
    const { data } = await supabase
      .from('products')
      .select('*, variants:product_variants(*)')
      .eq('is_active', true)
      .order('name');
    setProducts((data || []) as unknown as ProductWithVariants[]);
  };

  const handleRowClick = (bundle: Bundle) => {
    setSelectedBundle(bundle);
    setIsDetailOpen(true);
  };

  const handleCreate = () => {
    setFormData({ is_active: true, sort_order: 0, imageUrls: [] });
    setItemForms([{ product_id: '', variant_id: '', quantity: '1' }]);
    setSelectedBundle(null);
    setIsFormOpen(true);
  };

  const handleEdit = () => {
    if (!selectedBundle) return;
    setFormData({ ...selectedBundle, imageUrls: selectedBundle.image_url ? [selectedBundle.image_url] : [] });
    setItemForms(
      selectedBundle.items?.map(i => ({
        product_id: i.product_id,
        variant_id: '',
        quantity: i.quantity.toString(),
      })) || [{ product_id: '', variant_id: '', quantity: '1' }]
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

  // Auto-calculate suggested prices from selected products/variants
  const suggestedPrices = useMemo(() => {
    let totalSP = 0;
    let totalCP = 0;
    let allFilled = true;

    for (const item of itemForms) {
      if (!item.product_id) { allFilled = false; continue; }
      const qty = parseInt(item.quantity) || 1;
      const product = products.find(p => p.id === item.product_id);
      if (!product) { allFilled = false; continue; }

      if (item.variant_id && product.variants) {
        const variant = product.variants.find(v => v.id === item.variant_id);
        if (variant) {
          totalSP += (variant.price || product.price || 0) * qty;
          totalCP += ((variant as any).cost_price || 0) * qty;
        } else {
          totalSP += (product.price || 0) * qty;
        }
      } else {
        totalSP += (product.price || 0) * qty;
        totalCP += (product.cost_price || 0) * qty;
      }
    }

    return { totalSP: Math.round(totalSP), totalCP: Math.round(totalCP), allFilled };
  }, [itemForms, products]);

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
    const primaryImage = formData.imageUrls?.[0] || null;

    const bundleData = {
      name: formData.name!,
      slug,
      description: formData.description || null,
      bundle_price: formData.bundle_price!,
      compare_price: formData.compare_price || null,
      is_active: formData.is_active ?? true,
      image_url: primaryImage,
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
            {selectedBundle.image_url && (
              <div className="aspect-[2/1] rounded-lg overflow-hidden bg-muted">
                <img src={selectedBundle.image_url} alt={selectedBundle.name} className="w-full h-full object-cover" />
              </div>
            )}
            <DetailSection title="Info">
              <DetailField label="Name" value={selectedBundle.name} />
              <DetailField label="Bundle Price (SP)" value={`₹${Number(selectedBundle.bundle_price).toFixed(0)}`} />
              {selectedBundle.compare_price && (
                <DetailField label="Compare Price" value={`₹${Number(selectedBundle.compare_price).toFixed(0)}`} />
              )}
              <DetailField label="Active" value={selectedBundle.is_active ? 'Yes' : 'No'} />
              {selectedBundle.description && <DetailField label="Description" value={selectedBundle.description} />}
            </DetailSection>
            <DetailSection title="Products in Bundle">
              {selectedBundle.items?.map((item, i) => (
                <div key={i} className="border rounded-lg p-3 mb-2 bg-muted/30">
                  <p className="font-medium text-sm">{(item.product as any)?.name || item.product_id.slice(0, 8)}</p>
                  <p className="text-xs text-muted-foreground">Qty: {item.quantity} · ₹{Number((item.product as any)?.price || 0).toFixed(0)} each</p>
                </div>
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
          <div className="space-y-5 mt-4">
            {/* Name & Description */}
            <div className="space-y-2">
              <Label>Bundle Name *</Label>
              <Input value={formData.name || ''} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="e.g., Starter Kit" />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea value={formData.description || ''} onChange={(e) => setFormData({ ...formData, description: e.target.value })} rows={2} />
            </div>

            {/* Images */}
            <div className="space-y-2">
              <Label>Bundle Images</Label>
              <p className="text-xs text-muted-foreground">First image is used as primary. Upload up to 5 images.</p>
              <MultiImageUpload
                bucket="products"
                values={formData.imageUrls || []}
                onChange={(urls) => setFormData({ ...formData, imageUrls: urls })}
                maxImages={5}
              />
            </div>

            <div className="flex items-center gap-2">
              <Switch checked={formData.is_active} onCheckedChange={(c) => setFormData({ ...formData, is_active: c })} />
              <Label>Active</Label>
            </div>

            {/* Bundle items */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-base font-semibold">Products in Bundle *</Label>
                <Button variant="outline" size="sm" onClick={() => setItemForms([...itemForms, { product_id: '', variant_id: '', quantity: '1' }])}>
                  <Plus className="h-4 w-4 mr-1" /> Add Product
                </Button>
              </div>
              {itemForms.map((item, idx) => {
                const selectedProduct = products.find(p => p.id === item.product_id);
                const variants = selectedProduct?.variants || [];
                return (
                  <div key={idx} className="border rounded-xl p-4 space-y-3 bg-muted/20">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-foreground">Item {idx + 1}</span>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setItemForms(itemForms.filter((_, i) => i !== idx))}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs">Product *</Label>
                        <Select
                          value={item.product_id}
                          onValueChange={(v) => {
                            const u = [...itemForms];
                            u[idx].product_id = v;
                            u[idx].variant_id = '';
                            setItemForms(u);
                          }}
                        >
                          <SelectTrigger><SelectValue placeholder="Select product" /></SelectTrigger>
                          <SelectContent>
                            {products.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Variant {variants.length > 0 ? '*' : '(none)'}</Label>
                        <Select
                          value={item.variant_id}
                          onValueChange={(v) => { const u = [...itemForms]; u[idx].variant_id = v; setItemForms(u); }}
                          disabled={!item.product_id || variants.length === 0}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder={variants.length > 0 ? "Select variant" : "No variants"} />
                          </SelectTrigger>
                          <SelectContent>
                            {variants.map(v => (
                              <SelectItem key={v.id} value={v.id}>
                                {v.name} {v.price ? `— ₹${Number(v.price).toFixed(0)}` : ''}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="w-28 space-y-1.5">
                      <Label className="text-xs">Quantity</Label>
                      <Input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => { const u = [...itemForms]; u[idx].quantity = e.target.value; setItemForms(u); }}
                        className="h-10"
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Auto-calculated price suggestions */}
            {itemForms.some(i => i.product_id) && (
              <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 space-y-2">
                <div className="flex items-center gap-2 mb-1">
                  <Info className="h-4 w-4 text-primary" />
                  <span className="text-sm font-semibold text-foreground">Auto-Calculated Suggestions</span>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">Total Selling Price (sum)</p>
                    <p className="text-lg font-bold text-primary">₹{suggestedPrices.totalSP}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Total Cost Price (sum)</p>
                    <p className="text-lg font-bold text-foreground">₹{suggestedPrices.totalCP}</p>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">Set bundle price below these to create an attractive deal</p>
              </div>
            )}

            {/* Price fields at the bottom */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Bundle Selling Price (₹) *</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.bundle_price || ''}
                  onChange={(e) => setFormData({ ...formData, bundle_price: parseFloat(e.target.value) })}
                  placeholder={suggestedPrices.totalSP ? `Suggested: ₹${suggestedPrices.totalSP}` : "0.00"}
                />
                <p className="text-xs text-muted-foreground">Tax inclusive</p>
              </div>
              <div className="space-y-2">
                <Label>Compare / Original Price (₹)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.compare_price || ''}
                  onChange={(e) => setFormData({ ...formData, compare_price: parseFloat(e.target.value) || null })}
                  placeholder={suggestedPrices.totalSP ? `e.g., ₹${suggestedPrices.totalSP}` : "0.00"}
                />
                <p className="text-xs text-muted-foreground">Shown as strikethrough</p>
              </div>
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
