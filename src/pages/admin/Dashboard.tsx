import { useEffect, useState } from 'react';
import { AdminLayout, StatCard } from '@/components/admin/AdminLayout';
import { supabase } from '@/integrations/supabase/client';
import { ShimmerStats, ShimmerTable } from '@/components/ui/shimmer';
import { DataTable, Column } from '@/components/admin/DataTable';
import {
  ShoppingCart,
  DollarSign,
  Package,
  Users,
  TrendingUp,
  AlertTriangle,
  Truck,
  Clock,
  Percent,
  CreditCard,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import type { Order, Product } from '@/types/database';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts';

interface DashboardStats {
  todaySales: number;
  weekSales: number;
  totalOrders: number;
  newOrders: number;
  processingOrders: number;
  deliveredOrders: number;
  totalProducts: number;
  lowStockProducts: number;
  totalCustomers: number;
  avgOrderValue: number;
  conversionRate: number;
  codOrders: number;
  onlineOrders: number;
}

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];

export default function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);
  const [lowStockProducts, setLowStockProducts] = useState<Product[]>([]);
  const [salesChart, setSalesChart] = useState<any[]>([]);
  const [orderStatusChart, setOrderStatusChart] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);

      const [ordersRes, productsRes, customersRes, analyticsRes] = await Promise.all([
        supabase.from('orders').select('*').order('created_at', { ascending: false }),
        supabase.from('products').select('*'),
        supabase.from('profiles').select('id'),
        supabase.from('analytics_events').select('id').eq('event_type', 'page_view').gte('created_at', weekAgo.toISOString()),
      ]);

      const ordersData = (ordersRes.data || []) as unknown as Order[];
      const productsData = (productsRes.data || []) as unknown as Product[];
      const customersData = customersRes.data || [];
      const pageViews = analyticsRes.data?.length || 0;

      const todayOrders = ordersData.filter(o => new Date(o.created_at) >= today);
      const todaySales = todayOrders.reduce((sum, o) => sum + Number(o.total), 0);
      const weekOrders = ordersData.filter(o => new Date(o.created_at) >= weekAgo);
      const weekSales = weekOrders.reduce((sum, o) => sum + Number(o.total), 0);
      const newOrders = ordersData.filter(o => o.status === 'new').length;
      const processingOrders = ordersData.filter(o => o.status === 'confirmed' || o.status === 'packed').length;
      const deliveredOrders = ordersData.filter(o => o.status === 'delivered').length;
      const lowStock = productsData.filter(p => p.stock_quantity <= p.low_stock_threshold);
      const avgOrderValue = ordersData.length > 0 ? ordersData.reduce((s, o) => s + Number(o.total), 0) / ordersData.length : 0;
      const codOrders = ordersData.filter(o => o.payment_method === 'cod').length;
      const conversionRate = pageViews > 0 ? (weekOrders.length / pageViews) * 100 : 0;

      setStats({
        todaySales,
        weekSales,
        totalOrders: ordersData.length,
        newOrders,
        processingOrders,
        deliveredOrders,
        totalProducts: productsData.length,
        lowStockProducts: lowStock.length,
        totalCustomers: customersData.length,
        avgOrderValue,
        conversionRate,
        codOrders,
        onlineOrders: ordersData.length - codOrders,
      });

      // Build 7-day sales chart
      const dailySales: Record<string, { date: string; revenue: number; orders: number }> = {};
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const key = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        dailySales[key] = { date: key, revenue: 0, orders: 0 };
      }
      ordersData.forEach(o => {
        const key = new Date(o.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        if (dailySales[key]) {
          dailySales[key].revenue += Number(o.total);
          dailySales[key].orders += 1;
        }
      });
      setSalesChart(Object.values(dailySales));

      // Order status chart
      const statusCounts: Record<string, number> = {};
      ordersData.forEach(o => {
        statusCounts[o.status] = (statusCounts[o.status] || 0) + 1;
      });
      setOrderStatusChart(Object.entries(statusCounts).map(([name, value]) => ({
        name: name.charAt(0).toUpperCase() + name.slice(1), value
      })));

      setRecentOrders(ordersData.slice(0, 5));
      setLowStockProducts(lowStock.slice(0, 5));
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const orderColumns: Column<Order>[] = [
    { key: 'order_number', header: 'Order #' },
    {
      key: 'total',
      header: 'Amount',
      render: (order) => `₹${Number(order.total).toFixed(2)}`,
    },
    {
      key: 'status',
      header: 'Status',
      render: (order) => (
        <Badge variant={order.status === 'delivered' ? 'default' : order.status === 'cancelled' ? 'destructive' : 'secondary'}>
          {order.status}
        </Badge>
      ),
    },
    {
      key: 'created_at',
      header: 'Date',
      render: (order) => new Date(order.created_at).toLocaleDateString(),
    },
  ];

  const productColumns: Column<Product>[] = [
    { key: 'name', header: 'Product' },
    { key: 'sku', header: 'SKU' },
    {
      key: 'stock_quantity',
      header: 'Stock',
      render: (product) => (
        <span className="text-destructive font-medium">{product.stock_quantity}</span>
      ),
    },
    { key: 'low_stock_threshold', header: 'Threshold' },
  ];

  return (
    <AdminLayout title="Dashboard" description="Overview of your store performance">
      {isLoading ? (
        <div className="space-y-6">
          <ShimmerStats />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ShimmerTable rows={5} columns={4} />
            <ShimmerTable rows={5} columns={4} />
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Primary Stats */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <StatCard title="Today's Sales" value={`₹${stats?.todaySales.toLocaleString() || '0'}`} icon={<DollarSign className="h-5 w-5" />} />
            <StatCard title="New Orders" value={stats?.newOrders || 0} description="Awaiting confirmation" icon={<ShoppingCart className="h-5 w-5" />} />
            <StatCard title="Processing" value={stats?.processingOrders || 0} icon={<Clock className="h-5 w-5" />} />
            <StatCard title="Avg Order" value={`₹${stats?.avgOrderValue.toFixed(0) || '0'}`} icon={<TrendingUp className="h-5 w-5" />} />
            <StatCard title="Conversion" value={`${stats?.conversionRate.toFixed(1) || '0'}%`} description="Visitors → Orders" icon={<Percent className="h-5 w-5" />} />
            <StatCard title="Low Stock" value={stats?.lowStockProducts || 0} description="Need attention" icon={<AlertTriangle className="h-5 w-5 text-amber-500" />} />
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Revenue (Last 7 Days)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={salesChart}>
                      <defs>
                        <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="date" className="text-xs" tick={{ fontSize: 11 }} />
                      <YAxis className="text-xs" tick={{ fontSize: 11 }} />
                      <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }} />
                      <Area type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" fill="url(#colorRev)" name="Revenue (₹)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Order Status</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={orderStatusChart} cx="50%" cy="50%" innerRadius={40} outerRadius={70} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                        {orderStatusChart.map((_, i) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-2 space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">COD Orders</span>
                    <span className="font-medium">{stats?.codOrders || 0}</span>
                  </div>
                  <Progress value={stats && stats.totalOrders > 0 ? (stats.codOrders / stats.totalOrders) * 100 : 0} className="h-1.5" />
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Online Orders</span>
                    <span className="font-medium">{stats?.onlineOrders || 0}</span>
                  </div>
                  <Progress value={stats && stats.totalOrders > 0 ? (stats.onlineOrders / stats.totalOrders) * 100 : 0} className="h-1.5" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Secondary Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard title="Total Products" value={stats?.totalProducts || 0} icon={<Package className="h-5 w-5" />} />
            <StatCard title="Total Customers" value={stats?.totalCustomers || 0} icon={<Users className="h-5 w-5" />} />
            <StatCard title="Delivered" value={stats?.deliveredOrders || 0} icon={<Truck className="h-5 w-5" />} />
            <StatCard title="Week Sales" value={`₹${stats?.weekSales.toLocaleString() || '0'}`} icon={<CreditCard className="h-5 w-5" />} />
          </div>

          {/* Tables */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader><CardTitle className="text-lg">Recent Orders</CardTitle></CardHeader>
              <CardContent>
                <DataTable<Order> columns={orderColumns} data={recentOrders} emptyMessage="No orders yet" getRowId={(o) => o.id} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-amber-500" /> Low Stock Alert
                </CardTitle>
              </CardHeader>
              <CardContent>
                <DataTable<Product> columns={productColumns} data={lowStockProducts} emptyMessage="No low stock items" getRowId={(p) => p.id} />
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}