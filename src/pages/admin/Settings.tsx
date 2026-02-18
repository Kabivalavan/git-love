import { useEffect, useState, useCallback } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { ImageUpload } from '@/components/ui/image-upload';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Save, Store, Palette, Truck, Link as LinkIcon, Bell, CreditCard, Megaphone, Loader2, CheckCircle2, XCircle, ExternalLink, Shield, Unplug } from 'lucide-react';
import type { StoreInfo, ThemeSettings, CheckoutSettings, SocialLinks } from '@/types/database';
import { useStorefrontTheme, THEME_OPTIONS, type StorefrontTheme } from '@/hooks/useTheme';
import { cn } from '@/lib/utils';

interface RazorpayConnectionStatus {
  connected: boolean;
  is_test_mode: boolean;
  key_id_preview: string | null;
  connected_at: string | null;
}

interface RazorpayFormData {
  key_id: string;
  key_secret: string;
}

interface AnnouncementSettings {
  text: string;
  is_active: boolean;
  link: string;
}

export default function AdminSettings() {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState<string | null>(null);
  const [storeInfo, setStoreInfo] = useState<StoreInfo>({
    name: '',
    tagline: '',
    logo_url: null,
    favicon_url: null,
    contact_email: null,
    contact_phone: null,
    address: null,
  });
  const [theme, setTheme] = useState<ThemeSettings>({
    primary_color: '#3B82F6',
    secondary_color: '#10B981',
    font_family: 'Inter',
    border_radius: '8px',
  });
  const [checkout, setCheckout] = useState<CheckoutSettings>({
    cod_enabled: true,
    min_order_value: 0,
    free_shipping_threshold: 500,
    default_shipping_charge: 50,
  });
  const [social, setSocial] = useState<SocialLinks>({
    facebook: null,
    instagram: null,
    twitter: null,
    youtube: null,
  });
  const [razorpayStatus, setRazorpayStatus] = useState<RazorpayConnectionStatus>({
    connected: false,
    is_test_mode: false,
    key_id_preview: null,
    connected_at: null,
  });
  const [razorpayForm, setRazorpayForm] = useState<RazorpayFormData>({
    key_id: '',
    key_secret: '',
  });
  const [isConnecting, setIsConnecting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [announcement, setAnnouncement] = useState<AnnouncementSettings>({
    text: 'Free shipping on orders above ₹500 | Use code WELCOME10 for 10% off',
    is_active: true,
    link: '',
  });
  const { toast } = useToast();

  const { theme: storefrontTheme, setTheme: setStorefrontTheme } = useStorefrontTheme();

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('store_settings')
      .select('key, value');

    if (data) {
      data.forEach((item) => {
        const value = item.value as Record<string, unknown>;
        switch (item.key) {
          case 'store_info':
            setStoreInfo(value as unknown as StoreInfo);
            break;
          case 'theme':
            setTheme(value as unknown as ThemeSettings);
            break;
          case 'checkout':
            setCheckout(value as unknown as CheckoutSettings);
            break;
          case 'social_links':
            setSocial(value as unknown as SocialLinks);
            break;
          case 'razorpay':
            const rpVal = value as any;
            setRazorpayStatus({
              connected: rpVal.is_connected || false,
              is_test_mode: rpVal.is_test_mode || false,
              key_id_preview: rpVal.key_id_preview || null,
              connected_at: rpVal.connected_at || null,
            });
            break;
          case 'announcement':
            setAnnouncement(value as unknown as AnnouncementSettings);
            break;
        }
      });
    }
    setIsLoading(false);
  };

  const handleSave = async (key: string, value: Record<string, unknown>) => {
    setIsSaving(key);
    
    // Check if setting exists
    const { data: existing } = await supabase
      .from('store_settings')
      .select('id')
      .eq('key', key)
      .single();

    let error;
    if (existing) {
      const result = await supabase
        .from('store_settings')
        .update({ value: value as any })
        .eq('key', key);
      error = result.error;
    } else {
      const result = await supabase
        .from('store_settings')
        .insert({ key, value: value as any });
      error = result.error;
    }

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Saved', description: 'Settings saved successfully' });
    }
    setIsSaving(null);
  };

  const handleRazorpayConnect = useCallback(async () => {
    if (!razorpayForm.key_id || !razorpayForm.key_secret) {
      toast({ title: 'Error', description: 'Please enter both API Key ID and Secret', variant: 'destructive' });
      return;
    }
    setIsConnecting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await fetch(
        `https://riqjidlyjyhfpgnjtbqi.supabase.co/functions/v1/razorpay-settings?action=connect`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            key_id: razorpayForm.key_id,
            key_secret: razorpayForm.key_secret,
          }),
        }
      );

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Failed to connect');

      setRazorpayStatus({
        connected: true,
        is_test_mode: result.is_test_mode,
        key_id_preview: `${razorpayForm.key_id.substring(0, 8)}...${razorpayForm.key_id.substring(razorpayForm.key_id.length - 4)}`,
        connected_at: new Date().toISOString(),
      });
      setRazorpayForm({ key_id: '', key_secret: '' });
      toast({ title: 'Connected!', description: 'Razorpay payment gateway connected successfully.' });
    } catch (error: any) {
      toast({ title: 'Connection Failed', description: error.message, variant: 'destructive' });
    } finally {
      setIsConnecting(false);
    }
  }, [razorpayForm, toast]);

  const handleRazorpayDisconnect = useCallback(async () => {
    setIsDisconnecting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await fetch(
        `https://riqjidlyjyhfpgnjtbqi.supabase.co/functions/v1/razorpay-settings?action=disconnect`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
        }
      );

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Failed to disconnect');

      setRazorpayStatus({ connected: false, is_test_mode: false, key_id_preview: null, connected_at: null });
      toast({ title: 'Disconnected', description: 'Razorpay has been disconnected.' });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setIsDisconnecting(false);
    }
  }, [toast]);

  if (isLoading) {
    return (
      <AdminLayout title="Settings" description="Configure your store settings">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Settings" description="Configure your store settings">
      <Tabs defaultValue="store" className="space-y-6">
        <TabsList className="grid w-full grid-cols-7 lg:w-auto lg:inline-grid">
          <TabsTrigger value="store" className="gap-2">
            <Store className="h-4 w-4" />
            <span className="hidden sm:inline">Store</span>
          </TabsTrigger>
          <TabsTrigger value="announcement" className="gap-2">
            <Megaphone className="h-4 w-4" />
            <span className="hidden sm:inline">Banner</span>
          </TabsTrigger>
          <TabsTrigger value="theme" className="gap-2">
            <Palette className="h-4 w-4" />
            <span className="hidden sm:inline">Theme</span>
          </TabsTrigger>
          <TabsTrigger value="checkout" className="gap-2">
            <Truck className="h-4 w-4" />
            <span className="hidden sm:inline">Checkout</span>
          </TabsTrigger>
          <TabsTrigger value="payment" className="gap-2">
            <CreditCard className="h-4 w-4" />
            <span className="hidden sm:inline">Payment</span>
          </TabsTrigger>
          <TabsTrigger value="social" className="gap-2">
            <LinkIcon className="h-4 w-4" />
            <span className="hidden sm:inline">Social</span>
          </TabsTrigger>
          <TabsTrigger value="notifications" className="gap-2">
            <Bell className="h-4 w-4" />
            <span className="hidden sm:inline">Alerts</span>
          </TabsTrigger>
        </TabsList>

        {/* Store Info */}
        <TabsContent value="store">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Store className="h-5 w-5" />
                Store Information
              </CardTitle>
              <CardDescription>Basic information about your store</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label>Store Logo</Label>
                  <ImageUpload
                    bucket="store"
                    value={storeInfo.logo_url || undefined}
                    onChange={(url) => setStoreInfo({ ...storeInfo, logo_url: url })}
                    aspectRatio="video"
                    placeholder="Upload store logo"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Favicon</Label>
                  <ImageUpload
                    bucket="store"
                    value={storeInfo.favicon_url || undefined}
                    onChange={(url) => setStoreInfo({ ...storeInfo, favicon_url: url })}
                    aspectRatio="square"
                    placeholder="Upload favicon (32x32)"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="store_name">Store Name</Label>
                  <Input
                    id="store_name"
                    value={storeInfo.name}
                    onChange={(e) => setStoreInfo({ ...storeInfo, name: e.target.value })}
                    placeholder="My Awesome Store"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tagline">Tagline</Label>
                  <Input
                    id="tagline"
                    value={storeInfo.tagline}
                    onChange={(e) => setStoreInfo({ ...storeInfo, tagline: e.target.value })}
                    placeholder="Your one-stop shop"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="contact_email">Contact Email</Label>
                  <Input
                    id="contact_email"
                    type="email"
                    value={storeInfo.contact_email || ''}
                    onChange={(e) => setStoreInfo({ ...storeInfo, contact_email: e.target.value || null })}
                    placeholder="support@store.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contact_phone">Contact Phone</Label>
                  <Input
                    id="contact_phone"
                    value={storeInfo.contact_phone || ''}
                    onChange={(e) => setStoreInfo({ ...storeInfo, contact_phone: e.target.value || null })}
                    placeholder="+91 9876543210"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="address">Store Address</Label>
                <Textarea
                  id="address"
                  value={storeInfo.address || ''}
                  onChange={(e) => setStoreInfo({ ...storeInfo, address: e.target.value || null })}
                  placeholder="123 Main Street, City, State - 123456"
                  rows={3}
                />
              </div>

              <Button 
                onClick={() => handleSave('store_info', storeInfo as unknown as Record<string, unknown>)} 
                disabled={isSaving === 'store_info'}
              >
                {isSaving === 'store_info' ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                Save Store Info
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Announcement Banner */}
        <TabsContent value="announcement">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Megaphone className="h-5 w-5" />
                Announcement Banner
              </CardTitle>
              <CardDescription>Customize the top banner text on your storefront</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <Label className="text-base font-medium">Show Announcement Banner</Label>
                  <p className="text-sm text-muted-foreground">Display the top banner on your store</p>
                </div>
                <Switch
                  checked={announcement.is_active}
                  onCheckedChange={(checked) => setAnnouncement({ ...announcement, is_active: checked })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="announcement_text">Banner Text</Label>
                <Textarea
                  id="announcement_text"
                  value={announcement.text}
                  onChange={(e) => setAnnouncement({ ...announcement, text: e.target.value })}
                  placeholder="Free shipping on orders above ₹500"
                  rows={2}
                />
                <p className="text-xs text-muted-foreground">
                  This text will appear in the blue bar at the top of your store
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="announcement_link">Link URL (Optional)</Label>
                <Input
                  id="announcement_link"
                  value={announcement.link}
                  onChange={(e) => setAnnouncement({ ...announcement, link: e.target.value })}
                  placeholder="/products?offer=true"
                />
                <p className="text-xs text-muted-foreground">
                  Add a link to make the banner clickable
                </p>
              </div>

              {/* Preview */}
              <div className="space-y-2">
                <Label>Preview</Label>
                <div className="bg-primary text-primary-foreground rounded-lg p-3 text-center text-sm">
                  {announcement.text || 'Your announcement text will appear here'}
                </div>
              </div>

              <Button 
                onClick={() => handleSave('announcement', announcement as unknown as Record<string, unknown>)} 
                disabled={isSaving === 'announcement'}
              >
                {isSaving === 'announcement' ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                Save Announcement
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Theme */}
        <TabsContent value="theme">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Palette className="h-5 w-5" />
                Storefront Theme
              </CardTitle>
              <CardDescription>Choose a complete visual theme for your store</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
               {THEME_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setStorefrontTheme(opt.value)}
                    className={cn(
                      "p-4 rounded-lg border-2 text-left transition-all hover:shadow-md",
                      storefrontTheme === opt.value
                        ? "border-primary bg-accent"
                        : "border-border hover:border-primary/50"
                    )}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold text-sm">{opt.label}</span>
                      {storefrontTheme === opt.value && (
                        <CheckCircle2 className="h-4 w-4 text-primary" />
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">{opt.description}</p>
                    <div className="flex gap-1 mt-3">
                      {opt.colors.map((c, i) => (
                        <div key={i} className="w-6 h-6 rounded-full border border-border" style={{ backgroundColor: c }} />
                      ))}
                    </div>
                  </button>
                ))}
              </div>

              <Separator />

              {/* Legacy color customization */}
              <div>
                <p className="text-sm font-medium mb-3">Custom Color Overrides</p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="primary_color">Primary Color</Label>
                    <div className="flex gap-2">
                      <Input id="primary_color" type="color" value={theme.primary_color} onChange={(e) => setTheme({ ...theme, primary_color: e.target.value })} className="w-16 h-10 p-1" />
                      <Input value={theme.primary_color} onChange={(e) => setTheme({ ...theme, primary_color: e.target.value })} className="flex-1" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="secondary_color">Secondary Color</Label>
                    <div className="flex gap-2">
                      <Input id="secondary_color" type="color" value={theme.secondary_color} onChange={(e) => setTheme({ ...theme, secondary_color: e.target.value })} className="w-16 h-10 p-1" />
                      <Input value={theme.secondary_color} onChange={(e) => setTheme({ ...theme, secondary_color: e.target.value })} className="flex-1" />
                    </div>
                  </div>
                </div>
              </div>

              <Button 
                onClick={() => handleSave('theme', theme as unknown as Record<string, unknown>)} 
                disabled={isSaving === 'theme'}
              >
                {isSaving === 'theme' ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                Save Theme
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Checkout */}
        <TabsContent value="checkout">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Truck className="h-5 w-5" />
                Checkout & Shipping
              </CardTitle>
              <CardDescription>Configure checkout and delivery options</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <Label className="text-base font-medium">Cash on Delivery</Label>
                  <p className="text-sm text-muted-foreground">Allow customers to pay when they receive their order</p>
                </div>
                <Switch
                  checked={checkout.cod_enabled}
                  onCheckedChange={(checked) => setCheckout({ ...checkout, cod_enabled: checked })}
                />
              </div>

              <Separator />

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="min_order_value">Minimum Order Value (₹)</Label>
                  <Input
                    id="min_order_value"
                    type="number"
                    value={checkout.min_order_value}
                    onChange={(e) => setCheckout({ ...checkout, min_order_value: parseInt(e.target.value) || 0 })}
                    placeholder="0"
                  />
                  <p className="text-xs text-muted-foreground">Set to 0 for no minimum</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="default_shipping">Default Shipping Charge (₹)</Label>
                  <Input
                    id="default_shipping"
                    type="number"
                    value={checkout.default_shipping_charge}
                    onChange={(e) => setCheckout({ ...checkout, default_shipping_charge: parseInt(e.target.value) || 0 })}
                    placeholder="50"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="free_shipping_threshold">Free Shipping Threshold (₹)</Label>
                <Input
                  id="free_shipping_threshold"
                  type="number"
                  value={checkout.free_shipping_threshold}
                  onChange={(e) => setCheckout({ ...checkout, free_shipping_threshold: parseInt(e.target.value) || 0 })}
                  placeholder="500"
                />
                <p className="text-xs text-muted-foreground">Orders above this amount get free shipping. Set to 0 to disable.</p>
              </div>

              <Button 
                onClick={() => handleSave('checkout', checkout as unknown as Record<string, unknown>)} 
                disabled={isSaving === 'checkout'}
              >
                {isSaving === 'checkout' ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                Save Checkout Settings
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Payment / Razorpay */}
        <TabsContent value="payment">
          <div className="space-y-6">
            {/* Connection Status Card */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <CreditCard className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">Razorpay Payment Gateway</CardTitle>
                      <CardDescription>Accept online payments via Razorpay</CardDescription>
                    </div>
                  </div>
                  {razorpayStatus.connected ? (
                    <Badge variant="default" className="gap-1.5">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Connected
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="gap-1.5">
                      <XCircle className="h-3.5 w-3.5" />
                      Not Connected
                    </Badge>
                  )}
                </div>
              </CardHeader>

              {razorpayStatus.connected && (
                <CardContent>
                  <div className="p-4 border rounded-lg bg-muted/30 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">API Key</p>
                        <p className="text-sm text-muted-foreground font-mono">{razorpayStatus.key_id_preview}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium">Mode</p>
                        <Badge variant={razorpayStatus.is_test_mode ? "outline" : "default"} className="mt-0.5">
                          {razorpayStatus.is_test_mode ? '🧪 Test Mode' : '🟢 Live Mode'}
                        </Badge>
                      </div>
                    </div>
                    {razorpayStatus.connected_at && (
                      <p className="text-xs text-muted-foreground">
                        Connected on {new Date(razorpayStatus.connected_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
                      </p>
                    )}
                    <Separator />
                    <Button 
                      variant="destructive" 
                      size="sm"
                      onClick={handleRazorpayDisconnect}
                      disabled={isDisconnecting}
                      className="gap-2"
                    >
                      {isDisconnecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Unplug className="h-4 w-4" />}
                      Disconnect Razorpay
                    </Button>
                  </div>
                </CardContent>
              )}
            </Card>

            {/* Connect Form - shown only when not connected */}
            {!razorpayStatus.connected && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Shield className="h-5 w-5" />
                    Connect Your Razorpay Account
                  </CardTitle>
                  <CardDescription>
                    Enter your Razorpay API credentials to start accepting payments. Your keys are securely stored and encrypted.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="razorpay_key_id">API Key ID</Label>
                    <Input
                      id="razorpay_key_id"
                      value={razorpayForm.key_id}
                      onChange={(e) => setRazorpayForm({ ...razorpayForm, key_id: e.target.value })}
                      placeholder="rzp_test_xxxxx or rzp_live_xxxxx"
                    />
                    <p className="text-xs text-muted-foreground">
                      Found in Razorpay Dashboard → Settings → API Keys
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="razorpay_key_secret">API Key Secret</Label>
                    <Input
                      id="razorpay_key_secret"
                      type="password"
                      value={razorpayForm.key_secret}
                      onChange={(e) => setRazorpayForm({ ...razorpayForm, key_secret: e.target.value })}
                      placeholder="Enter your secret key"
                    />
                    <p className="text-xs text-muted-foreground">
                      Your secret key is never displayed after saving.
                    </p>
                  </div>

                  <Button
                    onClick={handleRazorpayConnect}
                    disabled={isConnecting || !razorpayForm.key_id || !razorpayForm.key_secret}
                    className="w-full gap-2"
                    size="lg"
                  >
                    {isConnecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                    {isConnecting ? 'Validating & Connecting...' : 'Connect Razorpay'}
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Setup Guide */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">How to Get Your API Keys</CardTitle>
                <CardDescription>Follow these steps to generate your Razorpay API credentials</CardDescription>
              </CardHeader>
              <CardContent>
                <ol className="space-y-4 text-sm">
                  <li className="flex gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">1</span>
                    <div>
                      <p className="font-medium">Log in to your Razorpay Dashboard</p>
                      <p className="text-muted-foreground">Go to <a href="https://dashboard.razorpay.com" target="_blank" rel="noopener noreferrer" className="text-primary underline inline-flex items-center gap-1">dashboard.razorpay.com <ExternalLink className="h-3 w-3" /></a></p>
                    </div>
                  </li>
                  <li className="flex gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">2</span>
                    <div>
                      <p className="font-medium">Navigate to Settings → API Keys</p>
                      <p className="text-muted-foreground">Or go directly to <a href="https://dashboard.razorpay.com/app/keys" target="_blank" rel="noopener noreferrer" className="text-primary underline inline-flex items-center gap-1">dashboard.razorpay.com/app/keys <ExternalLink className="h-3 w-3" /></a></p>
                    </div>
                  </li>
                  <li className="flex gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">3</span>
                    <div>
                      <p className="font-medium">Generate a new API Key</p>
                      <p className="text-muted-foreground">Copy both the Key ID (starts with rzp_) and the Key Secret</p>
                    </div>
                  </li>
                  <li className="flex gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">4</span>
                    <div>
                      <p className="font-medium">Paste credentials above and click Connect</p>
                      <p className="text-muted-foreground">We'll validate your keys with Razorpay before saving. Use test keys (rzp_test_) for development.</p>
                    </div>
                  </li>
                </ol>
              </CardContent>
            </Card>

            {/* Webhook Configuration */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Webhook Configuration (Optional)</CardTitle>
                <CardDescription>Set up webhooks for real-time payment notifications</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 border rounded-lg bg-muted/30">
                  <p className="text-sm font-medium mb-1">Your Webhook URL</p>
                  <code className="text-sm bg-background px-3 py-2 rounded-md block overflow-x-auto border">
                    https://riqjidlyjyhfpgnjtbqi.supabase.co/functions/v1/razorpay-verify-payment
                  </code>
                </div>
                <div className="text-sm text-muted-foreground space-y-1">
                  <p>Add this URL in your Razorpay Dashboard → Settings → Webhooks.</p>
                  <p>Enable events: <code className="bg-muted px-1 rounded">payment.captured</code>, <code className="bg-muted px-1 rounded">payment.failed</code>, <code className="bg-muted px-1 rounded">refund.created</code></p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Social */}
        <TabsContent value="social">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <LinkIcon className="h-5 w-5" />
                Social Media Links
              </CardTitle>
              <CardDescription>Connect your social media profiles</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="facebook">Facebook</Label>
                <Input
                  id="facebook"
                  value={social.facebook || ''}
                  onChange={(e) => setSocial({ ...social, facebook: e.target.value || null })}
                  placeholder="https://facebook.com/yourpage"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="instagram">Instagram</Label>
                <Input
                  id="instagram"
                  value={social.instagram || ''}
                  onChange={(e) => setSocial({ ...social, instagram: e.target.value || null })}
                  placeholder="https://instagram.com/yourhandle"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="twitter">Twitter</Label>
                <Input
                  id="twitter"
                  value={social.twitter || ''}
                  onChange={(e) => setSocial({ ...social, twitter: e.target.value || null })}
                  placeholder="https://twitter.com/yourhandle"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="youtube">YouTube</Label>
                <Input
                  id="youtube"
                  value={social.youtube || ''}
                  onChange={(e) => setSocial({ ...social, youtube: e.target.value || null })}
                  placeholder="https://youtube.com/yourchannel"
                />
              </div>

              <Button 
                onClick={() => handleSave('social_links', social as unknown as Record<string, unknown>)} 
                disabled={isSaving === 'social_links'}
              >
                {isSaving === 'social_links' ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                Save Social Links
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notifications */}
        <TabsContent value="notifications">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                Notification Settings
              </CardTitle>
              <CardDescription>Configure order and system notifications</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <Label className="text-base font-medium">New Order Alerts</Label>
                  <p className="text-sm text-muted-foreground">Get notified when a new order is placed</p>
                </div>
                <Switch defaultChecked />
              </div>
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <Label className="text-base font-medium">Low Stock Alerts</Label>
                  <p className="text-sm text-muted-foreground">Get notified when product stock is low</p>
                </div>
                <Switch defaultChecked />
              </div>
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <Label className="text-base font-medium">Customer Reviews</Label>
                  <p className="text-sm text-muted-foreground">Get notified when customers leave reviews</p>
                </div>
                <Switch />
              </div>
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <Label className="text-base font-medium">Payment Alerts</Label>
                  <p className="text-sm text-muted-foreground">Get notified for payment updates</p>
                </div>
                <Switch defaultChecked />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </AdminLayout>
  );
}
