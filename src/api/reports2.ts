import { supabase } from '@/integrations/supabase/client';

export type Reports2QueryParams = {
  fromISO: string;
  toISO: string;
  prevFromISO: string;
  prevToISO: string;
  fromDate: string;
  toDate: string;
};

export type Reports2Dataset = {
  orders: any[];
  prevOrders: any[];
  expenses: any[];
  deliveries: any[];
  payments: any[];
  refunds: any[];
  customers: any[];
  orderItems: any[];
};

export async function fetchReports2Dataset(params: Reports2QueryParams): Promise<Reports2Dataset> {
  const [ordersRes, prevOrdersRes, expensesRes, deliveriesRes, paymentsRes, refundsRes] = await Promise.all([
    supabase
      .from('orders')
      .select('id, total, subtotal, discount, shipping_charge, tax, status, payment_status, payment_method, created_at, user_id')
      .gte('created_at', params.fromISO)
      .lte('created_at', params.toISO)
      .order('created_at', { ascending: true })
      .limit(5000),
    supabase
      .from('orders')
      .select('id, total, payment_status, payment_method')
      .gte('created_at', params.prevFromISO)
      .lte('created_at', params.prevToISO)
      .limit(5000),
    supabase
      .from('expenses')
      .select('amount, category, date')
      .gte('date', params.fromDate)
      .lte('date', params.toDate)
      .limit(5000),
    supabase
      .from('deliveries')
      .select('id, status, order_id, created_at')
      .gte('created_at', params.fromISO)
      .lte('created_at', params.toISO)
      .limit(5000),
    supabase
      .from('payments')
      .select('id, amount, status, method, order_id, created_at')
      .gte('created_at', params.fromISO)
      .lte('created_at', params.toISO)
      .limit(5000),
    supabase
      .from('refunds')
      .select('id, amount, status, created_at')
      .gte('created_at', params.fromISO)
      .lte('created_at', params.toISO)
      .limit(5000),
  ]);

  const rootError = [
    ordersRes.error,
    prevOrdersRes.error,
    expensesRes.error,
    deliveriesRes.error,
    paymentsRes.error,
    refundsRes.error,
  ].find(Boolean);

  if (rootError) throw rootError;

  const orders = ordersRes.data || [];
  const orderIds = Array.from(new Set(orders.map((order: any) => order.id).filter(Boolean)));
  const userIds = Array.from(new Set(orders.map((order: any) => order.user_id).filter(Boolean)));

  const profilesPromise = userIds.length > 0
    ? supabase.from('profiles').select('id, user_id, full_name, created_at').in('user_id', userIds)
    : Promise.resolve({ data: [], error: null } as any);

  const orderItemsPromise = orderIds.length > 0
    ? supabase.from('order_items').select('order_id, product_name, product_id, quantity, total, price').in('order_id', orderIds)
    : Promise.resolve({ data: [], error: null } as any);

  const [profilesRes, orderItemsRes] = await Promise.all([profilesPromise, orderItemsPromise]);

  const secondaryError = [profilesRes.error, orderItemsRes.error].find(Boolean);
  if (secondaryError) throw secondaryError;

  return {
    orders,
    prevOrders: prevOrdersRes.data || [],
    expenses: expensesRes.data || [],
    deliveries: deliveriesRes.data || [],
    payments: paymentsRes.data || [],
    refunds: refundsRes.data || [],
    customers: profilesRes.data || [],
    orderItems: orderItemsRes.data || [],
  };
}
