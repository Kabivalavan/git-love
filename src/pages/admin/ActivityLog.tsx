import { useEffect, useState, useCallback, useMemo } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { DataTable, Column } from '@/components/admin/DataTable';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Activity, User, Package, ShoppingCart, Users, Receipt, Image, Percent, Truck, Layers, Settings, Filter } from 'lucide-react';
import { format } from 'date-fns';

interface ActivityLog {
  id: string;
  user_id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  details: Record<string, any>;
  created_at: string;
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

  useEffect(() => { fetchLogs(); }, []);

  const fetchLogs = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('activity_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(500);

    if (!error && data) {
      // Fetch profiles for user names
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
    const name = log.details?.name || log.details?.order_number || log.entity_id || '';
    const entityLabel = log.entity_type.charAt(0).toUpperCase() + log.entity_type.slice(1);

    switch (log.action) {
      case 'create': return `Created ${entityLabel}: ${name}`;
      case 'update': return `Updated ${entityLabel}: ${name}`;
      case 'delete': return `Deleted ${entityLabel}: ${name}`;
      case 'status_change':
        return `Changed ${entityLabel} status: ${log.details?.from || '?'} → ${log.details?.to || '?'}`;
      case 'block': return `Blocked customer: ${name}`;
      case 'unblock': return `Unblocked customer: ${name}`;
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
          searchable
          searchPlaceholder="Search activity..."
          searchKeys={['action', 'entity_type'] as any}
          getRowId={(l) => l.id}
          emptyMessage="No activity logged yet. Admin actions will appear here automatically."
        />
      </div>
    </AdminLayout>
  );
}
