import { useEffect, useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
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
import { useAdminProducts, useAdminStoreSettings, useSaveStoreSetting } from '@/hooks/useAdminQueries';
import { useQuery } from '@tanstack/react-query';

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

  // Use cached products from centralized hook
  const { data: cachedProducts = [] } = useAdminProducts();
  const allProducts = cachedProducts.map((p: any) => ({ id: p.id, name: p.name, price: p.price, slug: p.slug }));

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
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
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
    staleTime: 2 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
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
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  // Use centralized store settings
  const { data: allSettings } = useAdminStoreSettings();
  const saveSetting = useSaveStoreSetting();

  useEffect(() => {
    if (allSettings) {
      const convSetting = allSettings.find((s: any) => s.key === 'conversion_optimization');
      if (convSetting?.value) {
        setSettings({ ...DEFAULT_SETTINGS, ...(convSetting.value as any) });
      }
      setIsLoading(false);
    }
  }, [allSettings]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const value = settings as unknown as Record<string, unknown>;
      await saveSetting.mutateAsync({ key: 'conversion_optimization', value });
      toast({ title: 'Saved', description: 'Conversion settings saved' });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
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
          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            {[
              { label: 'Exit Popups Shown', key: 'exit_popup_shown', icon: Eye, color: 'text-primary' },
              { label: 'Exit Popup Clicks', key: 'exit_popup_clicked', icon: MousePointerClick, color: 'text-primary' },
              { label: 'Upsell Clicks', key: 'upsell_clicked', icon: TrendingUp, color: 'text-primary' },
              { label: 'Cross-Sell Clicks', key: 'cross_sell_clicked', icon: ShoppingBag, color: 'text-primary' },
            ].map((metric) => {
              const shownKey = metric.key.replace('_clicked', '_shown');
              const shown = analytics?.counts?.[shownKey] || 0;
              const clicked = analytics?.counts?.[metric.key] || 0;
              const ctr = shown > 0 ? ((clicked / shown) * 100).toFixed(1) : '0';
              return (
                <Card key={metric.key}>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <metric.icon className={`h-4 w-4 ${metric.color}`} />
                      <span className="text-xs text-muted-foreground">{metric.label}</span>
                    </div>
                    <p className="text-2xl font-bold">{analytics?.counts?.[metric.key] || 0}</p>
                    {metric.key.includes('clicked') && (
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        CTR: <span className="font-semibold text-foreground">{ctr}%</span> · {shown} impressions
                      </p>
                    )}
                    <p className="text-[10px] text-muted-foreground">Last 30 days</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Charts Row */}
          <div className="grid md:grid-cols-2 gap-6 mb-6">
            {/* Bar Chart - Event Distribution */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Event Distribution</CardTitle>
                <CardDescription className="text-xs">Impressions vs clicks across channels</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[220px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={[
                      { name: 'Exit Popup', shown: analytics?.counts?.exit_popup_shown || 0, clicked: analytics?.counts?.exit_popup_clicked || 0 },
                      { name: 'Upsell', shown: analytics?.counts?.upsell_shown || 0, clicked: analytics?.counts?.upsell_clicked || 0 },
                      { name: 'Cross-Sell', shown: analytics?.counts?.cross_sell_shown || 0, clicked: analytics?.counts?.cross_sell_clicked || 0 },
                    ]}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                      <YAxis tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                      <Tooltip />
                      <Bar dataKey="shown" fill="#94A3B8" name="Impressions" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="clicked" fill="#3B82F6" name="Clicks" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Pie Chart - Click Share */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Click Share by Channel</CardTitle>
                <CardDescription className="text-xs">Where conversions come from</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[220px]">
                  {(() => {
                    const pieData = [
                      { name: 'Exit Popup', value: analytics?.counts?.exit_popup_clicked || 0 },
                      { name: 'Upsell', value: analytics?.counts?.upsell_clicked || 0 },
                      { name: 'Cross-Sell', value: analytics?.counts?.cross_sell_clicked || 0 },
                    ].filter(d => d.value > 0);
                    const COLORS = ['#3B82F6', '#10B981', '#F59E0B'];
                    if (pieData.length === 0) return <p className="text-sm text-muted-foreground text-center pt-16">No click data yet</p>;
                    return (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={pieData} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                            {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    );
                  })()}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Top Clicked Products */}
          {topProducts.length > 0 && (
            <Card className="mb-6">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2"><Zap className="h-4 w-4 text-primary" /> Top Converting Products</CardTitle>
                <CardDescription className="text-xs">Most clicked products via upsell & cross-sell</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="divide-y divide-border">
                  {topProducts.map((p) => {
                    const img = p.images?.find((i: any) => i.is_primary)?.image_url || p.images?.[0]?.image_url;
                    const clicks = analytics?.productClicks?.[p.id] || 0;
                    return (
                      <div key={p.id} className="flex items-center gap-3 py-2.5">
                        <div className="w-10 h-10 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                          {img ? <img src={img} alt={p.name} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-xs">📦</div>}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{p.name}</p>
                          <p className="text-xs text-muted-foreground">₹{Number(p.price).toFixed(0)}</p>
                        </div>
                        <Badge variant="secondary" className="text-xs">{clicks} clicks</Badge>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Feature Status */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Feature Status</CardTitle>
              <CardDescription className="text-xs">Current activation status of all conversion tools</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { name: 'Exit Popup', enabled: settings.exit_popup.enabled, icon: Gift },
                  { name: 'Upsell', enabled: settings.upsell.enabled, icon: TrendingUp },
                  { name: 'Cross-Sell', enabled: settings.cross_sell.enabled, icon: ShoppingBag },
                  { name: 'Cart Optimizer', enabled: settings.cart_optimizer.enabled, icon: ShoppingCart },
                ].map((f) => (
                  <div key={f.name} className="flex items-center gap-2.5 p-3 border rounded-lg">
                    <f.icon className={`h-4 w-4 ${f.enabled ? 'text-primary' : 'text-muted-foreground'}`} />
                    <div className="flex-1">
                      <span className="text-sm font-medium">{f.name}</span>
                    </div>
                    <Badge variant={f.enabled ? 'default' : 'secondary'} className="text-[10px]">
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
                  <p className="text-sm text-muted-foreground text-center py-4">No manual upsell rules yet. Use auto-generate or auto-detection will be used.</p>
                )}
              </div>

              {/* Auto-Generate Upsell Rules */}
              <Separator />
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Auto-Generate Upsell Rules</Label>
                <p className="text-xs text-muted-foreground">
                  Automatically find higher-priced alternatives in the same category using weighted matching (price proximity, bestseller status, rating).
                </p>
                <Button
                  variant="outline"
                  onClick={async () => {
                    if (!allProducts.length) { toast({ title: 'No products', variant: 'destructive' }); return; }
                    setIsSaving(true);
                    try {
                      // Delete existing auto rules
                      await supabase.from('cross_sell_rules').delete().eq('rule_type', 'upsell');

                      // Fetch full product data for scoring
                      const { data: fullProducts } = await supabase
                        .from('products')
                        .select('id, name, price, category_id, is_bestseller, is_featured, is_active')
                        .eq('is_active', true);
                      const products = fullProducts || [];

                      const rules: { source_product_id: string; target_product_id: string; rule_type: string; sort_order: number }[] = [];

                      for (const source of products) {
                        if (!source.category_id) continue;
                        const candidates = products
                          .filter(p => p.id !== source.id && p.category_id === source.category_id && Number(p.price) > Number(source.price) * 1.1)
                          .map(p => {
                            let weight = 0;
                            const priceDiff = (Number(p.price) - Number(source.price)) / Number(source.price);
                            // Sweet spot: 15-50% higher
                            if (priceDiff >= 0.15 && priceDiff <= 0.5) weight += 3;
                            else if (priceDiff > 0.5 && priceDiff <= 1.0) weight += 1;
                            if (p.is_bestseller) weight += 2;
                            if (p.is_featured) weight += 1;
                            // Name similarity bonus
                            const srcWords = source.name.toLowerCase().split(/\s+/);
                            const tgtWords = p.name.toLowerCase().split(/\s+/);
                            const shared = srcWords.filter(w => w.length > 2 && tgtWords.includes(w)).length;
                            weight += Math.min(shared, 2);
                            return { ...p, weight };
                          })
                          .sort((a, b) => b.weight - a.weight)
                          .slice(0, 3);

                        candidates.forEach((target, i) => {
                          if (target.weight >= 2) {
                            rules.push({ source_product_id: source.id, target_product_id: target.id, rule_type: 'upsell', sort_order: i });
                          }
                        });
                      }

                      if (rules.length > 0) {
                        // Batch insert in chunks of 100
                        for (let i = 0; i < rules.length; i += 100) {
                          await supabase.from('cross_sell_rules').insert(rules.slice(i, i + 100));
                        }
                      }
                      toast({ title: 'Auto-generated', description: `Created ${rules.length} upsell rules` });
                      refetchRules();
                    } catch (err: any) {
                      toast({ title: 'Error', description: err.message, variant: 'destructive' });
                    }
                    setIsSaving(false);
                  }}
                  disabled={isSaving}
                  className="gap-2"
                >
                  <Zap className="h-4 w-4" /> Auto-Generate Upsell Rules
                </Button>
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
                  <p className="text-sm text-muted-foreground text-center py-4">No cross-sell rules yet. Use auto-generate or bestsellers will be shown as fallback.</p>
                )}
              </div>

              {/* Auto-Generate Cross-Sell Rules */}
              <Separator />
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Auto-Generate Cross-Sell Rules</Label>
                <p className="text-xs text-muted-foreground">
                  Automatically pair products from different categories using weighted matching (price compatibility, bestseller/featured status, complementary categories).
                </p>
                <Button
                  variant="outline"
                  onClick={async () => {
                    if (!allProducts.length) { toast({ title: 'No products', variant: 'destructive' }); return; }
                    setIsSaving(true);
                    try {
                      await supabase.from('cross_sell_rules').delete().eq('rule_type', 'cross_sell');

                      const { data: fullProducts } = await supabase
                        .from('products')
                        .select('id, name, price, category_id, is_bestseller, is_featured, is_active')
                        .eq('is_active', true);
                      const products = fullProducts || [];

                      const rules: { source_product_id: string; target_product_id: string; rule_type: string; sort_order: number }[] = [];

                      for (const source of products) {
                        const candidates = products
                          .filter(p => p.id !== source.id && p.category_id !== source.category_id)
                          .map(p => {
                            let weight = 0;
                            // Price compatibility: similar price range gets bonus
                            const priceRatio = Number(p.price) / Number(source.price);
                            if (priceRatio >= 0.3 && priceRatio <= 3.0) weight += 2;
                            if (priceRatio >= 0.5 && priceRatio <= 2.0) weight += 1;
                            if (p.is_bestseller) weight += 3;
                            if (p.is_featured) weight += 1;
                            // Different category bonus (complementary)
                            if (p.category_id && p.category_id !== source.category_id) weight += 1;
                            return { ...p, weight };
                          })
                          .sort((a, b) => b.weight - a.weight)
                          .slice(0, 4);

                        candidates.forEach((target, i) => {
                          if (target.weight >= 3) {
                            rules.push({ source_product_id: source.id, target_product_id: target.id, rule_type: 'cross_sell', sort_order: i });
                          }
                        });
                      }

                      if (rules.length > 0) {
                        for (let i = 0; i < rules.length; i += 100) {
                          await supabase.from('cross_sell_rules').insert(rules.slice(i, i + 100));
                        }
                      }
                      toast({ title: 'Auto-generated', description: `Created ${rules.length} cross-sell rules` });
                      refetchRules();
                    } catch (err: any) {
                      toast({ title: 'Error', description: err.message, variant: 'destructive' });
                    }
                    setIsSaving(false);
                  }}
                  disabled={isSaving}
                  className="gap-2"
                >
                  <Zap className="h-4 w-4" /> Auto-Generate Cross-Sell Rules
                </Button>
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
