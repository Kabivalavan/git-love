import { useCallback, useEffect, useState } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { DataTable, Column } from '@/components/admin/DataTable';
import { DetailPanel, DetailField, DetailSection } from '@/components/admin/DetailPanel';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Plus, Loader2, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { Product, Category, ProductImage, ProductVariant } from '@/types/database';
import { ShimmerTable } from '@/components/ui/shimmer';
import { useActivityLog } from '@/hooks/useActivityLog';
import { useAdminProducts, useAdminCategories, useDeleteProduct, useSaveProduct, useAdminRealtimeInvalidation, ADMIN_KEYS } from '@/hooks/useAdminQueries';
import { fetchProductVariants } from '@/api/admin';
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
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { MultiImageUpload } from '@/components/ui/image-upload';
import { ContentSectionsEditor } from '@/components/product/ContentSectionsEditor';
import type { ContentSection } from '@/components/product/ContentSections';

const PRODUCT_TYPES = [
  { value: 'general', label: 'General' },
  { value: 'clothing', label: 'Clothing / Apparel' },
  { value: 'footwear', label: 'Footwear' },
  { value: 'electronics', label: 'Electronics' },
  { value: 'food', label: 'Food / Grocery' },
];

const CLOTHING_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL'];
const FOOTWEAR_SIZES = ['5', '6', '7', '8', '9', '10', '11', '12'];

interface VariantForm {
  id?: string;
  name: string;
  sku: string;
  price: string;
  cost_price: string;
  tax_rate: string;
  stock_quantity: string;
  image_url: string;
  is_returnable: boolean;
}

