import { useEffect, useState } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { DataTable, Column } from '@/components/admin/DataTable';
import { DetailPanel, DetailField, DetailSection } from '@/components/admin/DetailPanel';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { Category } from '@/types/database';
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
import { ImageUpload } from '@/components/ui/image-upload';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export default function AdminCategories() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState<Partial<Category>>({});
  const { toast } = useToast();

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .order('sort_order', { ascending: true });

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      setCategories((data || []) as unknown as Category[]);
    }
    setIsLoading(false);
  };

  const handleRowClick = (category: Category) => {
    setSelectedCategory(category);
    setIsDetailOpen(true);
  };

  const handleEdit = () => {
    if (selectedCategory) {
      setFormData(selectedCategory);
      setIsDetailOpen(false);
      setIsFormOpen(true);
    }
  };

  const handleCreate = () => {
    setFormData({
      is_active: true,
      sort_order: 0,
    });
    setSelectedCategory(null);
    setIsFormOpen(true);
  };

  const handleDelete = async () => {
    if (!selectedCategory) return;
    setIsDeleting(true);

    const { error } = await supabase
      .from('categories')
      .delete()
      .eq('id', selectedCategory.id);

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Success', description: 'Category deleted successfully' });
      setIsDetailOpen(false);
      fetchCategories();
    }
    setIsDeleting(false);
  };

  const handleSave = async () => {
    if (!formData.name) {
      toast({ title: 'Error', description: 'Name is required', variant: 'destructive' });
      return;
    }

    setIsSaving(true);

    const slug = formData.slug || formData.name.toLowerCase().replace(/\s+/g, '-');
    const categoryData = {
      name: formData.name,
      slug,
      description: formData.description,
      image_url: formData.image_url,
      parent_id: formData.parent_id,
      sort_order: formData.sort_order ?? 0,
      is_active: formData.is_active ?? true,
    };

    if (selectedCategory) {
      const { error } = await supabase
        .from('categories')
        .update(categoryData)
        .eq('id', selectedCategory.id);

      if (error) {
        toast({ title: 'Error', description: error.message, variant: 'destructive' });
      } else {
        toast({ title: 'Success', description: 'Category updated successfully' });
        setIsFormOpen(false);
        fetchCategories();
      }
    } else {
      const { error } = await supabase.from('categories').insert([categoryData]);

      if (error) {
        toast({ title: 'Error', description: error.message, variant: 'destructive' });
      } else {
        toast({ title: 'Success', description: 'Category created successfully' });
        setIsFormOpen(false);
        fetchCategories();
      }
    }
    setIsSaving(false);
  };

  const getParentName = (parentId: string | null) => {
    if (!parentId) return '-';
    const parent = categories.find((c) => c.id === parentId);
    return parent?.name || '-';
  };

  const columns: Column<Category>[] = [
    { key: 'name', header: 'Name' },
    { key: 'slug', header: 'Slug' },
    {
      key: 'parent_id',
      header: 'Parent',
      render: (c) => getParentName(c.parent_id),
    },
    { key: 'sort_order', header: 'Order' },
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
      title="Categories"
      description="Organize your products into categories"
      actions={
        <Button onClick={handleCreate} className="opacity-60 hover:opacity-100">
          <Plus className="h-4 w-4 mr-2" />
          Add Category
        </Button>
      }
    >
      <DataTable<Category>
        columns={columns}
        data={categories}
        isLoading={isLoading}
        onRowClick={handleRowClick}
        searchable
        searchPlaceholder="Search categories..."
        searchKeys={['name', 'slug', 'description']}
        getRowId={(c) => c.id}
        emptyMessage="No categories found. Click 'Add Category' to create one."
      />

      {/* Detail Panel */}
      <DetailPanel
        isOpen={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
        title={selectedCategory?.name || 'Category Details'}
        onEdit={handleEdit}
        onDelete={handleDelete}
        isDeleting={isDeleting}
        deleteConfirmMessage="Are you sure you want to delete this category? Products in this category will become uncategorized."
      >
        {selectedCategory && (
          <div className="space-y-6">
            <DetailSection title="Basic Info">
              <DetailField label="Name" value={selectedCategory.name} />
              <DetailField label="Slug" value={selectedCategory.slug} />
              <DetailField label="Parent" value={getParentName(selectedCategory.parent_id)} />
              <DetailField label="Sort Order" value={selectedCategory.sort_order} />
            </DetailSection>

            <DetailSection title="Status">
              <DetailField label="Active" value={selectedCategory.is_active ? 'Yes' : 'No'} />
              <DetailField label="Created" value={new Date(selectedCategory.created_at).toLocaleDateString()} />
            </DetailSection>

            <div className="col-span-2">
              <DetailField label="Description" value={selectedCategory.description} />
            </div>
          </div>
        )}
      </DetailPanel>

      {/* Form Dialog */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedCategory ? 'Edit Category' : 'Create Category'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={formData.name || ''}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="slug">Slug</Label>
              <Input
                id="slug"
                value={formData.slug || ''}
                onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                placeholder="Auto-generated from name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="parent">Parent Category</Label>
              <Select
                value={formData.parent_id || 'none'}
                onValueChange={(value) => setFormData({ ...formData, parent_id: value === 'none' ? null : value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select parent category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None (Top Level)</SelectItem>
                  {categories
                    .filter((c) => c.id !== selectedCategory?.id)
                    .map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="sort_order">Sort Order</Label>
              <Input
                id="sort_order"
                type="number"
                value={formData.sort_order || 0}
                onChange={(e) => setFormData({ ...formData, sort_order: parseInt(e.target.value) })}
              />
            </div>

            <div className="space-y-2">
              <Label>Category Image</Label>
              <ImageUpload
                bucket="categories"
                value={formData.image_url || undefined}
                onChange={(url) => setFormData({ ...formData, image_url: url })}
                aspectRatio="square"
                placeholder="Upload category image"
              />
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
              <Button onClick={handleSave} disabled={isSaving} className="opacity-60 hover:opacity-100">
                {isSaving ? 'Saving...' : 'Save Category'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
