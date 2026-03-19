import { useEffect, useState, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import {
  Save, Loader2, Gift, TrendingUp, ShoppingBag, ShoppingCart,
  Trash2, Plus, ArrowUpRight, Target, BarChart3, Zap, Eye, MousePointerClick,
  Percent, ArrowRight,
} from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell } from 'recharts';
import type { ConversionSettings } from '@/hooks/useConversionOptimization';
import type { Product } from '@/types/database';

const DEFAULT_SETTINGS: ConversionSettings = {
  exit_popup: {
    enabled: false,
    coupon_code: 'EXIT10',
    discount_text: '10% OFF',
    headline: "Wait! Don't leave empty-handed 🎁",
    description: 'Use this exclusive discount code on your first order',
    show_once_per_session: true,
  },
  upsell: { enabled: true, price_diff_min: 10, max_items: 3 },
  cross_sell: { enabled: true, max_items: 4 },
  cart_optimizer: { enabled: true, show_free_shipping_bar: true, upsell_headline: 'Customers also bought' },
};

interface CrossSellRule {
  id: string;
  source_product_id: string;
  target_product_id: string;
  rule_type: string;
  sort_order: number;
  is_active: boolean;
  source_product?: { name: string };
  target_product?: { name: string };
}

export default function ConversionOptimization() {
  const [settings, setSettings] = useState<ConversionSettings>(DEFAULT_SETTINGS);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch products for rule creation
  const { data: allProducts = [] } = useQuery({
    queryKey: ['admin-products-list'],
    queryFn: async () => {
      const { data } = await supabase
        .from('products')
        .select('id, name, price, slug')
        .eq('is_active', true)
        .order('name');
      return (data || []) as Pick<Product, 'id' | 'name' | 'price' | 'slug'>[];
    },
  });

  // Fetch cross-sell rules
  const { data: crossSellRules = [], refetch: refetchRules } = useQuery({
    queryKey: ['admin-cross-sell-rules'],
    queryFn: async () => {
      const { data } = await supabase
        .from('cross_sell_rules')
        .select('*')
        .order('rule_type')
        .order('sort_order');
      return (data || []) as CrossSellRule[];
    },
  });

  // Fetch conversion analytics with product details
  const { data: analytics } = useQuery({
    queryKey: ['conversion-analytics'],
    queryFn: async () => {
      const { data } = await supabase
        .from('conversion_events')
        .select('event_type, product_id, created_at')
        .gte('created_at', new Date(Date.now() - 30 * 86400000).toISOString());
      const counts: Record<string, number> = {};
      const productClicks: Record<string, number> = {};
      (data || []).forEach((e: any) => {
        counts[e.event_type] = (counts[e.event_type] || 0) + 1;
        if ((e.event_type === 'upsell_clicked' || e.event_type === 'cross_sell_clicked') && e.product_id) {
          productClicks[e.product_id] = (productClicks[e.product_id] || 0) + 1;
        }
      });
      return { counts, productClicks };
    },
    staleTime: 60000,
  });

  // Fetch top clicked products for insights
  const topClickedProductIds = Object.entries(analytics?.productClicks || {})
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([id]) => id);

  const { data: topProducts = [] } = useQuery({
    queryKey: ['top-conversion-products', topClickedProductIds],
    queryFn: async () => {
      if (topClickedProductIds.length === 0) return [];
      const { data } = await supabase
        .from('products')
        .select('id, name, price, slug, images:product_images(image_url, is_primary)')
        .in('id', topClickedProductIds);
      return (data || []) as any[];
    },
    enabled: topClickedProductIds.length > 0,
  });

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    setIsLoading(true);
    const { data } = await supabase
      .from('store_settings')
      .select('value')
      .eq('key', 'conversion_optimization')
      .single();
    if (data?.value) {
      setSettings({ ...DEFAULT_SETTINGS, ...(data.value as any) });
    }
    setIsLoading(false);
  };

  const handleSave = async () => {
    setIsSaving(true);
    const { data: existing } = await supabase
      .from('store_settings')
      .select('id')
      .eq('key', 'conversion_optimization')
      .single();

    const value = settings as unknown as Record<string, unknown>;
    let error;
    if (existing) {
      const result = await supabase.from('store_settings').update({ value: value as any }).eq('key', 'conversion_optimization');
      error = result.error;
    } else {
      const result = await supabase.from('store_settings').insert({ key: 'conversion_optimization', value: value as any });
      error = result.error;
    }

    if (error) toast({ title: 'Error', description: error.message, variant: 'destructive' });
    else {
      toast({ title: 'Saved', description: 'Conversion settings saved' });
      queryClient.invalidateQueries({ queryKey: ['conversion-settings'] });
    }
    setIsSaving(false);
  };

  // Rule management
  const [newRule, setNewRule] = useState({ source_id: '', target_id: '', type: 'cross_sell' });

  const addRule = async () => {
    if (!newRule.source_id || !newRule.target_id) {
      toast({ title: 'Error', description: 'Select both source and target products', variant: 'destructive' });
      return;
    }
    if (newRule.source_id === newRule.target_id) {
      toast({ title: 'Error', description: 'Source and target must be different', variant: 'destructive' });
      return;
    }
    const { error } = await supabase.from('cross_sell_rules').insert({
      source_product_id: newRule.source_id,
      target_product_id: newRule.target_id,
      rule_type: newRule.type,
    });
    if (error) toast({ title: 'Error', description: error.code === '23505' ? 'This rule already exists' : error.message, variant: 'destructive' });
    else {
      toast({ title: 'Rule added' });
      setNewRule({ source_id: '', target_id: '', type: 'cross_sell' });
      refetchRules();
    }
  };

  const deleteRule = async (id: string) => {
    await supabase.from('cross_sell_rules').delete().eq('id', id);
    refetchRules();
  };

  if (isLoading) {
    return (
      <AdminLayout title="Sales Boost" description="Conversion optimization module">
        <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      </AdminLayout>
    );
  }

  const getProductName = (id: string) => allProducts.find(p => p.id === id)?.name || id.slice(0, 8);

  return (
    <AdminLayout title="Sales Boost" description="Increase conversions, AOV, and reduce bounce rate">
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid w-full grid-cols-5 lg:w-auto lg:inline-grid">
          <TabsTrigger value="overview" className="gap-2"><Target className="h-4 w-4" /><span className="hidden sm:inline">Overview</span></TabsTrigger>
          <TabsTrigger value="exit_popup" className="gap-2"><Gift className="h-4 w-4" /><span className="hidden sm:inline">Exit Popup</span></TabsTrigger>
          <TabsTrigger value="upsell" className="gap-2"><TrendingUp className="h-4 w-4" /><span className="hidden sm:inline">Upsell</span></TabsTrigger>
          <TabsTrigger value="cross_sell" className="gap-2"><ShoppingBag className="h-4 w-4" /><span className="hidden sm:inline">Cross-Sell</span></TabsTrigger>
          <TabsTrigger value="cart" className="gap-2"><ShoppingCart className="h-4 w-4" /><span className="hidden sm:inline">Cart</span></TabsTrigger>
        </TabsList>

        {/* Overview */}
        <TabsContent value="overview">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            {[
              { label: 'Exit Popups Shown', key: 'exit_popup_shown', icon: Gift },
              { label: 'Exit Popup Clicks', key: 'exit_popup_clicked', icon: Zap },
              { label: 'Upsell Clicks', key: 'upsell_clicked', icon: TrendingUp },
              { label: 'Cross-Sell Clicks', key: 'cross_sell_clicked', icon: ShoppingBag },
            ].map((metric) => (
              <Card key={metric.key}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <metric.icon className="h-4 w-4 text-primary" />
                    <span className="text-xs text-muted-foreground">{metric.label}</span>
                  </div>
                  <p className="text-2xl font-bold">{analytics?.[metric.key] || 0}</p>
                  <p className="text-[10px] text-muted-foreground">Last 30 days</p>
                </CardContent>
              </Card>
            ))}
          </div>
          <Card>
            <CardHeader>
              <CardTitle>Quick Status</CardTitle>
              <CardDescription>Current feature activation status</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { name: 'Exit Popup', enabled: settings.exit_popup.enabled },
                  { name: 'Upsell', enabled: settings.upsell.enabled },
                  { name: 'Cross-Sell', enabled: settings.cross_sell.enabled },
                  { name: 'Cart Optimizer', enabled: settings.cart_optimizer.enabled },
                ].map((f) => (
                  <div key={f.name} className="flex items-center gap-2 p-3 border rounded-lg">
                    <div className={`h-2.5 w-2.5 rounded-full ${f.enabled ? 'bg-[hsl(var(--success))]' : 'bg-muted'}`} />
                    <span className="text-sm font-medium">{f.name}</span>
                    <Badge variant={f.enabled ? 'default' : 'secondary'} className="ml-auto text-[10px]">
                      {f.enabled ? 'ON' : 'OFF'}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Exit Popup */}
        <TabsContent value="exit_popup">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Gift className="h-5 w-5" /> Exit-Intent Popup</CardTitle>
              <CardDescription>Show a discount coupon when visitors are about to leave your store</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <Label className="text-base font-medium">Enable Exit Popup</Label>
                  <p className="text-sm text-muted-foreground">Detect when mouse leaves viewport and show offer</p>
                </div>
                <Switch checked={settings.exit_popup.enabled} onCheckedChange={(v) => setSettings({ ...settings, exit_popup: { ...settings.exit_popup, enabled: v } })} />
              </div>
              <Separator />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Headline</Label>
                  <Input value={settings.exit_popup.headline} onChange={(e) => setSettings({ ...settings, exit_popup: { ...settings.exit_popup, headline: e.target.value } })} />
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Input value={settings.exit_popup.description} onChange={(e) => setSettings({ ...settings, exit_popup: { ...settings.exit_popup, description: e.target.value } })} />
                </div>
                <div className="space-y-2">
                  <Label>Coupon Code</Label>
                  <Input value={settings.exit_popup.coupon_code} onChange={(e) => setSettings({ ...settings, exit_popup: { ...settings.exit_popup, coupon_code: e.target.value.toUpperCase() } })} placeholder="EXIT10" />
                  <p className="text-xs text-muted-foreground">Must match an active coupon in Offers & Coupons</p>
                </div>
                <div className="space-y-2">
                  <Label>Discount Display Text</Label>
                  <Input value={settings.exit_popup.discount_text} onChange={(e) => setSettings({ ...settings, exit_popup: { ...settings.exit_popup, discount_text: e.target.value } })} placeholder="10% OFF" />
                </div>
              </div>
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <Label className="text-base font-medium">Show Once Per Session</Label>
                  <p className="text-sm text-muted-foreground">Only show the popup once per browser session</p>
                </div>
                <Switch checked={settings.exit_popup.show_once_per_session} onCheckedChange={(v) => setSettings({ ...settings, exit_popup: { ...settings.exit_popup, show_once_per_session: v } })} />
              </div>
              <Button onClick={handleSave} disabled={isSaving}>
                {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                Save Settings
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Upsell */}
        <TabsContent value="upsell">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><TrendingUp className="h-5 w-5" /> Smart Upselling</CardTitle>
              <CardDescription>Suggest higher-value alternatives on product pages to increase AOV</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <Label className="text-base font-medium">Enable Upsell</Label>
                  <p className="text-sm text-muted-foreground">Show "Upgrade Your Choice" section on product pages</p>
                </div>
                <Switch checked={settings.upsell.enabled} onCheckedChange={(v) => setSettings({ ...settings, upsell: { ...settings.upsell, enabled: v } })} />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Min Price Difference (%)</Label>
                  <Input type="number" value={settings.upsell.price_diff_min} onChange={(e) => setSettings({ ...settings, upsell: { ...settings.upsell, price_diff_min: Number(e.target.value) } })} />
                  <p className="text-xs text-muted-foreground">Minimum price difference to show as upsell</p>
                </div>
                <div className="space-y-2">
                  <Label>Max Items to Show</Label>
                  <Input type="number" value={settings.upsell.max_items} onChange={(e) => setSettings({ ...settings, upsell: { ...settings.upsell, max_items: Number(e.target.value) } })} min={1} max={6} />
                </div>
              </div>
              <Button onClick={handleSave} disabled={isSaving}>
                {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                Save Settings
              </Button>
            </CardContent>
          </Card>

          {/* Manual Upsell Rules */}
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Manual Upsell Rules</CardTitle>
              <CardDescription>Define specific upsell product relationships</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
                <div className="space-y-1">
                  <Label className="text-xs">When viewing…</Label>
                  <Select value={newRule.source_id} onValueChange={(v) => setNewRule({ ...newRule, source_id: v, type: 'upsell' })}>
                    <SelectTrigger><SelectValue placeholder="Source product" /></SelectTrigger>
                    <SelectContent>{allProducts.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Suggest upgrade to…</Label>
                  <Select value={newRule.target_id} onValueChange={(v) => setNewRule({ ...newRule, target_id: v, type: 'upsell' })}>
                    <SelectTrigger><SelectValue placeholder="Target product" /></SelectTrigger>
                    <SelectContent>{allProducts.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <Button onClick={() => { setNewRule({ ...newRule, type: 'upsell' }); addRule(); }} className="gap-1"><Plus className="h-4 w-4" /> Add Rule</Button>
              </div>
              <Separator />
              <div className="space-y-2">
                {crossSellRules.filter(r => r.rule_type === 'upsell').map((rule) => (
                  <div key={rule.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-2 text-sm">
                      <Badge variant="outline">{getProductName(rule.source_product_id)}</Badge>
                      <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
                      <Badge variant="outline">{getProductName(rule.target_product_id)}</Badge>
                    </div>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deleteRule(rule.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                {crossSellRules.filter(r => r.rule_type === 'upsell').length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">No manual upsell rules yet. Auto-detection will be used.</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Cross-Sell */}
        <TabsContent value="cross_sell">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><ShoppingBag className="h-5 w-5" /> Cross-Selling</CardTitle>
              <CardDescription>Show complementary products that customers frequently buy together</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <Label className="text-base font-medium">Enable Cross-Sell</Label>
                  <p className="text-sm text-muted-foreground">Show "Frequently Bought Together" on product pages</p>
                </div>
                <Switch checked={settings.cross_sell.enabled} onCheckedChange={(v) => setSettings({ ...settings, cross_sell: { ...settings.cross_sell, enabled: v } })} />
              </div>
              <div className="space-y-2">
                <Label>Max Items to Show</Label>
                <Input type="number" value={settings.cross_sell.max_items} onChange={(e) => setSettings({ ...settings, cross_sell: { ...settings.cross_sell, max_items: Number(e.target.value) } })} min={1} max={8} className="max-w-xs" />
              </div>
              <Button onClick={handleSave} disabled={isSaving}>
                {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                Save Settings
              </Button>
            </CardContent>
          </Card>

          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Product Relationships</CardTitle>
              <CardDescription>Define which products are complementary to each other</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
                <div className="space-y-1">
                  <Label className="text-xs">When viewing…</Label>
                  <Select value={newRule.source_id} onValueChange={(v) => setNewRule({ ...newRule, source_id: v, type: 'cross_sell' })}>
                    <SelectTrigger><SelectValue placeholder="Source product" /></SelectTrigger>
                    <SelectContent>{allProducts.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Also suggest…</Label>
                  <Select value={newRule.target_id} onValueChange={(v) => setNewRule({ ...newRule, target_id: v, type: 'cross_sell' })}>
                    <SelectTrigger><SelectValue placeholder="Target product" /></SelectTrigger>
                    <SelectContent>{allProducts.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <Button onClick={() => { setNewRule({ ...newRule, type: 'cross_sell' }); addRule(); }} className="gap-1"><Plus className="h-4 w-4" /> Add Rule</Button>
              </div>
              <Separator />
              <div className="space-y-2">
                {crossSellRules.filter(r => r.rule_type === 'cross_sell').map((rule) => (
                  <div key={rule.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-2 text-sm">
                      <Badge variant="outline">{getProductName(rule.source_product_id)}</Badge>
                      <span className="text-muted-foreground">→</span>
                      <Badge variant="outline">{getProductName(rule.target_product_id)}</Badge>
                    </div>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deleteRule(rule.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                {crossSellRules.filter(r => r.rule_type === 'cross_sell').length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">No cross-sell rules yet. Bestsellers will be shown as fallback.</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Cart Optimizer */}
        <TabsContent value="cart">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><ShoppingCart className="h-5 w-5" /> Cart Value Optimizer</CardTitle>
              <CardDescription>Increase average order value with shipping threshold nudges and product suggestions</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <Label className="text-base font-medium">Enable Cart Optimizer</Label>
                  <p className="text-sm text-muted-foreground">Show upsell suggestions and free shipping progress in cart</p>
                </div>
                <Switch checked={settings.cart_optimizer.enabled} onCheckedChange={(v) => setSettings({ ...settings, cart_optimizer: { ...settings.cart_optimizer, enabled: v } })} />
              </div>
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <Label className="text-base font-medium">Free Shipping Progress Bar</Label>
                  <p className="text-sm text-muted-foreground">Show progress towards free shipping threshold</p>
                </div>
                <Switch checked={settings.cart_optimizer.show_free_shipping_bar} onCheckedChange={(v) => setSettings({ ...settings, cart_optimizer: { ...settings.cart_optimizer, show_free_shipping_bar: v } })} />
              </div>
              <div className="space-y-2">
                <Label>Upsell Section Headline</Label>
                <Input value={settings.cart_optimizer.upsell_headline} onChange={(e) => setSettings({ ...settings, cart_optimizer: { ...settings.cart_optimizer, upsell_headline: e.target.value } })} placeholder="Customers also bought" className="max-w-md" />
              </div>
              <Button onClick={handleSave} disabled={isSaving}>
                {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                Save Settings
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </AdminLayout>
  );
}
