import { useEffect, useState, useMemo } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Eye, ShoppingCart, TrendingUp, Users, Package, BarChart3, MousePointer, ArrowDownToLine, AlertTriangle } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';

interface AnalyticsData {
  totalPageViews: number;
  uniqueSessions: number;
  productViews: { product_id: string; product_name: string; views: number }[];
  mostOrdered: { product_name: string; total_orders: number }[];
  pageViews: { page: string; views: number }[];
  dailyViews: { date: string; views: number }[];
  engagementByProduct: { product_id: string; product_name: string; views: number; cart_adds: number; orders: number; conversion: number }[];
  cartAbandonment: { addedToCart: number; purchased: number; abandonmentRate: number };
  scrollDepth: { depth25: number; depth50: number; depth75: number; depth100: number };
  revenueByDay: { date: string; revenue: number; orders: number }[];
  totalRevenue: number;
  totalOrders: number;
  avgOrderValue: number;
  newCustomers: number;
  returningCustomers: number;
}

function MetricCard({ icon: Icon, label, value, color = 'primary', subtext }: { icon: any; label: string; value: string | number; color?: string; subtext?: string }) {
  const colorMap: Record<string, string> = {
    primary: 'bg-primary/10 text-primary',
    green: 'bg-green-500/10 text-green-600',
    amber: 'bg-amber-500/10 text-amber-600',
    purple: 'bg-purple-500/10 text-purple-600',
    red: 'bg-red-500/10 text-red-600',
    blue: 'bg-blue-500/10 text-blue-600',
  };
  return (
    <Card>
      <CardContent className="p-4 flex items-center gap-3">
        <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${colorMap[color] || colorMap.primary}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-xl font-bold">{value}</p>
          {subtext && <p className="text-[10px] text-muted-foreground">{subtext}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

export default function AdminAnalytics() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [dateRange, setDateRange] = useState('7');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    if (dateRange !== 'custom') fetchAnalytics();
  }, [dateRange]);

  const getDateRange = () => {
    if (dateRange === 'custom' && customFrom && customTo) {
      return { since: new Date(customFrom).toISOString(), until: new Date(customTo + 'T23:59:59').toISOString() };
    }
    const daysAgo = new Date();
    daysAgo.setDate(daysAgo.getDate() - parseInt(dateRange));
    return { since: daysAgo.toISOString(), until: new Date().toISOString() };
  };

  const fetchAnalytics = async () => {
    setIsLoading(true);
    const { since, until } = getDateRange();

    try {
      const [eventsRes, orderItemsRes, ordersRes, profilesRes] = await Promise.all([
        supabase.from('analytics_events').select('*').gte('created_at', since).lte('created_at', until).order('created_at', { ascending: false }).limit(5000),
        supabase.from('order_items').select('product_name, quantity, total').gte('created_at', since).lte('created_at', until),
        supabase.from('orders').select('id, total, user_id, created_at, status').gte('created_at', since).lte('created_at', until),
        supabase.from('profiles').select('user_id, created_at').gte('created_at', since).lte('created_at', until),
      ]);

      const eventsList = eventsRes.data || [];
      const ordersList = ordersRes.data || [];
      const orderItemsList = orderItemsRes.data || [];

      const pageViews = eventsList.filter(e => e.event_type === 'page_view');
      const productViewEvents = eventsList.filter(e => e.event_type === 'product_view');
      const cartAddEvents = eventsList.filter(e => e.event_type === 'add_to_cart');
      const scrollEvents = eventsList.filter(e => e.event_type === 'scroll_depth');

      const uniqueSessions = new Set(eventsList.map(e => e.session_id).filter(Boolean)).size;

      // Page views by page
      const pageViewsMap = new Map<string, number>();
      pageViews.forEach(e => {
        const p = e.page_path || '/';
        pageViewsMap.set(p, (pageViewsMap.get(p) || 0) + 1);
      });
      const pageViewsList = Array.from(pageViewsMap.entries())
        .map(([page, views]) => ({ page, views }))
        .sort((a, b) => b.views - a.views)
        .slice(0, 15);

      // Product views
      const productViewsMap = new Map<string, number>();
      productViewEvents.forEach(e => {
        if (e.product_id) productViewsMap.set(e.product_id, (productViewsMap.get(e.product_id) || 0) + 1);
      });

      const productIds = Array.from(productViewsMap.keys());
      let productNames: Record<string, string> = {};
      if (productIds.length > 0) {
        const { data: products } = await supabase.from('products').select('id, name').in('id', productIds);
        products?.forEach(p => { productNames[p.id] = p.name; });
      }

      const productViewsList = Array.from(productViewsMap.entries())
        .map(([product_id, views]) => ({ product_id, product_name: productNames[product_id] || 'Unknown', views }))
        .sort((a, b) => b.views - a.views)
        .slice(0, 15);

      // Most ordered
      const orderedMap = new Map<string, number>();
      orderItemsList.forEach(item => {
        orderedMap.set(item.product_name, (orderedMap.get(item.product_name) || 0) + item.quantity);
      });
      const mostOrdered = Array.from(orderedMap.entries())
        .map(([product_name, total_orders]) => ({ product_name, total_orders }))
        .sort((a, b) => b.total_orders - a.total_orders)
        .slice(0, 15);

      // Daily views
      const dailyMap = new Map<string, number>();
      pageViews.forEach(e => {
        const date = new Date(e.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
        dailyMap.set(date, (dailyMap.get(date) || 0) + 1);
      });
      const dailyViews = Array.from(dailyMap.entries()).map(([date, views]) => ({ date, views })).reverse();

      // Cart adds map
      const cartAddsMap = new Map<string, number>();
      cartAddEvents.forEach(e => {
        if (e.product_id) cartAddsMap.set(e.product_id, (cartAddsMap.get(e.product_id) || 0) + 1);
      });

      // Engagement by product
      const engagementByProduct = productViewsList.map(pv => {
        const cartAdds = cartAddsMap.get(pv.product_id) || 0;
        const orders = orderedMap.get(pv.product_name) || 0;
        return { ...pv, cart_adds: cartAdds, orders, conversion: pv.views > 0 ? Math.round((orders / pv.views) * 100) : 0 };
      });

      // Cart abandonment
      const cartAddSessions = new Set(cartAddEvents.map(e => e.session_id).filter(Boolean));
      const purchaseSessions = new Set(eventsList.filter(e => e.event_type === 'purchase').map(e => e.session_id).filter(Boolean));
      const addedToCart = cartAddSessions.size;
      const purchased = purchaseSessions.size;
      const abandonmentRate = addedToCart > 0 ? Math.round(((addedToCart - purchased) / addedToCart) * 100) : 0;

      // Scroll depth
      const scrollDepthCounts = { depth25: 0, depth50: 0, depth75: 0, depth100: 0 };
      scrollEvents.forEach(e => {
        const depth = (e.metadata as any)?.depth;
        if (depth === 25) scrollDepthCounts.depth25++;
        else if (depth === 50) scrollDepthCounts.depth50++;
        else if (depth === 75) scrollDepthCounts.depth75++;
        else if (depth === 100) scrollDepthCounts.depth100++;
      });

      // Revenue by day
      const revenueByDayMap = new Map<string, { revenue: number; orders: number }>();
      ordersList.filter(o => o.status !== 'cancelled' && o.status !== 'returned').forEach(o => {
        const date = new Date(o.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
        const existing = revenueByDayMap.get(date) || { revenue: 0, orders: 0 };
        existing.revenue += Number(o.total);
        existing.orders++;
        revenueByDayMap.set(date, existing);
      });
      const revenueByDay = Array.from(revenueByDayMap.entries())
        .map(([date, d]) => ({ date, ...d }))
        .reverse();

      const validOrders = ordersList.filter(o => o.status !== 'cancelled' && o.status !== 'returned');
      const totalRevenue = validOrders.reduce((s, o) => s + Number(o.total), 0);
      const totalOrders = validOrders.length;
      const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

      // Customer acquisition
      const newCustomers = (profilesRes.data || []).length;
      const uniqueOrderUsers = new Set(ordersList.map(o => o.user_id).filter(Boolean));
      const returningCustomers = uniqueOrderUsers.size;

      setData({
        totalPageViews: pageViews.length,
        uniqueSessions,
        productViews: productViewsList,
        mostOrdered,
        pageViews: pageViewsList,
        dailyViews,
        engagementByProduct,
        cartAbandonment: { addedToCart, purchased, abandonmentRate },
        scrollDepth: scrollDepthCounts,
        revenueByDay,
        totalRevenue,
        totalOrders,
        avgOrderValue,
        newCustomers,
        returningCustomers,
      });
    } catch (err) {
      console.error(err);
      toast({ title: 'Error', description: 'Failed to fetch analytics', variant: 'destructive' });
    }
    setIsLoading(false);
  };

  return (
    <AdminLayout title="Analytics" description="Comprehensive store analytics and insights">
      <div className="space-y-6">
        {/* Date filter */}
        <div className="flex items-end gap-3 flex-wrap">
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">Today</SelectItem>
              <SelectItem value="7">Last 7 Days</SelectItem>
              <SelectItem value="30">Last 30 Days</SelectItem>
              <SelectItem value="90">Last 90 Days</SelectItem>
              <SelectItem value="365">Last Year</SelectItem>
              <SelectItem value="custom">Custom Range</SelectItem>
            </SelectContent>
          </Select>
          {dateRange === 'custom' && (
            <>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">From</label>
                <Input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} className="w-40 h-9" />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">To</label>
                <Input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} className="w-40 h-9" />
              </div>
              <button onClick={fetchAnalytics} className="h-9 px-4 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90">Apply</button>
            </>
          )}
        </div>

        <Tabs defaultValue="overview" className="w-full">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="products">Products</TabsTrigger>
            <TabsTrigger value="engagement">Engagement</TabsTrigger>
            <TabsTrigger value="revenue">Revenue</TabsTrigger>
          </TabsList>

          {/* OVERVIEW TAB */}
          <TabsContent value="overview" className="space-y-6 mt-4">
            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              <MetricCard icon={Eye} label="Page Views" value={isLoading ? '...' : data?.totalPageViews || 0} />
              <MetricCard icon={Users} label="Visitors" value={isLoading ? '...' : data?.uniqueSessions || 0} color="green" />
              <MetricCard icon={MousePointer} label="Product Views" value={isLoading ? '...' : data?.productViews.reduce((s, p) => s + p.views, 0) || 0} color="amber" />
              <MetricCard icon={ShoppingCart} label="Cart Adds" value={isLoading ? '...' : data?.cartAbandonment.addedToCart || 0} color="blue" />
              <MetricCard icon={Package} label="Orders" value={isLoading ? '...' : data?.totalOrders || 0} color="purple" />
              <MetricCard icon={TrendingUp} label="Avg Pages/Visit" value={isLoading ? '...' : data && data.uniqueSessions > 0 ? (data.totalPageViews / data.uniqueSessions).toFixed(1) : '0'} />
            </div>

            {/* Daily Views Chart */}
            {data && data.dailyViews.length > 0 && (
              <Card>
                <CardHeader><CardTitle className="flex items-center gap-2 text-base"><BarChart3 className="h-5 w-5" /> Daily Page Views</CardTitle></CardHeader>
                <CardContent>
                  <div className="flex items-end gap-1 h-40">
                    {data.dailyViews.map((d, i) => {
                      const maxViews = Math.max(...data.dailyViews.map(v => v.views), 1);
                      const height = (d.views / maxViews) * 100;
                      return (
                        <div key={i} className="flex-1 flex flex-col items-center gap-1">
                          <span className="text-[10px] text-muted-foreground">{d.views}</span>
                          <div className="w-full bg-primary/80 rounded-t-sm transition-all" style={{ height: `${Math.max(height, 4)}%` }} />
                          <span className="text-[9px] text-muted-foreground truncate w-full text-center">{d.date}</span>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Cart Abandonment + Scroll Depth + Customer Acquisition */}
            <div className="grid md:grid-cols-3 gap-4">
              <Card>
                <CardHeader><CardTitle className="text-base flex items-center gap-2"><AlertTriangle className="h-5 w-5" /> Cart Abandonment</CardTitle></CardHeader>
                <CardContent>
                  {isLoading ? <p className="text-sm text-muted-foreground">Loading...</p> : (
                    <div className="space-y-3">
                      <div className="text-center">
                        <p className="text-4xl font-bold text-destructive">{data?.cartAbandonment.abandonmentRate || 0}%</p>
                        <p className="text-xs text-muted-foreground mt-1">Abandonment Rate</p>
                      </div>
                      <Separator />
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Added to cart</span>
                        <span className="font-medium">{data?.cartAbandonment.addedToCart || 0}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Completed purchase</span>
                        <span className="font-medium">{data?.cartAbandonment.purchased || 0}</span>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-base flex items-center gap-2"><ArrowDownToLine className="h-5 w-5" /> Scroll Depth</CardTitle></CardHeader>
                <CardContent>
                  {isLoading ? <p className="text-sm text-muted-foreground">Loading...</p> : (
                    <div className="space-y-3">
                      {[
                        { label: '25%', value: data?.scrollDepth.depth25 || 0 },
                        { label: '50%', value: data?.scrollDepth.depth50 || 0 },
                        { label: '75%', value: data?.scrollDepth.depth75 || 0 },
                        { label: '100%', value: data?.scrollDepth.depth100 || 0 },
                      ].map(item => (
                        <div key={item.label} className="flex items-center gap-3">
                          <span className="text-sm font-medium w-10">{item.label}</span>
                          <div className="flex-1 h-3 bg-muted rounded-full overflow-hidden">
                            <div className="h-full bg-primary/70 rounded-full transition-all" style={{ width: `${Math.min(100, (item.value / Math.max(data?.scrollDepth.depth25 || 1, 1)) * 100)}%` }} />
                          </div>
                          <span className="text-xs text-muted-foreground w-8 text-right">{item.value}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-base flex items-center gap-2"><Users className="h-5 w-5" /> Customer Acquisition</CardTitle></CardHeader>
                <CardContent>
                  {isLoading ? <p className="text-sm text-muted-foreground">Loading...</p> : (
                    <div className="space-y-3">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">New Signups</span>
                        <span className="font-bold text-lg">{data?.newCustomers || 0}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Unique Buyers</span>
                        <span className="font-bold text-lg">{data?.returningCustomers || 0}</span>
                      </div>
                      <Separator />
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Avg Order Value</span>
                        <span className="font-bold">Rs {data?.avgOrderValue.toFixed(0) || 0}</span>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Top Pages */}
            <Card>
              <CardHeader><CardTitle className="text-base">Top Pages</CardTitle></CardHeader>
              <CardContent>
                {isLoading ? <p className="text-sm text-muted-foreground">Loading...</p> : !data?.pageViews.length ? (
                  <p className="text-sm text-muted-foreground">No page views tracked yet.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow><TableHead>Page</TableHead><TableHead className="text-right">Views</TableHead></TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.pageViews.map((p, i) => (
                        <TableRow key={i}>
                          <TableCell className="font-mono text-sm">{p.page}</TableCell>
                          <TableCell className="text-right"><Badge variant="secondary">{p.views}</Badge></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* PRODUCTS TAB */}
          <TabsContent value="products" className="space-y-6 mt-4">
            <div className="grid md:grid-cols-2 gap-6">
              <Card>
                <CardHeader><CardTitle className="text-base flex items-center gap-2"><Eye className="h-5 w-5" /> Most Viewed Products</CardTitle></CardHeader>
                <CardContent>
                  {isLoading ? <p className="text-sm text-muted-foreground">Loading...</p> : !data?.productViews.length ? (
                    <p className="text-sm text-muted-foreground">No product views tracked yet.</p>
                  ) : (
                    <Table>
                      <TableHeader><TableRow><TableHead>#</TableHead><TableHead>Product</TableHead><TableHead className="text-right">Views</TableHead></TableRow></TableHeader>
                      <TableBody>
                        {data.productViews.map((p, i) => (
                          <TableRow key={i}>
                            <TableCell className="font-medium">{i + 1}</TableCell>
                            <TableCell className="text-sm">{p.product_name}</TableCell>
                            <TableCell className="text-right"><Badge variant="secondary">{p.views}</Badge></TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-base flex items-center gap-2"><ShoppingCart className="h-5 w-5" /> Most Ordered Products</CardTitle></CardHeader>
                <CardContent>
                  {isLoading ? <p className="text-sm text-muted-foreground">Loading...</p> : !data?.mostOrdered.length ? (
                    <p className="text-sm text-muted-foreground">No orders yet.</p>
                  ) : (
                    <Table>
                      <TableHeader><TableRow><TableHead>#</TableHead><TableHead>Product</TableHead><TableHead className="text-right">Sold</TableHead></TableRow></TableHeader>
                      <TableBody>
                        {data.mostOrdered.map((p, i) => (
                          <TableRow key={i}>
                            <TableCell className="font-medium">{i + 1}</TableCell>
                            <TableCell className="text-sm">{p.product_name}</TableCell>
                            <TableCell className="text-right"><Badge>{p.total_orders}</Badge></TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* ENGAGEMENT TAB */}
          <TabsContent value="engagement" className="space-y-6 mt-4">
            <Card>
              <CardHeader><CardTitle className="text-base flex items-center gap-2"><TrendingUp className="h-5 w-5" /> Product Engagement Funnel</CardTitle></CardHeader>
              <CardContent>
                {isLoading ? <p className="text-sm text-muted-foreground">Loading...</p> : !data?.engagementByProduct.length ? (
                  <p className="text-sm text-muted-foreground">No engagement data yet.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Product</TableHead>
                        <TableHead className="text-right">Views</TableHead>
                        <TableHead className="text-right">Cart Adds</TableHead>
                        <TableHead className="text-right">Orders</TableHead>
                        <TableHead className="text-right">Conversion</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.engagementByProduct.map((p, i) => (
                        <TableRow key={i}>
                          <TableCell className="text-sm font-medium">{p.product_name}</TableCell>
                          <TableCell className="text-right">{p.views}</TableCell>
                          <TableCell className="text-right">{p.cart_adds}</TableCell>
                          <TableCell className="text-right">{p.orders}</TableCell>
                          <TableCell className="text-right">
                            <Badge variant={p.conversion > 5 ? "default" : "secondary"}>{p.conversion}%</Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* REVENUE TAB */}
          <TabsContent value="revenue" className="space-y-6 mt-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <MetricCard icon={TrendingUp} label="Total Revenue" value={isLoading ? '...' : `Rs ${data?.totalRevenue.toFixed(0) || 0}`} color="green" />
              <MetricCard icon={Package} label="Total Orders" value={isLoading ? '...' : data?.totalOrders || 0} color="blue" />
              <MetricCard icon={ShoppingCart} label="Avg Order Value" value={isLoading ? '...' : `Rs ${data?.avgOrderValue.toFixed(0) || 0}`} color="purple" />
              <MetricCard icon={Users} label="Unique Buyers" value={isLoading ? '...' : data?.returningCustomers || 0} color="amber" />
            </div>

            {/* Revenue Chart */}
            {data && data.revenueByDay.length > 0 && (
              <Card>
                <CardHeader><CardTitle className="text-base">Daily Revenue</CardTitle></CardHeader>
                <CardContent>
                  <div className="flex items-end gap-1 h-48">
                    {data.revenueByDay.map((d, i) => {
                      const maxRev = Math.max(...data.revenueByDay.map(v => v.revenue), 1);
                      const height = (d.revenue / maxRev) * 100;
                      return (
                        <div key={i} className="flex-1 flex flex-col items-center gap-1">
                          <span className="text-[9px] text-muted-foreground">Rs {(d.revenue / 1000).toFixed(1)}k</span>
                          <div className="w-full bg-green-500/70 rounded-t-sm transition-all" style={{ height: `${Math.max(height, 4)}%` }} />
                          <span className="text-[9px] text-muted-foreground truncate w-full text-center">{d.date}</span>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Revenue Table */}
            {data && data.revenueByDay.length > 0 && (
              <Card>
                <CardHeader><CardTitle className="text-base">Revenue Breakdown</CardTitle></CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow><TableHead>Date</TableHead><TableHead className="text-right">Orders</TableHead><TableHead className="text-right">Revenue</TableHead></TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.revenueByDay.map((d, i) => (
                        <TableRow key={i}>
                          <TableCell>{d.date}</TableCell>
                          <TableCell className="text-right">{d.orders}</TableCell>
                          <TableCell className="text-right font-medium">Rs {d.revenue.toFixed(0)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}
