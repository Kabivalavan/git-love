import { useState, useMemo, useEffect, useRef } from 'react';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { DataTable, Column } from '@/components/admin/DataTable';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { Activity, User, Package, ShoppingCart, Users, Receipt, Image, Percent, Truck, Layers, Settings, Filter, Clock, Hash, FileText, LayoutGrid, List, Loader2, ArrowRight } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface ActivityLog {
  id: string;
  user_id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  details: Record<string, any>;
  created_at: string;
  ip_address: string | null;
  profile?: { full_name: string | null; email: string | null } | null;
}

const ACTION_COLORS: Record<string, string> = {
  create: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  update: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  delete: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  status_change: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  block: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  unblock: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  refund: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  export: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300',
};

const ENTITY_ICONS: Record<string, any> = {
  product: Package, order: ShoppingCart, customer: Users, category: Package,
  banner: Image, coupon: Percent, offer: Percent, expense: Receipt,
  delivery: Truck, bundle: Layers, settings: Settings, return: Package,
};

const ENTITY_TYPES = ['product', 'order', 'customer', 'category', 'banner', 'coupon', 'offer', 'expense', 'delivery', 'bundle', 'settings', 'return'];
const ACTIONS = ['create', 'update', 'delete', 'status_change', 'block', 'unblock', 'refund', 'export'];
const PAGE_SIZE = 30;

function formatValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'object') return JSON.stringify(value);
  const s = String(value);
  return s.length > 80 ? s.slice(0, 80) + '…' : s;
}

