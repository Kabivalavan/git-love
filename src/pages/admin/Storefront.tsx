import { useEffect, useState } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { ShimmerCard } from '@/components/ui/shimmer';
import {
  Palette, Eye, Check, ChevronRight, Settings2, Save, Loader2,
  Layout, Grid, Rows, Sparkles, ShoppingBag, Zap, Crown, Leaf
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Template {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  preview: string;
  colors: { primary: string; secondary: string; accent: string };
}

interface Section {
  id: string;
  type: string;
  enabled: boolean;
  order: number;
  config: Record<string, string>;
}

const TEMPLATES: Template[] = [
  { id: 'classic', name: 'Classic Store', description: 'Traditional e-commerce layout inspired by Amazon', icon: <Layout className="h-5 w-5" />, preview: 'bg-gradient-to-br from-blue-50 to-white', colors: { primary: '#3B82F6', secondary: '#10B981', accent: '#F59E0B' } },
  { id: 'minimal', name: 'Minimal Clean', description: 'Clean, whitespace-focused design like Shopify themes', icon: <Rows className="h-5 w-5" />, preview: 'bg-gradient-to-br from-gray-50 to-white', colors: { primary: '#18181B', secondary: '#71717A', accent: '#3B82F6' } },
  { id: 'bold', name: 'Bold & Vibrant', description: 'Eye-catching colors inspired by Meesho', icon: <Sparkles className="h-5 w-5" />, preview: 'bg-gradient-to-br from-pink-100 to-purple-50', colors: { primary: '#EC4899', secondary: '#8B5CF6', accent: '#F59E0B' } },
  { id: 'fashion', name: 'Fashion Forward', description: 'Elegant design for fashion and lifestyle brands', icon: <Crown className="h-5 w-5" />, preview: 'bg-gradient-to-br from-amber-50 to-rose-50', colors: { primary: '#B45309', secondary: '#7C2D12', accent: '#D97706' } },
  { id: 'tech', name: 'Tech Modern', description: 'Sleek design for electronics like Flipkart', icon: <Zap className="h-5 w-5" />, preview: 'bg-gradient-to-br from-slate-900 to-slate-800', colors: { primary: '#2563EB', secondary: '#0EA5E9', accent: '#FBBF24' } },
  { id: 'grocery', name: 'Fresh Grocery', description: 'Warm, inviting design for food and grocery', icon: <Leaf className="h-5 w-5" />, preview: 'bg-gradient-to-br from-green-50 to-lime-50', colors: { primary: '#16A34A', secondary: '#84CC16', accent: '#F97316' } },
  { id: 'marketplace', name: 'Marketplace', description: 'Multi-category design like Snapdeal', icon: <ShoppingBag className="h-5 w-5" />, preview: 'bg-gradient-to-br from-red-50 to-orange-50', colors: { primary: '#DC2626', secondary: '#EA580C', accent: '#FBBF24' } },
];

const DEFAULT_SECTIONS: Section[] = [
  { id: 'hero_banner', type: 'hero_banner', enabled: true, order: 1, config: { title: 'Welcome to Our Store', subtitle: 'Discover amazing products' } },
  { id: 'promo_strip', type: 'promo_strip', enabled: true, order: 2, config: { text: 'Free shipping on orders above ₹500!' } },
  { id: 'categories', type: 'category_grid', enabled: true, order: 3, config: { title: 'Shop by Category', columns: '8' } },
  { id: 'featured', type: 'product_grid', enabled: true, order: 4, config: { title: 'Featured Products', filter: 'featured', limit: '8' } },
  { id: 'banner_1', type: 'banner_pair', enabled: true, order: 5, config: { banner1_title: 'Special Offers', banner2_title: 'New Arrivals' } },
  { id: 'bestsellers', type: 'product_grid', enabled: true, order: 6, config: { title: 'Best Sellers', filter: 'bestseller', limit: '8' } },
  { id: 'new_arrivals', type: 'product_carousel', enabled: true, order: 7, config: { title: 'New Arrivals', filter: 'new', limit: '12' } },
  { id: 'testimonials', type: 'testimonials', enabled: false, order: 8, config: { title: 'What Our Customers Say' } },
  { id: 'newsletter', type: 'newsletter', enabled: true, order: 9, config: { title: 'Subscribe to Our Newsletter', subtitle: 'Get updates on new products and offers' } },
];

export default function AdminStorefront() {
  const [selectedTemplate, setSelectedTemplate] = useState('classic');
  const [sections, setSections] = useState<Section[]>(DEFAULT_SECTIONS);
  const [isLoading, setIsLoading] = useState(true);
  const [editingSection, setEditingSection] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchStorefrontConfig();
  }, []);

  const fetchStorefrontConfig = async () => {
    setIsLoading(true);
    const { data } = await supabase
      .from('storefront_config')
      .select('*')
      .eq('page_name', 'home')
      .single();

    if (data) {
      setSelectedTemplate(data.template_id || 'classic');
      if (data.sections && Array.isArray(data.sections)) {
        const loadedSections = (data.sections as unknown as Section[]).map(s => ({
          ...s,
          config: s.config || {}
        }));
        setSections(loadedSections.length > 0 ? loadedSections : DEFAULT_SECTIONS);
      } else {
        setSections(DEFAULT_SECTIONS);
      }
    } else {
      setSections(DEFAULT_SECTIONS);
    }
    setIsLoading(false);
  };

  const handleSave = async () => {
    setIsSaving(true);

    // Check if config exists
    const { data: existing } = await supabase
      .from('storefront_config')
      .select('id')
      .eq('page_name', 'home')
      .single();

    let error;
    if (existing) {
      const res = await supabase
        .from('storefront_config')
        .update({
          template_id: selectedTemplate,
          sections: sections as any,
          is_active: true,
        })
        .eq('page_name', 'home');
      error = res.error;
    } else {
      const res = await supabase
        .from('storefront_config')
        .insert({
          page_name: 'home',
          template_id: selectedTemplate,
          sections: sections as any,
          is_active: true,
        });
      error = res.error;
    }

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Saved', description: 'Storefront configuration saved successfully' });
    }
    setIsSaving(false);
  };

  const toggleSection = (sectionId: string) => {
    setSections(sections.map(s => s.id === sectionId ? { ...s, enabled: !s.enabled } : s));
  };

  const updateSectionConfig = (sectionId: string, key: string, value: string) => {
    setSections(sections.map(s =>
      s.id === sectionId ? { ...s, config: { ...(s.config || {}), [key]: value } } : s
    ));
  };

  const moveSection = (sectionId: string, direction: 'up' | 'down') => {
    const index = sections.findIndex(s => s.id === sectionId);
    if ((direction === 'up' && index === 0) || (direction === 'down' && index === sections.length - 1)) return;
    const newSections = [...sections];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    [newSections[index], newSections[targetIndex]] = [newSections[targetIndex], newSections[index]];
    newSections.forEach((s, i) => s.order = i + 1);
    setSections(newSections);
  };

  const currentTemplate = TEMPLATES.find(t => t.id === selectedTemplate);

  if (isLoading) {
    return (
      <AdminLayout title="Storefront Builder" description="Customize your store's appearance">
        <div className="space-y-6">
          <div className="grid grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => <ShimmerCard key={i} />)}
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout
      title="Storefront Builder"
      description="Customize your store's appearance"
      actions={
        <div className="flex gap-3">
          <Button variant="outline" asChild>
            <a href="/" target="_blank" rel="noopener noreferrer">
              <Eye className="h-4 w-4 mr-2" />
              Preview
            </a>
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            {isSaving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      }
    >
      <Tabs defaultValue="template" className="space-y-6">
        <TabsList>
          <TabsTrigger value="template" className="gap-2">
            <Palette className="h-4 w-4" />
            Choose Template
          </TabsTrigger>
          <TabsTrigger value="sections" className="gap-2">
            <Grid className="h-4 w-4" />
            Page Sections
          </TabsTrigger>
          <TabsTrigger value="customize" className="gap-2">
            <Settings2 className="h-4 w-4" />
            Customize
          </TabsTrigger>
        </TabsList>

        <TabsContent value="template">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {TEMPLATES.map((template) => (
              <Card
                key={template.id}
                className={cn('cursor-pointer transition-all hover:shadow-lg', selectedTemplate === template.id && 'ring-2 ring-primary')}
                onClick={() => setSelectedTemplate(template.id)}
              >
                <CardContent className="p-4">
                  <div className={cn('aspect-video rounded-lg mb-3 relative overflow-hidden', template.preview)}>
                    <div className="absolute inset-0 flex items-center justify-center">{template.icon}</div>
                    {selectedTemplate === template.id && (
                      <div className="absolute top-2 right-2 bg-primary text-primary-foreground rounded-full p-1">
                        <Check className="h-3 w-3" />
                      </div>
                    )}
                  </div>
                  <h3 className="font-semibold">{template.name}</h3>
                  <p className="text-sm text-muted-foreground mt-1">{template.description}</p>
                  <div className="flex gap-1 mt-3">
                    <div className="w-6 h-6 rounded-full" style={{ backgroundColor: template.colors.primary }} />
                    <div className="w-6 h-6 rounded-full" style={{ backgroundColor: template.colors.secondary }} />
                    <div className="w-6 h-6 rounded-full" style={{ backgroundColor: template.colors.accent }} />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="sections">
          <div className="grid lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-3">
              {sections
                .sort((a, b) => a.order - b.order)
                .map((section, index) => (
                  <Card key={section.id} className={cn(!section.enabled && 'opacity-60')}>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-4">
                        <div className="flex flex-col gap-1">
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => moveSection(section.id, 'up')} disabled={index === 0}>
                            <ChevronRight className="h-4 w-4 -rotate-90" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => moveSection(section.id, 'down')} disabled={index === sections.length - 1}>
                            <ChevronRight className="h-4 w-4 rotate-90" />
                          </Button>
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium capitalize">{section.type.replace(/_/g, ' ')}</h4>
                            <Badge variant="outline" className="text-xs">{section.type}</Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {section.config?.title || section.config?.text || 'No title set'}
                          </p>
                        </div>
                        <Switch checked={section.enabled} onCheckedChange={() => toggleSection(section.id)} />
                        <Button variant="ghost" size="sm" onClick={() => setEditingSection(editingSection === section.id ? null : section.id)}>
                          <Settings2 className="h-4 w-4" />
                        </Button>
                      </div>

                      {editingSection === section.id && section.config && (
                        <div className="mt-4 pt-4 border-t space-y-3">
                          {Object.entries(section.config).map(([key, value]) => (
                            <div key={key} className="space-y-1">
                              <Label className="capitalize text-xs">{key.replace(/_/g, ' ')}</Label>
                              <Input
                                value={value || ''}
                                onChange={(e) => updateSectionConfig(section.id, key, e.target.value)}
                                className="h-8"
                              />
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
            </div>
            <div>
              <Card className="sticky top-24">
                <CardHeader>
                  <CardTitle className="text-lg">Section Types</CardTitle>
                  <CardDescription>Available section types for your page</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="p-2 bg-muted rounded"><strong>hero_banner</strong> - Large banner with CTA</div>
                  <div className="p-2 bg-muted rounded"><strong>promo_strip</strong> - Scrolling promo text</div>
                  <div className="p-2 bg-muted rounded"><strong>category_grid</strong> - Category circles/cards</div>
                  <div className="p-2 bg-muted rounded"><strong>product_grid</strong> - Product cards grid</div>
                  <div className="p-2 bg-muted rounded"><strong>product_carousel</strong> - Scrollable products</div>
                  <div className="p-2 bg-muted rounded"><strong>banner_pair</strong> - Two banners side by side</div>
                  <div className="p-2 bg-muted rounded"><strong>testimonials</strong> - Customer reviews</div>
                  <div className="p-2 bg-muted rounded"><strong>newsletter</strong> - Email signup form</div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="customize">
          <div className="grid lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Current Template: {currentTemplate?.name}</CardTitle>
                <CardDescription>Fine-tune your selected template</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <Label>Template Colors</Label>
                  <div className="flex gap-4">
                    {['primary', 'secondary', 'accent'].map((key) => (
                      <div key={key} className="flex-1 space-y-2">
                        <Label className="text-xs capitalize">{key}</Label>
                        <div className="h-12 rounded-lg" style={{ backgroundColor: (currentTemplate?.colors as any)?.[key] }} />
                      </div>
                    ))}
                  </div>
                </div>
                <Separator />
                <div className="space-y-4">
                  <Label>Quick Settings</Label>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between"><Label>Show promotional strip</Label><Switch defaultChecked /></div>
                    <div className="flex items-center justify-between"><Label>Enable newsletter popup</Label><Switch /></div>
                    <div className="flex items-center justify-between"><Label>Show category icons</Label><Switch defaultChecked /></div>
                    <div className="flex items-center justify-between"><Label>Enable quick view</Label><Switch defaultChecked /></div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Preview</CardTitle>
                <CardDescription>Visual preview of your selected template</CardDescription>
              </CardHeader>
              <CardContent>
                <div className={cn('aspect-video rounded-lg border overflow-hidden', currentTemplate?.preview)}>
                  <div className="h-full flex flex-col">
                    <div className="h-8 bg-card border-b flex items-center px-2 gap-2">
                      <div className="w-16 h-4 bg-muted rounded" />
                      <div className="flex-1" />
                      <div className="w-8 h-4 bg-muted rounded" />
                    </div>
                    <div className="h-24 mx-2 mt-2 rounded" style={{ backgroundColor: (currentTemplate?.colors.primary || '#3B82F6') + '20' }} />
                    <div className="flex gap-2 px-2 mt-2">
                      {[1, 2, 3, 4].map(i => <div key={i} className="w-8 h-8 rounded-full bg-muted" />)}
                    </div>
                    <div className="grid grid-cols-4 gap-2 p-2 mt-auto">
                      {[1, 2, 3, 4].map(i => <div key={i} className="aspect-square bg-muted rounded" />)}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </AdminLayout>
  );
}
