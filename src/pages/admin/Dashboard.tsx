import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
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
  Zap,
  RotateCcw,
  XCircle,
  PackageX,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { Order, Product } from '@/types/database';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts';
import { useAuth } from '@/hooks/useAuth';

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

const COLORS = ['hsl(38, 92%, 50%)', 'hsl(280, 65%, 60%)', 'hsl(211, 100%, 50%)'];

export default function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);
  const [lowStockProducts, setLowStockProducts] = useState<Product[]>([]);
  const [salesChart, setSalesChart] = useState<any[]>([]);
  const [orderStatusChart, setOrderStatusChart] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { profile } = useAuth();

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
        todaySales, weekSales, totalOrders: ordersData.length, newOrders, processingOrders, deliveredOrders,
        totalProducts: productsData.length, lowStockProducts: lowStock.length, totalCustomers: customersData.length,
        avgOrderValue, conversionRate, codOrders, onlineOrders: ordersData.length - codOrders,
      });

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

      const statusCounts: Record<string, number> = {};
      ordersData.forEach(o => { statusCounts[o.status] = (statusCounts[o.status] || 0) + 1; });
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
    { key: 'total', header: 'Amount', render: (order) => `₹${Number(order.total).toFixed(2)}` },
    {
      key: 'status', header: 'Status',
      render: (order) => (
        <Badge variant={order.status === 'delivered' ? 'default' : order.status === 'cancelled' ? 'destructive' : 'secondary'}>
          {order.status}
        </Badge>
      ),
    },
    { key: 'created_at', header: 'Date', render: (order) => new Date(order.created_at).toLocaleDateString() },
  ];

  const productColumns: Column<Product>[] = [
    { key: 'name', header: 'Product' },
    { key: 'sku', header: 'SKU' },
    { key: 'stock_quantity', header: 'Stock', render: (product) => <span className="text-destructive font-medium">{product.stock_quantity}</span> },
    { key: 'low_stock_threshold', header: 'Threshold' },
  ];

  const shippingData = [
    { name: 'Pending', value: stats?.newOrders || 0, color: 'hsl(38, 92%, 50%)' },
    { name: 'Packed', value: stats?.processingOrders || 0, color: 'hsl(280, 65%, 60%)' },
    { name: 'Shipped', value: stats?.deliveredOrders || 0, color: 'hsl(211, 100%, 50%)' },
  ];
  const totalShippings = shippingData.reduce((s, d) => s + d.value, 0);

  return (
    <AdminLayout>
      {isLoading ? (
        <div className="space-y-6">
          <ShimmerStats />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6"><ShimmerTable rows={5} columns={4} /><ShimmerTable rows={5} columns={4} /></div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Welcome */}
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-lg bg-muted flex items-center justify-center">
              <Package className="h-7 w-7 text-muted-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-foreground">
                Hello, {profile?.full_name || 'Admin'}
              </h1>
              <p className="text-sm text-muted-foreground">Store Dashboard</p>
            </div>
          </div>

          {/* Tabs */}
          <Tabs defaultValue="dashboard">
            <TabsList className="bg-transparent border-b border-border rounded-none p-0 h-auto gap-0">
              <TabsTrigger value="dashboard" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 pb-2 text-sm">
                Dashboard
              </TabsTrigger>
              <TabsTrigger value="getting-started" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 pb-2 text-sm">
                Getting Started
              </TabsTrigger>
            </TabsList>

            <TabsContent value="dashboard" className="mt-6 space-y-6">
              {/* Overview Section */}
              <div>
                <h2 className="text-base font-semibold text-foreground flex items-center gap-2 mb-4">
                  <Zap className="h-4 w-4 text-amber-500" />
                  Overview
                </h2>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                  <StatCard title="PENDING ORDERS" value={stats?.newOrders || 0} description="To Be Confirmed" icon={<ShoppingCart className="h-5 w-5" />} />
                  <StatCard title="RETURN REQUESTS" value={0} description="To Be Reviewed" icon={<RotateCcw className="h-5 w-5" />} />
                  <StatCard title="PENDING CANCEL REQUEST" value={0} description="To Be Processed" icon={<XCircle className="h-5 w-5" />} />
                  <StatCard title="YET TO RECEIVE PAYMENTS" value={`₹${stats?.todaySales.toLocaleString() || '0'}`} description="To Be Received" icon={<CreditCard className="h-5 w-5" />} />
                  <StatCard title="OUT OF STOCK ITEMS" value={stats?.lowStockProducts || 0} description="To Be Restocked" icon={<PackageX className="h-5 w-5" />} />
                </div>
              </div>

              {/* Charts Row */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Sales Summary */}
                <Card className="lg:col-span-2">
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-base font-semibold">Sales Summary</CardTitle>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs cursor-pointer">This Month</Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-4 mb-4">
                      <span className="text-3xl font-bold text-foreground">
                        {stats?.totalOrders || 0}
                      </span>
                      <div className="flex gap-2">
                        <Badge variant="outline" className="text-xs">Order</Badge>
                        <Badge variant="secondary" className="text-xs">Amount</Badge>
                      </div>
                    </div>
                    <div className="h-56">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={salesChart}>
                          <defs>
                            <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.2} />
                              <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                          <XAxis dataKey="date" tick={{ fontSize: 11 }} className="text-xs" />
                          <YAxis tick={{ fontSize: 11 }} className="text-xs" />
                          <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }} />
                          <Area type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" fill="url(#colorRev)" name="Revenue (₹)" strokeWidth={2} />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                {/* Shipping Overview */}
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-base font-semibold">Shipping Overview</CardTitle>
                    <Badge variant="outline" className="text-xs cursor-pointer">This Month</Badge>
                  </CardHeader>
                  <CardContent>
                    <div className="h-48 flex items-center justify-center">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={shippingData.length > 0 && totalShippings > 0 ? shippingData : [{ name: 'No Data', value: 1, color: 'hsl(var(--muted))' }]}
                            cx="50%" cy="50%"
                            innerRadius={50} outerRadius={75}
                            dataKey="value"
                            startAngle={90} endAngle={-270}
                          >
                            {(totalShippings > 0 ? shippingData : [{ color: 'hsl(var(--muted))' }]).map((entry, i) => (
                              <Cell key={i} fill={entry.color} />
                            ))}
                          </Pie>
                          <text x="50%" y="45%" textAnchor="middle" className="fill-muted-foreground text-[10px] uppercase tracking-wider">
                            ALL SHIPPINGS
                          </text>
                          <text x="50%" y="58%" textAnchor="middle" className="fill-foreground text-xl font-bold">
                            {totalShippings}
                          </text>
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="space-y-2 mt-2">
                      {shippingData.map((item) => (
                        <div key={item.name} className="flex items-center gap-2 text-sm">
                          <div className="h-3 w-3 rounded-sm" style={{ backgroundColor: item.color }} />
                          <span className="text-muted-foreground">{item.name}</span>
                          <span className="ml-auto font-medium">{item.value}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Secondary Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard title="TOTAL PRODUCTS" value={stats?.totalProducts || 0} icon={<Package className="h-5 w-5" />} />
                <StatCard title="TOTAL CUSTOMERS" value={stats?.totalCustomers || 0} icon={<Users className="h-5 w-5" />} />
                <StatCard title="DELIVERED" value={stats?.deliveredOrders || 0} icon={<Truck className="h-5 w-5" />} />
                <StatCard title="WEEK SALES" value={`₹${stats?.weekSales.toLocaleString() || '0'}`} icon={<CreditCard className="h-5 w-5" />} />
              </div>

              {/* Tables */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader><CardTitle className="text-base font-semibold">Recent Orders</CardTitle></CardHeader>
                  <CardContent>
                    <DataTable<Order> columns={orderColumns} data={recentOrders} emptyMessage="No orders yet" getRowId={(o) => o.id} />
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base font-semibold flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-amber-500" /> Low Stock Alert
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <DataTable<Product> columns={productColumns} data={lowStockProducts} emptyMessage="No low stock items" getRowId={(p) => p.id} />
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="getting-started" className="mt-6 space-y-6">
              <Card>
                <CardContent className="p-6">
                  <h3 className="text-lg font-semibold mb-4">🚀 Getting Started Checklist</h3>
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {[
                      { title: 'Add Your Products', desc: 'Create your product catalog with images, pricing, and variants', link: '/admin/products', icon: Package, done: (stats?.totalProducts || 0) > 0 },
                      { title: 'Set Up Categories', desc: 'Organize products into categories for easy browsing', link: '/admin/categories', icon: Package, done: false },
                      { title: 'Configure Store Settings', desc: 'Set your store name, logo, contact info, and policies', link: '/admin/settings', icon: AlertTriangle, done: false },
                      { title: 'Add Banners', desc: 'Upload hero banners for your homepage carousel', link: '/admin/banners', icon: Package, done: false },
                      { title: 'Create Offers', desc: 'Set up discounts and coupon codes to attract customers', link: '/admin/offers', icon: Percent, done: false },
                      { title: 'Review Analytics', desc: 'Monitor page views, product clicks, and customer engagement', link: '/admin/analytics', icon: TrendingUp, done: false },
                    ].map((item, i) => (
                      <Card key={i} className={`border ${item.done ? 'border-[hsl(142,76%,36%)]/30 bg-[hsl(142,76%,36%)]/5' : ''}`}>
                        <CardContent className="p-4">
                          <div className="flex items-start gap-3">
                            <div className={`h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0 ${item.done ? 'bg-[hsl(142,76%,36%)]/10 text-[hsl(142,76%,36%)]' : 'bg-primary/10 text-primary'}`}>
                              <item.icon className="h-4 w-4" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <h4 className="text-sm font-semibold">{item.title}</h4>
                                {item.done && <Badge className="bg-[hsl(142,76%,36%)] text-white text-[9px] px-1.5 py-0">Done</Badge>}
                              </div>
                              <p className="text-xs text-muted-foreground mt-1">{item.desc}</p>
                              {!item.done && (
                                <Button variant="link" size="sm" className="p-0 h-auto mt-2 text-xs" asChild>
                                  <Link to={item.link}>Get Started →</Link>
                                </Button>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      )}
    </AdminLayout>
  );
}
