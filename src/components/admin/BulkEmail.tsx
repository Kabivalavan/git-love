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
import { Mail, Loader2, Users, CheckCircle, XCircle, Search } from 'lucide-react';

interface Customer {
  user_id: string;
  full_name: string | null;
  email: string | null;
  mobile_number: string | null;
}

interface SendResult {
  email: string;
  name: string;
  status: 'sent' | 'failed';
  error?: string;
}

export function BulkEmail() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [results, setResults] = useState<SendResult[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [progress, setProgress] = useState({ sent: 0, total: 0 });
  const { toast } = useToast();

  useEffect(() => {
    fetchCustomers();
  }, []);

  const fetchCustomers = async () => {
    setIsLoading(true);
    const { data } = await supabase
      .from('profiles')
      .select('user_id, full_name, email, mobile_number')
      .not('email', 'is', null)
      .order('created_at', { ascending: false });
    setCustomers((data || []) as Customer[]);
    setIsLoading(false);
  };

  const filtered = customers.filter(c => {
    const q = search.toLowerCase();
    return (
      (c.full_name?.toLowerCase().includes(q) || false) ||
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
    if (!subject.trim() || !body.trim()) {
      toast({ title: 'Please fill subject and body', variant: 'destructive' });
      return;
    }
    if (selected.size === 0) {
      toast({ title: 'Select at least one customer', variant: 'destructive' });
      return;
    }

    setIsSending(true);
    setShowResults(false);
    const sendResults: SendResult[] = [];
    const total = selected.size;
    setProgress({ sent: 0, total });

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      toast({ title: 'Not authenticated', variant: 'destructive' });
      setIsSending(false);
      return;
    }

    let sentCount = 0;

    for (const userId of selected) {
      const customer = customers.find(c => c.user_id === userId);
      if (!customer?.email) {
        sendResults.push({ email: 'N/A', name: customer?.full_name || 'Unknown', status: 'failed', error: 'No email' });
        continue;
      }

      // Personalize
      const personalizedSubject = subject
        .replace(/\{\{name\}\}/g, customer.full_name || 'there');
      const personalizedBody = body
        .replace(/\{\{name\}\}/g, customer.full_name || 'there')
        .replace(/\{\{email\}\}/g, customer.email || '')
        .replace(/\n/g, '<br>');

      try {
        const res = await fetch(
          `https://riqjidlyjyhfpgnjtbqi.supabase.co/functions/v1/send-smtp-email`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({
              to: customer.email,
              subject: personalizedSubject,
              html: `<div style="font-family:sans-serif;font-size:15px;line-height:1.7;color:#333;max-width:600px;margin:0 auto;padding:24px">${personalizedBody}</div>`,
            }),
          }
        );

        if (res.ok) {
          sendResults.push({ email: customer.email, name: customer.full_name || 'Unknown', status: 'sent' });
          sentCount++;
        } else {
          const err = await res.json().catch(() => ({ error: 'Unknown error' }));
          sendResults.push({ email: customer.email, name: customer.full_name || 'Unknown', status: 'failed', error: err.error });
        }
      } catch (e: any) {
        sendResults.push({ email: customer.email, name: customer.full_name || 'Unknown', status: 'failed', error: e.message });
      }

      setProgress({ sent: sendResults.length, total });
    }

    setResults(sendResults);
    setShowResults(true);
    setIsSending(false);
    toast({
      title: `Sent ${sentCount} / ${total} emails`,
      description: sendResults.filter(r => r.status === 'failed').length > 0 ? 'Some emails failed.' : undefined,
    });
  };

  const sentCount = results.filter(r => r.status === 'sent').length;
  const failedCount = results.filter(r => r.status === 'failed').length;

  return (
    <div className="space-y-4">
      <div className="grid md:grid-cols-2 gap-4">
        {/* Email Composer */}
        <Card>
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-sm flex items-center gap-1.5">
              <Mail className="h-4 w-4" /> Compose Email
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-3">
            <div>
              <Label className="text-xs">Subject</Label>
              <Input
                value={subject}
                onChange={e => setSubject(e.target.value)}
                placeholder="🎉 Special offer for you, {{name}}!"
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs">Body</Label>
              <Textarea
                value={body}
                onChange={e => setBody(e.target.value)}
                rows={8}
                placeholder="Hi {{name}},&#10;&#10;We have exciting new arrivals just for you!&#10;&#10;Check them out at our store."
                className="mt-1 text-sm"
              />
              <p className="text-[10px] text-muted-foreground mt-1">
                Variables: <code>{'{{name}}'}</code>, <code>{'{{email}}'}</code>
              </p>
            </div>

            {isSending && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Sending {progress.sent} / {progress.total}...
              </div>
            )}

            <Button
              className="w-full"
              onClick={handleSend}
              disabled={isSending || selected.size === 0 || !subject.trim() || !body.trim()}
            >
              {isSending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Mail className="h-4 w-4 mr-2" />}
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
                <div className="text-center py-4 text-muted-foreground text-sm">No customers with email</div>
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
                      <p className="text-[10px] text-muted-foreground truncate">{c.email}</p>
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
                  <span className="truncate flex-1">{r.name} ({r.email})</span>
                  {r.status === 'sent' ? (
                    <Badge className="bg-green-100 text-green-800 text-[10px] ml-2">Sent</Badge>
                  ) : (
                    <Badge className="bg-red-100 text-red-800 text-[10px] ml-2 max-w-[120px] truncate">{r.error || 'Failed'}</Badge>
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
