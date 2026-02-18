import { useEffect, useState } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { ShimmerStats, ShimmerCard } from '@/components/ui/shimmer';
import { BarChart3, TrendingUp, TrendingDown, Package, DollarSign, Users, ShoppingCart, Download, Calendar, ArrowUpRight, ArrowDownRight, Percent, CreditCard, Truck, Star } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, AreaChart, Area, Legend } from 'recharts';

export default function AdminReports() {
  const [dateRange, setDateRange] = useState('30');
  const [salesData, setSalesData] = useState<any[]>([]);
  const [topProducts, setTopProducts] = useState<any[]>([]);
  const [categoryData, setCategoryData] = useState<any[]>([]);
  const [orderStatusData, setOrderStatusData] = useState<any[]>([]);
  const [paymentMethodData, setPaymentMethodData] = useState<any[]>([]);
  const [stats, setStats] = useState({
    totalRevenue: 0,
    totalOrders: 0,
    totalProducts: 0,
    totalCustomers: 0,
    avgOrderValue: 0,
    totalExpenses: 0,
    profit: 0,
    returnRate: 0,
    codOrders: 0,
    onlineOrders: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316'];

  useEffect(() => {
    fetchReportData();
  }, [dateRange]);

  const fetchReportData = async () => {
    setIsLoading(true);

    const daysAgo = parseInt(dateRange);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysAgo);

    const [ordersRes, productsRes, customersRes, categoriesRes, expensesRes] = await Promise.all([
      supabase.from('orders').select('*, order_items(*)').gte('created_at', startDate.toISOString()).order('created_at'),
      supabase.from('products').select('*'),
      supabase.from('profiles').select('id'),
      supabase.from('categories').select('*'),
      supabase.from('expenses').select('*').gte('date', startDate.toISOString().split('T')[0]),
    ]);

    const ordersData = ordersRes.data || [];
    const productsData = productsRes.data || [];
    const customersData = customersRes.data || [];
    const expensesData = expensesRes.data || [];

    const totalRevenue = ordersData.reduce((sum, o) => sum + Number(o.total), 0);
    const totalExpenses = expensesData.reduce((sum, e) => sum + Number(e.amount), 0);
    const avgOrderValue = ordersData.length > 0 ? totalRevenue / ordersData.length : 0;
    const returnedOrders = ordersData.filter(o => o.status === 'returned' || o.status === 'cancelled').length;
    const codOrders = ordersData.filter(o => o.payment_method === 'cod').length;

    setStats({
      totalRevenue,
      totalOrders: ordersData.length,
      totalProducts: productsData.length,
      totalCustomers: customersData.length,
      avgOrderValue,
      totalExpenses,
      profit: totalRevenue - totalExpenses,
      returnRate: ordersData.length > 0 ? (returnedOrders / ordersData.length) * 100 : 0,
      codOrders,
      onlineOrders: ordersData.length - codOrders,
    });

    // Daily sales data
    const dailySales: Record<string, { revenue: number; orders: number; expenses: number }> = {};
    ordersData.forEach((order) => {
      const date = new Date(order.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      if (!dailySales[date]) dailySales[date] = { revenue: 0, orders: 0, expenses: 0 };
      dailySales[date].revenue += Number(order.total);
      dailySales[date].orders += 1;
    });
    expensesData.forEach((exp) => {
      const date = new Date(exp.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      if (!dailySales[date]) dailySales[date] = { revenue: 0, orders: 0, expenses: 0 };
      dailySales[date].expenses += Number(exp.amount);
    });
    setSalesData(Object.entries(dailySales).map(([date, data]) => ({ date, ...data, profit: data.revenue - data.expenses })));

    // Top products
    const productSales: Record<string, { name: string; sales: number; revenue: number }> = {};
    ordersData.forEach((order) => {
      (order.order_items || []).forEach((item: any) => {
        if (!productSales[item.product_name]) productSales[item.product_name] = { name: item.product_name, sales: 0, revenue: 0 };
        productSales[item.product_name].sales += item.quantity;
        productSales[item.product_name].revenue += Number(item.total);
      });
    });
    setTopProducts(Object.values(productSales).sort((a, b) => b.revenue - a.revenue).slice(0, 10));

    // Category distribution
    const categorySales: Record<string, number> = {};
    ordersData.forEach((order) => {
      (order.order_items || []).forEach((item: any) => {
        const product = productsData.find(p => p.id === item.product_id);
        const category = categoriesRes.data?.find(c => c.id === product?.category_id);
        const catName = category?.name || 'Uncategorized';
        categorySales[catName] = (categorySales[catName] || 0) + Number(item.total);
      });
    });
    setCategoryData(Object.entries(categorySales).map(([name, value]) => ({ name, value })));

    // Order status distribution
    const statusCounts: Record<string, number> = {};
    ordersData.forEach((o) => {
      statusCounts[o.status] = (statusCounts[o.status] || 0) + 1;
    });
    setOrderStatusData(Object.entries(statusCounts).map(([name, value]) => ({ name: name.charAt(0).toUpperCase() + name.slice(1), value })));

    // Payment method distribution
    const paymentCounts: Record<string, number> = {};
    ordersData.forEach((o) => {
      const method = o.payment_method || 'unknown';
      paymentCounts[method] = (paymentCounts[method] || 0) + 1;
    });
    setPaymentMethodData(Object.entries(paymentCounts).map(([name, value]) => ({ name: name.toUpperCase(), value })));

    setIsLoading(false);
  };

  const exportToCSV = () => {
    const headers = ['Date', 'Orders', 'Revenue', 'Expenses', 'Profit'];
    const rows = salesData.map(d => [d.date, d.orders, d.revenue, d.expenses || 0, d.profit || 0]);
    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `report-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  const StatCard = ({ title, value, icon: Icon, trend, subtitle, color }: any) => (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <div className={`p-2 rounded-lg ${color || 'bg-primary/10'}`}>
            <Icon className={`h-5 w-5 ${color ? 'text-white' : 'text-primary'}`} />
          </div>
          {trend !== undefined && (
            <div className={`flex items-center text-sm ${trend >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {trend >= 0 ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
              {Math.abs(trend)}%
            </div>
          )}
        </div>
        <div className="mt-3">
          <p className="text-2xl font-bold">{value}</p>
          <p className="text-sm text-muted-foreground">{title}</p>
          {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
        </div>
      </CardContent>
    </Card>
  );

  return (
    <AdminLayout
      title="Reports & Analytics"
      description="Comprehensive business analytics and insights"
      actions={
        <div className="flex gap-3">
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-40">
              <Calendar className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
              <SelectItem value="365">Last year</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={exportToCSV}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      }
    >
      {isLoading ? (
        <div className="space-y-6">
          <ShimmerStats />
          <div className="grid grid-cols-2 gap-6">
            <ShimmerCard className="h-80" />
            <ShimmerCard className="h-80" />
          </div>
        </div>
      ) : (
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="revenue">Revenue & P&L</TabsTrigger>
            <TabsTrigger value="orders">Orders</TabsTrigger>
            <TabsTrigger value="products">Products</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              <StatCard title="Total Revenue" value={`₹${stats.totalRevenue.toLocaleString()}`} icon={DollarSign} />
              <StatCard title="Total Orders" value={stats.totalOrders} icon={ShoppingCart} />
              <StatCard title="Avg Order Value" value={`₹${stats.avgOrderValue.toFixed(0)}`} icon={TrendingUp} />
              <StatCard title="Total Customers" value={stats.totalCustomers} icon={Users} />
              <StatCard title="Net Profit" value={`₹${stats.profit.toLocaleString()}`} icon={stats.profit >= 0 ? TrendingUp : TrendingDown} />
              <StatCard title="Return Rate" value={`${stats.returnRate.toFixed(1)}%`} icon={Percent} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Revenue vs Expenses</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={salesData}>
                        <defs>
                          <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="date" className="text-xs" />
                        <YAxis className="text-xs" />
                        <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }} />
                        <Legend />
                        <Area type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" fill="url(#colorRevenue)" name="Revenue" />
                        <Line type="monotone" dataKey="expenses" stroke="#EF4444" name="Expenses" strokeWidth={2} dot={false} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Category Distribution</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={categoryData}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={100}
                          fill="#8884d8"
                          dataKey="value"
                          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        >
                          {categoryData.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value: number) => [`₹${value.toLocaleString()}`, 'Revenue']} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Quick Insights */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-muted-foreground">Payment Split</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">COD</span>
                      <span className="font-medium">{stats.codOrders}</span>
                    </div>
                    <Progress value={stats.totalOrders > 0 ? (stats.codOrders / stats.totalOrders) * 100 : 0} className="h-2" />
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Online</span>
                      <span className="font-medium">{stats.onlineOrders}</span>
                    </div>
                    <Progress value={stats.totalOrders > 0 ? (stats.onlineOrders / stats.totalOrders) * 100 : 0} className="h-2" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-muted-foreground">Order Status</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {orderStatusData.slice(0, 5).map((item) => (
                      <div key={item.name} className="flex items-center justify-between">
                        <Badge variant="outline" className="text-xs">{item.name}</Badge>
                        <span className="font-medium text-sm">{item.value}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-muted-foreground">P&L Summary</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Revenue</span>
                      <span className="text-green-600 font-medium">+₹{stats.totalRevenue.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Expenses</span>
                      <span className="text-red-600 font-medium">-₹{stats.totalExpenses.toLocaleString()}</span>
                    </div>
                    <div className="border-t pt-2 flex justify-between font-semibold">
                      <span>Net Profit</span>
                      <span className={stats.profit >= 0 ? 'text-green-600' : 'text-red-600'}>
                        ₹{stats.profit.toLocaleString()}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="revenue" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Revenue & Profit Trend</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-96">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={salesData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="date" className="text-xs" />
                      <YAxis className="text-xs" />
                      <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }} />
                      <Legend />
                      <Bar dataKey="revenue" fill="hsl(var(--primary))" name="Revenue" />
                      <Bar dataKey="expenses" fill="#EF4444" name="Expenses" />
                      <Bar dataKey="profit" fill="#10B981" name="Profit" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="orders" className="space-y-6">
            <div className="grid lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Daily Orders</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={salesData}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="date" className="text-xs" />
                        <YAxis className="text-xs" />
                        <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }} />
                        <Line type="monotone" dataKey="orders" stroke="hsl(var(--primary))" strokeWidth={2} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Order Status Distribution</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={orderStatusData} cx="50%" cy="50%" outerRadius={100} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                          {orderStatusData.map((_, index) => (
                            <Cell key={index} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="products" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Top Selling Products</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-96">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={topProducts} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis type="number" className="text-xs" />
                      <YAxis dataKey="name" type="category" width={150} className="text-xs" />
                      <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }} formatter={(value: number) => [`₹${value.toLocaleString()}`, 'Revenue']} />
                      <Bar dataKey="revenue" fill="hsl(var(--primary))" name="Revenue" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {topProducts.slice(0, 6).map((product, index) => (
                <Card key={index}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
                          #{index + 1}
                        </div>
                        <div>
                          <p className="font-medium text-sm">{product.name}</p>
                          <p className="text-xs text-muted-foreground">{product.sales} units sold</p>
                        </div>
                      </div>
                      <p className="font-bold">₹{product.revenue.toLocaleString()}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      )}
    </AdminLayout>
  );
}