export default function AdminProducts() {
  const { data: productsData, isLoading: isProductsLoading } = useAdminProducts();
  const { data: categoriesData } = useAdminCategories();
  const deleteProductMutation = useDeleteProduct();
  const saveProductMutation = useSaveProduct();

  const products = productsData || [];
  const categories = (categoriesData || []) as Category[];
  const isLoading = isProductsLoading;

  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState<Partial<Product> & { imageUrls?: string[]; productType?: string; contentSections?: ContentSection[] }>({});
  const [variantForms, setVariantForms] = useState<VariantForm[]>([]);
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('all');
  const [formParentCategoryId, setFormParentCategoryId] = useState<string>('');
  const { toast } = useToast();
  const { log } = useActivityLog();

  // Realtime invalidation instead of manual fetch
  useAdminRealtimeInvalidation(
    ['products', 'product_variants', 'stock_holds', 'orders', 'order_items'],
    [ADMIN_KEYS.products as unknown as string[]]
  );

  const handleRowClick = async (product: Product) => {
    const variants = await fetchProductVariants(product.id);
    setSelectedProduct({ ...product, variants: variants as unknown as ProductVariant[] });
    setIsDetailOpen(true);
  };

  const handleEdit = async () => {
    if (!selectedProduct) return;
    const imageUrls = selectedProduct.images?.map(img => img.image_url) || [];
    
    // Fetch variants for this product using centralized API
    const variants = await fetchProductVariants(selectedProduct.id);
    
    const existingVariants = (variants || []).map(v => ({
      id: v.id,
      name: v.name,
      sku: v.sku || '',
      price: v.price?.toString() || '',
      cost_price: (v as any).cost_price?.toString() || '',
      tax_rate: (v as any).tax_rate?.toString() || '',
      stock_quantity: v.stock_quantity?.toString() || '0',
      image_url: (v as any).image_url || '',
      is_returnable: (v as any).is_returnable !== false,
    }));
    
    // Detect product type: first check stored metadata, then heuristic fallback
    const contentSections = (selectedProduct as any).content_sections as ContentSection[] || [];
    let detectedType = 'general';
    const metaSection = (contentSections as any[]).find((s: any) => s?._meta_product_type);
    if (metaSection) {
      detectedType = metaSection._meta_product_type;
    } else if (existingVariants.length > 0) {
      const names = existingVariants.map(v => v.name.toUpperCase());
      if (names.some(n => CLOTHING_SIZES.includes(n))) detectedType = 'clothing';
      else if (names.some(n => FOOTWEAR_SIZES.includes(n))) detectedType = 'footwear';
    }
    // Filter out meta sections for display
    const displaySections = contentSections.filter((s: any) => !s?._meta_product_type);

    // Determine parent/sub category
    const catId = selectedProduct.category_id || '';
    const catObj = categories.find(c => c.id === catId);
    if (catObj?.parent_id) {
      setFormParentCategoryId(catObj.parent_id);
    } else {
      setFormParentCategoryId(catId);
    }

    setFormData({ ...selectedProduct, imageUrls, productType: detectedType, contentSections: displaySections, variant_required: (selectedProduct as any).variant_required || false } as any);
    // Always ensure at least 1 variant
    setVariantForms(existingVariants.length > 0 ? existingVariants : [defaultVariant()]);
    setIsDetailOpen(false);
    setIsFormOpen(true);
  };

  const defaultVariant = (): VariantForm => ({ name: '', sku: '', price: '', cost_price: '', tax_rate: '', stock_quantity: '0', image_url: '', is_returnable: true });

  const handleCreate = () => {
    setFormData({
      is_active: true,
      is_featured: false,
      is_bestseller: false,
      stock_quantity: 0,
      low_stock_threshold: 5,
      tax_rate: 0,
      sort_order: 0,
      imageUrls: [],
      productType: 'general',
      contentSections: [],
    });
    setVariantForms([defaultVariant()]);
    setFormParentCategoryId('');
    setSelectedProduct(null);
    setIsFormOpen(true);
  };

  const handleDelete = async () => {
    if (!selectedProduct) return;
    setIsDeleting(true);
    try {
      await deleteProductMutation.mutateAsync(selectedProduct);
      log({ action: 'delete', entityType: 'product', entityId: selectedProduct.id, details: { name: selectedProduct.name } });
      toast({ title: 'Success', description: 'Product deleted successfully' });
      setIsDetailOpen(false);
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
    setIsDeleting(false);
  };

  const addQuickSizes = () => {
    const sizes = formData.productType === 'footwear' ? FOOTWEAR_SIZES : CLOTHING_SIZES;
    const newVariants = sizes.map(size => ({
      name: size,
      sku: '',
      price: '',
      cost_price: '',
      tax_rate: '',
      stock_quantity: '0',
      image_url: '',
      is_returnable: true,
    }));
    setVariantForms([...variantForms, ...newVariants]);
  };

  const handleSave = async () => {
    if (isSaving) return;

    if (!formData.name) {
      toast({ title: 'Error', description: 'Product name is required', variant: 'destructive' });
      return;
    }
    const filledVariants = variantForms.filter(v => v.name.trim());
    if (filledVariants.length === 0) {
      toast({ title: 'Variant Required', description: 'At least one variant is required. Please fill in the variant name and price.', variant: 'destructive' });
      return;
    }

    setIsSaving(true);

    const toVariantPayload = (v: VariantForm, sortOrder: number) => ({
      name: v.name,
      sku: v.sku || null,
      price: v.price ? parseFloat(v.price) : null,
      cost_price: v.cost_price ? parseFloat(v.cost_price) : null,
      tax_rate: v.tax_rate ? parseFloat(v.tax_rate) : 0,
      mrp: null,
      stock_quantity: parseInt(v.stock_quantity) || 0,
      is_active: true,
      sort_order: sortOrder,
      image_url: v.image_url || null,
      is_returnable: v.is_returnable,
    });

    // Always regenerate slug from name (auto-update on name change)
    const slug = formData.name?.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') || formData.slug || '';
    // Use first variant's price as the product base price
    const firstVariantPrice = filledVariants[0]?.price ? parseFloat(filledVariants[0].price) : 0;
    const productData = {
      name: formData.name,
      slug,
      description: formData.description,
      short_description: formData.short_description,
      category_id: formData.category_id || null,
      price: firstVariantPrice,
      mrp: null,
      cost_price: null,
      sku: null,
      barcode: formData.barcode || null,
      stock_quantity: filledVariants.reduce((sum, v) => sum + (parseInt(v.stock_quantity) || 0), 0),
      low_stock_threshold: formData.low_stock_threshold ?? 5,
      tax_rate: 0,
      shipping_weight: formData.shipping_weight || null,
      is_active: formData.is_active ?? true,
      is_featured: formData.is_featured ?? false,
      is_bestseller: formData.is_bestseller ?? false,
      badge: formData.badge || null,
      sort_order: formData.sort_order ?? 0,
      content_sections: [...(formData.contentSections || []), { _meta_product_type: formData.productType || 'general' }] as unknown as import('@/integrations/supabase/types').Json,
      variant_required: (formData as any).variant_required || false,
    };

    try {
      const variantRecords = filledVariants.map((variant, sort_order) => toVariantPayload(variant, sort_order));

      const productId = await saveProductMutation.mutateAsync({
        productData,
        imageUrls: formData.imageUrls || [],
        variantRecords,
        existingProductId: selectedProduct?.id,
      });

      log({ action: selectedProduct ? 'update' : 'create', entityType: 'product', entityId: productId, details: { name: formData.name } });
      toast({ title: 'Success', description: `Product ${selectedProduct ? 'updated' : 'created'} successfully` });
      setIsFormOpen(false);
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }

    setIsSaving(false);
  };

  const columns: Column<Product>[] = [
    {
      key: 'name',
      header: 'Product',
      render: (p) => (
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-md overflow-hidden bg-muted">
            {p.images?.[0] ? (
              <img src={p.images[0].image_url} alt={p.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">No img</div>
            )}
          </div>
          <span className="font-medium">{p.name}</span>
        </div>
      ),
    },
    {
      key: 'sku',
      header: 'Variants / SKU',
      render: (p) => {
        const variantCount = ((p as any).variants || []).filter((v: any) => v.is_active !== false).length;
        if (variantCount !== undefined && variantCount > 0) {
          return (
            <span className="text-xs text-muted-foreground">
              {variantCount} variant{variantCount > 1 ? 's' : ''} — <span className="text-primary cursor-pointer underline">see details</span>
            </span>
          );
        }
        return <span className="text-xs text-muted-foreground">{p.sku || '—'}</span>;
      },
    },
    {
      key: 'price',
      header: 'Price',
      render: (p) => (
        <span className="font-medium">₹{Number(p.price).toFixed(0)}</span>
      ),
    },
    {
      key: 'stock_quantity',
      header: 'In Stock',
      render: (p) => {
        const inHold = (p as any).in_hold || 0;
        const available = Math.max(0, p.stock_quantity - inHold);
        return (
          <Badge variant={available <= p.low_stock_threshold ? 'destructive' : 'secondary'}>
            {available}
          </Badge>
        );
      },
    },
    {
      key: 'in_hold' as any,
      header: 'In Hold',
      render: (p) => {
        const inHold = (p as any).in_hold || 0;
        return (
          <Badge variant={inHold > 0 ? 'outline' : 'secondary'} className={inHold > 0 ? 'border-amber-500 text-amber-700 dark:text-amber-400' : ''}>
            {inHold}
          </Badge>
        );
      },
    },
    {
      key: 'processing_qty' as any,
      header: 'Processing',
      render: (p: any) => {
        const qty = p.processing_qty || 0;
        return (
          <Badge variant={qty > 0 ? 'outline' : 'secondary'} className={qty > 0 ? 'border-blue-500 text-blue-700 dark:text-blue-400' : ''}>
            {qty}
          </Badge>
        );
      },
    },
    {
      key: 'category',
      header: 'Category',
      render: (p) => p.category?.name || '-',
    },
    {
      key: 'is_active',
      header: 'Status',
      render: (p) => (
        <Badge variant={p.is_active ? 'default' : 'secondary'}>
          {p.is_active ? 'Active' : 'Inactive'}
        </Badge>
      ),
    },
  ];

  const filteredProducts = selectedCategoryFilter === 'all'
    ? products
    : products.filter(p => {
        const childIds = categories.filter(c => c.parent_id === selectedCategoryFilter).map(c => c.id);
        return p.category_id === selectedCategoryFilter || childIds.includes(p.category_id || '');
      });

  return (
    <AdminLayout
      title="Products"
      description="Manage your product catalog"
      actions={
        <Button onClick={handleCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Add Product
        </Button>
      }
    >
      {/* Category filter chips - only show parent categories */}
      {categories.filter(c => !c.parent_id).length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          <button
            onClick={() => setSelectedCategoryFilter('all')}
            className={cn(
              "px-3 py-1.5 rounded-full text-xs font-medium border transition-colors",
              selectedCategoryFilter === 'all'
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-card text-muted-foreground border-border hover:border-primary hover:text-foreground"
            )}
          >
            All ({products.length})
          </button>
          {categories.filter(c => !c.parent_id).map((cat) => {
            // Count products in this parent category and all its children
            const childIds = categories.filter(c => c.parent_id === cat.id).map(c => c.id);
            const count = products.filter(p => p.category_id === cat.id || childIds.includes(p.category_id || '')).length;
            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCategoryFilter(cat.id)}
                className={cn(
                  "px-3 py-1.5 rounded-full text-xs font-medium border transition-colors",
                  selectedCategoryFilter === cat.id
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-card text-muted-foreground border-border hover:border-primary hover:text-foreground"
                )}
              >
                {cat.name} ({count})
              </button>
            );
          })}
        </div>
      )}

      {isLoading ? (
        <ShimmerTable rows={6} columns={6} />
      ) : (
        <DataTable<Product>
          columns={columns}
          data={filteredProducts}
          isLoading={false}
          onRowClick={handleRowClick}
          searchable
          searchPlaceholder="Search products..."
          searchKeys={['name', 'sku', 'description']}
          getRowId={(p) => p.id}
          emptyMessage="No products found. Click 'Add Product' to create one."
        />
      )}

      {/* Detail Panel */}
      <DetailPanel
        isOpen={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
        title={selectedProduct?.name || 'Product Details'}
        onEdit={handleEdit}
        onDelete={handleDelete}
        isDeleting={isDeleting}
        deleteConfirmMessage="Are you sure you want to delete this product?"
      >
        {selectedProduct && (
          <div className="space-y-6">
            {selectedProduct.images && selectedProduct.images.length > 0 && (
              <div className="grid grid-cols-4 gap-2">
                {selectedProduct.images.map((img, i) => (
                  <div key={i} className="aspect-square rounded-lg overflow-hidden bg-muted">
                    <img src={img.image_url} alt="" className="w-full h-full object-cover" />
                  </div>
                ))}
              </div>
            )}
            <DetailSection title="Basic Info">
              <DetailField label="Name" value={selectedProduct.name} />
              <DetailField label="Slug" value={selectedProduct.slug} />
              <DetailField label="Badge" value={selectedProduct.badge} />
              <DetailField label="Category" value={selectedProduct.category?.name} />
              <DetailField label="Barcode" value={selectedProduct.barcode} />
            </DetailSection>
            <DetailSection title="Inventory">
              <DetailField label="Total Stock" value={selectedProduct.stock_quantity} />
              <DetailField label="In Hold" value={(selectedProduct as any).in_hold || 0} />
              <DetailField label="Available" value={Math.max(0, selectedProduct.stock_quantity - ((selectedProduct as any).in_hold || 0))} />
              <DetailField label="Low Stock Threshold" value={selectedProduct.low_stock_threshold} />
              <DetailField label="Weight" value={selectedProduct.shipping_weight ? `${selectedProduct.shipping_weight} kg` : '-'} />
            </DetailSection>
            {selectedProduct.variants && selectedProduct.variants.length > 0 && (
              <DetailSection title="Variants & Pricing">
                {selectedProduct.variants.map((v, i) => (
                  <div key={i} className="border rounded-lg p-3 mb-2 bg-muted/30 space-y-1">
                    <p className="font-semibold text-sm text-foreground">{v.name}{i === 0 ? ' (Default)' : ''}</p>
                    <div className="grid grid-cols-2 gap-x-4 text-xs text-muted-foreground">
                      {v.sku && <span>SKU: <span className="text-foreground">{v.sku}</span></span>}
                      {v.price && <span>SP: <span className="text-foreground font-medium">₹{Number(v.price).toFixed(0)}</span></span>}
                      {(v as any).cost_price && <span>CP: <span className="text-foreground">₹{Number((v as any).cost_price).toFixed(0)}</span></span>}
                      {(v as any).tax_rate != null && <span>Tax: <span className="text-foreground">{(v as any).tax_rate}%</span></span>}
                      <span>Stock: <span className="text-foreground">{v.stock_quantity}</span></span>
                    </div>
                  </div>
                ))}
              </DetailSection>
            )}
            <DetailSection title="Status">
              <DetailField label="Active" value={selectedProduct.is_active ? 'Yes' : 'No'} />
              <DetailField label="Featured" value={selectedProduct.is_featured ? 'Yes' : 'No'} />
              <DetailField label="Bestseller" value={selectedProduct.is_bestseller ? 'Yes' : 'No'} />
            </DetailSection>
            <div>
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Description</Label>
              <p className="text-sm text-foreground mt-1 whitespace-pre-wrap">{selectedProduct.description || '-'}</p>
            </div>
          </div>
        )}
      </DetailPanel>

      {/* Form Dialog */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedProduct ? 'Edit Product' : 'Create Product'}</DialogTitle>
          </DialogHeader>
          
          <Tabs defaultValue="basic" className="mt-4">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="basic">Basic</TabsTrigger>
              <TabsTrigger value="pricing">Pricing & Variants</TabsTrigger>
              <TabsTrigger value="inventory">Inventory</TabsTrigger>
              <TabsTrigger value="images">Images</TabsTrigger>
              <TabsTrigger value="content">Content</TabsTrigger>
            </TabsList>

            <TabsContent value="basic" className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Product Name *</Label>
                  <Input
                    id="name"
                    value={formData.name || ''}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Enter product name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="productType">Product Type</Label>
                  <Select
                    value={formData.productType || 'general'}
                    onValueChange={(value) => setFormData({ ...formData, productType: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PRODUCT_TYPES.map((t) => (
                        <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="category">Parent Category</Label>
                  <Select
                    value={formParentCategoryId}
                    onValueChange={(value) => {
                      setFormParentCategoryId(value);
                      // Set category_id to the parent itself; sub will override if chosen
                      setFormData({ ...formData, category_id: value || null });
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.filter(c => !c.parent_id).map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="subcategory">Sub Category</Label>
                  <Select
                    value={formParentCategoryId && categories.find(c => c.id === formData.category_id)?.parent_id === formParentCategoryId ? formData.category_id || '' : ''}
                    onValueChange={(value) => setFormData({ ...formData, category_id: value || formParentCategoryId || null })}
                    disabled={!formParentCategoryId || categories.filter(c => c.parent_id === formParentCategoryId).length === 0}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={formParentCategoryId ? "Select sub category (optional)" : "Select parent first"} />
                    </SelectTrigger>
                    <SelectContent>
                      {categories
                        .filter(c => c.parent_id === formParentCategoryId)
                        .map((cat) => (
                          <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>


              <div className="space-y-2">
                <Label htmlFor="badge">Badge</Label>
                <Input
                  id="badge"
                  value={formData.badge || ''}
                  onChange={(e) => setFormData({ ...formData, badge: e.target.value })}
                  placeholder="e.g., New, Sale, Hot"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="short_description">Short Description</Label>
                <Input
                  id="short_description"
                  value={formData.short_description || ''}
                  onChange={(e) => setFormData({ ...formData, short_description: e.target.value })}
                  placeholder="Brief product summary"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Full Description</Label>
                <Textarea
                  id="description"
                  rows={5}
                  value={formData.description || ''}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Detailed product description"
                />
              </div>

              <div className="flex flex-wrap gap-6">
                <div className="flex items-center gap-2">
                  <Switch id="is_active" checked={formData.is_active} onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })} />
                  <Label htmlFor="is_active">Active</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch id="is_featured" checked={formData.is_featured} onCheckedChange={(checked) => setFormData({ ...formData, is_featured: checked })} />
                  <Label htmlFor="is_featured">Featured</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch id="is_bestseller" checked={formData.is_bestseller} onCheckedChange={(checked) => setFormData({ ...formData, is_bestseller: checked })} />
                  <Label htmlFor="is_bestseller">Bestseller</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch id="variant_required" checked={(formData as any).variant_required || false} onCheckedChange={(checked) => setFormData({ ...formData, variant_required: checked } as any)} />
                  <Label htmlFor="variant_required">Variant Required</Label>
                </div>
              </div>
              {(formData as any).variant_required && (
                <p className="text-xs text-warning-foreground bg-warning/10 p-2 rounded border border-warning/20">
                  ⚠️ Customers must select a variant before adding to cart
                </p>
              )}
            </TabsContent>

            <TabsContent value="pricing" className="space-y-4 mt-4">
              {/* Variants Section - always shown, always at least 1 */}
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-base font-semibold">Product Variants <span className="text-destructive">*</span></Label>
                  <p className="text-sm text-muted-foreground">
                    Add sizes, colors, or other options. Each variant has its own SP, CP, Tax & SKU.
                  </p>
                </div>
                <div className="flex gap-2">
                  {(formData.productType === 'clothing' || formData.productType === 'footwear') && (
                    <Button variant="outline" size="sm" onClick={addQuickSizes}>
                      Quick Add {formData.productType === 'footwear' ? 'Shoe' : 'Clothing'} Sizes
                    </Button>
                  )}
                   <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setVariantForms([...variantForms, { name: '', sku: '', price: '', cost_price: '', tax_rate: '', stock_quantity: '0', image_url: '', is_returnable: true }])}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Add Variant
                  </Button>
                </div>
              </div>

              <p className="text-xs text-primary bg-primary/10 rounded px-3 py-2 font-medium">
                ℹ️ The first variant is auto-selected by default on the product page.
              </p>
              <div className="space-y-4">
                {variantForms.map((variant, index) => (
                  <div key={variant.id || `new-${index}`} className="border rounded-xl p-4 space-y-3 bg-muted/20">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-foreground">Variant {index + 1}{index === 0 ? ' (Default — auto-selected on product page)' : ''}</span>
                      {variantForms.length > 1 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive h-8 px-2"
                          onClick={() => setVariantForms(variantForms.filter((_, i) => i !== index))}
                        >
                          <Trash2 className="h-4 w-4 mr-1" />
                          Remove
                        </Button>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1.5">
                            <Label className="text-sm font-medium">Variant Name *</Label>
                            <Input
                              value={variant.name}
                              onChange={(e) => {
                                const updated = [...variantForms];
                                updated[index].name = e.target.value;
                                setVariantForms(updated);
                              }}
                              placeholder="e.g., L, Red, 500ml"
                              className="h-10"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-sm font-medium">SKU</Label>
                            <Input
                              value={variant.sku}
                              onChange={(e) => {
                                const updated = [...variantForms];
                                updated[index].sku = e.target.value;
                                setVariantForms(updated);
                              }}
                              placeholder="SKU-001"
                              className="h-10"
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                          <div className="space-y-1.5">
                            <Label className="text-sm font-medium">Selling Price (₹) *</Label>
                            <Input
                              type="number"
                              value={variant.price}
                              onChange={(e) => {
                                const updated = [...variantForms];
                                updated[index].price = e.target.value;
                                setVariantForms(updated);
                              }}
                              placeholder="0.00"
                              className="h-10"
                            />
                            <p className="text-[10px] text-muted-foreground">Tax inclusive</p>
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-sm font-medium">Cost Price (₹)</Label>
                            <Input
                              type="number"
                              value={variant.cost_price}
                              onChange={(e) => {
                                const updated = [...variantForms];
                                updated[index].cost_price = e.target.value;
                                setVariantForms(updated);
                              }}
                              placeholder="0.00"
                              className="h-10"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-sm font-medium">Tax Rate (%)</Label>
                            <Input
                              type="number"
                              value={variant.tax_rate}
                              onChange={(e) => {
                                const updated = [...variantForms];
                                updated[index].tax_rate = e.target.value;
                                setVariantForms(updated);
                              }}
                              placeholder="0"
                              className="h-10"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-sm font-medium">Stock Qty</Label>
                            <Input
                              type="number"
                              value={variant.stock_quantity}
                              onChange={(e) => {
                                const updated = [...variantForms];
                                updated[index].stock_quantity = e.target.value;
                                setVariantForms(updated);
                              }}
                              placeholder="0"
                              className="h-10"
                            />
                          </div>
                        </div>
                        {/* Returnable toggle */}
                        <div className="flex items-center gap-2 pt-1">
                          <Switch
                            id={`returnable-${index}`}
                            checked={variant.is_returnable}
                            onCheckedChange={(checked) => {
                              const updated = [...variantForms];
                              updated[index].is_returnable = checked;
                              setVariantForms(updated);
                            }}
                          />
                          <Label htmlFor={`returnable-${index}`} className="text-xs text-muted-foreground">Returnable</Label>
                        </div>
                      </div>
                    ))}
                  </div>
            </TabsContent>

            <TabsContent value="inventory" className="space-y-4 mt-4">
              {/* Total stock always from variants */}
              <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                <p className="text-sm font-semibold text-foreground">Total Stock (from all variants)</p>
                <p className="text-3xl font-bold text-primary">
                  {variantForms.reduce((sum, v) => sum + (parseInt(v.stock_quantity) || 0), 0)}
                </p>
                <p className="text-xs text-muted-foreground">Automatically calculated from variant quantities</p>
              </div>

              {/* Variant images moved to Images tab */}

              <div className="space-y-2">
                <Label htmlFor="low_stock_threshold">Low Stock Alert Threshold</Label>
                <Input
                  id="low_stock_threshold"
                  type="number"
                  value={formData.low_stock_threshold ?? 5}
                  onChange={(e) => setFormData({ ...formData, low_stock_threshold: parseInt(e.target.value) || 5 })}
                  className="h-10"
                  placeholder="5"
                />
                <p className="text-xs text-muted-foreground">You'll be alerted when stock falls below this number</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="shipping_weight">Shipping Weight (kg)</Label>
                <Input
                  id="shipping_weight"
                  type="number"
                  step="0.01"
                  value={formData.shipping_weight || ''}
                  onChange={(e) => setFormData({ ...formData, shipping_weight: parseFloat(e.target.value) || null })}
                  className="h-10"
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="barcode">Barcode</Label>
                <Input
                  id="barcode"
                  value={formData.barcode || ''}
                  onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                  className="h-10"
                  placeholder="Barcode / EAN"
                />
              </div>
            </TabsContent>

            <TabsContent value="images" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>Product Images</Label>
                <p className="text-xs text-muted-foreground mb-2">
                  Upload up to 10 images. The first image will be used as the primary image.
                </p>
                <MultiImageUpload
                  bucket="products"
                  values={formData.imageUrls || []}
                  onChange={(urls) => setFormData({ ...formData, imageUrls: urls })}
                  maxImages={10}
                />
              </div>

              {/* Variant Images */}
              {variantForms.filter(v => v.name.trim()).length > 0 && (formData.imageUrls || []).length > 0 && (
                <Separator />
              )}
              {variantForms.filter(v => v.name.trim()).length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-sm font-semibold">Variant Images</Label>
                      <p className="text-xs text-muted-foreground">Assign unique images per variant from the uploaded images above</p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const firstImg = formData.imageUrls?.[0] || '';
                        if (!firstImg) return;
                        setVariantForms(variantForms.map(v => ({ ...v, image_url: firstImg })));
                      }}
                      disabled={!formData.imageUrls?.length}
                    >
                      Use same image for all
                    </Button>
                  </div>
                  {!(formData.imageUrls || []).length && (
                    <p className="text-xs text-amber-600 bg-amber-50 dark:bg-amber-950/30 dark:text-amber-400 rounded-lg p-3">
                      Upload product images above first, then assign them to variants.
                    </p>
                  )}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {variantForms.map((variant, index) => {
                      if (!variant.name.trim()) return null;
                      return (
                        <div key={variant.id || `image-${index}`} className="border rounded-xl p-3 space-y-2 bg-muted/20">
                          <p className="text-xs font-semibold text-foreground">{variant.name}</p>
                          {variant.image_url ? (
                            <div className="relative aspect-square rounded-lg overflow-hidden bg-muted">
                              <img src={variant.image_url} alt={variant.name} className="w-full h-full object-cover" />
                              <Button
                                variant="destructive"
                                size="icon"
                                className="absolute top-1 right-1 h-6 w-6"
                                onClick={() => {
                                  const updated = [...variantForms];
                                  updated[index].image_url = '';
                                  setVariantForms(updated);
                                }}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          ) : (
                            <Select
                              value=""
                              onValueChange={(url) => {
                                const updated = [...variantForms];
                                updated[index].image_url = url;
                                setVariantForms(updated);
                              }}
                            >
                              <SelectTrigger className="h-9 text-xs">
                                <SelectValue placeholder="Select image" />
                              </SelectTrigger>
                              <SelectContent>
                                {(formData.imageUrls || []).map((url, imgIdx) => (
                                  <SelectItem key={imgIdx} value={url}>
                                    <div className="flex items-center gap-2">
                                      <img src={url} alt="" className="w-6 h-6 rounded object-cover" />
                                      <span>Image {imgIdx + 1}</span>
                                    </div>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="content" className="space-y-4 mt-4">
              <ContentSectionsEditor
                sections={formData.contentSections || []}
                onChange={(sections) => setFormData({ ...formData, contentSections: sections })}
              />
            </TabsContent>
          </Tabs>

          <div className="flex justify-end gap-3 pt-4 border-t mt-4">
            <Button variant="outline" onClick={() => setIsFormOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving...</>
              ) : 'Save Product'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
