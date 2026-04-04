import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const ADMIN_USER_ID = '8c3337c6-b9a1-46ea-97ef-7a53f5a6be6a';
  
  // Get product IDs
  const { data: products } = await supabase.from('products').select('id').eq('is_active', true).limit(10);
  const productIds = (products || []).map((p: any) => p.id);

  const names = ['Arun Kumar','Priya Sharma','Rajesh Nair','Sneha Patel','Vikram Singh','Meera Reddy','Deepak Joshi','Anita Verma','Suresh Menon','Kavitha Iyer','Rohit Gupta','Pooja Das','Manoj Pillai','Lakshmi Rao','Karthik S','Divya Nanda','Amit Chauhan','Sonal Mehta','Rahul Bhat','Neha Kapoor'];
  const cities = ['Mumbai','Delhi','Bangalore','Chennai','Hyderabad','Pune','Kolkata','Ahmedabad','Jaipur','Lucknow','Kochi','Indore','Bhopal','Nagpur','Coimbatore','Surat','Chandigarh','Madurai','Mangalore','Trivandrum'];
  const states = ['Maharashtra','Delhi','Karnataka','Tamil Nadu','Telangana','Maharashtra','West Bengal','Gujarat','Rajasthan','Uttar Pradesh','Kerala','Madhya Pradesh','Madhya Pradesh','Maharashtra','Tamil Nadu','Gujarat','Punjab','Tamil Nadu','Karnataka','Kerala'];
  const statuses = ['new','confirmed','packed','shipped','delivered','cancelled','returned'];
  const payStatuses = ['pending','paid','failed','refunded','partial'];
  const payMethods = ['online','cod','wallet'];
  const delStatuses = ['pending','assigned','picked','in_transit','delivered','failed'];
  const retStatuses = ['requested','approved','rejected','in_transit','received','refunded','completed'];
  const expCats = ['ads','packaging','delivery','staff','rent','utilities','software','other','purchase'];
  const expDescs = ['Google Ads campaign','Facebook Ads','Instagram promo','Bubble wrap','Corrugated boxes','Shipping labels','Delhivery charges','BlueDart pickup','Staff salary','Part-time staff','Office rent','Warehouse rent','Electricity bill','Internet bill','Software tools','Raw material','Inventory restock','Packaging tape','Return shipping','Photography','Product samples','Market research','Consulting fees','Trade show fees','Brand design'];
  const reasons = ['Damaged product','Wrong item received','Size does not fit','Quality not as expected','Changed my mind'];
  const couriers = ['Delhivery','BlueDart','DTDC','Ecom Express'];

  const pad = (n: number, len: number) => String(n).padStart(len, '0');
  const daysAgo = (n: number) => new Date(Date.now() - n * 86400000).toISOString();

  const results: string[] = [];

  // ORDERS (250)
  const orderRows = [];
  for (let i = 0; i < 250; i++) {
    const st = statuses[i % 7];
    const ps = st === 'delivered' ? 'paid' : st === 'cancelled' ? 'failed' : st === 'new' ? 'pending' : payStatuses[i % 5];
    const pm = payMethods[i % 3];
    const subtotal = 500 + (i * 37) % 4500;
    const discount = (i * 13) % 300;
    const tax = (i * 7) % 200;
    const ship = subtotal > 999 ? 0 : 49;
    orderRows.push({
      order_number: 'ORD' + new Date(Date.now() - i * 86400000).toISOString().slice(0,10).replace(/-/g,'') + pad(i % 10000, 4),
      user_id: ADMIN_USER_ID,
      status: st, payment_status: ps, payment_method: pm,
      subtotal, discount, tax, shipping_charge: ship,
      total: subtotal - discount + tax + ship,
      shipping_address: { full_name: names[i%20], address_line1: `${100+i} Street ${i%50}`, city: cities[i%20], state: states[i%20], pincode: pad(600000+(i*31)%40000,6), mobile_number: '9'+pad(800000000+i*137,9) },
      created_at: daysAgo(i * 0.5),
    });
  }

  const allOrderIds: any[] = [];
  for (let b = 0; b < orderRows.length; b += 50) {
    const { data, error } = await supabase.from('orders').insert(orderRows.slice(b, b+50)).select('id,total,payment_method,payment_status,status,created_at,user_id');
    if (error) { results.push(`Orders batch err: ${error.message}`); continue; }
    allOrderIds.push(...(data || []));
  }
  results.push(`Orders: ${allOrderIds.length}`);

  // ORDER ITEMS
  const itemRows: any[] = [];
  for (const o of allOrderIds) {
    const cnt = 1 + (itemRows.length % 3);
    for (let j = 0; j < cnt; j++) {
      itemRows.push({
        order_id: o.id,
        product_id: productIds.length > 0 ? productIds[(itemRows.length+j) % productIds.length] : null,
        product_name: 'Product Item ' + (j+1),
        quantity: 1+(j%3), price: 200+(j*47)%2000,
        total: (1+(j%3)) * (200+(j*47)%2000),
        created_at: o.created_at,
      });
    }
  }
  for (let b = 0; b < itemRows.length; b += 100) {
    const { error } = await supabase.from('order_items').insert(itemRows.slice(b, b+100));
    if (error) results.push(`Items err: ${error.message}`);
  }
  results.push(`Order items: ${itemRows.length}`);

  // DELIVERIES (220)
  const delRows: any[] = [];
  for (let i = 0; i < Math.min(220, allOrderIds.length); i++) {
    const o = allOrderIds[i]; const ds = delStatuses[i%6];
    delRows.push({
      order_id: o.id, status: ds, partner_name: couriers[i%4],
      tracking_number: 'TRK'+pad(i,8), tracking_url: 'https://track.example.com/TRK'+pad(i,8),
      estimated_date: new Date(Date.now()+(3+i%7)*86400000).toISOString(),
      delivered_at: ds==='delivered' ? daysAgo(i%10) : null,
      delivery_charge: Number(o.total)>999?0:49,
      is_cod: o.payment_method==='cod',
      cod_amount: o.payment_method==='cod'?o.total:null,
      cod_collected: o.payment_method==='cod'&&ds==='delivered',
      created_at: o.created_at,
    });
  }
  for (let b = 0; b < delRows.length; b += 50) {
    const { error } = await supabase.from('deliveries').insert(delRows.slice(b, b+50));
    if (error) results.push(`Deliveries err: ${error.message}`);
  }
  results.push(`Deliveries: ${delRows.length}`);

  // PAYMENTS (230)
  const payRows: any[] = [];
  for (let i = 0; i < Math.min(230, allOrderIds.length); i++) {
    const o = allOrderIds[i];
    payRows.push({
      order_id: o.id, amount: o.total, method: o.payment_method,
      status: o.payment_status||'pending',
      transaction_id: o.payment_method==='online'?'pay_'+o.id.slice(0,12):null,
      created_at: o.created_at,
    });
  }
  for (let b = 0; b < payRows.length; b += 50) {
    const { error } = await supabase.from('payments').insert(payRows.slice(b, b+50));
    if (error) results.push(`Payments err: ${error.message}`);
  }
  results.push(`Payments: ${payRows.length}`);

  // RETURNS (from delivered/returned orders)
  const deliveredOrders = allOrderIds.filter((o: any) => o.status==='delivered'||o.status==='returned');
  const retRows: any[] = [];
  for (let i = 0; i < Math.min(210, deliveredOrders.length); i++) {
    const o = deliveredOrders[i];
    retRows.push({
      return_number: 'RET'+new Date(o.created_at).toISOString().slice(0,10).replace(/-/g,'')+pad(i%10000,4),
      order_id: o.id, user_id: ADMIN_USER_ID,
      status: retStatuses[i%7], reason: reasons[i%5],
      reason_details: i%2===0?'Product arrived with visible scratches':null,
      created_at: daysAgo(i*0.5),
    });
  }
  const returnIds: any[] = [];
  for (let b = 0; b < retRows.length; b += 50) {
    const { data, error } = await supabase.from('returns').insert(retRows.slice(b, b+50)).select('id,order_id');
    if (error) results.push(`Returns err: ${error.message}`);
    else returnIds.push(...(data||[]));
  }
  results.push(`Returns: ${returnIds.length}`);

  // RETURN ITEMS
  if (returnIds.length > 0) {
    const orderIdsForRet = [...new Set(returnIds.map((r: any) => r.order_id))].slice(0,100);
    const { data: oItems } = await supabase.from('order_items').select('id,order_id,product_id,product_name,price').in('order_id', orderIdsForRet);
    const oItemMap: Record<string, any[]> = {};
    for (const oi of (oItems||[])) { if (!oItemMap[oi.order_id]) oItemMap[oi.order_id]=[]; oItemMap[oi.order_id].push(oi); }
    const riRows: any[] = [];
    for (const r of returnIds) {
      const items = oItemMap[r.order_id];
      if (items?.length) { const oi=items[0]; riRows.push({ return_id:r.id, order_item_id:oi.id, product_id:oi.product_id, product_name:oi.product_name, quantity:1, price:oi.price }); }
    }
    for (let b = 0; b < riRows.length; b += 50) {
      const { error } = await supabase.from('return_items').insert(riRows.slice(b, b+50));
      if (error) results.push(`Return items err: ${error.message}`);
    }
    results.push(`Return items: ${riRows.length}`);
  }

  return new Response(JSON.stringify({ success: true, results }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
