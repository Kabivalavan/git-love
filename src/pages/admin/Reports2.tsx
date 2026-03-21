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
  PieChart, Pie, Cell, LineChart, Line, Legend,
} from 'recharts';
import {
  TrendingUp, TrendingDown, ShoppingCart, DollarSign,
  ArrowUpRight, ArrowDownRight, CreditCard, BarChart3, Truck,
  AlertTriangle, Wallet, Clock, CheckCircle, XCircle, RefreshCw,
} from 'lucide-react';
import { format, subDays, startOfMonth, endOfMonth, subMonths } from 'date-fns';

const COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d8', '#ec4899', '#f97316'];

type DateRange = '1d' | '7d' | '30d' | '90d' | 'this_month' | 'last_month';

function getDateRange(range: DateRange): { from: Date; to: Date } {
  const now = new Date();
  switch (range) {
    case '1d': return { from: subDays(now, 1), to: now };
    case '7d': return { from: subDays(now, 7), to: now };
    case '30d': return { from: subDays(now, 30), to: now };
    case '90d': return { from: subDays(now, 90), to: now };
    case 'this_month': return { from: startOfMonth(now), to: now };
    case 'last_month': return { from: startOfMonth(subMonths(now, 1)), to: endOfMonth(subMonths(now, 1)) };
  }
}

function getPrevRange(range: DateRange): { from: Date; to: Date } {
  const { from, to } = getDateRange(range);
  const diff = to.getTime() - from.getTime();
  return { from: new Date(from.getTime() - diff), to: new Date(from.getTime()) };
}

