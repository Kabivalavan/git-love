/**
 * Centralized Admin API Layer
 * All admin Supabase calls go through here — components never call supabase directly.
 */
import { supabase } from '@/integrations/supabase/client';
import type { Product, Category, Order, Banner } from '@/types/database';

// ─── Store Settings ───
export async function fetchAllStoreSettings() {
  const { data, error } = await supabase
    .from('store_settings')
    .select('key, value');
  if (error) throw error;
  return data || [];
}

export async function upsertStoreSetting(key: string, value: Record<string, unknown>) {
  const { data: existing } = await supabase
    .from('store_settings')
    .select('id')
    .eq('key', key)
    .single();

  if (existing) {
    const { error } = await supabase
      .from('store_settings')
      .update({ value: value as any })
      .eq('key', key);
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from('store_settings')
      .insert({ key, value: value as any });
    if (error) throw error;
  }
}

// ─── Products ───
export async function fetchAdminProducts() {
  const [{ data, error }, { data: processingOrders }] = await Promise.all([
    supabase
      .from('products')
      .select('*, category:categories(*), images:product_images(*), variants:product_variants(*)')
      .order('created_at', { ascending: false }),
    supabase
      .from('orders')
      .select('id')
      .in('status', ['new', 'confirmed', 'packed']),
  ]);

  if (error) throw error;

  const productsList = (data || []) as unknown as Product[];
  const processingMap: Record<string, number> = {};

  if (processingOrders && processingOrders.length > 0) {
    const orderIds = processingOrders.map((order) => order.id);
    const { data: items } = await supabase
      .from('order_items')
      .select('product_id, quantity')
      .in('order_id', orderIds);

    (items || []).forEach((item: any) => {
      if (!item.product_id) return;
      processingMap[item.product_id] = (processingMap[item.product_id] || 0) + Number(item.quantity || 0);
    });
  }

  return productsList.map((product) => ({
    ...product,
    processing_qty: processingMap[product.id] || 0,
  }));
}

