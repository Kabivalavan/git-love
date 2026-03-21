import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Send, Loader2, Users, CheckCircle, XCircle, Search, Image as ImageIcon, AlertTriangle } from 'lucide-react';

interface Customer {
  user_id: string;
  full_name: string | null;
  mobile_number: string | null;
  email: string | null;
}

interface SendResult {
  phone: string;
  name: string;
  status: 'sent' | 'failed';
  error?: string;
}

export function BulkWhatsApp() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [results, setResults] = useState<SendResult[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [waConnected, setWaConnected] = useState<boolean | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchCustomers();
    checkWhatsAppConnection();
  }, []);

  const checkWhatsAppConnection = async () => {
    const { data } = await supabase.from('store_settings').select('value').eq('key', 'whatsapp').maybeSingle();
    if (data?.value) {
      const v = data.value as any;
      setWaConnected(!!(v.api_token && v.phone_number_id));
    } else {
      setWaConnected(false);
    }
  };

  const fetchCustomers = async () => {
    setIsLoading(true);
    const { data } = await supabase
      .from('profiles')
      .select('user_id, full_name, mobile_number, email')
      .not('mobile_number', 'is', null)
      .order('created_at', { ascending: false });
    setCustomers((data || []) as Customer[]);
    setIsLoading(false);
  };

  const filtered = customers.filter(c => {
    const q = search.toLowerCase();
    return (
      (c.full_name?.toLowerCase().includes(q) || false) ||
      (c.mobile_number?.includes(q) || false) ||
      (c.email?.toLowerCase().includes(q) || false)
    );
  });

  const toggleAll = () => {
    if (selected.size === filtered.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map(c => c.user_id)));
    }
  };

  const toggleOne = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const handleSend = async () => {
    if (!message.trim()) {
      toast({ title: 'Please enter a message', variant: 'destructive' });
      return;
    }
    if (selected.size === 0) {
      toast({ title: 'Select at least one customer', variant: 'destructive' });
      return;
    }

    setIsSending(true);
    const sendResults: SendResult[] = [];

    for (const userId of selected) {
      const customer = customers.find(c => c.user_id === userId);
      if (!customer?.mobile_number) {
        sendResults.push({ phone: 'N/A', name: customer?.full_name || 'Unknown', status: 'failed', error: 'No phone number' });
        continue;
      }

      const phone = customer.mobile_number.replace(/\D/g, '');
      const intlPhone = phone.startsWith('91') ? phone : `91${phone}`;

      // Personalize message
      const personalizedMsg = message
        .replace(/\{\{name\}\}/g, customer.full_name || 'there')
        .replace(/\{\{phone\}\}/g, customer.mobile_number || '');

      // Build WhatsApp URL with image if provided
      let waUrl = `https://wa.me/${intlPhone}?text=${encodeURIComponent(personalizedMsg)}`;
      if (imageUrl.trim()) {
        waUrl += `\n${imageUrl.trim()}`;
      }

      // Open WhatsApp Web for each (manual sending via web.whatsapp)
      try {
        window.open(waUrl, '_blank');
        sendResults.push({ phone: customer.mobile_number, name: customer.full_name || 'Unknown', status: 'sent' });
      } catch (e: any) {
        sendResults.push({ phone: customer.mobile_number, name: customer.full_name || 'Unknown', status: 'failed', error: e.message });
      }

      // Small delay between opens
      await new Promise(r => setTimeout(r, 500));
    }

    setResults(sendResults);
    setShowResults(true);
    setIsSending(false);
    toast({
      title: `Sent to ${sendResults.filter(r => r.status === 'sent').length} / ${sendResults.length} customers`,
    });
  };

  const sentCount = results.filter(r => r.status === 'sent').length;
  const failedCount = results.filter(r => r.status === 'failed').length;

  if (waConnected === false) {
    return (
      <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800">
        <CardContent className="p-6 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-foreground">WhatsApp Business API Not Connected</p>
            <p className="text-sm text-muted-foreground mt-1">
              Go to <strong>Settings → WhatsApp</strong> to connect your WhatsApp Business API before sending bulk messages.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid md:grid-cols-2 gap-4">
        {/* Message Composer */}
        <Card>
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-sm">Compose Message</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-3">
            <div>
              <Label className="text-xs">Message</Label>
              <Textarea
                value={message}
                onChange={e => setMessage(e.target.value)}
                rows={6}
                placeholder="Hi {{name}}, check out our latest collection! 🎉"
                className="mt-1 font-mono text-sm"
              />
              <p className="text-[10px] text-muted-foreground mt-1">
                Variables: <code>{'{{name}}'}</code>, <code>{'{{phone}}'}</code>
              </p>
            </div>
            <div>
              <Label className="text-xs flex items-center gap-1"><ImageIcon className="h-3 w-3" /> Image URL (optional)</Label>
              <Input
                value={imageUrl}
                onChange={e => setImageUrl(e.target.value)}
                placeholder="https://example.com/promo.jpg"
                className="mt-1"
              />
            </div>
            <Button
              className="w-full"
              onClick={handleSend}
              disabled={isSending || selected.size === 0 || !message.trim()}
            >
              {isSending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
              Send to {selected.size} Customer{selected.size !== 1 ? 's' : ''}
            </Button>
          </CardContent>
        </Card>

        {/* Customer Selection */}
        <Card>
          <CardHeader className="py-3 px-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-1.5">
                <Users className="h-4 w-4" /> Customers ({customers.length})
              </CardTitle>
              <Badge variant="secondary" className="text-[10px]">{selected.size} selected</Badge>
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search customers..."
                className="pl-8 h-8 text-xs"
              />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                checked={selected.size === filtered.length && filtered.length > 0}
                onCheckedChange={toggleAll}
              />
              <span className="text-xs text-muted-foreground">Select All ({filtered.length})</span>
            </div>
            <div className="max-h-[300px] overflow-y-auto space-y-1">
              {isLoading ? (
                <div className="text-center py-4 text-muted-foreground text-sm">Loading...</div>
              ) : filtered.length === 0 ? (
                <div className="text-center py-4 text-muted-foreground text-sm">No customers with phone numbers</div>
              ) : (
                filtered.map(c => (
                  <div
                    key={c.user_id}
                    className="flex items-center gap-2 p-2 rounded hover:bg-muted/50 cursor-pointer"
                    onClick={() => toggleOne(c.user_id)}
                  >
                    <Checkbox checked={selected.has(c.user_id)} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{c.full_name || 'Unknown'}</p>
                      <p className="text-[10px] text-muted-foreground">{c.mobile_number}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Send Results */}
      {showResults && results.length > 0 && (
        <Card>
          <CardHeader className="py-3 px-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Send Results</CardTitle>
              <div className="flex gap-2">
                <Badge className="bg-green-100 text-green-800 text-[10px]">
                  <CheckCircle className="h-3 w-3 mr-1" /> {sentCount} Sent
                </Badge>
                {failedCount > 0 && (
                  <Badge className="bg-red-100 text-red-800 text-[10px]">
                    <XCircle className="h-3 w-3 mr-1" /> {failedCount} Failed
                  </Badge>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="max-h-[200px] overflow-y-auto space-y-1">
              {results.map((r, i) => (
                <div key={i} className="flex items-center justify-between text-xs p-1.5 rounded bg-muted/30">
                  <span>{r.name} ({r.phone})</span>
                  {r.status === 'sent' ? (
                    <Badge className="bg-green-100 text-green-800 text-[10px]">Sent</Badge>
                  ) : (
                    <Badge className="bg-red-100 text-red-800 text-[10px]">{r.error || 'Failed'}</Badge>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