export default function AdminActivityLog() {
  const [filterEntity, setFilterEntity] = useState('all');
  const [filterAction, setFilterAction] = useState('all');
  const [filterDate, setFilterDate] = useState('all');
  const [selectedLog, setSelectedLog] = useState<ActivityLog | null>(null);
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');
  const sentinelRef = useRef<HTMLDivElement>(null);
  const profileMapRef = useRef<Map<string, any>>(new Map());

  const dateRange = useMemo(() => {
    if (filterDate === 'all') return { from: null, to: null };
    const days = parseInt(filterDate);
    const from = new Date();
    from.setDate(from.getDate() - days);
    return { from: from.toISOString(), to: new Date().toISOString() };
  }, [filterDate]);

  // KPI summary via backend RPC (accurate, independent of pagination)
  const { data: summary } = useQuery({
    queryKey: ['admin-activity-log-summary', filterEntity, filterAction, filterDate],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_activity_log_summary', {
        p_from: dateRange.from,
        p_to: dateRange.to,
        p_entity: filterEntity === 'all' ? null : filterEntity,
        p_action: filterAction === 'all' ? null : filterAction,
      });
      if (error) throw error;
      return data as { total: number; today: number; creates: number; updates: number; deletes: number };
    },
    staleTime: 60 * 1000,
  });

  // Infinite paginated logs cached by React Query — no refetch on revisit within staleTime
  const infinite = useInfiniteQuery({
    queryKey: ['admin-activity-logs', filterEntity, filterAction, filterDate],
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      const offset = pageParam as number;
      let q = supabase
        .from('activity_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .range(offset, offset + PAGE_SIZE - 1);

      if (filterEntity !== 'all') q = q.eq('entity_type', filterEntity);
      if (filterAction !== 'all') q = q.eq('action', filterAction);
      if (dateRange.from) q = q.gte('created_at', dateRange.from);

      const { data, error } = await q;
      if (error) throw error;

      // Enrich profiles (cached across pages)
      const newUserIds = [...new Set((data || []).map((l: any) => l.user_id))].filter(
        (id) => id && !profileMapRef.current.has(id)
      );
      if (newUserIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, full_name, email')
          .in('user_id', newUserIds as string[]);
        (profiles || []).forEach((p: any) => profileMapRef.current.set(p.user_id, p));
      }
      return (data || []).map((l: any) => ({ ...l, profile: profileMapRef.current.get(l.user_id) || null })) as ActivityLog[];
    },
    getNextPageParam: (lastPage, allPages) => {
      if (!lastPage || lastPage.length < PAGE_SIZE) return undefined;
      return allPages.reduce((sum, p) => sum + p.length, 0);
    },
    staleTime: 5 * 60 * 1000, // 5 min — avoid refetch when returning to page
    gcTime: 15 * 60 * 1000,
  });

  // Dedupe by id to prevent React duplicate-key crashes on overlapping pages
  const logs = useMemo<ActivityLog[]>(() => {
    const all = infinite.data?.pages.flat() || [];
    const seen = new Set<string>();
    const out: ActivityLog[] = [];
    for (const l of all) {
      if (!l?.id || seen.has(l.id)) continue;
      seen.add(l.id);
      out.push(l);
    }
    return out;
  }, [infinite.data]);

  const isLoading = infinite.isLoading;
  const isLoadingMore = infinite.isFetchingNextPage;
  const hasMore = infinite.hasNextPage;

  // Infinite scroll observer with safety guards
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && hasMore && !isLoadingMore && !isLoading) {
          infinite.fetchNextPage();
        }
      },
      { rootMargin: '300px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, isLoadingMore, isLoading, infinite]);

  const stats = summary || { total: 0, today: 0, creates: 0, updates: 0, deletes: 0 };

  const getDescription = (log: ActivityLog) => {
    const name = log.details?.name || log.details?.order_number || log.details?.code || log.entity_id || '';
    const entityLabel = log.entity_type.charAt(0).toUpperCase() + log.entity_type.slice(1);
    switch (log.action) {
      case 'create': return `Created ${entityLabel}: ${name}`;
      case 'update': return `Updated ${entityLabel}: ${name}`;
      case 'delete': return `Deleted ${entityLabel}: ${name}`;
      case 'status_change': return `Changed ${entityLabel} status: ${log.details?.from || '?'} → ${log.details?.to || '?'}`;
      case 'block': return `Blocked customer: ${name}`;
      case 'unblock': return `Unblocked customer: ${name}`;
      case 'refund': return `Refunded: ${name}`;
      case 'export': return `${log.details?.name || `Exported ${entityLabel}`}`;
      default: return `${log.action} on ${entityLabel}`;
    }
  };

  const columns: Column<ActivityLog>[] = [
    {
      key: 'created_at', header: 'Time', className: 'w-[160px]',
      render: (l) => <span className="text-xs text-muted-foreground">{format(new Date(l.created_at), 'dd MMM yyyy, HH:mm')}</span>,
    },
    {
      key: 'user_id', header: 'User', className: 'w-[150px]',
      render: (l) => (
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-primary text-[10px] font-bold">
            {(l.profile?.full_name?.[0] || l.profile?.email?.[0] || '?').toUpperCase()}
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-sm truncate">{l.profile?.full_name || l.profile?.email || 'Unknown'}</span>
            <Badge variant="outline" className="text-[9px] w-fit px-1 py-0">Admin</Badge>
          </div>
        </div>
      ),
    },
    {
      key: 'action', header: 'Action', className: 'w-[120px]',
      render: (l) => <Badge className={`text-[10px] border-0 ${ACTION_COLORS[l.action] || 'bg-muted text-muted-foreground'}`}>{l.action.replace('_', ' ').toUpperCase()}</Badge>,
    },
    {
      key: 'entity_type', header: 'Entity', className: 'w-[100px]',
      render: (l) => {
        const Icon = ENTITY_ICONS[l.entity_type] || Activity;
        return <div className="flex items-center gap-1.5 text-sm"><Icon className="h-3.5 w-3.5 text-muted-foreground" /><span className="capitalize">{l.entity_type}</span></div>;
      },
    },
    {
      key: 'details', header: 'Description',
      render: (l) => <span className="text-sm text-muted-foreground">{getDescription(l)}</span>,
    },
  ];

  const changes = (selectedLog?.details?.changes || {}) as Record<string, { from: unknown; to: unknown }>;
  const hasChanges = Object.keys(changes).length > 0;

  return (
    <AdminLayout title="Activity Log" description="Audit trail of all admin actions">
      <div className="space-y-6">
        {/* Backend-computed KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Card><CardHeader className="pb-2"><CardTitle className="text-xs font-medium text-muted-foreground">Total</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{stats.total.toLocaleString()}</p></CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-xs font-medium text-muted-foreground">Today</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{stats.today}</p></CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-xs font-medium text-muted-foreground">Creates</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold text-green-600">{stats.creates}</p></CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-xs font-medium text-muted-foreground">Updates</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold text-blue-600">{stats.updates}</p></CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-xs font-medium text-muted-foreground">Deletes</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold text-red-600">{stats.deletes}</p></CardContent></Card>
        </div>

        <div className="flex flex-wrap gap-3 items-center">
          <Select value={filterEntity} onValueChange={setFilterEntity}>
            <SelectTrigger className="w-[150px]"><Filter className="h-3 w-3 mr-1" /><SelectValue placeholder="Entity" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Entities</SelectItem>
              {ENTITY_TYPES.map(e => <SelectItem key={e} value={e} className="capitalize">{e}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterAction} onValueChange={setFilterAction}>
            <SelectTrigger className="w-[150px]"><SelectValue placeholder="Action" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Actions</SelectItem>
              {ACTIONS.map(a => <SelectItem key={a} value={a} className="capitalize">{a.replace('_', ' ')}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterDate} onValueChange={setFilterDate}>
            <SelectTrigger className="w-[140px]"><SelectValue placeholder="Date Range" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Time</SelectItem>
              <SelectItem value="1">Today</SelectItem>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
          <div className="ml-auto flex items-center gap-1 border border-border rounded-lg p-0.5">
            <Button variant={viewMode === 'table' ? 'default' : 'ghost'} size="icon" className="h-8 w-8" onClick={() => setViewMode('table')}>
              <List className="h-4 w-4" />
            </Button>
            <Button variant={viewMode === 'grid' ? 'default' : 'ghost'} size="icon" className="h-8 w-8" onClick={() => setViewMode('grid')}>
              <LayoutGrid className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {viewMode === 'table' && (
          <DataTable<ActivityLog>
            columns={columns}
            data={logs}
            isLoading={isLoading}
            onRowClick={(log) => setSelectedLog(log)}
            searchable
            searchPlaceholder="Search activity..."
            searchKeys={['action', 'entity_type'] as any}
            getRowId={(l) => l.id}
            emptyMessage="No activity logged yet."
          />
        )}

        {viewMode === 'grid' && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {isLoading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <Card key={i} className="animate-pulse"><CardContent className="p-4 h-28" /></Card>
              ))
            ) : logs.length === 0 ? (
              <div className="col-span-full text-center py-12 text-muted-foreground">No activity logged yet.</div>
            ) : (
              logs.map(log => {
                const Icon = ENTITY_ICONS[log.entity_type] || Activity;
                return (
                  <Card key={log.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setSelectedLog(log)}>
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <Icon className="h-4 w-4 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge className={cn("text-[10px] border-0", ACTION_COLORS[log.action] || 'bg-muted text-muted-foreground')}>
                              {log.action.replace('_', ' ').toUpperCase()}
                            </Badge>
                            <Badge variant="outline" className="text-[10px] capitalize">{log.entity_type}</Badge>
                          </div>
                          <p className="text-sm font-medium text-foreground truncate">{getDescription(log)}</p>
                          <div className="flex items-center gap-2 mt-1.5">
                            <div className="h-5 w-5 rounded-full bg-muted flex items-center justify-center text-[9px] font-bold text-muted-foreground">
                              {(log.profile?.full_name?.[0] || '?').toUpperCase()}
                            </div>
                            <span className="text-xs text-muted-foreground truncate">{log.profile?.full_name || 'Admin'}</span>
                            <span className="text-xs text-muted-foreground ml-auto whitespace-nowrap">{format(new Date(log.created_at), 'dd MMM, HH:mm')}</span>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        )}

        <div ref={sentinelRef} className="flex justify-center py-4">
          {isLoadingMore ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="text-sm">Loading more...</span>
            </div>
          ) : !hasMore && logs.length > 0 ? (
            <span className="text-xs text-muted-foreground">End of activity log</span>
          ) : null}
        </div>
      </div>

      <Dialog open={!!selectedLog} onOpenChange={(open) => { if (!open) setSelectedLog(null); }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedLog && (() => {
                const Icon = ENTITY_ICONS[selectedLog.entity_type] || Activity;
                return <Icon className="h-5 w-5 text-primary" />;
              })()}
              Activity Detail
            </DialogTitle>
          </DialogHeader>
          {selectedLog && (
            <div className="space-y-4 mt-2">
              <div className="p-3 rounded-lg bg-muted/50 border">
                <p className="text-sm font-semibold text-foreground">{getDescription(selectedLog)}</p>
                <p className="text-xs text-muted-foreground mt-1">{format(new Date(selectedLog.created_at), 'dd MMMM yyyy, hh:mm:ss a')}</p>
              </div>
              <Separator />
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><User className="h-3 w-3" /> Performed By</div>
                  <p className="text-sm font-medium text-foreground">{selectedLog.profile?.full_name || selectedLog.profile?.email || 'Unknown User'}</p>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><Activity className="h-3 w-3" /> Action</div>
                  <Badge className={`text-[10px] border-0 ${ACTION_COLORS[selectedLog.action] || 'bg-muted text-muted-foreground'}`}>{selectedLog.action.replace('_', ' ').toUpperCase()}</Badge>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><Package className="h-3 w-3" /> Entity</div>
                  <p className="text-sm font-medium text-foreground capitalize">{selectedLog.entity_type}</p>
                </div>
                {selectedLog.entity_id && (
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><Hash className="h-3 w-3" /> Reference ID</div>
                    <p className="text-xs font-mono text-muted-foreground break-all">{selectedLog.entity_id}</p>
                  </div>
                )}
              </div>

              {/* Field-level diff */}
              {hasChanges && (
                <>
                  <Separator />
                  <div>
                    <div className="flex items-center gap-1.5 mb-3">
                      <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Field Changes ({Object.keys(changes).length})</p>
                    </div>
                    <div className="rounded-lg border overflow-hidden">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-muted/50 text-xs text-muted-foreground">
                            <th className="text-left px-3 py-2 font-medium">Field</th>
                            <th className="text-left px-3 py-2 font-medium">Before</th>
                            <th className="px-2 py-2 w-6" />
                            <th className="text-left px-3 py-2 font-medium">After</th>
                          </tr>
                        </thead>
                        <tbody>
                          {Object.entries(changes).map(([field, diff]) => (
                            <tr key={field} className="border-t">
                              <td className="px-3 py-2 font-medium text-foreground capitalize">{field.replace(/_/g, ' ')}</td>
                              <td className="px-3 py-2 text-red-600 dark:text-red-400 break-all max-w-[180px]">{formatValue(diff?.from)}</td>
                              <td className="px-1 py-2 text-muted-foreground"><ArrowRight className="h-3 w-3" /></td>
                              <td className="px-3 py-2 text-green-600 dark:text-green-400 break-all max-w-[180px]">{formatValue(diff?.to)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}

              {/* Other details */}
              {selectedLog.details && Object.keys(selectedLog.details).filter(k => k !== 'changes').length > 0 && (
                <>
                  <Separator />
                  <div>
                    <div className="flex items-center gap-1.5 mb-2">
                      <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Additional Info</p>
                    </div>
                    <div className="space-y-1 max-h-[200px] overflow-y-auto">
                      {Object.entries(selectedLog.details)
                        .filter(([k]) => k !== 'changes')
                        .map(([key, value]) => (
                          <div key={key} className="flex items-start justify-between gap-4 py-1.5 border-b border-border/50 last:border-0">
                            <span className="text-xs font-medium text-muted-foreground capitalize min-w-[100px]">{key.replace(/_/g, ' ')}</span>
                            <span className="text-sm text-foreground text-right break-all">{formatValue(value)}</span>
                          </div>
                        ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