export async function fetchAdminProductsPaginated(from: number, to: number) {
  const { data, error, count } = await supabase
    .from('products')
    .select('*, category:categories(*), images:product_images(*), variants:product_variants(*)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to);
  if (error) throw error;
  return { data: (data || []) as unknown as Product[], count: count || 0 };
}

export async function fetchProductVariants(productId: string) {
  const { data, error } = await supabase
    .from('product_variants')
    .select('*')
    .eq('product_id', productId)
    .eq('is_active', true)
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function saveProduct(
  productData: any,
  imageUrls: string[],
  variantRecords: any[],
  existingProductId?: string
) {
  let productId: string;

  if (existingProductId) {
    const { error } = await supabase.from('products').update(productData).eq('id', existingProductId);
    if (error) throw error;
    productId = existingProductId;
    // Delete old images and variants BEFORE re-inserting
    await supabase.from('product_images').delete().eq('product_id', productId);
    await supabase.from('product_variants').delete().eq('product_id', productId);
  } else {
    const { data, error } = await supabase.from('products').insert([productData]).select().single();
    if (error) throw error;
    productId = data.id;
  }

  // Insert images
  if (imageUrls.length > 0) {
    const imageRecords = imageUrls.map((url, index) => ({
      product_id: productId,
      image_url: url,
      sort_order: index,
      is_primary: index === 0,
    }));
    await supabase.from('product_images').insert(imageRecords);
  }

  // Insert variants
  if (variantRecords.length > 0) {
    const records = variantRecords.map((v) => ({ ...v, product_id: productId }));
    const { error: insertError } = await supabase.from('product_variants').insert(records as any);
    if (insertError) throw insertError;
  }

  return productId;
}

export async function deleteProduct(product: Product) {
  if (product.images) {
    for (const img of product.images) {
      const urlParts = img.image_url.split('/products/');
      if (urlParts.length > 1) {
        await supabase.storage.from('products').remove([urlParts[1]]);
      }
    }
  }
  const { error } = await supabase.from('products').delete().eq('id', product.id);
  if (error) throw error;
}

// ─── Categories ───
export async function fetchAdminCategories() {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return (data || []) as unknown as Category[];
}

export async function saveCategory(categoryData: any, existingId?: string) {
  if (existingId) {
    const { error } = await supabase.from('categories').update(categoryData).eq('id', existingId);
    if (error) throw error;
    return existingId;
  } else {
    const { data, error } = await supabase.from('categories').insert([categoryData]).select().single();
    if (error) throw error;
    return data.id;
  }
}

export async function deleteCategory(id: string) {
  const { error } = await supabase.from('categories').delete().eq('id', id);
  if (error) throw error;
}

// ─── Orders ───
export async function fetchOrders(from: number, to: number) {
  const { data, error, count } = await supabase
    .from('orders')
    .select('*, order_items:order_items(id, product_name, variant_name, quantity)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to);
  if (error) throw error;
  return { data: (data || []) as unknown as Order[], count: count || 0 };
}

export async function fetchOrderDetails(orderId: string) {
  const [itemsRes, deliveryRes, paymentsRes, returnsRes] = await Promise.all([
    supabase.from('order_items').select('*').eq('order_id', orderId),
    supabase.from('deliveries').select('*').eq('order_id', orderId).maybeSingle(),
    supabase.from('payments').select('*').eq('order_id', orderId),
    supabase.from('returns').select('id').eq('order_id', orderId).not('status', 'eq', 'rejected'),
  ]);

  let returnedItems: Record<string, number> = {};
  if (returnsRes.data && returnsRes.data.length > 0) {
    const returnIds = returnsRes.data.map(r => r.id);
    const { data: returnItemsData } = await supabase
      .from('return_items')
      .select('order_item_id, quantity')
      .in('return_id', returnIds);
    (returnItemsData || []).forEach((ri: any) => {
      returnedItems[ri.order_item_id] = (returnedItems[ri.order_item_id] || 0) + ri.quantity;
    });
  }

  return {
    items: itemsRes.data || [],
    delivery: deliveryRes.data,
    payments: paymentsRes.data || [],
    returnedItems,
  };
}

export async function updateOrderStatus(orderId: string, updates: Record<string, any>) {
  const { error } = await supabase.from('orders').update(updates).eq('id', orderId);
  if (error) throw error;
}

// ─── Dashboard ───
export async function fetchDashboardData() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);

  const [ordersRes, productsRes, customersRes, analyticsRes, returnsRes] = await Promise.all([
    supabase
      .from('orders')
      .select('id, order_number, total, status, payment_method, created_at')
      .order('created_at', { ascending: false }),
    supabase
      .from('products')
      .select('id, name, sku, stock_quantity, low_stock_threshold'),
    supabase.from('profiles').select('id'),
    supabase.from('analytics_events').select('id').eq('event_type', 'page_view').gte('created_at', weekAgo.toISOString()),
    supabase.from('returns').select('id', { count: 'exact', head: true }).eq('status', 'requested' as any),
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
  const shippedOrders = ordersData.filter(o => o.status === 'shipped').length;
  const deliveredOrders = ordersData.filter(o => o.status === 'delivered').length;
  const pendingPaymentAmount = ordersData
    .filter(o => o.payment_method !== 'cod' && !['delivered', 'cancelled'].includes(o.status || ''))
    .reduce((sum, o) => {
      // Count orders with pending payment status
      return sum;
    }, 0);
  // Actual pending payments: COD orders that haven't been collected
  const pendingCodAmount = ordersData
    .filter(o => o.payment_method === 'cod' && o.status !== 'cancelled')
    .reduce((sum, o) => sum + Number(o.total), 0);
  const lowStock = productsData.filter(p => p.stock_quantity <= p.low_stock_threshold);
  const avgOrderValue = ordersData.length > 0 ? ordersData.reduce((s, o) => s + Number(o.total), 0) / ordersData.length : 0;
  const codOrders = ordersData.filter(o => o.payment_method === 'cod').length;
  const conversionRate = pageViews > 0 ? (weekOrders.length / pageViews) * 100 : 0;

  // Build daily sales chart
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

  const statusCounts: Record<string, number> = {};
  ordersData.forEach(o => { statusCounts[o.status] = (statusCounts[o.status] || 0) + 1; });

  return {
    stats: {
      todaySales, weekSales, totalOrders: ordersData.length, newOrders, processingOrders, deliveredOrders,
      totalProducts: productsData.length, lowStockProducts: lowStock.length, totalCustomers: customersData.length,
      avgOrderValue, conversionRate, codOrders, onlineOrders: ordersData.length - codOrders,
      returnRequests: returnsRes.count || 0,
    },
    salesChart: Object.values(dailySales),
    orderStatusChart: Object.entries(statusCounts).map(([name, value]) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1), value,
    })),
    recentOrders: ordersData.slice(0, 5),
    lowStockProducts: lowStock.slice(0, 5),
  };
}

