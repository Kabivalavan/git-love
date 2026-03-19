import { useEffect, useState } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { DataTable, Column } from '@/components/admin/DataTable';
import { DetailPanel, DetailField, DetailSection } from '@/components/admin/DetailPanel';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus } from 'lucide-react';
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
import { Checkbox } from '@/components/ui/checkbox';

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
  variant_ids: string[] | null;
  start_date: string | null;
  end_date: string | null;
  is_active: boolean;
  auto_apply: boolean;
  show_timer: boolean;
  created_at: string;
}

interface CategoryItem {
  id: string;
  name: string;
  parent_id: string | null;
}

interface ProductItem {
  id: string;
  name: string;
  category_id: string | null;
  variant_required: boolean | null;
}

interface VariantItem {
  id: string;
  name: string;
  product_id: string;
}

const OFFER_TYPES = [
  { value: 'percentage', label: 'Percentage Off' },
  { value: 'flat', label: 'Flat Discount' },
];

function formatIST(utcStr: string | null): string {
  if (!utcStr) return 'Not set';
  return new Date(utcStr).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' });
}

function utcToISTLocal(utcStr: string | null): string {
  if (!utcStr) return '';
  // Convert UTC to IST by formatting in Asia/Kolkata timezone
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
  // Treat the datetime-local value as IST (+05:30) regardless of browser timezone
  const d = new Date(localStr + ':00+05:30');
  return d.toISOString();
}

type FormData = Partial<Offer> & {
  start_date_local?: string;
  end_date_local?: string;
  apply_scope?: 'all' | 'category' | 'product';
  selected_variant_ids?: string[];
  apply_all_variants?: boolean;
  parent_category_id?: string | null;
};

