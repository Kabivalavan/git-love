import { useEffect, useState } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { MessageSquare, Send, Save, Loader2, Edit, Eye, ShoppingCart, Truck, Star, UserPlus, Package, Clock, Sparkles, Mail } from 'lucide-react';
import { BulkWhatsApp } from '@/components/admin/BulkWhatsApp';
import { BulkEmail } from '@/components/admin/BulkEmail';
import { useAdminStoreSettings, useSaveStoreSetting } from '@/hooks/useAdminQueries';
import { BulkWhatsApp } from '@/components/admin/BulkWhatsApp';
import { BulkEmail } from '@/components/admin/BulkEmail';

interface WhatsAppTemplate {
  id: string;
  name: string;
  trigger: string;
  message: string;
  is_active: boolean;
  description: string;
}

const DEFAULT_TEMPLATES: WhatsAppTemplate[] = [
  { id: 'welcome', name: 'Welcome Message', trigger: 'user_signup', description: 'Sent when a new customer signs up', is_active: true, message: `Hi {{customer_name}} \u{1F44B}\n\nWelcome to {{store_name}}! We're thrilled to have you.\n\n\u{1F381} Use code *{{coupon_code}}* to get *{{discount}}% OFF* your first order!\n\n\u{1F6D2} Shop now: {{shop_url}}\n\nHappy shopping! \u{2728}` },
  { id: 'cart_abandonment', name: 'Cart Abandonment', trigger: 'cart_abandonment', description: 'Sent when a customer leaves items in cart', is_active: true, message: `Hi {{customer_name}} \u{1F44B}\n\nYou left some amazing items in your cart! \u{1F6D2}\n\n\u{1F4E6} Items: {{cart_items}}\n\u{1F4B0} Total: \u20B9{{cart_total}}\n\nComplete your order before they sell out! \u{23F0}\n\n\u{1F449} {{checkout_url}}\n\n\u2013 {{store_name}}` },
  { id: 'order_confirmation', name: 'Order Confirmation', trigger: 'order_created', description: 'Sent when an order is placed', is_active: true, message: `Hi {{customer_name}} \u{1F44B}\n\nYour order *#{{order_number}}* has been confirmed! \u2705\n\n\u{1F6CD}\uFE0F Items: {{order_items}}\n\u{1F4B0} Total: \u20B9{{order_total}}\n\u{1F4CD} Delivery: {{delivery_address}}\n\nWe'll notify you once it's shipped \u{1F69A}\n\n\u2013 {{store_name}}` },
  { id: 'order_shipped', name: 'Order Shipped', trigger: 'order_shipped', description: 'Sent when an order is shipped', is_active: true, message: `Hi {{customer_name}} \u{1F389}\n\nYour order *#{{order_number}}* is on its way! \u{1F69A}\n\n\u{1F4E6} Courier: {{courier_name}}\n\u{1F522} Tracking: {{tracking_number}}\n\u{1F4C5} ETA: {{estimated_delivery}}\n\n\u{1F517} Track: {{tracking_url}}\n\n\u2013 {{store_name}}` },
  { id: 'out_for_delivery', name: 'Out for Delivery', trigger: 'out_for_delivery', description: 'Sent when order is out for delivery', is_active: true, message: `Hi {{customer_name}} \u{1F4E6}\n\nYour order *#{{order_number}}* is out for delivery today! \u{1F3C3}\n\n{{cod_message}}\n\nPlease keep your phone accessible \u{1F4F1}\n\n\u2013 {{store_name}}` },
  { id: 'order_delivered', name: 'Order Delivered', trigger: 'order_delivered', description: 'Sent when order is delivered', is_active: true, message: `Hi {{customer_name}} \u{1F44B}\n\nYour order *#{{order_number}}* has been delivered! \u2705\n\nWe hope you love your purchase \u{1F496}\n\n\u2B50 Share your experience: {{review_url}}\n\n\u{1F381} Use code *{{next_order_coupon}}* on your next order!\n\n\u2013 {{store_name}}` },
  { id: 'review_request', name: 'Review Request', trigger: 'review_request', description: 'Sent after delivery to request a review', is_active: true, message: `Hi {{customer_name}} \u{1F44B}\n\nHow's your *{{product_name}}*? \u2B50\n\nWe'd love your honest feedback!\n\n\u{1F449} {{review_url}}\n\n\u{1F381} Leave a review & get *{{discount}}% OFF* with code *{{coupon_code}}*\n\n\u2013 {{store_name}}` },
  { id: 'payment_reminder', name: 'Payment Reminder', trigger: 'payment_pending', description: 'Sent when payment is pending', is_active: true, message: `Hi {{customer_name}} \u{1F44B}\n\nYour payment of \u20B9{{amount}} for order *#{{order_number}}* is still pending \u23F3\n\nPlease complete your payment to confirm the order.\n\nNeed help? Just reply here \u{1F60A}\n\n\u2013 {{store_name}}` },
];