export async function fetchLiveViewerStats() {
  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [sessionsRes, todayViewsRes] = await Promise.all([
    supabase.from('analytics_sessions').select('visitor_id').gte('last_active_at', fiveMinAgo),
    supabase.from('analytics_events').select('id', { count: 'exact', head: true }).eq('event_type', 'page_view').gte('created_at', todayStart.toISOString()),
  ]);

  const uniqueVisitors = new Set((sessionsRes.data || []).map((s: any) => s.visitor_id)).size;
  return {
    liveViewers: uniqueVisitors,
    todayPageViews: todayViewsRes.count || 0,
    activeSessions: uniqueVisitors,
  };
}

// ─── Banners ───
export async function fetchAdminBanners() {
  const { data, error } = await supabase
    .from('banners')
    .select('*')
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return (data || []) as unknown as Banner[];
}

// ─── Customers ───
export async function fetchAdminCustomers() {
  const [{ data: profiles, error }, { data: orders }] = await Promise.all([
    supabase.from('profiles').select('*').order('created_at', { ascending: false }),
    supabase.from('orders').select('user_id, total'),
  ]);
  if (error) throw error;

  const orderStats: Record<string, { count: number; total: number }> = {};
  (orders || []).forEach((o: any) => {
    if (!o.user_id) return;
    if (!orderStats[o.user_id]) orderStats[o.user_id] = { count: 0, total: 0 };
    orderStats[o.user_id].count += 1;
    orderStats[o.user_id].total += Number(o.total);
  });

  return (profiles || []).map((p: any) => ({
    ...p,
    order_count: orderStats[p.user_id]?.count || 0,
    total_spent: orderStats[p.user_id]?.total || 0,
  }));
}

export async function fetchAdminCustomersPaginated(from: number, to: number) {
  const { data: profiles, error, count } = await supabase
    .from('profiles')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to);
  if (error) throw error;

  const userIds = (profiles || []).map((p: any) => p.user_id);
  let orderStats: Record<string, { count: number; total: number }> = {};
  if (userIds.length > 0) {
    const { data: orders } = await supabase
      .from('orders')
      .select('user_id, total')
      .in('user_id', userIds);
    (orders || []).forEach((o: any) => {
      if (!o.user_id) return;
      if (!orderStats[o.user_id]) orderStats[o.user_id] = { count: 0, total: 0 };
      orderStats[o.user_id].count += 1;
      orderStats[o.user_id].total += Number(o.total);
    });
  }

  const data = (profiles || []).map((p: any) => ({
    ...p,
    order_count: orderStats[p.user_id]?.count || 0,
    total_spent: orderStats[p.user_id]?.total || 0,
  }));

  return { data, count: count || 0 };
}