export default function AdminOffers() {
  const [offers, setOffers] = useState<Offer[]>([]);
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [allCategories, setAllCategories] = useState<CategoryItem[]>([]);
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<ProductItem[]>([]);
  const [variants, setVariants] = useState<VariantItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedOffer, setSelectedOffer] = useState<Offer | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState<FormData>({});
  const { toast } = useToast();
  const { log } = useActivityLog();

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
      const now = new Date().toISOString();
      const allOffers = (data || []) as unknown as Offer[];
      const expired = allOffers.filter(o => o.is_active && o.end_date && o.end_date < now);
      if (expired.length > 0) {
        await Promise.all(expired.map(o =>
          supabase.from('offers').update({ is_active: false }).eq('id', o.id)
        ));
        allOffers.forEach(o => {
          if (o.is_active && o.end_date && o.end_date < now) o.is_active = false;
        });
      }
      setOffers(allOffers);
    }
    setIsLoading(false);
  };

  const fetchCategories = async () => {
    const { data } = await supabase.from('categories').select('id, name, parent_id').eq('is_active', true).order('sort_order');
    const all = (data || []) as CategoryItem[];
    setAllCategories(all);
    setCategories(all.filter(c => !c.parent_id));
  };

  const fetchProducts = async () => {
    const { data } = await supabase.from('products').select('id, name, category_id, variant_required').eq('is_active', true);
    setProducts((data || []) as ProductItem[]);
  };

  const fetchVariantsForProduct = async (productId: string) => {
    const { data } = await supabase.from('product_variants').select('id, name, product_id').eq('product_id', productId).eq('is_active', true).order('sort_order');
    setVariants((data || []) as VariantItem[]);
  };

  useEffect(() => {
    if (formData.apply_scope === 'category' && formData.category_id) {
      const childCatIds = allCategories.filter(c => c.parent_id === formData.category_id).map(c => c.id);
      const catIds = [formData.category_id, ...childCatIds];
      setFilteredProducts(products.filter(p => p.category_id && catIds.includes(p.category_id)));
    } else if (formData.apply_scope === 'product') {
      setFilteredProducts(products);
    } else {
      setFilteredProducts([]);
    }
  }, [formData.category_id, formData.apply_scope, products, allCategories]);

  useEffect(() => {
    if (formData.product_id) {
      fetchVariantsForProduct(formData.product_id);
    } else {
      setVariants([]);
    }
  }, [formData.product_id]);

  const handleRowClick = (offer: Offer) => {
    setSelectedOffer(offer);
    setIsDetailOpen(true);
  };

  const handleEdit = () => {
    if (selectedOffer) {
      const scope = selectedOffer.product_id ? 'product' : selectedOffer.category_id ? 'category' : 'all';
      const hasVariantIds = selectedOffer.variant_ids && selectedOffer.variant_ids.length > 0;
      // Determine parent_category_id: if category_id is a sub-category, find its parent
      let parentCatId: string | null = null;
      if (scope === 'category' && selectedOffer.category_id) {
        const cat = allCategories.find(c => c.id === selectedOffer.category_id);
        parentCatId = cat?.parent_id || selectedOffer.category_id;
      }
      setFormData({
        ...selectedOffer,
        start_date_local: utcToISTLocal(selectedOffer.start_date),
        end_date_local: utcToISTLocal(selectedOffer.end_date),
        apply_scope: scope,
        apply_all_variants: !hasVariantIds,
        selected_variant_ids: hasVariantIds ? selectedOffer.variant_ids! : [],
        parent_category_id: parentCatId,
      });
      setIsDetailOpen(false);
      setIsFormOpen(true);
    }
  };

  const handleCreate = () => {
    setFormData({
      type: 'flat',
      is_active: true,
      auto_apply: true,
      value: 0,
      start_date_local: '',
      end_date_local: '',
      apply_scope: 'all',
      apply_all_variants: true,
      selected_variant_ids: [],
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
      log({ action: 'delete', entityType: 'offer', entityId: selectedOffer.id, details: { name: selectedOffer.name, type: selectedOffer.type, value: selectedOffer.value } });
      setIsDetailOpen(false);
      fetchOffers();
    }
    setIsDeleting(false);
  };

  const handleSave = async () => {
    if (!formData.name) {
      toast({ title: 'Error', description: 'Name is required', variant: 'destructive' });
      return;
    }
    if (!formData.value && formData.value !== 0) {
      toast({ title: 'Error', description: 'Discount value is required', variant: 'destructive' });
      return;
    }

    setIsSaving(true);

    // Determine variant_ids to save
    let variantIdsToSave: string[] | null = null;
    if (formData.apply_scope === 'product' && formData.product_id && !formData.apply_all_variants) {
      variantIdsToSave = formData.selected_variant_ids && formData.selected_variant_ids.length > 0
        ? formData.selected_variant_ids
        : null;
    }

    const offerData = {
      name: formData.name,
      description: formData.description,
      type: (formData.type || 'flat') as 'percentage' | 'flat' | 'buy_x_get_y',
      value: formData.value || 0,
      buy_quantity: null,
      get_quantity: null,
      min_order_value: formData.min_order_value || null,
      max_discount: formData.type === 'percentage' ? (formData.max_discount || null) : null,
      category_id: formData.apply_scope === 'category' ? (formData.category_id || null) : null,
      product_id: formData.apply_scope === 'product' ? (formData.product_id || null) : null,
      variant_ids: variantIdsToSave as unknown as import('@/integrations/supabase/types').Json,
      start_date: formData.start_date_local ? istLocalToUTC(formData.start_date_local) : null,
      end_date: formData.end_date_local ? istLocalToUTC(formData.end_date_local) : null,
      is_active: formData.is_active ?? true,
      auto_apply: true,
      show_timer: formData.show_timer ?? false,
    };

    if (selectedOffer) {
      const { error } = await supabase.from('offers').update(offerData).eq('id', selectedOffer.id);
      if (error) {
        toast({ title: 'Error', description: error.message, variant: 'destructive' });
      } else {
        toast({ title: 'Success', description: 'Offer updated successfully' });
        log({ action: 'update', entityType: 'offer', entityId: selectedOffer.id, details: { name: formData.name, type: formData.type, value: formData.value } });
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
    if (offer.type === 'flat') return `₹${Math.round(offer.value)}`;
    return `Buy ${offer.buy_quantity} Get ${offer.get_quantity}`;
  };

  const getTargetLabel = (offer: Offer) => {
    if (offer.product_id) {
      const p = products.find(pr => pr.id === offer.product_id);
      const label = p ? p.name : 'Specific Product';
      if (offer.variant_ids && offer.variant_ids.length > 0) {
        return `${label} (${offer.variant_ids.length} variant${offer.variant_ids.length > 1 ? 's' : ''})`;
      }
      return label;
    }
    if (offer.category_id) {
      const c = allCategories.find(ca => ca.id === offer.category_id);
      return c ? c.name : 'Specific Category';
    }
    return 'All Products';
  };

  // For detail panel - get variant names
  const [detailVariantNames, setDetailVariantNames] = useState<Record<string, string>>({});
  useEffect(() => {
    if (selectedOffer?.variant_ids && selectedOffer.variant_ids.length > 0 && selectedOffer.product_id) {
      setDetailVariantNames({}); // reset while loading
      supabase.from('product_variants').select('id, name').eq('product_id', selectedOffer.product_id).then(({ data }) => {
        const map: Record<string, string> = {};
        (data || []).forEach((v: any) => { map[v.id] = v.name; });
        setDetailVariantNames(map);
      });
    } else {
      setDetailVariantNames({});
    }
  }, [selectedOffer?.id, selectedOffer?.product_id]);

  const columns: Column<Offer>[] = [
    { key: 'name', header: 'Name' },
    {
      key: 'type', header: 'Type',
      render: (o) => OFFER_TYPES.find(t => t.value === o.type)?.label || o.type,
    },
    { key: 'value', header: 'Value', render: formatValue },
    {
      key: 'product_id', header: 'Applied To',
      render: getTargetLabel,
    },
    {
      key: 'is_active', header: 'Status',
      render: (o) => (
        <Badge variant={o.is_active ? 'default' : 'secondary'}>
          {o.is_active ? 'Active' : 'Inactive'}
        </Badge>
      ),
    },
  ];

  const parentCatId = formData.parent_category_id || formData.category_id;
  const subCategoriesForParent = parentCatId
    ? allCategories.filter(c => c.parent_id === parentCatId)
    : [];

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
              <DetailField label="Description" value={selectedOffer.description || '-'} />
              <DetailField label="Type" value={OFFER_TYPES.find(t => t.value === selectedOffer.type)?.label || selectedOffer.type} />
              <DetailField label="Value" value={formatValue(selectedOffer)} />
              <DetailField label="Status" value={selectedOffer.is_active ? 'Active ✓' : 'Inactive'} />
              <DetailField label="Show Timer" value={selectedOffer.show_timer ? 'Yes ✓' : 'No'} />
            </DetailSection>
            <DetailSection title="Applied To">
              <DetailField label="Target" value={getTargetLabel(selectedOffer)} />
              {selectedOffer.variant_ids && selectedOffer.variant_ids.length > 0 && (
                <DetailField
                  label="Specific Variants"
                  value={
                    Object.keys(detailVariantNames).length > 0
                      ? selectedOffer.variant_ids.map(id => detailVariantNames[id] || 'Unknown').join(', ')
                      : 'Loading...'
                  }
                />
              )}
              {selectedOffer.product_id && (!selectedOffer.variant_ids || selectedOffer.variant_ids.length === 0) && (
                <DetailField label="Variants" value="All variants" />
              )}
            </DetailSection>
            <DetailSection title="Conditions">
              <DetailField label="Min Order Value" value={selectedOffer.min_order_value ? `₹${Math.round(selectedOffer.min_order_value)}` : '-'} />
              <DetailField label="Max Discount" value={selectedOffer.max_discount ? `₹${Math.round(selectedOffer.max_discount)}` : '-'} />
            </DetailSection>
            <DetailSection title="Schedule (IST)">
              <DetailField label="Start Date" value={formatIST(selectedOffer.start_date)} />
              <DetailField label="End Date" value={formatIST(selectedOffer.end_date)} />
            </DetailSection>
          </div>
        )}
      </DetailPanel>

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedOffer ? 'Edit Offer' : 'Create Offer'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Step 1: Basic Info */}
            <div className="space-y-1">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Step 1 — Basic Info</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  value={formData.name || ''}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Summer Sale"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="type">Discount Type *</Label>
                <Select
                  value={formData.type || 'flat'}
                  onValueChange={(value) => setFormData({ ...formData, type: value })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {OFFER_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="value">
                  {formData.type === 'percentage' ? 'Percentage (%) *' : 'Flat Discount Amount (₹) *'}
                </Label>
                <Input
                  id="value"
                  type="number"
                  step="1"
                  value={formData.value || ''}
                  onChange={(e) => setFormData({ ...formData, value: parseFloat(e.target.value) })}
                />
              </div>
              {formData.type === 'percentage' && (
                <div className="space-y-2">
                  <Label htmlFor="max_discount_inline">Max Discount Cap (₹)</Label>
                  <Input
                    id="max_discount_inline"
                    type="number"
                    step="1"
                    value={formData.max_discount || ''}
                    onChange={(e) => setFormData({ ...formData, max_discount: parseFloat(e.target.value) })}
                    placeholder="Optional"
                  />
                </div>
              )}
            </div>

            {/* Step 2: Apply Scope */}
            <div className="space-y-1 pt-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Step 2 — Apply To</p>
            </div>
            <div className="space-y-2">
              <Label>Apply Scope</Label>
              <Select
                value={formData.apply_scope || 'all'}
                onValueChange={(value) => setFormData({
                  ...formData,
                  apply_scope: value as 'all' | 'category' | 'product',
                  category_id: value === 'all' ? null : formData.category_id,
                  product_id: value === 'product' ? formData.product_id : null,
                  apply_all_variants: true,
                  selected_variant_ids: [],
                })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Products</SelectItem>
                  <SelectItem value="category">Specific Category</SelectItem>
                  <SelectItem value="product">Specific Product</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {formData.apply_scope === 'category' && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Parent Category *</Label>
                  <Select
                    value={formData.parent_category_id || formData.category_id || 'none'}
                    onValueChange={(value) => {
                      const pid = value === 'none' ? null : value;
                      setFormData({ ...formData, parent_category_id: pid, category_id: pid, product_id: null });
                    }}
                  >
                    <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— Select —</SelectItem>
                      {categories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {subCategoriesForParent.length > 0 && (
                  <div className="space-y-2">
                    <Label>Sub-Category (optional)</Label>
                    <Select
                      value={
                        formData.category_id && formData.category_id !== formData.parent_category_id
                          ? formData.category_id
                          : 'none'
                      }
                      onValueChange={(value) => {
                        if (value === 'none') {
                          setFormData({ ...formData, category_id: formData.parent_category_id || null });
                        } else {
                          setFormData({ ...formData, category_id: value });
                        }
                      }}
                    >
                      <SelectTrigger><SelectValue placeholder="All in parent" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">All in parent category</SelectItem>
                        {subCategoriesForParent.map((sub) => (
                          <SelectItem key={sub.id} value={sub.id}>{sub.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            )}

            {formData.apply_scope === 'product' && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Select Product *</Label>
                  <Select
                    value={formData.product_id || 'none'}
                    onValueChange={(value) => setFormData({ ...formData, product_id: value === 'none' ? null : value, apply_all_variants: true, selected_variant_ids: [] })}
                  >
                    <SelectTrigger><SelectValue placeholder="Select product" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— Select —</SelectItem>
                      {products.map((prod) => (
                        <SelectItem key={prod.id} value={prod.id}>{prod.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Variant selection */}
                {formData.product_id && variants.length > 0 && (
                  <div className="space-y-3 border border-border rounded-lg p-3">
                    <Label className="text-sm font-medium">Variant Selection</Label>
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="apply_all_variants"
                        checked={formData.apply_all_variants ?? true}
                        onCheckedChange={(checked) => setFormData({
                          ...formData,
                          apply_all_variants: !!checked,
                          selected_variant_ids: checked ? [] : formData.selected_variant_ids,
                        })}
                      />
                      <Label htmlFor="apply_all_variants" className="text-sm cursor-pointer">Apply to all variants</Label>
                    </div>
                    {!formData.apply_all_variants && (
                      <div className="space-y-2 pl-2">
                        {variants.map((v) => (
                          <div key={v.id} className="flex items-center gap-2">
                            <Checkbox
                              id={`variant-${v.id}`}
                              checked={(formData.selected_variant_ids || []).includes(v.id)}
                              onCheckedChange={(checked) => {
                                const ids = formData.selected_variant_ids || [];
                                setFormData({
                                  ...formData,
                                  selected_variant_ids: checked
                                    ? [...ids, v.id]
                                    : ids.filter(id => id !== v.id),
                                });
                              }}
                            />
                            <Label htmlFor={`variant-${v.id}`} className="text-sm cursor-pointer">{v.name}</Label>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Step 3: Conditions */}
            <div className="space-y-1 pt-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Step 3 — Conditions & Schedule</p>
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
              {formData.type !== 'percentage' && (
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
              )}
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

            {/* Settings */}
            <div className="space-y-3 border border-border rounded-xl p-4">
              <p className="text-sm font-semibold text-foreground">Settings</p>
              <div className="flex items-center gap-2">
                <Switch
                  id="is_active"
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                />
                <Label htmlFor="is_active">Active</Label>
              </div>
              <div className="flex items-center gap-2 opacity-60">
                <Switch id="auto_apply" checked={true} disabled />
                <div>
                  <Label htmlFor="auto_apply">Auto Apply</Label>
                  <p className="text-xs text-muted-foreground">Offers are always auto-applied to matching products</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="show_timer"
                  checked={formData.show_timer || false}
                  onCheckedChange={(checked) => setFormData({ ...formData, show_timer: checked })}
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
