import { useState, useMemo } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Shimmer } from '@/components/ui/shimmer';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, AreaChart, Area, Legend,
} from 'recharts';
import {
  TrendingUp, TrendingDown, ShoppingCart, Users, DollarSign, Package,
  ArrowUpRight, ArrowDownRight, Percent, CreditCard, BarChart3,
} from 'lucide-react';
import { format, subDays, startOfMonth, endOfMonth, subMonths, startOfWeek, endOfWeek } from 'date-fns';

const COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d8', '#ec4899', '#f97316'];

type DateRange = '7d' | '30d' | '90d' | 'this_month' | 'last_month';

function getDateRange(range: DateRange): { from: Date; to: Date } {
  const now = new Date();
  switch (range) {
    case '7d': return { from: subDays(now, 7), to: now };
    case '30d': return { from: subDays(now, 30), to: now };
    case '90d': return { from: subDays(now, 90), to: now };
    case 'this_month': return { from: startOfMonth(now), to: now };
    case 'last_month': return { from: startOfMonth(subMonths(now, 1)), to: endOfMonth(subMonths(now, 1)) };
  }
}

function KPICard({ title, value, change, icon: Icon, prefix = '', suffix = '' }: {
  title: string; value: string | number; change?: number; icon: any; prefix?: string; suffix?: string;
}) {
  const isPositive = (change ?? 0) >= 0;
  return (
    <Card className="relative overflow-hidden">
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{title}</p>
            <p className="text-2xl font-bold text-foreground mt-1">{prefix}{typeof value === 'number' ? value.toLocaleString() : value}{suffix}</p>
            {change !== undefined && (
              <div className={`flex items-center gap-1 mt-1 text-xs font-medium ${isPositive ? 'text-emerald-600' : 'text-red-500'}`}>
                {isPositive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                {Math.abs(change).toFixed(1)}% vs prev period
              </div>
            )}
          </div>
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Icon className="h-5 w-5 text-primary" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Reports2() {
  const [dateRange, setDateRange] = useState<DateRange>('30d');
  const { from, to } = getDateRange(dateRange);
  const fromStr = from.toISOString();
  const toStr = to.toISOString();

  // Fetch orders
  const { data: orders = [], isLoading: ordersLoading } = useQuery({
    queryKey: ['reports2-orders', fromStr, toStr],
    queryFn: async () => {
      const { data } = await supabase
        .from('orders')
        .select('id, total, subtotal, discount, shipping_charge, tax, status, payment_status, payment_method, created_at, user_id')
        .gte('created_at', fromStr)
        .lte('created_at', toStr)
        .order('created_at', { ascending: true });
      return data || [];
    },
  });

  // Fetch order items for product analytics
  const { data: orderItems = [] } = useQuery({
    queryKey: ['reports2-order-items', fromStr, toStr],
    queryFn: async () => {
      const orderIds = orders.map(o => o.id);
      if (orderIds.length === 0) return [];
      const { data } = await supabase
        .from('order_items')
        .select('product_name, product_id, quantity, total, price')
        .in('order_id', orderIds);
      return data || [];
    },
    enabled: orders.length > 0,
  });

  // Fetch expenses
  const { data: expenses = [] } = useQuery({
    queryKey: ['reports2-expenses', fromStr, toStr],
    queryFn: async () => {
      const { data } = await supabase
        .from('expenses')
        .select('amount, category, date')
        .gte('date', format(from, 'yyyy-MM-dd'))
        .lte('date', format(to, 'yyyy-MM-dd'));
      return data || [];
    },
  });

  // Fetch customers
  const { data: customers = [] } = useQuery({
    queryKey: ['reports2-customers', fromStr, toStr],
    queryFn: async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id, user_id, created_at')
        .gte('created_at', fromStr)
        .lte('created_at', toStr);
      return data || [];
    },
  });

  // Compute analytics
  const analytics = useMemo(() => {
    const totalRevenue = orders.reduce((s, o) => s + Number(o.total || 0), 0);
    const totalOrders = orders.length;
    const totalDiscount = orders.reduce((s, o) => s + Number(o.discount || 0), 0);
    const totalExpenses = expenses.reduce((s, e) => s + Number(e.amount || 0), 0);
    const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
    const paidOrders = orders.filter(o => o.payment_status === 'paid');
    const paidRevenue = paidOrders.reduce((s, o) => s + Number(o.total || 0), 0);
    const profit = paidRevenue - totalExpenses;

    // Revenue by day
    const revenueByDay: Record<string, number> = {};
    const ordersByDay: Record<string, number> = {};
    orders.forEach(o => {
      const day = format(new Date(o.created_at), 'MMM dd');
      revenueByDay[day] = (revenueByDay[day] || 0) + Number(o.total || 0);
      ordersByDay[day] = (ordersByDay[day] || 0) + 1;
    });
    const revenueTrend = Object.entries(revenueByDay).map(([date, revenue]) => ({
      date, revenue: Math.round(revenue), orders: ordersByDay[date] || 0,
    }));

    // Top products
    const productMap: Record<string, { name: string; qty: number; revenue: number }> = {};
    orderItems.forEach(item => {
      const key = item.product_id || item.product_name;
      if (!productMap[key]) productMap[key] = { name: item.product_name, qty: 0, revenue: 0 };
      productMap[key].qty += Number(item.quantity || 0);
      productMap[key].revenue += Number(item.total || 0);
    });
    const topProducts = Object.values(productMap)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 8);

    // Order status distribution
    const statusMap: Record<string, number> = {};
    orders.forEach(o => {
      statusMap[o.status || 'unknown'] = (statusMap[o.status || 'unknown'] || 0) + 1;
    });
    const statusDist = Object.entries(statusMap).map(([name, value]) => ({ name, value }));

    // Payment method distribution
    const payMethodMap: Record<string, number> = {};
    orders.forEach(o => {
      const m = o.payment_method || 'unknown';
      payMethodMap[m] = (payMethodMap[m] || 0) + 1;
    });
    const paymentDist = Object.entries(payMethodMap).map(([name, value]) => ({ name, value }));

    // Expense categories
    const expCatMap: Record<string, number> = {};
    expenses.forEach(e => {
      expCatMap[e.category] = (expCatMap[e.category] || 0) + Number(e.amount || 0);
    });
    const expenseDist = Object.entries(expCatMap).map(([name, value]) => ({ name, value: Math.round(value) }));

    // Customer analytics
    const uniqueCustomers = new Set(orders.map(o => o.user_id).filter(Boolean)).size;
    const repeatCustomerMap: Record<string, number> = {};
    orders.forEach(o => {
      if (o.user_id) repeatCustomerMap[o.user_id] = (repeatCustomerMap[o.user_id] || 0) + 1;
    });
    const repeatCustomers = Object.values(repeatCustomerMap).filter(c => c > 1).length;
    const newCustomers = customers.length;

    // Discount analysis
    const ordersWithDiscount = orders.filter(o => Number(o.discount || 0) > 0).length;
    const discountRate = totalOrders > 0 ? (ordersWithDiscount / totalOrders) * 100 : 0;

    return {
      totalRevenue, totalOrders, totalDiscount, totalExpenses, avgOrderValue,
      profit, revenueTrend, topProducts, statusDist, paymentDist, expenseDist,
      uniqueCustomers, repeatCustomers, newCustomers, discountRate, paidRevenue,
    };
  }, [orders, orderItems, expenses, customers]);

  const isLoading = ordersLoading;

  return (
    <AdminLayout title="Analytics Dashboard" description="Store performance overview">
      {/* Date Range Slicer */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-primary" />
          <span className="text-sm font-medium text-muted-foreground">Period:</span>
        </div>
        <Select value={dateRange} onValueChange={(v) => setDateRange(v as DateRange)}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7d">Last 7 Days</SelectItem>
            <SelectItem value="30d">Last 30 Days</SelectItem>
            <SelectItem value="90d">Last 90 Days</SelectItem>
            <SelectItem value="this_month">This Month</SelectItem>
            <SelectItem value="last_month">Last Month</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[1,2,3,4,5,6].map(i => <Shimmer key={i} className="h-28 rounded-xl" />)}
        </div>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4 mb-6">
            <KPICard title="Total Revenue" value={`₹${Math.round(analytics.totalRevenue).toLocaleString()}`} icon={DollarSign} />
            <KPICard title="Total Orders" value={analytics.totalOrders} icon={ShoppingCart} />
            <KPICard title="Avg Order Value" value={`₹${Math.round(analytics.avgOrderValue).toLocaleString()}`} icon={TrendingUp} />
            <KPICard title="Net Profit" value={`₹${Math.round(analytics.profit).toLocaleString()}`} icon={analytics.profit >= 0 ? TrendingUp : TrendingDown} />
            <KPICard title="Total Expenses" value={`₹${Math.round(analytics.totalExpenses).toLocaleString()}`} icon={CreditCard} />
            <KPICard title="Discounts Given" value={`₹${Math.round(analytics.totalDiscount).toLocaleString()}`} icon={Percent} />
          </div>

          {/* Row 1: Revenue Trend + Top Products */}
          <div className="grid lg:grid-cols-3 gap-6 mb-6">
            <Card className="lg:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">Revenue & Orders Trend</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <AreaChart data={analytics.revenueTrend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                    <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                    <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))' }} />
                    <Area type="monotone" dataKey="revenue" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.15} strokeWidth={2} name="Revenue (₹)" />
                    <Area type="monotone" dataKey="orders" stroke="#22c55e" fill="#22c55e" fillOpacity={0.1} strokeWidth={2} name="Orders" yAxisId={0} />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">Most Bought Products</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 max-h-[260px] overflow-y-auto">
                  {analytics.topProducts.map((p, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <span className="text-xs font-bold text-muted-foreground w-5">{i + 1}.</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{p.name}</p>
                        <p className="text-xs text-muted-foreground">{p.qty} sold · ₹{Math.round(p.revenue).toLocaleString()}</p>
                      </div>
                      <div className="w-20 bg-muted rounded-full h-2">
                        <div
                          className="h-2 rounded-full bg-primary"
                          style={{ width: `${analytics.topProducts[0]?.revenue ? (p.revenue / analytics.topProducts[0].revenue) * 100 : 0}%` }}
                        />
                      </div>
                    </div>
                  ))}
                  {analytics.topProducts.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-8">No product data</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Row 2: Order Status + Payment Methods + Expenses */}
          <div className="grid md:grid-cols-3 gap-6 mb-6">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">Order Status</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={analytics.statusDist} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} innerRadius={40} paddingAngle={3}>
                      {analytics.statusDist.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))' }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex flex-wrap gap-2 justify-center">
                  {analytics.statusDist.map((s, i) => (
                    <Badge key={s.name} variant="outline" className="text-[10px] gap-1">
                      <span className="w-2 h-2 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                      {s.name} ({s.value})
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">Payment Methods</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={analytics.paymentDist} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} innerRadius={40} paddingAngle={3}>
                      {analytics.paymentDist.map((_, i) => <Cell key={i} fill={COLORS[(i + 3) % COLORS.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))' }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex flex-wrap gap-2 justify-center">
                  {analytics.paymentDist.map((s, i) => (
                    <Badge key={s.name} variant="outline" className="text-[10px] gap-1">
                      <span className="w-2 h-2 rounded-full" style={{ background: COLORS[(i + 3) % COLORS.length] }} />
                      {s.name} ({s.value})
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">Expense Breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={analytics.expenseDist} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis type="number" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={80} stroke="hsl(var(--muted-foreground))" />
                    <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))' }} />
                    <Bar dataKey="value" fill="#f59e0b" radius={[0, 6, 6, 0]} name="Amount (₹)" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Row 3: Customer Analytics */}
          <div className="grid md:grid-cols-4 gap-4 mb-6">
            <KPICard title="Unique Buyers" value={analytics.uniqueCustomers} icon={Users} />
            <KPICard title="New Customers" value={analytics.newCustomers} icon={Users} />
            <KPICard title="Repeat Buyers" value={analytics.repeatCustomers} icon={Users} />
            <KPICard title="Discount Usage" value={`${analytics.discountRate.toFixed(1)}%`} icon={Percent} />
          </div>

          {/* Revenue Summary Bar */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Revenue Waterfall</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={[
                  { name: 'Gross Revenue', value: Math.round(analytics.totalRevenue) },
                  { name: 'Discounts', value: -Math.round(analytics.totalDiscount) },
                  { name: 'Paid Revenue', value: Math.round(analytics.paidRevenue) },
                  { name: 'Expenses', value: -Math.round(analytics.totalExpenses) },
                  { name: 'Net Profit', value: Math.round(analytics.profit) },
                ]}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))' }} />
                  <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                    {[
                      { name: 'Gross Revenue', color: '#3b82f6' },
                      { name: 'Discounts', color: '#ef4444' },
                      { name: 'Paid Revenue', color: '#22c55e' },
                      { name: 'Expenses', color: '#f59e0b' },
                      { name: 'Net Profit', color: '#8b5cf6' },
                    ].map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </>
      )}
    </AdminLayout>
  );
}