// ─── Coupons ───
export async function fetchAdminCoupons() {
  const { data, error } = await supabase
    .from('coupons')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function fetchAdminCouponsPaginated(from: number, to: number) {
  const { data, error, count } = await supabase
    .from('coupons')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to);
  if (error) throw error;
  return { data: data || [], count: count || 0 };
}

// ─── Offers ───
export async function fetchAdminOffers() {
  const { data, error } = await supabase
    .from('offers')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function fetchAdminOffersPaginated(from: number, to: number) {
  const { data, error, count } = await supabase
    .from('offers')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to);
  if (error) throw error;
  return { data: data || [], count: count || 0 };
}

// ─── Expenses ───
export async function fetchAdminExpenses() {
  const { data, error } = await supabase
    .from('expenses')
    .select('*')
    .order('date', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function fetchAdminExpensesPaginated(from: number, to: number) {
  const { data, error, count } = await supabase
    .from('expenses')
    .select('*', { count: 'exact' })
    .order('date', { ascending: false })
    .range(from, to);
  if (error) throw error;
  return { data: data || [], count: count || 0 };
}

// ─── Bundles ───
export async function fetchAdminBundlesPaginated(from: number, to: number) {
  const { data, error, count } = await supabase
    .from('bundles')
    .select('*, items:bundle_items(*, product:products(name, price, images:product_images(*)))', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to);
  if (error) throw error;
  return { data: data || [], count: count || 0 };
}

// ─── Deliveries ───
export async function fetchDeliveries(from: number, to: number, filters?: { status?: string; cod?: string }) {
  let query = supabase
    .from('deliveries')
    .select('*, order:orders(order_number)', { count: 'exact' })
    .order('created_at', { ascending: false });

  if (filters?.status && filters.status !== 'all') query = query.eq('status', filters.status as any);
  if (filters?.cod === 'cod') query = query.eq('is_cod', true);
  if (filters?.cod === 'prepaid') query = query.eq('is_cod', false);
  if (filters?.cod === 'cod_pending') query = query.eq('is_cod', true).eq('cod_collected', false);

  query = query.range(from, to);
  const { data, error, count } = await query;
  if (error) throw error;
  return { data: data || [], count: count || 0 };
}

// ─── Payments ───
export async function fetchPayments(from: number, to: number) {
  const { data, error, count } = await supabase
    .from('payments')
    .select('*, order:orders(order_number)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to);
  if (error) throw error;
  return { data: data || [], count: count || 0 };
}

// ─── Returns ───
export async function fetchAdminReturnsPaginated(from: number, to: number, filters?: { status?: string }) {
  let query = supabase
    .from('returns')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false });

  if (filters?.status && filters.status !== 'all') {
    query = query.eq('status', filters.status as any);
  }

  const { data, error, count } = await query.range(from, to);
  if (error) throw error;
  if (!data || data.length === 0) return { data: [], count: count || 0 };

  const orderIds = [...new Set(data.map((r) => r.order_id).filter(Boolean))];
  const userIds = [...new Set(data.map((r) => r.user_id).filter(Boolean))];
  const returnIds = data.map((r) => r.id);

  const [ordersRes, profilesRes, itemsRes, refundsRes] = await Promise.all([
    orderIds.length > 0
      ? supabase.from('orders').select('id, order_number, total, payment_method').in('id', orderIds)
      : Promise.resolve({ data: [], error: null } as any),
    userIds.length > 0
      ? supabase.from('profiles').select('user_id, full_name, email, mobile_number').in('user_id', userIds)
      : Promise.resolve({ data: [], error: null } as any),
    returnIds.length > 0
      ? supabase.from('return_items').select('*').in('return_id', returnIds)
      : Promise.resolve({ data: [], error: null } as any),
    returnIds.length > 0
      ? supabase.from('refunds').select('*').in('return_id', returnIds)
      : Promise.resolve({ data: [], error: null } as any),
  ]);

  const relatedError = [ordersRes.error, profilesRes.error, itemsRes.error, refundsRes.error].find(Boolean);
  if (relatedError) throw relatedError;

  const ordersMap = new Map((ordersRes.data || []).map((o) => [o.id, o]));
  const profilesMap = new Map((profilesRes.data || []).map((p) => [p.user_id, p]));
  const itemsMap = new Map<string, any[]>();

  (itemsRes.data || []).forEach((item) => {
    const list = itemsMap.get(item.return_id) || [];
    list.push(item);
    itemsMap.set(item.return_id, list);
  });

  const refundsMap = new Map((refundsRes.data || []).map((r) => [r.return_id, r]));

  const result = data.map((r) => ({
    ...r,
    images: (r.images as any) || [],
    order: ordersMap.get(r.order_id) as any,
    profile: profilesMap.get(r.user_id) as any,
    items: itemsMap.get(r.id) || [],
    refund: (refundsMap.get(r.id) as any) || null,
  }));

  return { data: result, count: count || 0 };
}

export async function fetchAdminReturns() {
  const { data, error } = await supabase
    .from('returns')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  if (!data || data.length === 0) return [];

  const orderIds = [...new Set(data.map(r => r.order_id))];
  const userIds = [...new Set(data.map(r => r.user_id))];
  const returnIds = data.map(r => r.id);

  const [ordersRes, profilesRes, itemsRes, refundsRes] = await Promise.all([
    supabase.from('orders').select('id, order_number, total, payment_method').in('id', orderIds),
    supabase.from('profiles').select('user_id, full_name, email, mobile_number').in('user_id', userIds),
    supabase.from('return_items').select('*').in('return_id', returnIds),
    supabase.from('refunds').select('*').in('return_id', returnIds),
  ]);

  const ordersMap = new Map((ordersRes.data || []).map(o => [o.id, o]));
  const profilesMap = new Map((profilesRes.data || []).map(p => [p.user_id, p]));
  const itemsMap = new Map<string, any[]>();
  (itemsRes.data || []).forEach(item => {
    const list = itemsMap.get(item.return_id) || [];
    list.push(item);
    itemsMap.set(item.return_id, list);
  });
  const refundsMap = new Map((refundsRes.data || []).map(r => [r.return_id, r]));

  return data.map(r => ({
    ...r,
    images: (r.images as any) || [],
    order: ordersMap.get(r.order_id) as any,
    profile: profilesMap.get(r.user_id) as any,
    items: itemsMap.get(r.id) || [],
    refund: refundsMap.get(r.id) as any || null,
  }));
}

// ─── Analytics ───
export async function fetchAnalyticsData(since: string, until: string) {
  const [eventsRes, orderItemsRes, ordersRes, profilesRes, sessionsRes] = await Promise.all([
    supabase.from('analytics_events').select('*').gte('created_at', since).lte('created_at', until).order('created_at', { ascending: false }).limit(5000),
    supabase.from('order_items').select('product_name, quantity, total').gte('created_at', since).lte('created_at', until),
    supabase.from('orders').select('id, total, user_id, created_at, status').gte('created_at', since).lte('created_at', until),
    supabase.from('profiles').select('user_id, created_at').gte('created_at', since).lte('created_at', until),
    supabase.from('analytics_sessions').select('*').gte('created_at', since).lte('created_at', until).limit(5000),
  ]);

  const eventsList = eventsRes.data || [];
  const ordersList = ordersRes.data || [];
  const orderItemsList = orderItemsRes.data || [];
  const sessionsList = (sessionsRes.data || []) as any[];

  // Fetch product names for product views
  const productViewEvents = eventsList.filter(e => e.event_type === 'product_view');
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

  return {
    eventsList,
    ordersList,
    orderItemsList,
    sessionsList,
    newCustomersCount: (profilesRes.data || []).length,
    productNames,
    productViewsMap,
  };
}
