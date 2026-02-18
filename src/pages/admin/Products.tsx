import { useEffect, useState } from 'react';
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
  name: string;
  sku: string;
  price: string;
  mrp: string;
  stock_quantity: string;
}

export default function AdminProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState<Partial<Product> & { imageUrls?: string[]; productType?: string; contentSections?: ContentSection[] }>({});
  const [variantForms, setVariantForms] = useState<VariantForm[]>([]);
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('all');
  const { toast } = useToast();

  useEffect(() => {
    fetchProducts();
    fetchCategories();
  }, []);

  const fetchProducts = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('products')
      .select('*, category:categories(*), images:product_images(*)')
      .order('created_at', { ascending: false });

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      setProducts((data || []) as unknown as Product[]);
    }
    setIsLoading(false);
  };

  const fetchCategories = async () => {
    const { data } = await supabase.from('categories').select('*').eq('is_active', true);
    setCategories((data || []) as unknown as Category[]);
  };

  const handleRowClick = (product: Product) => {
    setSelectedProduct(product);
    setIsDetailOpen(true);
  };

  const handleEdit = async () => {
    if (!selectedProduct) return;
    const imageUrls = selectedProduct.images?.map(img => img.image_url) || [];
    
    // Fetch variants for this product
    const { data: variants } = await supabase
      .from('product_variants')
      .select('*')
      .eq('product_id', selectedProduct.id);
    
    const existingVariants = (variants || []).map(v => ({
      name: v.name,
      sku: v.sku || '',
      price: v.price?.toString() || '',
      mrp: v.mrp?.toString() || '',
      stock_quantity: v.stock_quantity?.toString() || '0',
    }));
    
    // Detect product type from variants
    let detectedType = 'general';
    if (existingVariants.length > 0) {
      const names = existingVariants.map(v => v.name.toUpperCase());
      if (names.some(n => CLOTHING_SIZES.includes(n))) detectedType = 'clothing';
      else if (names.some(n => FOOTWEAR_SIZES.includes(n))) detectedType = 'footwear';
    }
    const contentSections = (selectedProduct as any).content_sections as ContentSection[] || [];
    setFormData({ ...selectedProduct, imageUrls, productType: detectedType, contentSections, variant_required: (selectedProduct as any).variant_required || false } as any);
    setVariantForms(existingVariants);
    setIsDetailOpen(false);
    setIsFormOpen(true);
  };

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
    setVariantForms([]);
    setSelectedProduct(null);
    setIsFormOpen(true);
  };

  const handleDelete = async () => {
    if (!selectedProduct) return;
    setIsDeleting(true);

    if (selectedProduct.images) {
      for (const img of selectedProduct.images) {
        const urlParts = img.image_url.split('/products/');
        if (urlParts.length > 1) {
          await supabase.storage.from('products').remove([urlParts[1]]);
        }
      }
    }

    const { error } = await supabase.from('products').delete().eq('id', selectedProduct.id);

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Success', description: 'Product deleted successfully' });
      setIsDetailOpen(false);
      fetchProducts();
    }
    setIsDeleting(false);
  };

  const addQuickSizes = () => {
    const sizes = formData.productType === 'footwear' ? FOOTWEAR_SIZES : CLOTHING_SIZES;
    const newVariants = sizes.map(size => ({
      name: size,
      sku: '',
      price: '',
      mrp: '',
      stock_quantity: '0',
    }));
    setVariantForms([...variantForms, ...newVariants]);
  };

  const handleSave = async () => {
    if (!formData.name || !formData.price) {
      toast({ title: 'Error', description: 'Name and price are required', variant: 'destructive' });
      return;
    }
    // Clothing/footwear must have variants
    if ((formData.productType === 'clothing' || formData.productType === 'footwear') && variantForms.filter(v => v.name.trim()).length === 0) {
      toast({ title: 'Variants Required', description: 'Clothing and footwear products must have at least one variant (size)', variant: 'destructive' });
      return;
    }

    setIsSaving(true);

    const slug = formData.slug || formData.name?.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    const productData = {
      name: formData.name,
      slug,
      description: formData.description,
      short_description: formData.short_description,
      category_id: formData.category_id || null,
      price: formData.price,
      mrp: formData.mrp || null,
      cost_price: formData.cost_price || null,
      sku: formData.sku || null,
      barcode: formData.barcode || null,
      stock_quantity: formData.stock_quantity ?? 0,
      low_stock_threshold: formData.low_stock_threshold ?? 5,
      tax_rate: formData.tax_rate ?? 0,
      shipping_weight: formData.shipping_weight || null,
      is_active: formData.is_active ?? true,
      is_featured: formData.is_featured ?? false,
      is_bestseller: formData.is_bestseller ?? false,
      badge: formData.badge || null,
      sort_order: formData.sort_order ?? 0,
      content_sections: (formData.contentSections || []) as unknown as import('@/integrations/supabase/types').Json,
      variant_required: (formData as any).variant_required || false,
    };

    try {
      let productId: string;

      if (selectedProduct) {
        const { error } = await supabase.from('products').update(productData).eq('id', selectedProduct.id);
        if (error) throw error;
        productId = selectedProduct.id;
        await supabase.from('product_images').delete().eq('product_id', productId);
        await supabase.from('product_variants').delete().eq('product_id', productId);
      } else {
        const { data, error } = await supabase.from('products').insert([productData]).select().single();
        if (error) throw error;
        productId = data.id;
      }

      // Insert images
      if (formData.imageUrls && formData.imageUrls.length > 0) {
        const imageRecords = formData.imageUrls.map((url, index) => ({
          product_id: productId,
          image_url: url,
          sort_order: index,
          is_primary: index === 0,
        }));
        await supabase.from('product_images').insert(imageRecords);
      }

      // Insert variants
      if (variantForms.length > 0) {
        const variantRecords = variantForms
          .filter(v => v.name.trim())
          .map(v => ({
            product_id: productId,
            name: v.name,
            sku: v.sku || null,
            price: v.price ? parseFloat(v.price) : null,
            mrp: v.mrp ? parseFloat(v.mrp) : null,
            stock_quantity: parseInt(v.stock_quantity) || 0,
            is_active: true,
          }));
        if (variantRecords.length > 0) {
          await supabase.from('product_variants').insert(variantRecords);
        }
      }

      toast({ title: 'Success', description: `Product ${selectedProduct ? 'updated' : 'created'} successfully` });
      setIsFormOpen(false);
      fetchProducts();
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
    { key: 'sku', header: 'SKU' },
    {
      key: 'price',
      header: 'Price',
      render: (p) => (
        <div>
          <span className="font-medium">₹{Number(p.price).toFixed(0)}</span>
          {p.mrp && p.mrp > p.price && (
            <span className="text-xs text-muted-foreground line-through ml-2">₹{Number(p.mrp).toFixed(0)}</span>
          )}
        </div>
      ),
    },
    {
      key: 'stock_quantity',
      header: 'Stock',
      render: (p) => (
        <Badge variant={p.stock_quantity <= p.low_stock_threshold ? 'destructive' : 'secondary'}>
          {p.stock_quantity}
        </Badge>
      ),
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
    : products.filter(p => p.category_id === selectedCategoryFilter);

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
      {/* Category filter chips */}
      {categories.length > 0 && (
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
          {categories.map((cat) => {
            const count = products.filter(p => p.category_id === cat.id).length;
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
              <DetailField label="SKU" value={selectedProduct.sku} />
              <DetailField label="Slug" value={selectedProduct.slug} />
              <DetailField label="Badge" value={selectedProduct.badge} />
              <DetailField label="Category" value={selectedProduct.category?.name} />
              <DetailField label="Barcode" value={selectedProduct.barcode} />
            </DetailSection>
            <DetailSection title="Pricing">
              <DetailField label="Price" value={`₹${Number(selectedProduct.price).toFixed(2)}`} />
              <DetailField label="MRP" value={selectedProduct.mrp ? `₹${Number(selectedProduct.mrp).toFixed(2)}` : '-'} />
              <DetailField label="Cost Price" value={selectedProduct.cost_price ? `₹${Number(selectedProduct.cost_price).toFixed(2)}` : '-'} />
              <DetailField label="Tax Rate" value={`${selectedProduct.tax_rate}%`} />
            </DetailSection>
            <DetailSection title="Inventory">
              <DetailField label="Stock" value={selectedProduct.stock_quantity} />
              <DetailField label="Low Stock Threshold" value={selectedProduct.low_stock_threshold} />
              <DetailField label="Weight" value={selectedProduct.shipping_weight ? `${selectedProduct.shipping_weight} kg` : '-'} />
            </DetailSection>
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
            <TabsList className="grid w-full grid-cols-6">
              <TabsTrigger value="basic">Basic</TabsTrigger>
              <TabsTrigger value="pricing">Pricing</TabsTrigger>
              <TabsTrigger value="inventory">Inventory</TabsTrigger>
              <TabsTrigger value="variants">Variants</TabsTrigger>
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
                  <Label htmlFor="sku">SKU</Label>
                  <Input
                    id="sku"
                    value={formData.sku || ''}
                    onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                    placeholder="Stock keeping unit"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="category">Category</Label>
                  <Select
                    value={formData.category_id || ''}
                    onValueChange={(value) => setFormData({ ...formData, category_id: value || null })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((cat) => (
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
                <p className="text-xs text-amber-600 bg-amber-50 dark:bg-amber-950 dark:text-amber-400 p-2 rounded">
                  ⚠️ Customers must select a variant before adding to cart
                </p>
              )}
            </TabsContent>

            <TabsContent value="pricing" className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="price">Selling Price *</Label>
                  <Input id="price" type="number" step="0.01" value={formData.price || ''} onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) })} placeholder="0.00" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="mrp">MRP (Original Price)</Label>
                  <Input id="mrp" type="number" step="0.01" value={formData.mrp || ''} onChange={(e) => setFormData({ ...formData, mrp: parseFloat(e.target.value) || null })} placeholder="0.00" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="cost_price">Cost Price</Label>
                  <Input id="cost_price" type="number" step="0.01" value={formData.cost_price || ''} onChange={(e) => setFormData({ ...formData, cost_price: parseFloat(e.target.value) || null })} placeholder="0.00" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tax_rate">Tax Rate (%)</Label>
                  <Input id="tax_rate" type="number" step="0.01" value={formData.tax_rate || 0} onChange={(e) => setFormData({ ...formData, tax_rate: parseFloat(e.target.value) || 0 })} placeholder="0" />
                </div>
              </div>
              {formData.mrp && formData.price && formData.mrp > formData.price && (
                <div className="p-3 bg-accent rounded-lg">
                  <p className="text-sm text-accent-foreground">
                    Discount: {Math.round(((formData.mrp - formData.price) / formData.mrp) * 100)}% off
                  </p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="inventory" className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Stock Quantity</Label>
                  <Input type="number" value={formData.stock_quantity || 0} onChange={(e) => setFormData({ ...formData, stock_quantity: parseInt(e.target.value) || 0 })} />
                </div>
                <div className="space-y-2">
                  <Label>Low Stock Alert Threshold</Label>
                  <Input type="number" value={formData.low_stock_threshold || 5} onChange={(e) => setFormData({ ...formData, low_stock_threshold: parseInt(e.target.value) || 5 })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Barcode</Label>
                  <Input value={formData.barcode || ''} onChange={(e) => setFormData({ ...formData, barcode: e.target.value })} placeholder="UPC, EAN, etc." />
                </div>
                <div className="space-y-2">
                  <Label>Shipping Weight (kg)</Label>
                  <Input type="number" step="0.01" value={formData.shipping_weight || ''} onChange={(e) => setFormData({ ...formData, shipping_weight: parseFloat(e.target.value) || null })} />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="variants" className="space-y-4 mt-4">
              <div className="flex items-center justify-between">
                <div>
              <Label className="text-base font-semibold">Product Variants {(formData.productType === 'clothing' || formData.productType === 'footwear') && <span className="text-destructive">*</span>}</Label>
                  <p className="text-sm text-muted-foreground">
                    {(formData.productType === 'clothing' || formData.productType === 'footwear') 
                      ? 'Variants are mandatory for clothing/footwear products' 
                      : 'Add sizes, colors, or other customization options'}
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
                    onClick={() => setVariantForms([...variantForms, { name: '', sku: '', price: '', mrp: '', stock_quantity: '0' }])}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Add Variant
                  </Button>
                </div>
              </div>

              {variantForms.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground border rounded-lg">
                  <p>No variants added yet.</p>
                  <p className="text-sm">Add variants for sizes, colors, etc.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {variantForms.map((variant, index) => (
                    <div key={index} className="grid grid-cols-6 gap-2 items-end p-3 border rounded-lg">
                      <div className="space-y-1">
                        <Label className="text-xs">Name *</Label>
                        <Input
                          value={variant.name}
                          onChange={(e) => {
                            const updated = [...variantForms];
                            updated[index].name = e.target.value;
                            setVariantForms(updated);
                          }}
                          placeholder="e.g., L, Red"
                          className="h-8"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">SKU</Label>
                        <Input
                          value={variant.sku}
                          onChange={(e) => {
                            const updated = [...variantForms];
                            updated[index].sku = e.target.value;
                            setVariantForms(updated);
                          }}
                          className="h-8"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Price</Label>
                        <Input
                          type="number"
                          value={variant.price}
                          onChange={(e) => {
                            const updated = [...variantForms];
                            updated[index].price = e.target.value;
                            setVariantForms(updated);
                          }}
                          className="h-8"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">MRP</Label>
                        <Input
                          type="number"
                          value={variant.mrp}
                          onChange={(e) => {
                            const updated = [...variantForms];
                            updated[index].mrp = e.target.value;
                            setVariantForms(updated);
                          }}
                          className="h-8"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Stock</Label>
                        <Input
                          type="number"
                          value={variant.stock_quantity}
                          onChange={(e) => {
                            const updated = [...variantForms];
                            updated[index].stock_quantity = e.target.value;
                            setVariantForms(updated);
                          }}
                          className="h-8"
                        />
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        onClick={() => setVariantForms(variantForms.filter((_, i) => i !== index))}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
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