function KPICard({ title, value, change, icon: Icon }: {
  title: string; value: string; change?: number; icon: any;
}) {
  const isPositive = (change ?? 0) >= 0;
  return (
    <Card className="relative overflow-hidden">
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="min-w-0">
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">{title}</p>
            <p className="text-xl font-bold text-foreground mt-1 truncate">{value}</p>
            {change !== undefined && (
              <div className={`flex items-center gap-1 mt-1 text-[11px] font-semibold ${isPositive ? 'text-emerald-600' : 'text-red-500'}`}>
                {isPositive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                {Math.abs(change).toFixed(1)}%
              </div>
            )}
          </div>
          <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Icon className="h-4 w-4 text-primary" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function MetricBlock({ label, value, icon: Icon, color }: { label: string; value: string | number; icon: any; color: string }) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card">
      <div className="h-8 w-8 rounded-lg flex items-center justify-center" style={{ background: `${color}20` }}>
        <Icon className="h-4 w-4" style={{ color }} />
      </div>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-bold text-foreground">{value}</p>
      </div>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return <p className="text-sm text-muted-foreground text-center py-10">{message}</p>;
}

export default function Reports2() {
  const [dateRange, setDateRange] = useState<DateRange>('30d');
  const [paymentFilter, setPaymentFilter] = useState<string>('all');
  const [deliveryFilter, setDeliveryFilter] = useState<string>('all');

  const { from, to } = useMemo(() => getDateRange(dateRange), [dateRange]);
  const prev = useMemo(() => getPrevRange(dateRange), [dateRange]);
  const fromStr = useMemo(() => from.toISOString(), [from]);
  const toStr = useMemo(() => to.toISOString(), [to]);
  const prevFromStr = useMemo(() => prev.from.toISOString(), [prev]);
  const prevToStr = useMemo(() => prev.to.toISOString(), [prev]);
  const fromDate = useMemo(() => format(from, 'yyyy-MM-dd'), [from]);
  const toDate = useMemo(() => format(to, 'yyyy-MM-dd'), [to]);

  // Single consolidated query for all dashboard data
  const { data: dashData, isLoading } = useQuery({
    queryKey: ['r2-all', dateRange, fromDate, toDate],
    queryFn: async () => {
      const [
        ordersRes,
        prevOrdersRes,
        expensesRes,
        deliveriesRes,
        paymentsRes,
        refundsRes,
        profilesRes,
        orderItemsRes,
      ] = await Promise.all([
        supabase.from('orders')
          .select('id, total, subtotal, discount, shipping_charge, tax, status, payment_status, payment_method, created_at, user_id')
          .gte('created_at', fromStr)
          .lte('created_at', toStr)
          .order('created_at', { ascending: true }),
        supabase.from('orders')
          .select('id, total, payment_status, payment_method')
          .gte('created_at', prevFromStr)
          .lte('created_at', prevToStr),
        supabase.from('expenses')
          .select('amount, category, date')
          .gte('date', fromDate)
          .lte('date', toDate),
        supabase.from('deliveries')
          .select('id, status, order_id, created_at')
          .gte('created_at', fromStr)
          .lte('created_at', toStr),
        supabase.from('payments')
          .select('id, amount, status, method, order_id, created_at')
          .gte('created_at', fromStr)
          .lte('created_at', toStr),
        supabase.from('refunds')
          .select('id, amount, status, created_at')
          .gte('created_at', fromStr)
          .lte('created_at', toStr),
        supabase.from('profiles')
          .select('id, user_id, full_name, created_at')
          .gte('created_at', fromStr)
          .lte('created_at', toStr),
        supabase.from('order_items')
          .select('order_id, product_name, product_id, quantity, total, price, created_at')
          .gte('created_at', fromStr)
          .lte('created_at', toStr),
      ]);

      const firstError = [
        ordersRes.error,
        prevOrdersRes.error,
        expensesRes.error,
        deliveriesRes.error,
        paymentsRes.error,
        refundsRes.error,
        profilesRes.error,
        orderItemsRes.error,
      ].find(Boolean);

      if (firstError) {
        throw firstError;
      }

      return {
        orders: ordersRes.data || [],
        prevOrders: prevOrdersRes.data || [],
        expenses: expensesRes.data || [],
        deliveries: deliveriesRes.data || [],
        payments: paymentsRes.data || [],
        refunds: refundsRes.data || [],
        customers: profilesRes.data || [],
        orderItems: orderItemsRes.data || [],
      };
    },
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  const orders = dashData?.orders || [];
  const prevOrders = dashData?.prevOrders || [];
  const expenses = dashData?.expenses || [];
  const deliveries = dashData?.deliveries || [];
  const payments = dashData?.payments || [];
  const refunds = dashData?.refunds || [];
  const customers = dashData?.customers || [];
  const orderItems = dashData?.orderItems || [];

  // Apply filters
  const filteredOrders = useMemo(() => {
    let o = orders;
    if (paymentFilter !== 'all') o = o.filter(x => x.payment_method === paymentFilter);
    if (deliveryFilter !== 'all') {
      const delOrderIds = new Set(deliveries.filter(d => d.status === deliveryFilter).map(d => d.order_id));
      o = o.filter(x => delOrderIds.has(x.id));
    }
    return o;
  }, [orders, paymentFilter, deliveryFilter, deliveries]);

  // Analytics computations
  const analytics = useMemo(() => {
    const fo = filteredOrders;
    const totalRevenue = fo.reduce((s, o) => s + Number(o.total || 0), 0);
    const prevRevenue = prevOrders.reduce((s, o) => s + Number(o.total || 0), 0);
    const totalOrders = fo.length;
    const prevTotalOrders = prevOrders.length;
    const totalDiscount = fo.reduce((s, o) => s + Number(o.discount || 0), 0);
    const totalExpenses = expenses.reduce((s, e) => s + Number(e.amount || 0), 0);
    const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
    const prevAOV = prevTotalOrders > 0 ? prevRevenue / prevTotalOrders : 0;
    const paidRevenue = fo.filter(o => o.payment_status === 'paid').reduce((s, o) => s + Number(o.total || 0), 0);
    const profit = paidRevenue - totalExpenses;

    const codOrders = fo.filter(o => o.payment_method === 'cod');
    const onlineOrders = fo.filter(o => o.payment_method === 'online');
    const codPct = totalOrders > 0 ? (codOrders.length / totalOrders * 100) : 0;
    const onlinePct = totalOrders > 0 ? (onlineOrders.length / totalOrders * 100) : 0;
    const pendingDeliveries = deliveries.filter(d => !['delivered', 'failed'].includes(d.status || '')).length;
    const codPendingAmount = fo.filter(o => o.payment_method === 'cod' && o.payment_status !== 'paid').reduce((s, o) => s + Number(o.total || 0), 0);

    const revenueChange = prevRevenue > 0 ? ((totalRevenue - prevRevenue) / prevRevenue) * 100 : 0;
    const ordersChange = prevTotalOrders > 0 ? ((totalOrders - prevTotalOrders) / prevTotalOrders) * 100 : 0;
    const aovChange = prevAOV > 0 ? ((avgOrderValue - prevAOV) / prevAOV) * 100 : 0;

    // Revenue trend by day
    const revenueByDay: Record<string, { revenue: number; profit: number; orders: number }> = {};
    fo.forEach(o => {
      const day = format(new Date(o.created_at), 'MMM dd');
      if (!revenueByDay[day]) revenueByDay[day] = { revenue: 0, profit: 0, orders: 0 };
      revenueByDay[day].revenue += Number(o.total || 0);
      revenueByDay[day].orders += 1;
      if (o.payment_status === 'paid') revenueByDay[day].profit += Number(o.total || 0);
    });
    const totalDays = Object.keys(revenueByDay).length || 1;
    const dailyExpense = totalExpenses / totalDays;
    const revenueTrend = Object.entries(revenueByDay).map(([date, d]) => ({
      date,
      revenue: Math.round(d.revenue),
      profit: Math.round(d.profit - dailyExpense),
      orders: d.orders,
    }));

    // Order funnel
    const statusCounts: Record<string, number> = {};
    fo.forEach(o => { statusCounts[o.status || 'new'] = (statusCounts[o.status || 'new'] || 0) + 1; });
    const funnelData = [
      { name: 'New', value: statusCounts['new'] || 0, fill: '#3b82f6' },
      { name: 'Confirmed', value: statusCounts['confirmed'] || 0, fill: '#22c55e' },
      { name: 'Packed', value: statusCounts['packed'] || 0, fill: '#f59e0b' },
      { name: 'Shipped', value: statusCounts['shipped'] || 0, fill: '#8b5cf6' },
      { name: 'Delivered', value: statusCounts['delivered'] || 0, fill: '#06b6d8' },
    ];

    // Top products
    const filteredOrderIds = new Set(fo.map((order) => order.id));
    const filteredOrderItems = orderItems.filter((item: any) => filteredOrderIds.has(item.order_id));
    const productMap: Record<string, { name: string; qty: number; revenue: number }> = {};
    filteredOrderItems.forEach((item: any) => {
      const key = item.product_id || item.product_name;
      if (!productMap[key]) productMap[key] = { name: item.product_name, qty: 0, revenue: 0 };
      productMap[key].qty += Number(item.quantity || 0);
      productMap[key].revenue += Number(item.total || 0);
    });
    const topProducts = Object.values(productMap).sort((a, b) => b.revenue - a.revenue).slice(0, 8);

    // Top customers
    const customerSpend: Record<string, { orders: number; total: number }> = {};
    fo.forEach(o => {
      if (!o.user_id) return;
      if (!customerSpend[o.user_id]) customerSpend[o.user_id] = { orders: 0, total: 0 };
      customerSpend[o.user_id].orders += 1;
      customerSpend[o.user_id].total += Number(o.total || 0);
    });
    const topCustomerIds = Object.entries(customerSpend).sort((a, b) => b[1].total - a[1].total).slice(0, 6);
    const topCustomers = topCustomerIds.map(([uid, data]) => {
      const profile = customers.find((c: any) => c.user_id === uid);
      return { name: profile?.full_name || uid.slice(0, 8), orders: data.orders, total: data.total };
    });

    // Payment split pie
    const paymentSplit = [
      { name: 'COD', value: codOrders.length },
      { name: 'Online', value: onlineOrders.length },
      { name: 'Other', value: totalOrders - codOrders.length - onlineOrders.length },
    ].filter(x => x.value > 0);

    // Expense categories
    const expCatMap: Record<string, number> = {};
    expenses.forEach((e: any) => { expCatMap[e.category] = (expCatMap[e.category] || 0) + Number(e.amount || 0); });
    const expenseDist = Object.entries(expCatMap).map(([name, value]) => ({ name, value: Math.round(value) })).sort((a, b) => b.value - a.value);

    // Delivery status
    const delStatusMap: Record<string, number> = {};
    deliveries.forEach((d: any) => { delStatusMap[d.status || 'pending'] = (delStatusMap[d.status || 'pending'] || 0) + 1; });

    // Cashflow
    const paymentsReceived = payments.filter((p: any) => p.status === 'paid').reduce((s: number, p: any) => s + Number(p.amount || 0), 0);
    const refundTotal = refunds.reduce((s: number, r: any) => s + Number(r.amount || 0), 0);

    // AI Insights
    const insights: string[] = [];
    if (totalOrders > 0 && codPct > 60) insights.push(`⚠️ COD orders at ${codPct.toFixed(0)}% — consider incentivizing online payments`);
    if (topProducts[0]) insights.push(`🔥 "${topProducts[0].name}" generating ₹${Math.round(topProducts[0].revenue).toLocaleString()} revenue`);
    if (totalOrders > 0 && profit < 0) insights.push(`📉 Net profit is negative — review expenses (₹${Math.round(totalExpenses).toLocaleString()})`);
    if (pendingDeliveries > 5) insights.push(`🚚 ${pendingDeliveries} deliveries pending — follow up for faster fulfillment`);
    if (codPendingAmount > 0) insights.push(`💵 ₹${Math.round(codPendingAmount).toLocaleString()} COD payments pending collection`);
    if (revenueChange > 20) insights.push(`📈 Revenue up ${revenueChange.toFixed(0)}% vs previous period — great momentum!`);
    if (revenueChange < -10) insights.push(`📉 Revenue down ${Math.abs(revenueChange).toFixed(0)}% — investigate drop`);
    if (totalRevenue > 0 && totalDiscount > totalRevenue * 0.15) insights.push(`🎯 Discounts are ${((totalDiscount / totalRevenue) * 100).toFixed(0)}% of revenue — review discount strategy`);

    return {
      totalRevenue,
      totalOrders,
      avgOrderValue,
      profit,
      totalExpenses,
      totalDiscount,
      codPct,
      onlinePct,
      pendingDeliveries,
      codPendingAmount,
      revenueChange,
      ordersChange,
      aovChange,
      revenueTrend,
      funnelData,
      topProducts,
      topCustomers,
      paymentSplit,
      expenseDist,
      delStatusMap,
      paymentsReceived,
      refundTotal,
      insights,
      paidRevenue,
    };
  }, [filteredOrders, prevOrders, orderItems, expenses, customers, deliveries, payments, refunds]);

  const fmt = (n: number) => `₹${Math.round(n).toLocaleString()}`;

  return (
    <AdminLayout title="Analytics Dashboard" description="Store performance overview">
      {/* Slicers */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-muted-foreground" />
          <Select value={dateRange} onValueChange={(v) => setDateRange(v as DateRange)}>
            <SelectTrigger className="w-36 h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="1d">Today</SelectItem>
              <SelectItem value="7d">Last 7 Days</SelectItem>
              <SelectItem value="30d">Last 30 Days</SelectItem>
              <SelectItem value="90d">Last 90 Days</SelectItem>
              <SelectItem value="this_month">This Month</SelectItem>
              <SelectItem value="last_month">Last Month</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Select value={paymentFilter} onValueChange={setPaymentFilter}>
          <SelectTrigger className="w-32 h-9"><SelectValue placeholder="Payment" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Payments</SelectItem>
            <SelectItem value="cod">COD</SelectItem>
            <SelectItem value="online">Online</SelectItem>
          </SelectContent>
        </Select>
        <Select value={deliveryFilter} onValueChange={setDeliveryFilter}>
          <SelectTrigger className="w-36 h-9"><SelectValue placeholder="Delivery" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Deliveries</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="in_transit">In Transit</SelectItem>
            <SelectItem value="delivered">Delivered</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[1, 2, 3, 4, 5, 6, 7].map(i => <Shimmer key={i} className="h-24 rounded-xl" />)}
        </div>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3 mb-6">
            <KPICard title="Revenue" value={fmt(analytics.totalRevenue)} change={analytics.revenueChange} icon={DollarSign} />
            <KPICard title="Profit" value={fmt(analytics.profit)} icon={analytics.profit >= 0 ? TrendingUp : TrendingDown} />
            <KPICard title="Orders" value={String(analytics.totalOrders)} change={analytics.ordersChange} icon={ShoppingCart} />
            <KPICard title="AOV" value={fmt(analytics.avgOrderValue)} change={analytics.aovChange} icon={TrendingUp} />
            <KPICard title="COD / Online" value={`${analytics.codPct.toFixed(0)}% / ${analytics.onlinePct.toFixed(0)}%`} icon={CreditCard} />
            <KPICard title="Pending Deliveries" value={String(analytics.pendingDeliveries)} icon={Truck} />
            <KPICard title="COD Pending" value={fmt(analytics.codPendingAmount)} icon={Wallet} />
          </div>

          {/* AI Insights Strip */}
          {analytics.insights.length > 0 && (
            <Card className="mb-6 border-primary/20 bg-primary/5">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="h-4 w-4 text-primary" />
                  <span className="text-xs font-bold uppercase tracking-wider text-primary">AI Insights</span>
                </div>
                <div className="grid md:grid-cols-2 gap-2">
                  {analytics.insights.map((insight, i) => (
                    <p key={i} className="text-sm text-foreground">{insight}</p>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Sales + Profit Trend */}
          <Card className="mb-6">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Sales & Profit Trend</CardTitle>
            </CardHeader>
            <CardContent>
              {analytics.revenueTrend.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={analytics.revenueTrend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                    <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                    <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))' }} />
                    <Legend />
                    <Line type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={2.5} dot={false} name="Revenue (₹)" />
                    <Line type="monotone" dataKey="profit" stroke="#22c55e" strokeWidth={2.5} dot={false} name="Profit (₹)" />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <EmptyState message="No sales data for this period" />
              )}
            </CardContent>
          </Card>

          {/* Funnel + Top Products */}
          <div className="grid lg:grid-cols-2 gap-6 mb-6">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">Order & Payment Funnel</CardTitle>
              </CardHeader>
              <CardContent>
                {analytics.totalOrders > 0 ? (
                  <div className="space-y-2">
                    {analytics.funnelData.map((step) => {
                      const maxVal = Math.max(...analytics.funnelData.map(f => f.value), 1);
                      return (
                        <div key={step.name} className="flex items-center gap-3">
                          <span className="text-xs font-medium w-20 text-muted-foreground">{step.name}</span>
                          <div className="flex-1 bg-muted rounded-full h-6 relative overflow-hidden">
                            <div className="h-6 rounded-full flex items-center px-2 transition-all" style={{ width: `${Math.max(8, (step.value / maxVal) * 100)}%`, background: step.fill }}>
                              <span className="text-[11px] font-bold text-white">{step.value}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <EmptyState message="No orders to show funnel" />
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">Top Products</CardTitle>
              </CardHeader>
              <CardContent>
                {analytics.topProducts.length > 0 ? (
                  <div className="space-y-2.5 max-h-[250px] overflow-y-auto">
                    {analytics.topProducts.map((p, i) => (
                      <div key={i} className="flex items-center gap-3">
                        <span className="text-xs font-bold text-muted-foreground w-5">{i + 1}.</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{p.name}</p>
                          <p className="text-xs text-muted-foreground">{p.qty} sold · {fmt(p.revenue)}</p>
                        </div>
                        <div className="w-16 bg-muted rounded-full h-1.5">
                          <div className="h-1.5 rounded-full bg-primary" style={{ width: `${analytics.topProducts[0]?.revenue ? (p.revenue / analytics.topProducts[0].revenue) * 100 : 0}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyState message="No product sales data yet" />
                )}
              </CardContent>
            </Card>
          </div>

          {/* Top Customers + Payment Split */}
          <div className="grid lg:grid-cols-2 gap-6 mb-6">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">Top Customers</CardTitle>
              </CardHeader>
              <CardContent>
                {analytics.topCustomers.length > 0 ? (
                  <div className="space-y-2.5 max-h-[220px] overflow-y-auto">
                    {analytics.topCustomers.map((c, i) => (
                      <div key={i} className="flex items-center justify-between gap-2 p-2 rounded-lg bg-muted/30">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary flex-shrink-0">{i + 1}</span>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">{c.name}</p>
                            <p className="text-xs text-muted-foreground">{c.orders} orders</p>
                          </div>
                        </div>
                        <span className="text-sm font-bold text-foreground flex-shrink-0">{fmt(c.total)}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyState message="No customer data yet" />
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">COD vs Online Payments</CardTitle>
              </CardHeader>
              <CardContent>
                {analytics.paymentSplit.length > 0 ? (
                  <>
                    <ResponsiveContainer width="100%" height={200}>
                      <PieChart>
                        <Pie data={analytics.paymentSplit} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} innerRadius={40} paddingAngle={3}>
                          {analytics.paymentSplit.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                        </Pie>
                        <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))' }} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="flex flex-wrap gap-2 justify-center">
                      {analytics.paymentSplit.map((s, i) => (
                        <Badge key={s.name} variant="outline" className="text-[10px] gap-1">
                          <span className="w-2 h-2 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                          {s.name} ({s.value})
                        </Badge>
                      ))}
                    </div>
                  </>
                ) : (
                  <EmptyState message="No payment data yet" />
                )}
              </CardContent>
            </Card>
          </div>

          {/* Expenses + Delivery & Cashflow */}
          <div className="grid lg:grid-cols-2 gap-6 mb-6">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">Expense Breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                {analytics.expenseDist.length > 0 ? (
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={analytics.expenseDist} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis type="number" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={80} stroke="hsl(var(--muted-foreground))" />
                      <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))' }} />
                      <Bar dataKey="value" fill="#f59e0b" radius={[0, 6, 6, 0]} name="Amount (₹)" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyState message="No expenses recorded" />
                )}
              </CardContent>
            </Card>

            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold">Delivery Status</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-2">
                    <MetricBlock label="Pending" value={analytics.delStatusMap['pending'] || 0} icon={Clock} color="#f59e0b" />
                    <MetricBlock label="In Transit" value={analytics.delStatusMap['in_transit'] || 0} icon={Truck} color="#3b82f6" />
                    <MetricBlock label="Delivered" value={analytics.delStatusMap['delivered'] || 0} icon={CheckCircle} color="#22c55e" />
                    <MetricBlock label="Failed" value={analytics.delStatusMap['failed'] || 0} icon={XCircle} color="#ef4444" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold">Cashflow</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-2">
                    <MetricBlock label="Received" value={fmt(analytics.paymentsReceived)} icon={DollarSign} color="#22c55e" />
                    <MetricBlock label="COD Pending" value={fmt(analytics.codPendingAmount)} icon={Wallet} color="#f59e0b" />
                    <MetricBlock label="Refunds" value={fmt(analytics.refundTotal)} icon={RefreshCw} color="#ef4444" />
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </>
      )}
    </AdminLayout>
  );
}
