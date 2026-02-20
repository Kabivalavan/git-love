import { useEffect, useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { ShimmerCard } from '@/components/ui/shimmer';
import { Download, Calendar, TrendingUp, DollarSign, ShoppingCart, Users, Package, AlertTriangle } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LineChart, Line, ScatterChart, Scatter,
  ComposedChart
} from 'recharts';
import type { ReportDefinition } from '@/pages/admin/Reports';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316', '#84CC16', '#06B6D4'];

const fmt = (v: number) => `₹${Number(v).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
const fmtNum = (v: number) => Number(v).toLocaleString('en-IN');

interface KPI {
  label: string;
  value: string | number;
  icon: React.ElementType;
  color?: string;
}

function KPICard({ kpi }: { kpi: KPI }) {
  const colorMap: Record<string, string> = {
    blue: 'bg-blue-500/10 text-blue-600',
    green: 'bg-green-500/10 text-green-600',
    amber: 'bg-amber-500/10 text-amber-600',
    red: 'bg-red-500/10 text-red-600',
    purple: 'bg-purple-500/10 text-purple-600',
    primary: 'bg-primary/10 text-primary',
  };
  const Icon = kpi.icon;
  const cls = colorMap[kpi.color || 'primary'];
  return (
    <Card>
      <CardContent className="p-4 flex items-center gap-3">
        <div className={`h-10 w-10 rounded-lg flex items-center justify-center flex-shrink-0 ${cls}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground truncate">{kpi.label}</p>
          <p className="text-xl font-bold truncate">{kpi.value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

const CustomTooltipStyle = {
  backgroundColor: 'hsl(var(--card))',
  border: '1px solid hsl(var(--border))',
  borderRadius: '8px',
  fontSize: '12px',
  color: 'hsl(var(--foreground))',
};

interface ReportViewerProps {
  report: ReportDefinition;
}

export function ReportViewer({ report }: ReportViewerProps) {
  const [dateRange, setDateRange] = useState('30');
  const [statusFilter, setStatusFilter] = useState('all');
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => { fetchData(); }, [report.id, dateRange, statusFilter]);

  const getStartDate = () => {
    const d = new Date();
    d.setDate(d.getDate() - parseInt(dateRange));
    return d.toISOString();
  };

  const fetchData = async () => {
    setIsLoading(true);
    const since = getStartDate();

    try {
      switch (report.id) {

        // ── SALES ────────────────────────────────────────────────────────────────

        case 'sales-by-customer': {
          let q = supabase.from('orders').select('user_id, total, discount, status, created_at, profiles!left(full_name, email)').gte('created_at', since) as any;
          if (statusFilter !== 'all') q = q.eq('status', statusFilter);
          const { data: orders } = await q;
          const kpiOrders = (orders || []);
          const totalRevenue = kpiOrders.reduce((s: number, o: any) => s + Number(o.total), 0);
          const totalDiscount = kpiOrders.reduce((s: number, o: any) => s + Number(o.discount || 0), 0);
          const grouped: Record<string, any> = {};
          kpiOrders.forEach((o: any) => {
            const name = o.profiles?.full_name || o.profiles?.email || 'Guest';
            if (!grouped[name]) grouped[name] = { name, revenue: 0, orders: 0, lastOrder: '', avgOrder: 0 };
            grouped[name].revenue += Number(o.total);
            grouped[name].orders += 1;
            if (!grouped[name].lastOrder || o.created_at > grouped[name].lastOrder) grouped[name].lastOrder = o.created_at;
          });
          const list = Object.values(grouped).sort((a: any, b: any) => b.revenue - a.revenue)
            .map((r: any) => ({ ...r, avgOrder: r.orders > 0 ? r.revenue / r.orders : 0, lastOrder: r.lastOrder ? new Date(r.lastOrder).toLocaleDateString('en-IN') : '-' }));
          setData({ kpis: [
            { label: 'Total Revenue', value: fmt(totalRevenue), icon: DollarSign, color: 'green' },
            { label: 'Total Orders', value: fmtNum(kpiOrders.length), icon: ShoppingCart, color: 'blue' },
            { label: 'Avg Order Value', value: fmt(kpiOrders.length > 0 ? totalRevenue / kpiOrders.length : 0), icon: TrendingUp, color: 'purple' },
            { label: 'Discount Given', value: fmt(totalDiscount), icon: DollarSign, color: 'red' },
          ], chart: { type: 'bar-horizontal', data: list.slice(0, 15), xKey: 'revenue', yKey: 'name', xLabel: 'Revenue (₹)' }, table: list,
          columns: ['name', 'orders', 'revenue', 'avgOrder', 'lastOrder'] });
          break;
        }

        case 'sales-by-category': {
          let q = supabase.from('order_items').select('quantity, total, product_id, products!left(category_id, categories!left(name)), order_id, orders!inner(created_at, status, discount)').gte('orders.created_at', since) as any;
          const { data: items } = await q;
          const allItems = (items || []).filter((i: any) => i.orders);
          const totalRevenue = allItems.reduce((s: number, i: any) => s + Number(i.total), 0);
          const totalUnits = allItems.reduce((s: number, i: any) => s + i.quantity, 0);
          const totalDiscount = allItems.reduce((s: number, i: any) => s + Number(i.orders?.discount || 0), 0) / Math.max(allItems.length, 1);
          const grouped: Record<string, any> = {};
          allItems.forEach((item: any) => {
            const cat = item.products?.categories?.name || 'Uncategorized';
            if (!grouped[cat]) grouped[cat] = { name: cat, revenue: 0, units: 0 };
            grouped[cat].revenue += Number(item.total);
            grouped[cat].units += item.quantity;
          });
          const list = Object.values(grouped).sort((a: any, b: any) => b.revenue - a.revenue).map((r: any) => ({
            ...r, contribution: totalRevenue > 0 ? ((r.revenue / totalRevenue) * 100).toFixed(1) + '%' : '0%'
          }));
          setData({ kpis: [
            { label: 'Total Revenue', value: fmt(totalRevenue), icon: DollarSign, color: 'green' },
            { label: 'Units Sold', value: fmtNum(totalUnits), icon: Package, color: 'blue' },
            { label: 'Categories', value: list.length, icon: Package, color: 'purple' },
            { label: 'Discount Given', value: fmt(totalDiscount), icon: DollarSign, color: 'red' },
          ], chart: { type: 'donut', data: list.map((r: any) => ({ name: r.name, value: r.revenue })) }, table: list,
          columns: ['name', 'units', 'revenue', 'contribution'] });
          break;
        }

        case 'sales-by-product': {
          const { data: items } = await supabase.from('order_items').select('product_name, quantity, total, price, product_id, orders!inner(created_at, status)').gte('orders.created_at', since) as any;
          const { data: products } = await supabase.from('products').select('id, stock_quantity, name');
          const stockMap: Record<string, number> = {};
          (products || []).forEach((p: any) => { stockMap[p.id] = p.stock_quantity; });
          const allItems = (items || []);
          const totalRevenue = allItems.reduce((s: number, i: any) => s + Number(i.total), 0);
          const grouped: Record<string, any> = {};
          allItems.forEach((item: any) => {
            const key = item.product_id || item.product_name;
            if (!grouped[key]) grouped[key] = { name: item.product_name, revenue: 0, units: 0, totalPrice: 0, product_id: item.product_id };
            grouped[key].revenue += Number(item.total);
            grouped[key].units += item.quantity;
            grouped[key].totalPrice += Number(item.price) * item.quantity;
          });
          const list = Object.values(grouped).sort((a: any, b: any) => b.revenue - a.revenue).map((r: any) => ({
            ...r, avgSellingPrice: r.units > 0 ? r.totalPrice / r.units : 0, stockLeft: stockMap[r.product_id] ?? '-'
          }));
          setData({ kpis: [
            { label: 'Total Revenue', value: fmt(totalRevenue), icon: DollarSign, color: 'green' },
            { label: 'Total Orders', value: allItems.length, icon: ShoppingCart, color: 'blue' },
            { label: 'Avg Order Value', value: fmt(allItems.length > 0 ? totalRevenue / allItems.length : 0), icon: TrendingUp, color: 'purple' },
            { label: 'Products Sold', value: list.length, icon: Package, color: 'amber' },
          ], chart: { type: 'bar-horizontal', data: list.slice(0, 15), xKey: 'revenue', yKey: 'name', xLabel: 'Revenue (₹)' }, table: list,
          columns: ['name', 'units', 'revenue', 'avgSellingPrice', 'stockLeft'] });
          break;
        }

        case 'sales-by-variant': {
          const { data: items } = await supabase.from('order_items').select('product_name, variant_name, quantity, total, orders!inner(created_at)').gte('orders.created_at', since).not('variant_name', 'is', null) as any;
          const allItems = (items || []);
          const totalRevenue = allItems.reduce((s: number, i: any) => s + Number(i.total), 0);
          const grouped: Record<string, any> = {};
          allItems.forEach((item: any) => {
            const key = `${item.product_name}||${item.variant_name}`;
            if (!grouped[key]) grouped[key] = { product: item.product_name, variant: item.variant_name, revenue: 0, units: 0 };
            grouped[key].revenue += Number(item.total);
            grouped[key].units += item.quantity;
          });
          const list = Object.values(grouped).sort((a: any, b: any) => b.revenue - a.revenue);
          const chartData = list.slice(0, 15).map((r: any) => ({ name: `${r.product} - ${r.variant}`, revenue: r.revenue, units: r.units }));
          setData({ kpis: [
            { label: 'Total Revenue', value: fmt(totalRevenue), icon: DollarSign, color: 'green' },
            { label: 'Total Orders', value: allItems.length, icon: ShoppingCart, color: 'blue' },
            { label: 'Avg Order Value', value: fmt(allItems.length > 0 ? totalRevenue / allItems.length : 0), icon: TrendingUp, color: 'purple' },
            { label: 'Variants Sold', value: list.length, icon: Package, color: 'amber' },
          ], chart: { type: 'bar-horizontal', data: chartData, xKey: 'revenue', yKey: 'name', xLabel: 'Revenue (₹)' }, table: list,
          columns: ['product', 'variant', 'units', 'revenue'] });
          break;
        }

        case 'sales-by-coupon': {
          const { data: orders } = await supabase.from('orders').select('coupon_code, total, discount').gte('created_at', since).not('coupon_code', 'is', null) as any;
          const allOrders = (orders || []);
          const totalRevenue = allOrders.reduce((s: number, o: any) => s + Number(o.total), 0);
          const totalDiscount = allOrders.reduce((s: number, o: any) => s + Number(o.discount || 0), 0);
          const grouped: Record<string, any> = {};
          allOrders.forEach((o: any) => {
            const code = o.coupon_code || 'None';
            if (!grouped[code]) grouped[code] = { code, revenue: 0, orders: 0, discount: 0 };
            grouped[code].revenue += Number(o.total);
            grouped[code].orders += 1;
            grouped[code].discount += Number(o.discount || 0);
          });
          const list = Object.values(grouped).sort((a: any, b: any) => b.revenue - a.revenue).map((r: any) => ({
            ...r, netRevenue: r.revenue - r.discount
          }));
          setData({ kpis: [
            { label: 'Total Revenue', value: fmt(totalRevenue), icon: DollarSign, color: 'green' },
            { label: 'Total Orders', value: allOrders.length, icon: ShoppingCart, color: 'blue' },
            { label: 'Avg Order Value', value: fmt(allOrders.length > 0 ? totalRevenue / allOrders.length : 0), icon: TrendingUp, color: 'purple' },
            { label: 'Discount Given', value: fmt(totalDiscount), icon: DollarSign, color: 'red' },
          ], chart: { type: 'bar', data: list, xKey: 'code', yKey: 'revenue', yLabel: 'Revenue (₹)' }, table: list,
          columns: ['code', 'orders', 'revenue', 'discount', 'netRevenue'] });
          break;
        }

        case 'sales-summary': {
          let q = supabase.from('orders').select('total, discount, created_at, status, payment_status').gte('created_at', since).order('created_at') as any;
          if (statusFilter !== 'all') q = q.eq('status', statusFilter);
          const { data: orders } = await q;
          const allOrders = (orders || []);
          const totalRevenue = allOrders.reduce((s: number, o: any) => s + Number(o.total), 0);
          const totalDiscount = allOrders.reduce((s: number, o: any) => s + Number(o.discount || 0), 0);
          const daily: Record<string, any> = {};
          allOrders.forEach((o: any) => {
            const date = new Date(o.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
            if (!daily[date]) daily[date] = { date, revenue: 0, orders: 0, discounts: 0 };
            daily[date].revenue += Number(o.total);
            daily[date].orders += 1;
            daily[date].discounts += Number(o.discount || 0);
          });
          const list = Object.values(daily).map((d: any) => ({ ...d, netRevenue: d.revenue - d.discounts }));
          setData({ kpis: [
            { label: 'Total Revenue', value: fmt(totalRevenue), icon: DollarSign, color: 'green' },
            { label: 'Total Orders', value: allOrders.length, icon: ShoppingCart, color: 'blue' },
            { label: 'Avg Order Value', value: fmt(allOrders.length > 0 ? totalRevenue / allOrders.length : 0), icon: TrendingUp, color: 'purple' },
            { label: 'Discount Given', value: fmt(totalDiscount), icon: DollarSign, color: 'red' },
          ], chart: { type: 'line-dual', data: list, xKey: 'date', keys: [{ key: 'revenue', color: '#3B82F6', name: 'Revenue (₹)' }, { key: 'orders', color: '#10B981', name: 'Orders', yAxisId: 'right' }] }, table: list,
          columns: ['date', 'orders', 'revenue', 'discounts', 'netRevenue'] });
          break;
        }

        case 'sales-by-date': {
          const { data: orders } = await supabase.from('orders').select('total, created_at').gte('created_at', since).order('created_at') as any;
          const allOrders = (orders || []);
          const totalRevenue = allOrders.reduce((s: number, o: any) => s + Number(o.total), 0);
          const daily: Record<string, any> = {};
          allOrders.forEach((o: any) => {
            const date = new Date(o.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
            if (!daily[date]) daily[date] = { date, revenue: 0, orders: 0 };
            daily[date].revenue += Number(o.total);
            daily[date].orders += 1;
          });
          const list = Object.values(daily).map((d: any) => ({ ...d, avgOrderValue: d.orders > 0 ? d.revenue / d.orders : 0 }));
          setData({ kpis: [
            { label: 'Total Revenue', value: fmt(totalRevenue), icon: DollarSign, color: 'green' },
            { label: 'Total Orders', value: allOrders.length, icon: ShoppingCart, color: 'blue' },
            { label: 'Avg Order Value', value: fmt(allOrders.length > 0 ? totalRevenue / allOrders.length : 0), icon: TrendingUp, color: 'purple' },
            { label: 'Discount Given', value: fmt(0), icon: DollarSign, color: 'red' },
          ], chart: { type: 'composed-bar-line', data: list, xKey: 'date', barKey: 'revenue', barName: 'Revenue (₹)', lineKey: 'orders', lineName: 'Orders' }, table: list,
          columns: ['date', 'orders', 'revenue', 'avgOrderValue'] });
          break;
        }

        case 'sales-return-history': {
          const { data: orders } = await supabase.from('orders').select('order_number, status, total, notes, created_at, payments(refund_amount, refund_reason)').gte('created_at', since).in('status', ['returned', 'cancelled']) as any;
          const allOrders = (orders || []);
          const totalRevenue = allOrders.reduce((s: number, o: any) => s + Number(o.total), 0);
          const totalRefunds = allOrders.reduce((s: number, o: any) => s + Number(o.payments?.[0]?.refund_amount || 0), 0);
          const daily: Record<string, any> = {};
          allOrders.forEach((o: any) => {
            const date = new Date(o.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
            if (!daily[date]) daily[date] = { date, returned: 0, cancelled: 0 };
            if (o.status === 'returned') daily[date].returned += 1;
            else daily[date].cancelled += 1;
          });
          const list = allOrders.map((o: any) => ({
            orderNumber: o.order_number, status: o.status, refundAmount: o.payments?.[0]?.refund_amount || 0,
            refundReason: o.payments?.[0]?.refund_reason || o.notes || '-', date: new Date(o.created_at).toLocaleDateString('en-IN')
          }));
          setData({ kpis: [
            { label: 'Total Revenue', value: fmt(totalRevenue), icon: DollarSign, color: 'green' },
            { label: 'Total Orders', value: allOrders.length, icon: ShoppingCart, color: 'blue' },
            { label: 'Avg Order Value', value: fmt(allOrders.length > 0 ? totalRevenue / allOrders.length : 0), icon: TrendingUp, color: 'purple' },
            { label: 'Total Refunds', value: fmt(totalRefunds), icon: DollarSign, color: 'red' },
          ], chart: { type: 'bar-stacked', data: Object.values(daily), xKey: 'date', keys: [{ key: 'returned', color: '#EF4444', name: 'Returned' }, { key: 'cancelled', color: '#F59E0B', name: 'Cancelled' }] }, table: list,
          columns: ['orderNumber', 'status', 'refundAmount', 'refundReason', 'date'] });
          break;
        }

        // ── INVENTORY ──────────────────────────────────────────────────────────

        case 'stock-summary': {
          const { data: products } = await supabase.from('products').select('name, sku, stock_quantity, low_stock_threshold, is_active, in_hold');
          const allProds = (products || []);
          const total = allProds.length;
          const lowStock = allProds.filter((p: any) => (p.stock_quantity || 0) <= (p.low_stock_threshold || 5) && (p.stock_quantity || 0) > 0).length;
          const outOfStock = allProds.filter((p: any) => (p.stock_quantity || 0) === 0).length;
          const list = allProds.map((p: any) => ({
            name: p.name, sku: p.sku || '-', stock: p.stock_quantity || 0, inHold: p.in_hold || 0,
            threshold: p.low_stock_threshold || 5,
            status: (p.stock_quantity || 0) === 0 ? 'Out of Stock' : (p.stock_quantity || 0) <= (p.low_stock_threshold || 5) ? 'Low' : 'In Stock'
          })).sort((a: any, b: any) => a.stock - b.stock);
          setData({ kpis: [
            { label: 'Total Products', value: total, icon: Package, color: 'blue' },
            { label: 'Low Stock Items', value: lowStock, icon: AlertTriangle, color: 'amber' },
            { label: 'Out of Stock', value: outOfStock, icon: Package, color: 'red' },
            { label: 'Healthy Stock', value: total - lowStock - outOfStock, icon: TrendingUp, color: 'green' },
          ], chart: { type: 'bar-horizontal', data: list.slice(0, 20), xKey: 'stock', yKey: 'name', xLabel: 'Stock Quantity' }, table: list,
          columns: ['name', 'sku', 'stock', 'inHold', 'threshold', 'status'] });
          break;
        }

        case 'low-stock': {
          const { data: products } = await supabase.from('products').select('name, sku, stock_quantity, low_stock_threshold, category_id, categories!left(name)') as any;
          const list = (products || []).filter((p: any) => (p.stock_quantity || 0) <= (p.low_stock_threshold || 5) && (p.stock_quantity || 0) > 0)
            .map((p: any) => ({ name: p.name, currentStock: p.stock_quantity || 0, threshold: p.low_stock_threshold || 5, category: p.categories?.name || '-' }))
            .sort((a: any, b: any) => a.currentStock - b.currentStock);
          setData({ kpis: [
            { label: 'Total Products', value: (products || []).length, icon: Package, color: 'blue' },
            { label: 'Low Stock Items', value: list.length, icon: AlertTriangle, color: 'amber' },
            { label: 'Out of Stock', value: (products || []).filter((p: any) => (p.stock_quantity || 0) === 0).length, icon: Package, color: 'red' },
            { label: 'Healthy Stock', value: (products || []).length - list.length, icon: TrendingUp, color: 'green' },
          ], chart: null, table: list, columns: ['name', 'currentStock', 'threshold', 'category'] });
          break;
        }

        case 'out-of-stock': {
          const { data: products } = await supabase.from('products').select('name, sku, stock_quantity, category_id, categories!left(name), created_at') as any;
          const { data: lastSaleItems } = await supabase.from('order_items').select('product_name, orders!inner(created_at)').gte('orders.created_at', since) as any;
          const lastSaleMap: Record<string, string> = {};
          (lastSaleItems || []).forEach((i: any) => {
            if (!lastSaleMap[i.product_name] || i.orders?.created_at > lastSaleMap[i.product_name])
              lastSaleMap[i.product_name] = i.orders?.created_at;
          });
          const allProds = (products || []);
          const oos = allProds.filter((p: any) => (p.stock_quantity || 0) === 0);
          const list = oos.map((p: any) => ({
            name: p.name, sku: p.sku || '-', category: p.categories?.name || '-',
            lastSoldDate: lastSaleMap[p.name] ? new Date(lastSaleMap[p.name]).toLocaleDateString('en-IN') : 'Never', status: 'Out of Stock'
          }));
          setData({ kpis: [
            { label: 'Total Products', value: allProds.length, icon: Package, color: 'blue' },
            { label: 'Low Stock Items', value: allProds.filter((p: any) => (p.stock_quantity || 0) <= (p.low_stock_threshold || 5) && (p.stock_quantity || 0) > 0).length, icon: AlertTriangle, color: 'amber' },
            { label: 'Out of Stock', value: oos.length, icon: Package, color: 'red' },
            { label: 'Fast Moving', value: 0, icon: TrendingUp, color: 'green' },
          ], chart: null, table: list, columns: ['name', 'sku', 'category', 'lastSoldDate', 'status'] });
          break;
        }

        case 'product-performance': {
          const { data: items } = await supabase.from('order_items').select('product_name, quantity, total, product_id, orders!inner(created_at)').gte('orders.created_at', since) as any;
          const { data: products } = await supabase.from('products').select('id, name, stock_quantity');
          const stockMap: Record<string, number> = {};
          (products || []).forEach((p: any) => { stockMap[p.id] = p.stock_quantity; });
          const allItems = (items || []);
          const grouped: Record<string, any> = {};
          allItems.forEach((item: any) => {
            const key = item.product_id || item.product_name;
            if (!grouped[key]) grouped[key] = { name: item.product_name, units: 0, revenue: 0, product_id: item.product_id };
            grouped[key].units += item.quantity;
            grouped[key].revenue += Number(item.total);
          });
          const list = Object.values(grouped).map((r: any) => ({
            ...r, currentStock: stockMap[r.product_id] ?? 0,
            turnover: r.units > 10 ? 'Fast' : r.units > 3 ? 'Normal' : 'Slow'
          })).sort((a: any, b: any) => b.units - a.units);
          const scatterData = list.map((r: any) => ({ x: r.units, y: r.currentStock, name: r.name }));
          setData({ kpis: [
            { label: 'Total Products', value: (products || []).length, icon: Package, color: 'blue' },
            { label: 'Low Stock Items', value: (products || []).filter((p: any) => (p.stock_quantity || 0) <= 5).length, icon: AlertTriangle, color: 'amber' },
            { label: 'Out of Stock', value: (products || []).filter((p: any) => (p.stock_quantity || 0) === 0).length, icon: Package, color: 'red' },
            { label: 'Fast Moving', value: list.filter((r: any) => r.turnover === 'Fast').length, icon: TrendingUp, color: 'green' },
          ], chart: { type: 'scatter', data: scatterData, xLabel: 'Units Sold', yLabel: 'Current Stock' }, table: list,
          columns: ['name', 'units', 'currentStock', 'revenue', 'turnover'] });
          break;
        }

        // ── PAYMENTS ──────────────────────────────────────────────────────────

        case 'payments-received': {
          const { data: payments } = await supabase.from('payments').select('*, orders!inner(order_number, user_id)').gte('created_at', since).eq('status', 'paid') as any;
          const allPayments = (payments || []);
          const totalPaid = allPayments.reduce((s: number, p: any) => s + Number(p.amount), 0);
          const daily: Record<string, number> = {};
          allPayments.forEach((p: any) => {
            const date = new Date(p.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
            daily[date] = (daily[date] || 0) + Number(p.amount);
          });
          const lineData = Object.entries(daily).map(([date, amount]) => ({ date, amount }));
          const list = allPayments.map((p: any) => ({
            orderNumber: p.orders?.order_number || '-', method: p.method, amount: p.amount, status: p.status, date: new Date(p.created_at).toLocaleDateString('en-IN')
          }));
          const { data: failedPayments } = await supabase.from('payments').select('amount').gte('created_at', since).eq('status', 'failed');
          const totalFailed = (failedPayments || []).reduce((s: number, p: any) => s + Number(p.amount), 0);
          const { data: refundedPayments } = await supabase.from('payments').select('refund_amount').gte('created_at', since).not('refund_amount', 'is', null);
          const totalRefunded = (refundedPayments || []).reduce((s: number, p: any) => s + Number(p.refund_amount || 0), 0);
          setData({ kpis: [
            { label: 'Payments Received', value: fmt(totalPaid), icon: DollarSign, color: 'green' },
            { label: 'Failed Payments', value: fmt(totalFailed), icon: AlertTriangle, color: 'red' },
            { label: 'Refunded Amount', value: fmt(totalRefunded), icon: DollarSign, color: 'amber' },
            { label: 'Total Transactions', value: allPayments.length, icon: ShoppingCart, color: 'blue' },
          ], chart: { type: 'line', data: lineData, xKey: 'date', keys: [{ key: 'amount', color: '#10B981', name: 'Amount (₹)' }] }, table: list,
          columns: ['orderNumber', 'method', 'amount', 'status', 'date'] });
          break;
        }

        case 'payments-by-method': {
          const { data: payments } = await supabase.from('payments').select('method, amount, status').gte('created_at', since) as any;
          const allPayments = (payments || []);
          const totalPaid = allPayments.filter((p: any) => p.status === 'paid').reduce((s: number, p: any) => s + Number(p.amount), 0);
          const grouped: Record<string, any> = {};
          allPayments.forEach((p: any) => {
            const m = p.method || 'Unknown';
            if (!grouped[m]) grouped[m] = { name: m, value: 0, count: 0 };
            grouped[m].value += Number(p.amount);
            grouped[m].count += 1;
          });
          const list = Object.values(grouped).sort((a: any, b: any) => b.value - a.value).map((r: any) => ({
            ...r, share: allPayments.length > 0 ? ((r.count / allPayments.length) * 100).toFixed(1) + '%' : '0%'
          }));
          const { data: failedPayments } = await supabase.from('payments').select('amount').gte('created_at', since).eq('status', 'failed');
          const totalFailed = (failedPayments || []).reduce((s: number, p: any) => s + Number(p.amount), 0);
          const { data: refundedPayments } = await supabase.from('payments').select('refund_amount').gte('created_at', since).not('refund_amount', 'is', null);
          const totalRefunded = (refundedPayments || []).reduce((s: number, p: any) => s + Number(p.refund_amount || 0), 0);
          setData({ kpis: [
            { label: 'Payments Received', value: fmt(totalPaid), icon: DollarSign, color: 'green' },
            { label: 'Failed Payments', value: fmt(totalFailed), icon: AlertTriangle, color: 'red' },
            { label: 'Refunded Amount', value: fmt(totalRefunded), icon: DollarSign, color: 'amber' },
            { label: 'Total Transactions', value: allPayments.length, icon: ShoppingCart, color: 'blue' },
          ], chart: { type: 'donut', data: list.map((r: any) => ({ name: r.name, value: r.value })) }, table: list,
          columns: ['name', 'count', 'value', 'share'] });
          break;
        }

        case 'payment-status': {
          const { data: payments } = await supabase.from('payments').select('status, amount, updated_at, created_at').gte('created_at', since) as any;
          const allPayments = (payments || []);
          const totalPaid = allPayments.filter((p: any) => p.status === 'paid').reduce((s: number, p: any) => s + Number(p.amount), 0);
          const totalFailed = allPayments.filter((p: any) => p.status === 'failed').reduce((s: number, p: any) => s + Number(p.amount), 0);
          const totalRefunded = allPayments.filter((p: any) => p.status === 'refunded').reduce((s: number, p: any) => s + Number(p.amount), 0);
          const daily: Record<string, any> = {};
          allPayments.forEach((p: any) => {
            const date = new Date(p.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
            if (!daily[date]) daily[date] = { date, paid: 0, failed: 0, pending: 0, refunded: 0 };
            daily[date][p.status as string] = (daily[date][p.status as string] || 0) + Number(p.amount);
          });
          const statusGroups: Record<string, any> = {};
          allPayments.forEach((p: any) => {
            if (!statusGroups[p.status]) statusGroups[p.status] = { status: p.status, count: 0, total: 0, lastUpdated: '' };
            statusGroups[p.status].count += 1;
            statusGroups[p.status].total += Number(p.amount);
            if (!statusGroups[p.status].lastUpdated || p.updated_at > statusGroups[p.status].lastUpdated) statusGroups[p.status].lastUpdated = p.updated_at;
          });
          const list = Object.values(statusGroups).map((r: any) => ({ ...r, lastUpdated: r.lastUpdated ? new Date(r.lastUpdated).toLocaleDateString('en-IN') : '-' }));
          setData({ kpis: [
            { label: 'Payments Received', value: fmt(totalPaid), icon: DollarSign, color: 'green' },
            { label: 'Failed Payments', value: fmt(totalFailed), icon: AlertTriangle, color: 'red' },
            { label: 'Refunded Amount', value: fmt(totalRefunded), icon: DollarSign, color: 'amber' },
            { label: 'Total Transactions', value: allPayments.length, icon: ShoppingCart, color: 'blue' },
          ], chart: { type: 'bar-stacked', data: Object.values(daily), xKey: 'date', keys: [
            { key: 'paid', color: '#10B981', name: 'Paid' },
            { key: 'pending', color: '#F59E0B', name: 'Pending' },
            { key: 'failed', color: '#EF4444', name: 'Failed' },
            { key: 'refunded', color: '#8B5CF6', name: 'Refunded' },
          ]}, table: list, columns: ['status', 'count', 'total', 'lastUpdated'] });
          break;
        }

        case 'refunds': {
          const { data: payments } = await supabase.from('payments').select('*, orders!inner(order_number)').gte('created_at', since).not('refund_amount', 'is', null) as any;
          const allPayments = (payments || []);
          const totalPaid = allPayments.reduce((s: number, p: any) => s + Number(p.amount), 0);
          const totalFailed = 0;
          const totalRefunded = allPayments.reduce((s: number, p: any) => s + Number(p.refund_amount || 0), 0);
          const daily: Record<string, number> = {};
          allPayments.forEach((p: any) => {
            const date = new Date(p.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
            daily[date] = (daily[date] || 0) + Number(p.refund_amount || 0);
          });
          const list = allPayments.map((p: any) => ({
            orderNumber: p.orders?.order_number || '-', refundAmount: p.refund_amount || 0,
            refundReason: p.refund_reason || '-', method: p.method, date: new Date(p.created_at).toLocaleDateString('en-IN')
          }));
          setData({ kpis: [
            { label: 'Payments Received', value: fmt(totalPaid), icon: DollarSign, color: 'green' },
            { label: 'Failed Payments', value: fmt(totalFailed), icon: AlertTriangle, color: 'red' },
            { label: 'Refunded Amount', value: fmt(totalRefunded), icon: DollarSign, color: 'amber' },
            { label: 'Total Transactions', value: allPayments.length, icon: ShoppingCart, color: 'blue' },
          ], chart: { type: 'bar', data: Object.entries(daily).map(([date, amount]) => ({ date, amount })), xKey: 'date', yKey: 'amount', yLabel: 'Refund Amount (₹)' }, table: list,
          columns: ['orderNumber', 'refundAmount', 'refundReason', 'method', 'date'] });
          break;
        }

        // ── CUSTOMERS ─────────────────────────────────────────────────────────

        case 'customer-list': {
          const { data: profiles } = await supabase.from('profiles').select('full_name, mobile_number, email, is_blocked, created_at, user_id');
          const { data: orders } = await supabase.from('orders').select('user_id, total');
          const totalCustomers = (profiles || []).length;
          const newCust = (profiles || []).filter((p: any) => new Date(p.created_at) >= new Date(since)).length;
          const orderMap: Record<string, { count: number; total: number }> = {};
          (orders || []).forEach((o: any) => {
            if (!orderMap[o.user_id]) orderMap[o.user_id] = { count: 0, total: 0 };
            orderMap[o.user_id].count += 1;
            orderMap[o.user_id].total += Number(o.total);
          });
          const repeatCust = Object.values(orderMap).filter(v => v.count > 1).length;
          const avgSpend = Object.values(orderMap).reduce((s, v) => s + v.total, 0) / Math.max(Object.keys(orderMap).length, 1);
          const list = (profiles || []).map((p: any) => ({
            name: p.full_name || 'N/A', mobile: p.mobile_number || '-', email: p.email || '-',
            totalOrders: orderMap[p.user_id]?.count || 0, totalSpend: orderMap[p.user_id]?.total || 0,
            joinedDate: new Date(p.created_at).toLocaleDateString('en-IN'),
            status: p.is_blocked ? 'Blocked' : 'Active'
          })).sort((a: any, b: any) => b.totalSpend - a.totalSpend);
          setData({ kpis: [
            { label: 'Total Customers', value: totalCustomers, icon: Users, color: 'blue' },
            { label: 'New Customers', value: newCust, icon: Users, color: 'green' },
            { label: 'Repeat Customers', value: repeatCust, icon: TrendingUp, color: 'purple' },
            { label: 'Avg Spend / Customer', value: fmt(avgSpend), icon: DollarSign, color: 'amber' },
          ], chart: null, table: list, columns: ['name', 'mobile', 'email', 'totalOrders', 'totalSpend', 'joinedDate', 'status'] });
          break;
        }

        case 'top-customers': {
          const { data: orders } = await supabase.from('orders').select('user_id, total, created_at').gte('created_at', since) as any;
          const { data: profiles } = await supabase.from('profiles').select('user_id, full_name, email');
          const profileMap: Record<string, string> = {};
          (profiles || []).forEach((p: any) => { profileMap[p.user_id] = p.full_name || p.email || 'Unknown'; });
          const grouped: Record<string, any> = {};
          (orders || []).forEach((o: any) => {
            if (!grouped[o.user_id]) grouped[o.user_id] = { name: profileMap[o.user_id] || 'Unknown', revenue: 0, orders: 0, lastOrder: '' };
            grouped[o.user_id].revenue += Number(o.total);
            grouped[o.user_id].orders += 1;
            if (!grouped[o.user_id].lastOrder || o.created_at > grouped[o.user_id].lastOrder) grouped[o.user_id].lastOrder = o.created_at;
          });
          const allOrders = (orders || []);
          const totalRevenue = allOrders.reduce((s: number, o: any) => s + Number(o.total), 0);
          const totalDiscount = 0;
          const list = Object.values(grouped).sort((a: any, b: any) => b.revenue - a.revenue).slice(0, 20)
            .map((r: any) => ({ ...r, avgOrder: r.orders > 0 ? r.revenue / r.orders : 0, lastOrder: r.lastOrder ? new Date(r.lastOrder).toLocaleDateString('en-IN') : '-' }));
          const totalCustomers = (profiles || []).length;
          const repeatCust = Object.values(grouped).filter((v: any) => v.orders > 1).length;
          const avgSpend = totalRevenue / Math.max(Object.keys(grouped).length, 1);
          setData({ kpis: [
            { label: 'Total Customers', value: totalCustomers, icon: Users, color: 'blue' },
            { label: 'New Customers', value: 0, icon: Users, color: 'green' },
            { label: 'Repeat Customers', value: repeatCust, icon: TrendingUp, color: 'purple' },
            { label: 'Avg Spend / Customer', value: fmt(avgSpend), icon: DollarSign, color: 'amber' },
          ], chart: { type: 'bar-horizontal', data: list.slice(0, 10), xKey: 'revenue', yKey: 'name', xLabel: 'Revenue (₹)' }, table: list,
          columns: ['name', 'orders', 'revenue', 'avgOrder', 'lastOrder'] });
          break;
        }

        case 'new-customers': {
          const { data: profiles } = await supabase.from('profiles').select('full_name, mobile_number, email, created_at, user_id').gte('created_at', since).order('created_at', { ascending: false });
          const { data: orders } = await supabase.from('orders').select('user_id, total, created_at').gte('created_at', since);
          const allProfiles = (profiles || []);
          const totalCustomers = allProfiles.length;
          const ordersByUser: Record<string, any[]> = {};
          (orders || []).forEach((o: any) => {
            if (!ordersByUser[o.user_id]) ordersByUser[o.user_id] = [];
            ordersByUser[o.user_id].push(o);
          });
          const daily: Record<string, number> = {};
          allProfiles.forEach((p: any) => {
            const date = new Date(p.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
            daily[date] = (daily[date] || 0) + 1;
          });
          const list = allProfiles.map((p: any) => {
            const userOrders = (ordersByUser[p.user_id] || []).sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
            return {
              name: p.full_name || 'N/A', mobile: p.mobile_number || '-',
              signupDate: new Date(p.created_at).toLocaleDateString('en-IN'),
              firstOrderDate: userOrders[0] ? new Date(userOrders[0].created_at).toLocaleDateString('en-IN') : '-',
              firstOrderValue: userOrders[0] ? userOrders[0].total : 0
            };
          });
          const repeatCust = Object.values(ordersByUser).filter(v => v.length > 1).length;
          setData({ kpis: [
            { label: 'Total Customers', value: totalCustomers, icon: Users, color: 'blue' },
            { label: 'New Customers', value: totalCustomers, icon: Users, color: 'green' },
            { label: 'Repeat Customers', value: repeatCust, icon: TrendingUp, color: 'purple' },
            { label: 'Avg Spend / Customer', value: fmt((orders || []).reduce((s: number, o: any) => s + Number(o.total), 0) / Math.max(totalCustomers, 1)), icon: DollarSign, color: 'amber' },
          ], chart: { type: 'line', data: Object.entries(daily).map(([date, count]) => ({ date, count })), xKey: 'date', keys: [{ key: 'count', color: '#3B82F6', name: 'New Customers' }] }, table: list,
          columns: ['name', 'mobile', 'signupDate', 'firstOrderDate', 'firstOrderValue'] });
          break;
        }

        // ── ORDERS ────────────────────────────────────────────────────────────

        case 'order-fulfillment': {
          const { data: orders } = await supabase.from('orders').select('id, order_number, status, created_at, deliveries!left(partner_name, estimated_date, delivered_at)').gte('created_at', since) as any;
          const allOrders = (orders || []);
          const totalOrders = allOrders.length;
          const cancelled = allOrders.filter((o: any) => o.status === 'cancelled').length;
          const returned = allOrders.filter((o: any) => o.status === 'returned').length;
          const totalValue = allOrders.reduce((s: number, o: any) => s + 0, 0);
          const daily: Record<string, any> = {};
          allOrders.forEach((o: any) => {
            const date = new Date(o.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
            if (!daily[date]) daily[date] = { date, new: 0, confirmed: 0, packed: 0, shipped: 0, delivered: 0 };
            const s = o.status as string;
            if (daily[date][s] !== undefined) daily[date][s] += 1;
          });
          const list = allOrders.map((o: any) => ({
            orderNumber: o.order_number, status: o.status,
            daysSinceOrder: Math.floor((Date.now() - new Date(o.created_at).getTime()) / 86400000),
            deliveryPartner: o.deliveries?.[0]?.partner_name || '-',
            estimatedDelivery: o.deliveries?.[0]?.estimated_date ? new Date(o.deliveries[0].estimated_date).toLocaleDateString('en-IN') : '-',
            deliveredAt: o.deliveries?.[0]?.delivered_at ? new Date(o.deliveries[0].delivered_at).toLocaleDateString('en-IN') : '-'
          }));
          setData({ kpis: [
            { label: 'Total Orders', value: totalOrders, icon: ShoppingCart, color: 'blue' },
            { label: 'Total Order Value', value: fmt(totalValue), icon: DollarSign, color: 'green' },
            { label: 'Cancelled Orders', value: cancelled, icon: AlertTriangle, color: 'red' },
            { label: 'Returned Orders', value: returned, icon: Package, color: 'amber' },
          ], chart: { type: 'bar-stacked', data: Object.values(daily), xKey: 'date', keys: [
            { key: 'new', color: '#3B82F6', name: 'New' },
            { key: 'confirmed', color: '#10B981', name: 'Confirmed' },
            { key: 'packed', color: '#F59E0B', name: 'Packed' },
            { key: 'shipped', color: '#8B5CF6', name: 'Shipped' },
            { key: 'delivered', color: '#14B8A6', name: 'Delivered' },
          ]}, table: list, columns: ['orderNumber', 'status', 'daysSinceOrder', 'deliveryPartner', 'estimatedDelivery', 'deliveredAt'] });
          break;
        }

        case 'orders-by-status': {
          let q = supabase.from('orders').select('status, total').gte('created_at', since) as any;
          const { data: orders } = await q;
          const allOrders = (orders || []);
          const totalOrders = allOrders.length;
          const totalValue = allOrders.reduce((s: number, o: any) => s + Number(o.total), 0);
          const cancelled = allOrders.filter((o: any) => o.status === 'cancelled').length;
          const returned = allOrders.filter((o: any) => o.status === 'returned').length;
          const grouped: Record<string, any> = {};
          allOrders.forEach((o: any) => {
            const s = o.status || 'unknown';
            if (!grouped[s]) grouped[s] = { status: s, count: 0, value: 0 };
            grouped[s].count += 1;
            grouped[s].value += Number(o.total);
          });
          const list = Object.values(grouped).map((r: any) => ({
            ...r, share: totalOrders > 0 ? ((r.count / totalOrders) * 100).toFixed(1) + '%' : '0%'
          }));
          setData({ kpis: [
            { label: 'Total Orders', value: totalOrders, icon: ShoppingCart, color: 'blue' },
            { label: 'Total Order Value', value: fmt(totalValue), icon: DollarSign, color: 'green' },
            { label: 'Cancelled Orders', value: cancelled, icon: AlertTriangle, color: 'red' },
            { label: 'Returned Orders', value: returned, icon: Package, color: 'amber' },
          ], chart: { type: 'donut', data: list.map((r: any) => ({ name: r.status, value: r.count })) }, table: list,
          columns: ['status', 'count', 'value', 'share'] });
          break;
        }

        case 'orders-by-date': {
          const { data: orders } = await supabase.from('orders').select('total, created_at').gte('created_at', since).order('created_at') as any;
          const allOrders = (orders || []);
          const totalOrders = allOrders.length;
          const totalValue = allOrders.reduce((s: number, o: any) => s + Number(o.total), 0);
          const daily: Record<string, any> = {};
          allOrders.forEach((o: any) => {
            const date = new Date(o.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
            if (!daily[date]) daily[date] = { date, orders: 0, value: 0 };
            daily[date].orders += 1;
            daily[date].value += Number(o.total);
          });
          const list = Object.values(daily).map((d: any) => ({ ...d, avgOrderValue: d.orders > 0 ? d.value / d.orders : 0 }));
          setData({ kpis: [
            { label: 'Total Orders', value: totalOrders, icon: ShoppingCart, color: 'blue' },
            { label: 'Total Order Value', value: fmt(totalValue), icon: DollarSign, color: 'green' },
            { label: 'Cancelled Orders', value: 0, icon: AlertTriangle, color: 'red' },
            { label: 'Returned Orders', value: 0, icon: Package, color: 'amber' },
          ], chart: { type: 'composed-bar-line', data: list, xKey: 'date', barKey: 'value', barName: 'Order Value (₹)', lineKey: 'orders', lineName: 'Orders' }, table: list,
          columns: ['date', 'orders', 'value', 'avgOrderValue'] });
          break;
        }

        case 'cancelled-orders': {
          const { data: orders } = await supabase.from('orders').select('order_number, total, payment_status, notes, created_at, user_id, profiles!left(full_name, email)').gte('created_at', since).eq('status', 'cancelled') as any;
          const allOrders = (orders || []);
          const totalOrders = allOrders.length;
          const totalValue = allOrders.reduce((s: number, o: any) => s + Number(o.total), 0);
          const daily: Record<string, number> = {};
          allOrders.forEach((o: any) => {
            const date = new Date(o.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
            daily[date] = (daily[date] || 0) + 1;
          });
          const list = allOrders.map((o: any) => ({
            orderNumber: o.order_number, customer: o.profiles?.full_name || o.profiles?.email || 'Guest',
            orderValue: o.total, paymentStatus: o.payment_status,
            cancellationReason: o.notes || '-', date: new Date(o.created_at).toLocaleDateString('en-IN')
          }));
          setData({ kpis: [
            { label: 'Total Orders', value: totalOrders, icon: ShoppingCart, color: 'blue' },
            { label: 'Total Order Value', value: fmt(totalValue), icon: DollarSign, color: 'green' },
            { label: 'Cancelled Orders', value: totalOrders, icon: AlertTriangle, color: 'red' },
            { label: 'Returned Orders', value: 0, icon: Package, color: 'amber' },
          ], chart: { type: 'bar', data: Object.entries(daily).map(([date, count]) => ({ date, count })), xKey: 'date', yKey: 'count', yLabel: 'Cancellations' }, table: list,
          columns: ['orderNumber', 'customer', 'orderValue', 'paymentStatus', 'cancellationReason', 'date'] });
          break;
        }

        // ── DELIVERY ──────────────────────────────────────────────────────────

        case 'delivery-status': {
          const { data: deliveries } = await supabase.from('deliveries').select('*, orders!inner(order_number)').gte('created_at', since) as any;
          const allDel = (deliveries || []);
          const total = allDel.length;
          const delivered = allDel.filter((d: any) => d.status === 'delivered').length;
          const failed = allDel.filter((d: any) => d.status === 'failed').length;
          const codPending = allDel.filter((d: any) => d.is_cod && !d.cod_collected).reduce((s: number, d: any) => s + Number(d.cod_amount || 0), 0);
          const grouped: Record<string, number> = {};
          allDel.forEach((d: any) => { grouped[d.status] = (grouped[d.status] || 0) + 1; });
          const list = allDel.map((d: any) => ({
            orderNumber: d.orders?.order_number || '-', partner: d.partner_name || '-',
            tracking: d.tracking_number || '-', status: d.status,
            estimatedDelivery: d.estimated_date ? new Date(d.estimated_date).toLocaleDateString('en-IN') : '-',
            deliveredAt: d.delivered_at ? new Date(d.delivered_at).toLocaleDateString('en-IN') : '-'
          }));
          setData({ kpis: [
            { label: 'Total Shipments', value: total, icon: Package, color: 'blue' },
            { label: 'Delivered', value: delivered, icon: TrendingUp, color: 'green' },
            { label: 'Failed', value: failed, icon: AlertTriangle, color: 'red' },
            { label: 'COD Pending', value: fmt(codPending), icon: DollarSign, color: 'amber' },
          ], chart: { type: 'donut', data: Object.entries(grouped).map(([name, value]) => ({ name, value })) }, table: list,
          columns: ['orderNumber', 'partner', 'tracking', 'status', 'estimatedDelivery', 'deliveredAt'] });
          break;
        }

        case 'cod-collection': {
          const { data: deliveries } = await supabase.from('deliveries').select('*, orders!inner(order_number)').gte('created_at', since).eq('is_cod', true) as any;
          const allDel = (deliveries || []);
          const total = allDel.length;
          const delivered = allDel.filter((d: any) => d.status === 'delivered').length;
          const failed = allDel.filter((d: any) => d.status === 'failed').length;
          const codPending = allDel.filter((d: any) => !d.cod_collected).reduce((s: number, d: any) => s + Number(d.cod_amount || 0), 0);
          const daily: Record<string, any> = {};
          allDel.forEach((d: any) => {
            const date = new Date(d.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
            if (!daily[date]) daily[date] = { date, collected: 0, pending: 0 };
            if (d.cod_collected) daily[date].collected += Number(d.cod_amount || 0);
            else daily[date].pending += Number(d.cod_amount || 0);
          });
          const list = allDel.map((d: any) => ({
            orderNumber: d.orders?.order_number || '-', partner: d.partner_name || '-',
            codAmount: d.cod_amount || 0, collected: d.cod_collected ? 'Yes' : 'No',
            deliveredDate: d.delivered_at ? new Date(d.delivered_at).toLocaleDateString('en-IN') : '-',
            notes: d.notes || '-'
          }));
          setData({ kpis: [
            { label: 'Total Shipments', value: total, icon: Package, color: 'blue' },
            { label: 'Delivered', value: delivered, icon: TrendingUp, color: 'green' },
            { label: 'Failed', value: failed, icon: AlertTriangle, color: 'red' },
            { label: 'COD Pending', value: fmt(codPending), icon: DollarSign, color: 'amber' },
          ], chart: { type: 'bar-stacked', data: Object.values(daily), xKey: 'date', keys: [{ key: 'collected', color: '#10B981', name: 'Collected' }, { key: 'pending', color: '#EF4444', name: 'Pending' }] }, table: list,
          columns: ['orderNumber', 'partner', 'codAmount', 'collected', 'deliveredDate', 'notes'] });
          break;
        }

        case 'delivery-performance': {
          const { data: deliveries } = await supabase.from('deliveries').select('partner_name, status, created_at, delivered_at').gte('created_at', since) as any;
          const allDel = (deliveries || []);
          const total = allDel.length;
          const delivered = allDel.filter((d: any) => d.status === 'delivered').length;
          const failed = allDel.filter((d: any) => d.status === 'failed').length;
          const codPending = 0;
          const grouped: Record<string, any> = {};
          allDel.forEach((d: any) => {
            const partner = d.partner_name || 'Unknown';
            if (!grouped[partner]) grouped[partner] = { partner, shipments: 0, delivered: 0, failed: 0, totalDays: 0, deliveredCount: 0 };
            grouped[partner].shipments += 1;
            if (d.status === 'delivered') {
              grouped[partner].delivered += 1;
              if (d.delivered_at) {
                const days = (new Date(d.delivered_at).getTime() - new Date(d.created_at).getTime()) / 86400000;
                grouped[partner].totalDays += days;
                grouped[partner].deliveredCount += 1;
              }
            }
            if (d.status === 'failed') grouped[partner].failed += 1;
          });
          const list = Object.values(grouped).map((r: any) => ({
            partner: r.partner, shipments: r.shipments,
            avgDeliveryTime: r.deliveredCount > 0 ? (r.totalDays / r.deliveredCount).toFixed(1) + ' days' : '-',
            deliveredPct: r.shipments > 0 ? ((r.delivered / r.shipments) * 100).toFixed(1) + '%' : '0%',
            failedPct: r.shipments > 0 ? ((r.failed / r.shipments) * 100).toFixed(1) + '%' : '0%',
          }));
          const chartData = list.map((r: any) => ({ name: r.partner, avgDays: parseFloat(r.avgDeliveryTime) || 0 }));
          setData({ kpis: [
            { label: 'Total Shipments', value: total, icon: Package, color: 'blue' },
            { label: 'Delivered', value: delivered, icon: TrendingUp, color: 'green' },
            { label: 'Failed', value: failed, icon: AlertTriangle, color: 'red' },
            { label: 'COD Pending', value: fmt(codPending), icon: DollarSign, color: 'amber' },
          ], chart: { type: 'bar', data: chartData, xKey: 'name', yKey: 'avgDays', yLabel: 'Avg Delivery Days' }, table: list,
          columns: ['partner', 'shipments', 'avgDeliveryTime', 'deliveredPct', 'failedPct'] });
          break;
        }

        // ── EXPENSES ──────────────────────────────────────────────────────────

        case 'expense-summary': {
          const { data: expenses } = await supabase.from('expenses').select('amount, date, category').gte('date', since.split('T')[0]);
          const allExp = (expenses || []);
          const total = allExp.reduce((s: number, e: any) => s + Number(e.amount), 0);
          const monthly: Record<string, any> = {};
          allExp.forEach((e: any) => {
            const month = new Date(e.date).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
            if (!monthly[month]) monthly[month] = { month, total: 0, count: 0, topCategory: {} };
            monthly[month].total += Number(e.amount);
            monthly[month].count += 1;
            monthly[month].topCategory[e.category] = (monthly[month].topCategory[e.category] || 0) + Number(e.amount);
          });
          const list = Object.values(monthly).map((m: any) => ({
            month: m.month, totalExpenses: m.total, entries: m.count,
            highestCategory: Object.entries(m.topCategory).sort(([, a], [, b]) => (b as number) - (a as number))[0]?.[0] || '-'
          }));
          const catGroups: Record<string, number> = {};
          allExp.forEach((e: any) => { catGroups[e.category] = (catGroups[e.category] || 0) + Number(e.amount); });
          const topCat = Object.entries(catGroups).sort(([, a], [, b]) => b - a)[0]?.[0] || '-';
          const monthlyAvg = list.length > 0 ? total / list.length : 0;
          setData({ kpis: [
            { label: 'Total Expenses', value: fmt(total), icon: DollarSign, color: 'red' },
            { label: 'Monthly Average', value: fmt(monthlyAvg), icon: TrendingUp, color: 'amber' },
            { label: 'Highest Category', value: topCat, icon: Package, color: 'purple' },
            { label: 'Net Profit (est.)', value: '—', icon: DollarSign, color: 'green' },
          ], chart: { type: 'bar', data: list, xKey: 'month', yKey: 'totalExpenses', yLabel: 'Expenses (₹)' }, table: list,
          columns: ['month', 'totalExpenses', 'entries', 'highestCategory'] });
          break;
        }

        case 'expense-by-category': {
          const { data: expenses } = await supabase.from('expenses').select('amount, category').gte('date', since.split('T')[0]);
          const allExp = (expenses || []);
          const total = allExp.reduce((s: number, e: any) => s + Number(e.amount), 0);
          const grouped: Record<string, any> = {};
          allExp.forEach((e: any) => {
            const cat = e.category;
            if (!grouped[cat]) grouped[cat] = { name: cat, value: 0, count: 0 };
            grouped[cat].value += Number(e.amount);
            grouped[cat].count += 1;
          });
          const list = Object.values(grouped).sort((a: any, b: any) => b.value - a.value).map((r: any) => ({
            ...r, share: total > 0 ? ((r.value / total) * 100).toFixed(1) + '%' : '0%'
          }));
          const topCat = list[0]?.name || '-';
          const monthlyAvg = total / Math.max(parseInt(dateRange) / 30, 1);
          setData({ kpis: [
            { label: 'Total Expenses', value: fmt(total), icon: DollarSign, color: 'red' },
            { label: 'Monthly Average', value: fmt(monthlyAvg), icon: TrendingUp, color: 'amber' },
            { label: 'Highest Category', value: topCat, icon: Package, color: 'purple' },
            { label: 'Categories Count', value: list.length, icon: Package, color: 'green' },
          ], chart: { type: 'donut', data: list.map((r: any) => ({ name: r.name, value: r.value })) }, table: list,
          columns: ['name', 'value', 'share', 'count'] });
          break;
        }

        case 'profit-loss': {
          const { data: orders } = await supabase.from('orders').select('total, created_at').gte('created_at', since).order('created_at');
          const { data: expenses } = await supabase.from('expenses').select('amount, date').gte('date', since.split('T')[0]);
          const allOrders = (orders || []);
          const allExp = (expenses || []);
          const totalRevenue = allOrders.reduce((s: number, o: any) => s + Number(o.total), 0);
          const totalExpenses = allExp.reduce((s: number, e: any) => s + Number(e.amount), 0);
          const totalProfit = totalRevenue - totalExpenses;
          const monthly: Record<string, any> = {};
          allOrders.forEach((o: any) => {
            const period = new Date(o.created_at).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
            if (!monthly[period]) monthly[period] = { period, revenue: 0, expenses: 0, profit: 0, margin: 0 };
            monthly[period].revenue += Number(o.total);
          });
          allExp.forEach((e: any) => {
            const period = new Date(e.date).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
            if (!monthly[period]) monthly[period] = { period, revenue: 0, expenses: 0, profit: 0, margin: 0 };
            monthly[period].expenses += Number(e.amount);
          });
          const list = Object.values(monthly).map((m: any) => ({
            ...m, profit: m.revenue - m.expenses,
            margin: m.revenue > 0 ? ((( m.revenue - m.expenses) / m.revenue) * 100).toFixed(1) + '%' : '0%'
          }));
          const topCat = '-';
          setData({ kpis: [
            { label: 'Total Expenses', value: fmt(totalExpenses), icon: DollarSign, color: 'red' },
            { label: 'Total Revenue', value: fmt(totalRevenue), icon: TrendingUp, color: 'green' },
            { label: 'Highest Category', value: topCat, icon: Package, color: 'purple' },
            { label: 'Net Profit', value: fmt(totalProfit), icon: DollarSign, color: totalProfit >= 0 ? 'green' : 'red' },
          ], chart: { type: 'line', data: list, xKey: 'period', keys: [{ key: 'revenue', color: '#10B981', name: 'Revenue (₹)' }, { key: 'expenses', color: '#EF4444', name: 'Expenses (₹)' }] }, table: list,
          columns: ['period', 'revenue', 'expenses', 'profit', 'margin'] });
          break;
        }

        default:
          setData({ kpis: [], chart: null, table: [], columns: [] });
      }
    } catch (err) {
      console.error('Report fetch error:', err);
      setData({ kpis: [], chart: null, table: [], columns: [] });
    }
    setIsLoading(false);
  };

  const exportCSV = () => {
    if (!data?.table?.length) return;
    const cols = data.columns || Object.keys(data.table[0]);
    const headers = cols;
    const rows = data.table.map((d: any) => cols.map((h: string) => d[h] ?? ''));
    const csv = [headers, ...rows].map((r: any[]) => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${report.id}-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  const renderChart = () => {
    if (!data?.chart) return null;
    const { type, data: chartData, xKey, yKey, keys, xLabel, yLabel, barKey, barName, lineKey, lineName } = data.chart;

    if (!chartData?.length) return null;

    return (
      <Card>
        <CardContent className="pt-6">
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              {type === 'donut' ? (
                <PieChart>
                  <Pie data={chartData} cx="50%" cy="50%" innerRadius={70} outerRadius={110} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                    {chartData.map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => fmt(v)} contentStyle={CustomTooltipStyle} />
                  <Legend />
                </PieChart>
              ) : type === 'bar-horizontal' ? (
                <BarChart data={chartData.slice(0, 15)} layout="vertical" margin={{ left: 20, right: 30 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis type="number" tickFormatter={(v) => `₹${(v/1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
                  <YAxis dataKey={yKey} type="category" width={140} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: number) => fmt(v)} contentStyle={CustomTooltipStyle} />
                  <Bar dataKey={xKey} fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                </BarChart>
              ) : type === 'bar' ? (
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey={xKey} tick={{ fontSize: 11 }} />
                  <YAxis tickFormatter={(v) => typeof v === 'number' && v > 1000 ? `₹${(v/1000).toFixed(0)}k` : v} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: number) => typeof v === 'number' && v > 100 ? fmt(v) : v} contentStyle={CustomTooltipStyle} />
                  <Legend />
                  <Bar dataKey={yKey} fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name={yLabel || yKey} />
                </BarChart>
              ) : type === 'bar-stacked' ? (
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey={xKey} tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip contentStyle={CustomTooltipStyle} />
                  <Legend />
                  {(keys || []).map((k: any) => (
                    <Bar key={k.key} dataKey={k.key} stackId="a" fill={k.color} name={k.name} />
                  ))}
                </BarChart>
              ) : type === 'line' ? (
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey={xKey} tick={{ fontSize: 11 }} />
                  <YAxis tickFormatter={(v) => typeof v === 'number' && v > 1000 ? `₹${(v/1000).toFixed(0)}k` : v} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: number) => typeof v === 'number' && v > 100 ? fmt(v) : v} contentStyle={CustomTooltipStyle} />
                  <Legend />
                  {(keys || []).map((k: any) => (
                    <Line key={k.key} type="monotone" dataKey={k.key} stroke={k.color} strokeWidth={2} dot={false} name={k.name} />
                  ))}
                </LineChart>
              ) : type === 'line-dual' ? (
                <ComposedChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey={xKey} tick={{ fontSize: 11 }} />
                  <YAxis yAxisId="left" tickFormatter={(v) => `₹${(v/1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} />
                  <Tooltip contentStyle={CustomTooltipStyle} />
                  <Legend />
                  {(keys || []).map((k: any) =>
                    k.yAxisId === 'right'
                      ? <Line key={k.key} yAxisId="right" type="monotone" dataKey={k.key} stroke={k.color} strokeWidth={2} dot={false} name={k.name} />
                      : <Line key={k.key} yAxisId="left" type="monotone" dataKey={k.key} stroke={k.color} strokeWidth={2} dot={false} name={k.name} />
                  )}
                </ComposedChart>
              ) : type === 'composed-bar-line' ? (
                <ComposedChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey={xKey} tick={{ fontSize: 11 }} />
                  <YAxis yAxisId="left" tickFormatter={(v) => `₹${(v/1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} />
                  <Tooltip contentStyle={CustomTooltipStyle} />
                  <Legend />
                  <Bar yAxisId="left" dataKey={barKey} fill="hsl(var(--primary))" name={barName} radius={[4, 4, 0, 0]} />
                  <Line yAxisId="right" type="monotone" dataKey={lineKey} stroke="#10B981" strokeWidth={2} dot={false} name={lineName} />
                </ComposedChart>
              ) : type === 'scatter' ? (
                <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="x" name="Units Sold" tick={{ fontSize: 11 }} label={{ value: 'Units Sold', position: 'insideBottom', offset: -10, fontSize: 11 }} />
                  <YAxis dataKey="y" name="Stock" tick={{ fontSize: 11 }} label={{ value: 'Current Stock', angle: -90, position: 'insideLeft', fontSize: 11 }} />
                  <Tooltip cursor={{ strokeDasharray: '3 3' }} contentStyle={CustomTooltipStyle} formatter={(v, name) => [v, name]} />
                  <Scatter data={chartData} fill="hsl(var(--primary))" fillOpacity={0.7} />
                </ScatterChart>
              ) : null}
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    );
  };

  const renderTable = () => {
    if (!data?.table?.length) return null;
    const cols: string[] = data.columns || Object.keys(data.table[0]);
    const formatCell = (key: string, val: any) => {
      if (val === null || val === undefined) return '-';
      if (typeof val === 'number') {
        if (['revenue', 'amount', 'value', 'price', 'profit', 'expenses', 'total', 'spend', 'avgOrder', 'avgOrderValue', 'avgSellingPrice', 'firstOrderValue', 'refundAmount', 'codAmount', 'netRevenue', 'discount', 'totalExpenses', 'totalSpend'].some(k => key.toLowerCase().includes(k.toLowerCase())))
          return fmt(val);
        return fmtNum(val);
      }
      return String(val);
    };
    const colLabel = (key: string) => key.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ').replace(/^\w/, c => c.toUpperCase());
    return (
      <Card>
        <CardContent className="p-0">
          <div className="overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">#</TableHead>
                  {cols.map(col => <TableHead key={col}>{colLabel(col)}</TableHead>)}
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.table.map((row: any, i: number) => (
                  <TableRow key={i}>
                    <TableCell className="text-muted-foreground text-xs">{i + 1}</TableCell>
                    {cols.map(col => (
                      <TableCell key={col}>
                        {col === 'status' || col === 'turnover' || col === 'collected' ? (
                          <Badge variant={
                            (row[col] === 'delivered' || row[col] === 'In Stock' || row[col] === 'Fast' || row[col] === 'Active' || row[col] === 'Yes' || row[col] === 'paid') ? 'default'
                            : (row[col] === 'Out of Stock' || row[col] === 'failed' || row[col] === 'Blocked' || row[col] === 'No' || row[col] === 'cancelled' || row[col] === 'returned') ? 'destructive'
                            : 'secondary'
                          }>{formatCell(col, row[col])}</Badge>
                        ) : formatCell(col, row[col])}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    );
  };

  if (isLoading) return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[1,2,3,4].map(i => <ShimmerCard key={i} className="h-20" />)}
      </div>
      <ShimmerCard className="h-80" />
      <ShimmerCard className="h-64" />
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <Select value={dateRange} onValueChange={setDateRange}>
          <SelectTrigger className="w-40">
            <Calendar className="h-4 w-4 mr-2 text-muted-foreground" /><SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Last 7 days</SelectItem>
            <SelectItem value="30">Last 30 days</SelectItem>
            <SelectItem value="90">Last 90 days</SelectItem>
            <SelectItem value="180">Last 6 months</SelectItem>
            <SelectItem value="365">Last year</SelectItem>
          </SelectContent>
        </Select>

        {['sales-by-customer', 'sales-summary', 'orders-by-status', 'order-fulfillment'].includes(report.id) && (
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-44"><SelectValue placeholder="Order Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="delivered">Delivered</SelectItem>
              <SelectItem value="shipped">Shipped</SelectItem>
              <SelectItem value="confirmed">Confirmed</SelectItem>
              <SelectItem value="new">New</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
              <SelectItem value="returned">Returned</SelectItem>
            </SelectContent>
          </Select>
        )}

        <Button variant="outline" onClick={exportCSV} disabled={!data?.table?.length}>
          <Download className="h-4 w-4 mr-2" />Export CSV
        </Button>
      </div>

      {/* KPI Cards */}
      {data?.kpis?.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {data.kpis.map((kpi: KPI, i: number) => <KPICard key={i} kpi={kpi} />)}
        </div>
      )}

      {/* Chart */}
      {renderChart()}

      {/* Table */}
      {data?.table?.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            No data available for this report in the selected date range.
          </CardContent>
        </Card>
      ) : renderTable()}
    </div>
  );
}
