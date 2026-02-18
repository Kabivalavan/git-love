import { useEffect, useState } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { DataTable, Column } from '@/components/admin/DataTable';
import { DetailPanel, DetailField, DetailSection } from '@/components/admin/DetailPanel';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { ImageUpload } from '@/components/ui/image-upload';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface Banner {
  id: string;
  title: string;
  position: string;
  type: string;
  media_url: string;
  redirect_url: string | null;
  start_date: string | null;
  end_date: string | null;
  is_active: boolean;
  show_on_mobile: boolean;
  show_on_desktop: boolean;
  sort_order: number;
  created_at: string;
}

const POSITIONS = [
  { value: 'home_top', label: 'Home Top Slider' },
  { value: 'home_middle', label: 'Home Middle' },
  { value: 'category', label: 'Category Page' },
  { value: 'offer', label: 'Offer Banner' },
  { value: 'popup', label: 'Popup' },
];

export default function AdminBanners() {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedBanner, setSelectedBanner] = useState<Banner | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState<Partial<Banner>>({});
  const { toast } = useToast();

  useEffect(() => {
    fetchBanners();
  }, []);

  const fetchBanners = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('banners')
      .select('*')
      .order('sort_order', { ascending: true });

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      setBanners((data || []) as Banner[]);
    }
    setIsLoading(false);
  };

  const handleRowClick = (banner: Banner) => {
    setSelectedBanner(banner);
    setIsDetailOpen(true);
  };

  const handleEdit = () => {
    if (selectedBanner) {
      setFormData(selectedBanner);
      setIsDetailOpen(false);
      setIsFormOpen(true);
    }
  };

  const handleCreate = () => {
    setFormData({
      is_active: true,
      show_on_mobile: true,
      show_on_desktop: true,
      type: 'image',
      position: 'home_top',
      sort_order: 0,
    });
    setSelectedBanner(null);
    setIsFormOpen(true);
  };

  const handleDelete = async () => {
    if (!selectedBanner) return;
    setIsDeleting(true);

    const { error } = await supabase
      .from('banners')
      .delete()
      .eq('id', selectedBanner.id);

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Success', description: 'Banner deleted successfully' });
      setIsDetailOpen(false);
      fetchBanners();
    }
    setIsDeleting(false);
  };

  const handleSave = async () => {
    if (!formData.title || !formData.media_url) {
      toast({ title: 'Error', description: 'Title and image are required', variant: 'destructive' });
      return;
    }

    setIsSaving(true);

    const bannerData = {
      title: formData.title,
      position: (formData.position || 'home_top') as 'home_top' | 'home_middle' | 'category' | 'offer' | 'popup',
      type: (formData.type || 'image') as 'image' | 'video',
      media_url: formData.media_url,
      redirect_url: formData.redirect_url,
      start_date: formData.start_date,
      end_date: formData.end_date,
      is_active: formData.is_active ?? true,
      show_on_mobile: formData.show_on_mobile ?? true,
      show_on_desktop: formData.show_on_desktop ?? true,
      sort_order: formData.sort_order ?? 0,
    };

    if (selectedBanner) {
      const { error } = await supabase
        .from('banners')
        .update(bannerData)
        .eq('id', selectedBanner.id);

      if (error) {
        toast({ title: 'Error', description: error.message, variant: 'destructive' });
      } else {
        toast({ title: 'Success', description: 'Banner updated successfully' });
        setIsFormOpen(false);
        fetchBanners();
      }
    } else {
      const { error } = await supabase.from('banners').insert([bannerData]);

      if (error) {
        toast({ title: 'Error', description: error.message, variant: 'destructive' });
      } else {
        toast({ title: 'Success', description: 'Banner created successfully' });
        setIsFormOpen(false);
        fetchBanners();
      }
    }
    setIsSaving(false);
  };

  const columns: Column<Banner>[] = [
    {
      key: 'media_url',
      header: 'Preview',
      render: (b) => (
        <img src={b.media_url} alt={b.title} className="h-12 w-20 object-cover rounded" />
      ),
    },
    { key: 'title', header: 'Title' },
    {
      key: 'position',
      header: 'Position',
      render: (b) => POSITIONS.find(p => p.value === b.position)?.label || b.position,
    },
    { key: 'sort_order', header: 'Order' },
    {
      key: 'is_active',
      header: 'Status',
      render: (b) => (
        <Badge variant={b.is_active ? 'default' : 'secondary'}>
          {b.is_active ? 'Active' : 'Inactive'}
        </Badge>
      ),
    },
  ];

  return (
    <AdminLayout
      title="Banners & Media"
      description="Manage homepage banners and promotional media"
      actions={
        <Button onClick={handleCreate} className="bg-primary hover:bg-primary/90">
          <Plus className="h-4 w-4 mr-2" />
          Add Banner
        </Button>
      }
    >
      <DataTable<Banner>
        columns={columns}
        data={banners}
        isLoading={isLoading}
        onRowClick={handleRowClick}
        searchable
        searchPlaceholder="Search banners..."
        searchKeys={['title']}
        getRowId={(b) => b.id}
        emptyMessage="No banners found. Click 'Add Banner' to create one."
      />

      <DetailPanel
        isOpen={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
        title={selectedBanner?.title || 'Banner Details'}
        onEdit={handleEdit}
        onDelete={handleDelete}
        isDeleting={isDeleting}
      >
        {selectedBanner && (
          <div className="space-y-6">
            <img
              src={selectedBanner.media_url}
              alt={selectedBanner.title}
              className="w-full rounded-lg"
            />
            <DetailSection title="Details">
              <DetailField label="Title" value={selectedBanner.title} />
              <DetailField label="Position" value={POSITIONS.find(p => p.value === selectedBanner.position)?.label} />
              <DetailField label="Redirect URL" value={selectedBanner.redirect_url} />
              <DetailField label="Sort Order" value={selectedBanner.sort_order} />
            </DetailSection>
            <DetailSection title="Visibility">
              <DetailField label="Active" value={selectedBanner.is_active ? 'Yes' : 'No'} />
              <DetailField label="Mobile" value={selectedBanner.show_on_mobile ? 'Yes' : 'No'} />
              <DetailField label="Desktop" value={selectedBanner.show_on_desktop ? 'Yes' : 'No'} />
            </DetailSection>
            <DetailSection title="Schedule">
              <DetailField label="Start Date" value={selectedBanner.start_date ? new Date(selectedBanner.start_date).toLocaleDateString() : 'Not set'} />
              <DetailField label="End Date" value={selectedBanner.end_date ? new Date(selectedBanner.end_date).toLocaleDateString() : 'Not set'} />
            </DetailSection>
          </div>
        )}
      </DetailPanel>

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedBanner ? 'Edit Banner' : 'Create Banner'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Banner Image *</Label>
              <ImageUpload
                bucket="banners"
                value={formData.media_url}
                onChange={(url) => setFormData({ ...formData, media_url: url || '' })}
                aspectRatio="banner"
                placeholder="Upload banner image (recommended: 1920x640)"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="title">Title *</Label>
                <Input
                  id="title"
                  value={formData.title || ''}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="position">Position</Label>
                <Select
                  value={formData.position || 'home_top'}
                  onValueChange={(value) => setFormData({ ...formData, position: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {POSITIONS.map((pos) => (
                      <SelectItem key={pos.value} value={pos.value}>
                        {pos.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="redirect_url">Redirect URL</Label>
              <Input
                id="redirect_url"
                value={formData.redirect_url || ''}
                onChange={(e) => setFormData({ ...formData, redirect_url: e.target.value })}
                placeholder="https://..."
              />
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
              <Label htmlFor="sort_order">Sort Order</Label>
              <Input
                id="sort_order"
                type="number"
                value={formData.sort_order || 0}
                onChange={(e) => setFormData({ ...formData, sort_order: parseInt(e.target.value) })}
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
                  id="show_on_mobile"
                  checked={formData.show_on_mobile}
                  onCheckedChange={(checked) => setFormData({ ...formData, show_on_mobile: checked })}
                />
                <Label htmlFor="show_on_mobile">Show on Mobile</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="show_on_desktop"
                  checked={formData.show_on_desktop}
                  onCheckedChange={(checked) => setFormData({ ...formData, show_on_desktop: checked })}
                />
                <Label htmlFor="show_on_desktop">Show on Desktop</Label>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button variant="outline" onClick={() => setIsFormOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={isSaving}>
                {isSaving ? 'Saving...' : 'Save Banner'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