const TRIGGER_ICONS: Record<string, any> = {
  user_signup: UserPlus, cart_abandonment: ShoppingCart, order_created: Package,
  order_shipped: Truck, out_for_delivery: Clock, order_delivered: Star,
  review_request: Star, payment_pending: Clock,
};

const VARIABLE_DESCRIPTIONS: Record<string, string[]> = {
  welcome: ['customer_name', 'store_name', 'coupon_code', 'discount', 'shop_url'],
  cart_abandonment: ['customer_name', 'store_name', 'cart_items', 'cart_total', 'checkout_url'],
  order_confirmation: ['customer_name', 'store_name', 'order_number', 'order_items', 'order_total', 'delivery_address'],
  order_shipped: ['customer_name', 'store_name', 'order_number', 'courier_name', 'tracking_number', 'estimated_delivery', 'tracking_url'],
  out_for_delivery: ['customer_name', 'store_name', 'order_number', 'cod_message'],
  order_delivered: ['customer_name', 'store_name', 'order_number', 'review_url', 'next_order_coupon'],
  review_request: ['customer_name', 'store_name', 'product_name', 'review_url', 'discount', 'coupon_code'],
  payment_reminder: ['customer_name', 'store_name', 'amount', 'order_number'],
};

export default function WhatsAppMarketing() {
  const [templates, setTemplates] = useState<WhatsAppTemplate[]>(DEFAULT_TEMPLATES);
  const [editingTemplate, setEditingTemplate] = useState<WhatsAppTemplate | null>(null);
  const [editMessage, setEditMessage] = useState('');
  const [editActive, setEditActive] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [previewTemplate, setPreviewTemplate] = useState<WhatsAppTemplate | null>(null);
  const { toast } = useToast();

  useEffect(() => { fetchTemplates(); }, []);

  const fetchTemplates = async () => {
    setIsLoading(true);
    const { data } = await supabase.from('store_settings').select('value').eq('key', 'whatsapp_templates').maybeSingle();
    if (data?.value) {
      const saved = data.value as any as WhatsAppTemplate[];
      const savedIds = new Set(saved.map(t => t.id));
      setTemplates([...saved, ...DEFAULT_TEMPLATES.filter(d => !savedIds.has(d.id))]);
    }
    setIsLoading(false);
  };

  const handleEdit = (template: WhatsAppTemplate) => {
    setEditingTemplate(template);
    setEditMessage(template.message);
    setEditActive(template.is_active);
  };

  const handleSave = async () => {
    if (!editingTemplate) return;
    setIsSaving(true);
    const updated = templates.map(t => t.id === editingTemplate.id ? { ...t, message: editMessage, is_active: editActive } : t);
    setTemplates(updated);

    const { data: existing } = await supabase.from('store_settings').select('id').eq('key', 'whatsapp_templates').maybeSingle();
    let error;
    if (existing) {
      ({ error } = await supabase.from('store_settings').update({ value: updated as any }).eq('key', 'whatsapp_templates'));
    } else {
      ({ error } = await supabase.from('store_settings').insert({ key: 'whatsapp_templates', value: updated as any }));
    }
    if (error) toast({ title: 'Error', description: error.message, variant: 'destructive' });
    else toast({ title: 'Template saved!' });
    setEditingTemplate(null);
    setIsSaving(false);
  };

  const toggleTemplate = async (id: string, active: boolean) => {
    const updated = templates.map(t => t.id === id ? { ...t, is_active: active } : t);
    setTemplates(updated);
    const { data: existing } = await supabase.from('store_settings').select('id').eq('key', 'whatsapp_templates').maybeSingle();
    if (existing) await supabase.from('store_settings').update({ value: updated as any }).eq('key', 'whatsapp_templates');
    else await supabase.from('store_settings').insert({ key: 'whatsapp_templates', value: updated as any });
  };

  const getPreviewMessage = (template: WhatsAppTemplate) => {
    return template.message
      .replace(/\{\{customer_name\}\}/g, 'John').replace(/\{\{store_name\}\}/g, 'My Store')
      .replace(/\{\{coupon_code\}\}/g, 'WELCOME10').replace(/\{\{discount\}\}/g, '10')
      .replace(/\{\{shop_url\}\}/g, 'https://mystore.com').replace(/\{\{cart_items\}\}/g, 'Blue T-Shirt x1, Sneakers x1')
      .replace(/\{\{cart_total\}\}/g, '1,999').replace(/\{\{checkout_url\}\}/g, 'https://mystore.com/checkout')
      .replace(/\{\{order_number\}\}/g, 'ORD20250320001').replace(/\{\{order_items\}\}/g, 'Blue T-Shirt x1')
      .replace(/\{\{order_total\}\}/g, '999').replace(/\{\{delivery_address\}\}/g, '123 Main St, Mumbai')
      .replace(/\{\{courier_name\}\}/g, 'Delhivery').replace(/\{\{tracking_number\}\}/g, 'DL123456789')
      .replace(/\{\{estimated_delivery\}\}/g, '22 Mar 2025').replace(/\{\{tracking_url\}\}/g, 'https://track.delhivery.com/123')
      .replace(/\{\{cod_message\}\}/g, 'COD Amount: ₹999').replace(/\{\{review_url\}\}/g, 'https://mystore.com/review')
      .replace(/\{\{next_order_coupon\}\}/g, 'COMEBACK10').replace(/\{\{product_name\}\}/g, 'Blue T-Shirt')
      .replace(/\{\{amount\}\}/g, '999');
  };

  return (
    <AdminLayout title="Marketing" description="WhatsApp templates, bulk messaging & email campaigns">
      <Tabs defaultValue="templates" className="space-y-4">
        <TabsList>
          <TabsTrigger value="templates" className="text-xs"><MessageSquare className="h-3.5 w-3.5 mr-1" /> Templates</TabsTrigger>
          <TabsTrigger value="bulk-whatsapp" className="text-xs"><Send className="h-3.5 w-3.5 mr-1" /> Bulk WhatsApp</TabsTrigger>
          <TabsTrigger value="bulk-email" className="text-xs"><Mail className="h-3.5 w-3.5 mr-1" /> Bulk Email</TabsTrigger>
        </TabsList>

        <TabsContent value="templates">
          <div className="space-y-6">
            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card><CardContent className="p-4 flex items-center gap-3"><div className="h-10 w-10 rounded-lg bg-green-500/10 flex items-center justify-center"><MessageSquare className="h-5 w-5 text-green-600" /></div><div><p className="text-xs text-muted-foreground">Total Templates</p><p className="text-xl font-bold">{templates.length}</p></div></CardContent></Card>
              <Card><CardContent className="p-4 flex items-center gap-3"><div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center"><Sparkles className="h-5 w-5 text-blue-600" /></div><div><p className="text-xs text-muted-foreground">Active</p><p className="text-xl font-bold text-green-600">{templates.filter(t => t.is_active).length}</p></div></CardContent></Card>
              <Card><CardContent className="p-4 flex items-center gap-3"><div className="h-10 w-10 rounded-lg bg-amber-500/10 flex items-center justify-center"><Send className="h-5 w-5 text-amber-600" /></div><div><p className="text-xs text-muted-foreground">Triggers</p><p className="text-xl font-bold">{new Set(templates.map(t => t.trigger)).size}</p></div></CardContent></Card>
              <Card><CardContent className="p-4 flex items-center gap-3"><div className="h-10 w-10 rounded-lg bg-red-500/10 flex items-center justify-center"><Clock className="h-5 w-5 text-red-600" /></div><div><p className="text-xs text-muted-foreground">Inactive</p><p className="text-xl font-bold text-muted-foreground">{templates.filter(t => !t.is_active).length}</p></div></CardContent></Card>
            </div>

            {/* Templates Grid */}
            <div className="grid md:grid-cols-2 gap-4">
              {templates.map((template) => {
                const Icon = TRIGGER_ICONS[template.trigger] || MessageSquare;
                return (
                  <Card key={template.id} className={!template.is_active ? 'opacity-60' : ''}>
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          <div className="h-8 w-8 rounded-lg bg-green-500/10 flex items-center justify-center"><Icon className="h-4 w-4 text-green-600" /></div>
                          <div><CardTitle className="text-sm">{template.name}</CardTitle><CardDescription className="text-xs">{template.description}</CardDescription></div>
                        </div>
                        <Switch checked={template.is_active} onCheckedChange={(v) => toggleTemplate(template.id, v)} />
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="bg-muted/50 rounded-lg p-3 max-h-28 overflow-y-auto">
                        <p className="text-xs text-muted-foreground whitespace-pre-wrap font-mono leading-relaxed">
                          {template.message.substring(0, 200)}{template.message.length > 200 ? '...' : ''}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-[10px]">{template.trigger.replace(/_/g, ' ')}</Badge>
                        <div className="flex-1" />
                        <Button variant="ghost" size="sm" onClick={() => setPreviewTemplate(template)}><Eye className="h-3.5 w-3.5 mr-1" /> Preview</Button>
                        <Button variant="outline" size="sm" onClick={() => handleEdit(template)}><Edit className="h-3.5 w-3.5 mr-1" /> Edit</Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="bulk-whatsapp">
          <BulkWhatsApp />
        </TabsContent>

        <TabsContent value="bulk-email">
          <BulkEmail />
        </TabsContent>
      </Tabs>

      {/* Edit Dialog */}
      <Dialog open={!!editingTemplate} onOpenChange={(open) => { if (!open) setEditingTemplate(null); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Edit className="h-5 w-5" /> Edit: {editingTemplate?.name}</DialogTitle></DialogHeader>
          {editingTemplate && (
            <div className="space-y-4 mt-2">
              <div className="flex items-center gap-3"><Label>Active</Label><Switch checked={editActive} onCheckedChange={setEditActive} /></div>
              <div><Label>Message Template</Label><Textarea value={editMessage} onChange={(e) => setEditMessage(e.target.value)} rows={10} className="font-mono text-sm mt-1" /></div>
              <div>
                <Label className="text-xs text-muted-foreground">Available Variables (click to insert)</Label>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {(VARIABLE_DESCRIPTIONS[editingTemplate.id] || []).map(v => (
                    <Badge key={v} variant="outline" className="cursor-pointer hover:bg-primary/10 text-[11px]" onClick={() => setEditMessage(prev => prev + `{{${v}}}`)}>{`{{${v}}}`}</Badge>
                  ))}
                </div>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Live Preview</Label>
                <div className="mt-2 bg-[#e5ddd5] rounded-xl p-4">
                  <div className="bg-white rounded-lg p-3 max-w-[85%] shadow-sm">
                    <p className="text-sm whitespace-pre-wrap leading-relaxed">{getPreviewMessage({ ...editingTemplate, message: editMessage })}</p>
                    <p className="text-[10px] text-muted-foreground text-right mt-1">12:00 PM ✓✓</p>
                  </div>
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <Button className="flex-1" onClick={handleSave} disabled={isSaving}>
                  {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />} Save Template
                </Button>
                <Button variant="outline" onClick={() => setEditingTemplate(null)}>Cancel</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={!!previewTemplate} onOpenChange={(open) => { if (!open) setPreviewTemplate(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Eye className="h-5 w-5" /> Preview: {previewTemplate?.name}</DialogTitle></DialogHeader>
          {previewTemplate && (
            <div className="bg-[#e5ddd5] rounded-xl p-4 mt-2">
              <div className="bg-white rounded-lg p-4 shadow-sm">
                <p className="text-sm whitespace-pre-wrap leading-relaxed">{getPreviewMessage(previewTemplate)}</p>
                <p className="text-[10px] text-muted-foreground text-right mt-2">12:00 PM ✓✓</p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
