import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Send, Loader2, Users, CheckCircle, XCircle, Search, Upload, X, AlertTriangle, Paperclip } from 'lucide-react';

interface Customer {
  user_id: string;
  full_name: string | null;
  mobile_number: string | null;
  email: string | null;
}

interface SendResult {
  phone: string;
  name: string | null;
  status: 'sent' | 'failed';
  error?: string;
}

type MediaType = 'image' | 'video' | 'document';

function detectMediaType(file: File): MediaType {
  if (file.type.startsWith('image/')) return 'image';
  if (file.type.startsWith('video/')) return 'video';
  return 'document';
}

export function BulkWhatsApp() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState('');
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaUrl, setMediaUrl] = useState<string>('');
  const [mediaUploading, setMediaUploading] = useState(false);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [results, setResults] = useState<SendResult[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [waConnected, setWaConnected] = useState<boolean | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchCustomers();
    checkWhatsAppConnection();
  }, []);

  const checkWhatsAppConnection = async () => {
    const { data } = await supabase.from('store_settings').select('value').eq('key', 'whatsapp').maybeSingle();
    if (data?.value) {
      const v = data.value as any;
      setWaConnected(!!(v.api_token && v.phone_number_id && v.api_url));
    } else setWaConnected(false);
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
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map(c => c.user_id)));
  };

  const toggleOne = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  };

  const handleFile = async (file: File) => {
    if (file.size > 15 * 1024 * 1024) {
      toast({ title: 'File too large', description: 'Max 15MB allowed by WhatsApp.', variant: 'destructive' });
      return;
    }
    setMediaFile(file);
    setMediaUploading(true);
    try {
      const ext = file.name.split('.').pop() || 'bin';
      const path = `bulk-whatsapp/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error } = await supabase.storage.from('store').upload(path, file, { upsert: false });
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage.from('store').getPublicUrl(path);
      setMediaUrl(publicUrl);
    } catch (e: any) {
      toast({ title: 'Upload failed', description: e.message, variant: 'destructive' });
      setMediaFile(null);
    } finally {
      setMediaUploading(false);
    }
  };

  const clearMedia = () => {
    setMediaFile(null);
    setMediaUrl('');
    if (fileRef.current) fileRef.current.value = '';
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
    setShowResults(false);

    const recipients = Array.from(selected)
      .map(id => customers.find(c => c.user_id === id))
      .filter(Boolean)
      .map(c => ({ phone: c!.mobile_number || '', name: c!.full_name }));

    try {
      const { data, error } = await supabase.functions.invoke('whatsapp-bulk-send', {
        body: {
          recipients,
          message,
          media_url: mediaUrl || null,
          media_type: mediaFile ? detectMediaType(mediaFile) : null,
        },
      });

      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);

      const payload = data as any;
      setResults(payload.results || []);
      setShowResults(true);
      toast({
        title: `Sent ${payload.sent} / ${recipients.length}`,
        description: payload.failed > 0 ? `${payload.failed} failed — see results below.` : undefined,
        variant: payload.failed > 0 ? 'destructive' : 'default',
      });
    } catch (e: any) {
      toast({ title: 'Send failed', description: e.message, variant: 'destructive' });
    } finally {
      setIsSending(false);
    }
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
              <Label className="text-xs flex items-center gap-1"><Paperclip className="h-3 w-3" /> Media (optional — image / video / document, max 15MB)</Label>
              {!mediaFile ? (
                <div className="mt-1">
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*,video/*,application/pdf,.doc,.docx,.xls,.xlsx"
                    onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                    className="hidden"
                  />
                  <Button type="button" variant="outline" size="sm" className="w-full" onClick={() => fileRef.current?.click()}>
                    <Upload className="h-3.5 w-3.5 mr-2" /> Choose file
                  </Button>
                </div>
              ) : (
                <div className="mt-1 flex items-center gap-2 p-2 rounded border bg-muted/30">
                  {mediaUploading ? (
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  ) : detectMediaType(mediaFile) === 'image' && mediaUrl ? (
                    <img src={mediaUrl} alt="preview" className="h-10 w-10 rounded object-cover" />
                  ) : (
                    <Paperclip className="h-4 w-4 text-muted-foreground" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs truncate">{mediaFile.name}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {(mediaFile.size / 1024).toFixed(0)} KB · {detectMediaType(mediaFile)}
                    </p>
                  </div>
                  <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={clearMedia}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}
            </div>
            <Button
              className="w-full"
              onClick={handleSend}
              disabled={isSending || mediaUploading || selected.size === 0 || !message.trim()}
            >
              {isSending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
              Send to {selected.size} Customer{selected.size !== 1 ? 's' : ''}
            </Button>
            <p className="text-[10px] text-muted-foreground text-center">
              Sent via your connected WhatsApp Business API
            </p>
          </CardContent>
        </Card>

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
              <Checkbox checked={selected.size === filtered.length && filtered.length > 0} onCheckedChange={toggleAll} />
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
            <div className="max-h-[260px] overflow-y-auto space-y-1">
              {results.map((r, i) => (
                <div key={i} className="flex items-center justify-between text-xs p-1.5 rounded bg-muted/30 gap-2">
                  <span className="truncate flex-1">{r.name || 'Unknown'} ({r.phone})</span>
                  {r.status === 'sent' ? (
                    <Badge className="bg-green-100 text-green-800 text-[10px]">Sent</Badge>
                  ) : (
                    <Badge className="bg-red-100 text-red-800 text-[10px] max-w-[180px] truncate">{r.error || 'Failed'}</Badge>
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
