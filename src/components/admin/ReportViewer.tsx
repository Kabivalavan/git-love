import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { ShimmerCard } from '@/components/ui/shimmer';
import { Download, Calendar } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import type { ReportDefinition } from '@/pages/admin/Reports';

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316'];

interface ReportViewerProps {
  report: ReportDefinition;
}

export function ReportViewer({ report }: ReportViewerProps) {
  const [dateRange, setDateRange] = useState('30');
  const [data, setData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => { fetchData(); }, [report.id, dateRange]);

  const getStartDate = () => {
    const d = new Date();
    d.setDate(d.getDate() - parseInt(dateRange));
    return d;
  };

  const fetchData = async () => {
    setIsLoading(true);
    const startDate = getStartDate();
    let result: any[] = [];

    try {
      switch (report.id) {
        case 'sales-by-customer': {
          const { data: orders } = await supabase.from('orders').select('user_id, total, profiles!inner(full_name, email)').gte('created_at', startDate.toISOString()) as any;
          const grouped: Record<string, any> = {};
          (orders || []).forEach((o: any) => {
            const name = o.profiles?.full_name || o.profiles?.email || 'Unknown';
            if (!grouped[name]) grouped[name] = { name, revenue: 0, orders: 0 };
            grouped[name].revenue += Number(o.total);
            grouped[name].orders += 1;
          });
          result = Object.values(grouped).sort((a: any, b: any) => b.revenue - a.revenue);
          break;
        }
        case 'sales-by-category': {
          const { data: orders } = await supabase.from('orders').select('*, order_items(*, products(category_id, categories(name)))').gte('created_at', startDate.toISOString()) as any;
          const grouped: Record<string, any> = {};
          (orders || []).forEach((o: any) => {
            (o.order_items || []).forEach((item: any) => {
              const cat = item.products?.categories?.name || 'Uncategorized';
              if (!grouped[cat]) grouped[cat] = { name: cat, revenue: 0, units: 0 };
              grouped[cat].revenue += Number(item.total);
              grouped[cat].units += item.quantity;
            });
          });
          result = Object.values(grouped).sort((a: any, b: any) => b.revenue - a.revenue);
          break;
        }
        case 'sales-by-product':
        case 'product-performance': {
          const { data: orders } = await supabase.from('orders').select('*, order_items(*)').gte('created_at', startDate.toISOString());
          const grouped: Record<string, any> = {};
          (orders || []).forEach((o: any) => {
            (o.order_items || []).forEach((item: any) => {
              if (!grouped[item.product_name]) grouped[item.product_name] = { name: item.product_name, revenue: 0, units: 0 };
              grouped[item.product_name].revenue += Number(item.total);
              grouped[item.product_name].units += item.quantity;
            });
          });
          result = Object.values(grouped).sort((a: any, b: any) => b.revenue - a.revenue);
          break;
        }
        case 'sales-summary':
        case 'sales-by-date': {
          const { data: orders } = await supabase.from('orders').select('*').gte('created_at', startDate.toISOString()).order('created_at');
          const daily: Record<string, any> = {};
          (orders || []).forEach((o: any) => {
            const date = new Date(o.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            if (!daily[date]) daily[date] = { date, revenue: 0, orders: 0 };
            daily[date].revenue += Number(o.total);
            daily[date].orders += 1;
          });
          result = Object.values(daily);
          break;
        }
        case 'orders-by-status':
        case 'order-fulfillment': {
          const { data: orders } = await supabase.from('orders').select('status').gte('created_at', startDate.toISOString());
          const grouped: Record<string, number> = {};
          (orders || []).forEach((o: any) => { grouped[o.status] = (grouped[o.status] || 0) + 1; });
          result = Object.entries(grouped).map(([name, value]) => ({ name: name.charAt(0).toUpperCase() + name.slice(1), value }));
          break;
        }
        case 'payments-by-method': {
          const { data: orders } = await supabase.from('orders').select('payment_method, total').gte('created_at', startDate.toISOString());
          const grouped: Record<string, any> = {};
          (orders || []).forEach((o: any) => {
            const m = (o.payment_method || 'unknown').toUpperCase();
            if (!grouped[m]) grouped[m] = { name: m, value: 0, count: 0 };
            grouped[m].value += Number(o.total);
            grouped[m].count += 1;
          });
          result = Object.values(grouped);
          break;
        }
        case 'stock-summary': {
          const { data: products } = await supabase.from('products').select('name, stock_quantity, price, low_stock_threshold');
          result = (products || []).map((p: any) => ({ name: p.name, stock: p.stock_quantity || 0, value: (p.stock_quantity || 0) * Number(p.price) }));
          break;
        }
        case 'low-stock': {
          const { data: products } = await supabase.from('products').select('name, stock_quantity, low_stock_threshold, price');
          result = (products || []).filter((p: any) => (p.stock_quantity || 0) <= (p.low_stock_threshold || 5) && (p.stock_quantity || 0) > 0)
            .map((p: any) => ({ name: p.name, stock: p.stock_quantity, threshold: p.low_stock_threshold }));
          break;
        }
        case 'out-of-stock': {
          const { data: products } = await supabase.from('products').select('name, stock_quantity, price');
          result = (products || []).filter((p: any) => (p.stock_quantity || 0) === 0).map((p: any) => ({ name: p.name, stock: 0, price: Number(p.price) }));
          break;
        }
        case 'expense-summary':
        case 'expense-by-category': {
          const { data: expenses } = await supabase.from('expenses').select('*').gte('date', startDate.toISOString().split('T')[0]);
          const grouped: Record<string, number> = {};
          (expenses || []).forEach((e: any) => { grouped[e.category] = (grouped[e.category] || 0) + Number(e.amount); });
          result = Object.entries(grouped).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
          break;
        }
        case 'profit-loss': {
          const { data: orders } = await supabase.from('orders').select('total, created_at').gte('created_at', startDate.toISOString());
          const { data: expenses } = await supabase.from('expenses').select('amount, date').gte('date', startDate.toISOString().split('T')[0]);
          const daily: Record<string, any> = {};
          (orders || []).forEach((o: any) => {
            const date = new Date(o.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            if (!daily[date]) daily[date] = { date, revenue: 0, expenses: 0, profit: 0 };
            daily[date].revenue += Number(o.total);
          });
          (expenses || []).forEach((e: any) => {
            const date = new Date(e.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            if (!daily[date]) daily[date] = { date, revenue: 0, expenses: 0, profit: 0 };
            daily[date].expenses += Number(e.amount);
          });
          Object.values(daily).forEach((d: any) => { d.profit = d.revenue - d.expenses; });
          result = Object.values(daily);
          break;
        }
        case 'top-customers': {
          const { data: orders } = await supabase.from('orders').select('user_id, total').gte('created_at', startDate.toISOString());
          const { data: profiles } = await supabase.from('profiles').select('user_id, full_name, email');
          const grouped: Record<string, any> = {};
          (orders || []).forEach((o: any) => {
            if (!grouped[o.user_id]) {
              const profile = (profiles || []).find((p: any) => p.user_id === o.user_id);
              grouped[o.user_id] = { name: profile?.full_name || profile?.email || 'Unknown', revenue: 0, orders: 0 };
            }
            grouped[o.user_id].revenue += Number(o.total);
            grouped[o.user_id].orders += 1;
          });
          result = Object.values(grouped).sort((a: any, b: any) => b.revenue - a.revenue).slice(0, 20);
          break;
        }
        default: {
          result = [];
        }
      }
    } catch (err) {
      console.error('Report fetch error:', err);
    }

    setData(result);
    setIsLoading(false);
  };

  const exportCSV = () => {
    if (!data.length) return;
    const headers = Object.keys(data[0]);
    const rows = data.map(d => headers.map(h => d[h]));
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${report.id}-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  const isPieReport = ['orders-by-status', 'order-fulfillment', 'payments-by-method', 'expense-by-category', 'expense-summary'].includes(report.id);
  const isBarReport = ['sales-by-product', 'sales-by-category', 'sales-by-customer', 'top-customers', 'product-performance', 'stock-summary', 'low-stock'].includes(report.id);
  const isLineReport = ['sales-summary', 'sales-by-date', 'orders-by-date', 'profit-loss'].includes(report.id);

  if (isLoading) return <div className="space-y-4"><ShimmerCard className="h-96" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Select value={dateRange} onValueChange={setDateRange}>
          <SelectTrigger className="w-40">
            <Calendar className="h-4 w-4 mr-2" /><SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Last 7 days</SelectItem>
            <SelectItem value="30">Last 30 days</SelectItem>
            <SelectItem value="90">Last 90 days</SelectItem>
            <SelectItem value="365">Last year</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" onClick={exportCSV} disabled={!data.length}>
          <Download className="h-4 w-4 mr-2" />Export CSV
        </Button>
      </div>

      {data.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            No data available for this report in the selected date range.
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Chart */}
          {(isPieReport || isBarReport || isLineReport) && (
            <Card>
              <CardContent className="pt-6">
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    {isPieReport ? (
                      <PieChart>
                        <Pie data={data} cx="50%" cy="50%" innerRadius={60} outerRadius={100} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                          {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                        </Pie>
                        <Tooltip formatter={(v: number) => `₹${v.toLocaleString()}`} />
                        <Legend />
                      </PieChart>
                    ) : (
                      <BarChart data={data.slice(0, 20)} layout={isBarReport ? 'vertical' : 'horizontal'}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        {isBarReport ? (
                          <>
                            <XAxis type="number" />
                            <YAxis dataKey="name" type="category" width={120} className="text-xs" />
                          </>
                        ) : (
                          <>
                            <XAxis dataKey="date" className="text-xs" />
                            <YAxis className="text-xs" />
                          </>
                        )}
                        <Tooltip formatter={(v: number) => `₹${v.toLocaleString()}`} contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }} />
                        <Legend />
                        {isLineReport && data[0]?.revenue !== undefined && <Bar dataKey="revenue" fill="hsl(var(--primary))" name="Revenue" />}
                        {isLineReport && data[0]?.expenses !== undefined && <Bar dataKey="expenses" fill="#EF4444" name="Expenses" />}
                        {isLineReport && data[0]?.profit !== undefined && <Bar dataKey="profit" fill="#10B981" name="Profit" />}
                        {isLineReport && data[0]?.orders !== undefined && !data[0]?.revenue && <Bar dataKey="orders" fill="hsl(var(--primary))" name="Orders" />}
                        {isBarReport && data[0]?.revenue !== undefined && <Bar dataKey="revenue" fill="hsl(var(--primary))" name="Revenue" />}
                        {isBarReport && data[0]?.units !== undefined && <Bar dataKey="units" fill="#10B981" name="Units" />}
                        {isBarReport && data[0]?.stock !== undefined && <Bar dataKey="stock" fill="hsl(var(--primary))" name="Stock" />}
                        {isBarReport && data[0]?.value !== undefined && !data[0]?.revenue && <Bar dataKey="value" fill="#F59E0B" name="Value" />}
                      </BarChart>
                    )}
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Data Table */}
          <Card>
            <CardContent className="p-0">
              <div className="overflow-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">#</th>
                      {Object.keys(data[0]).map(key => (
                        <th key={key} className="px-4 py-3 text-left font-medium text-muted-foreground capitalize">{key.replace(/_/g, ' ')}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.map((row, i) => (
                      <tr key={i} className="border-b hover:bg-muted/30">
                        <td className="px-4 py-3 text-muted-foreground">{i + 1}</td>
                        {Object.entries(row).map(([key, val]) => (
                          <td key={key} className="px-4 py-3">
                            {typeof val === 'number' ? (
                              key.includes('revenue') || key.includes('amount') || key.includes('value') || key.includes('price') || key.includes('profit') || key.includes('expenses')
                                ? `₹${val.toLocaleString()}`
                                : val.toLocaleString()
                            ) : String(val)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}