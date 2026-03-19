import { useEffect, useState, useMemo } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { DataTable, Column } from '@/components/admin/DataTable';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { Activity, User, Package, ShoppingCart, Users, Receipt, Image, Percent, Truck, Layers, Settings, Filter, Clock, Hash, FileText } from 'lucide-react';
import { format } from 'date-fns';

interface ActivityLog {
  id: string;
  user_id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  details: Record<string, any>;
  created_at: string;
  ip_address: string | null;
  profile?: { full_name: string | null; email: string | null };
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
  product: Package,
  order: ShoppingCart,
  customer: Users,
  category: Package,
  banner: Image,
  coupon: Percent,
  offer: Percent,
  expense: Receipt,
  delivery: Truck,
  bundle: Layers,
  settings: Settings,
};

const ENTITY_TYPES = ['product', 'order', 'customer', 'category', 'banner', 'coupon', 'offer', 'expense', 'delivery', 'bundle', 'settings'];
const ACTIONS = ['create', 'update', 'delete', 'status_change', 'block', 'unblock', 'refund', 'export'];

export default function AdminActivityLog() {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterEntity, setFilterEntity] = useState('all');
  const [filterAction, setFilterAction] = useState('all');
  const [filterDate, setFilterDate] = useState('all');
  const [selectedLog, setSelectedLog] = useState<ActivityLog | null>(null);

  useEffect(() => { fetchLogs(); }, []);

  const fetchLogs = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('activity_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(500);

    if (!error && data) {
      const userIds = [...new Set(data.map((l: any) => l.user_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name, email')
        .in('user_id', userIds);

      const profileMap = new Map((profiles || []).map((p: any) => [p.user_id, p]));
      setLogs(data.map((l: any) => ({
        ...l,
        profile: profileMap.get(l.user_id) || null,
      })));
    }
    setIsLoading(false);
  };

  const filteredLogs = useMemo(() => {
    let result = logs;
    if (filterEntity !== 'all') result = result.filter(l => l.entity_type === filterEntity);
    if (filterAction !== 'all') result = result.filter(l => l.action === filterAction);
    if (filterDate !== 'all') {
      const now = new Date();
      const days = parseInt(filterDate);
      const start = new Date(now);
      start.setDate(start.getDate() - days);
      result = result.filter(l => new Date(l.created_at) >= start);
    }
    return result;
  }, [logs, filterEntity, filterAction, filterDate]);

  const stats = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayCount = logs.filter(l => new Date(l.created_at) >= today).length;
    const creates = logs.filter(l => l.action === 'create').length;
    const updates = logs.filter(l => l.action === 'update' || l.action === 'status_change').length;
    const deletes = logs.filter(l => l.action === 'delete').length;
    return { total: logs.length, todayCount, creates, updates, deletes };
  }, [logs]);

  const getDescription = (log: ActivityLog) => {
    const name = log.details?.name || log.details?.order_number || log.details?.code || log.entity_id || '';
    const entityLabel = log.entity_type.charAt(0).toUpperCase() + log.entity_type.slice(1);

    switch (log.action) {
      case 'create': return `Created ${entityLabel}: ${name}`;
      case 'update': return `Updated ${entityLabel}: ${name}`;
      case 'delete': return `Deleted ${entityLabel}: ${name}`;
      case 'status_change':
        return `Changed ${entityLabel} status: ${log.details?.from || '?'} → ${log.details?.to || '?'}`;
      case 'block': return `Blocked customer: ${name}`;
      case 'unblock': return `Unblocked customer: ${name}`;
      case 'refund': return `Refunded: ${name}`;
      case 'export': return `Exported ${entityLabel}`;
      default: return `${log.action} on ${entityLabel}`;
    }
  };

  const columns: Column<ActivityLog>[] = [
    {
      key: 'created_at',
      header: 'Time',
      className: 'w-[160px]',
      render: (l) => (
        <span className="text-xs text-muted-foreground">
          {format(new Date(l.created_at), 'dd MMM yyyy, HH:mm')}
        </span>
      ),
    },
    {
      key: 'user_id',
      header: 'User',
      className: 'w-[150px]',
      render: (l) => (
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-primary text-[10px] font-bold">
            {(l.profile?.full_name?.[0] || l.profile?.email?.[0] || '?').toUpperCase()}
          </div>
          <span className="text-sm truncate">{l.profile?.full_name || l.profile?.email || 'Unknown'}</span>
        </div>
      ),
    },
    {
      key: 'action',
      header: 'Action',
      className: 'w-[120px]',
      render: (l) => (
        <Badge className={`text-[10px] border-0 ${ACTION_COLORS[l.action] || 'bg-muted text-muted-foreground'}`}>
          {l.action.replace('_', ' ').toUpperCase()}
        </Badge>
      ),
    },
    {
      key: 'entity_type',
      header: 'Entity',
      className: 'w-[100px]',
      render: (l) => {
        const Icon = ENTITY_ICONS[l.entity_type] || Activity;
        return (
          <div className="flex items-center gap-1.5 text-sm">
            <Icon className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="capitalize">{l.entity_type}</span>
          </div>
        );
      },
    },
    {
      key: 'details',
      header: 'Description',
      render: (l) => (
        <span className="text-sm text-muted-foreground">{getDescription(l)}</span>
      ),
    },
  ];

  // Render detail key-value pairs from log.details
  const renderDetailValue = (key: string, value: any): string => {
    if (value === null || value === undefined) return '-';
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  };

  return (
    <AdminLayout
      title="Activity Log"
      description="Audit trail of all admin actions"
    >
      <div className="space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">Today</CardTitle>
            </CardHeader>
            <CardContent><p className="text-2xl font-bold">{stats.todayCount}</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">Creates</CardTitle>
            </CardHeader>
            <CardContent><p className="text-2xl font-bold text-green-600">{stats.creates}</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">Updates</CardTitle>
            </CardHeader>
            <CardContent><p className="text-2xl font-bold text-blue-600">{stats.updates}</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">Deletes</CardTitle>
            </CardHeader>
            <CardContent><p className="text-2xl font-bold text-red-600">{stats.deletes}</p></CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          <Select value={filterEntity} onValueChange={setFilterEntity}>
            <SelectTrigger className="w-[150px]">
              <Filter className="h-3 w-3 mr-1" /><SelectValue placeholder="Entity" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Entities</SelectItem>
              {ENTITY_TYPES.map(e => <SelectItem key={e} value={e} className="capitalize">{e}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterAction} onValueChange={setFilterAction}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Action" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Actions</SelectItem>
              {ACTIONS.map(a => <SelectItem key={a} value={a} className="capitalize">{a.replace('_', ' ')}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterDate} onValueChange={setFilterDate}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Date Range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Time</SelectItem>
              <SelectItem value="1">Today</SelectItem>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        <DataTable<ActivityLog>
          columns={columns}
          data={filteredLogs}
          isLoading={isLoading}
          onRowClick={(log) => setSelectedLog(log)}
          searchable
          searchPlaceholder="Search activity..."
          searchKeys={['action', 'entity_type'] as any}
          getRowId={(l) => l.id}
          emptyMessage="No activity logged yet. Admin actions will appear here automatically."
        />
      </div>

      {/* Detail Dialog */}
      <Dialog open={!!selectedLog} onOpenChange={(open) => { if (!open) setSelectedLog(null); }}>
        <DialogContent className="max-w-lg">
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
              {/* Summary banner */}
              <div className="p-3 rounded-lg bg-muted/50 border">
                <p className="text-sm font-semibold text-foreground">{getDescription(selectedLog)}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {format(new Date(selectedLog.created_at), 'dd MMMM yyyy, hh:mm:ss a')}
                </p>
              </div>

              <Separator />

              {/* Key info grid */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <User className="h-3 w-3" /> Performed By
                  </div>
                  <p className="text-sm font-medium text-foreground">
                    {selectedLog.profile?.full_name || selectedLog.profile?.email || 'Unknown User'}
                  </p>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Activity className="h-3 w-3" /> Action
                  </div>
                  <Badge className={`text-[10px] border-0 ${ACTION_COLORS[selectedLog.action] || 'bg-muted text-muted-foreground'}`}>
                    {selectedLog.action.replace('_', ' ').toUpperCase()}
                  </Badge>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Package className="h-3 w-3" /> Entity Type
                  </div>
                  <p className="text-sm font-medium text-foreground capitalize">{selectedLog.entity_type}</p>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Hash className="h-3 w-3" /> Entity ID
                  </div>
                  <p className="text-xs font-mono text-foreground break-all">{selectedLog.entity_id || '-'}</p>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" /> Timestamp
                  </div>
                  <p className="text-sm text-foreground">
                    {format(new Date(selectedLog.created_at), 'dd MMM yyyy, hh:mm:ss a')}
                  </p>
                </div>
                {selectedLog.ip_address && (
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      IP Address
                    </div>
                    <p className="text-sm font-mono text-foreground">{selectedLog.ip_address}</p>
                  </div>
                )}
              </div>

              {/* Details section */}
              {selectedLog.details && Object.keys(selectedLog.details).length > 0 && (
                <>
                  <Separator />
                  <div>
                    <div className="flex items-center gap-1.5 mb-3">
                      <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Change Details</p>
                    </div>
                    <div className="space-y-2 max-h-[300px] overflow-y-auto">
                      {Object.entries(selectedLog.details).map(([key, value]) => (
                        <div key={key} className="flex items-start justify-between gap-4 py-1.5 border-b border-border/50 last:border-0">
                          <span className="text-xs font-medium text-muted-foreground capitalize min-w-[100px]">
                            {key.replace(/_/g, ' ')}
                          </span>
                          <span className="text-sm text-foreground text-right break-all">
                            {renderDetailValue(key, value)}
                          </span>
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
