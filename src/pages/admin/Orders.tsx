import { useEffect, useState, useCallback } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import {
  ArrowLeft, Package, Truck, MapPin, CreditCard, Loader2, Download, Search, MessageCircle
} from 'lucide-react';
import type { Order, OrderItem, OrderStatus, ShippingAddress, Delivery, DeliveryStatus, Payment, StoreInfo } from '@/types/database';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import jsPDF from 'jspdf';
import { usePaginatedFetch } from '@/hooks/usePaginatedFetch';

const ORDER_STATUSES: OrderStatus[] = ['new', 'confirmed', 'packed', 'shipped', 'delivered', 'cancelled', 'returned'];
const DELIVERY_STATUSES: DeliveryStatus[] = ['pending', 'assigned', 'picked', 'in_transit', 'delivered', 'failed'];

// Different colors for order statuses
const orderStatusColors: Record<OrderStatus, string> = {
  new: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  confirmed: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200',
  packed: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  shipped: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
  delivered: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  cancelled: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  returned: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
};

// Different colors for payment statuses
const paymentStatusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  paid: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  failed: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  refunded: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  partial: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
};

// Different colors for delivery statuses
const deliveryStatusColors: Record<string, string> = {
  pending: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
  assigned: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  picked: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200',
  in_transit: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
  delivered: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  failed: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
};

export default function AdminOrders() {
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [delivery, setDelivery] = useState<Delivery | null>(null);
  const [deliveryEdit, setDeliveryEdit] = useState<Partial<Delivery>>({});
  const [payments, setPayments] = useState<Payment[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isUpdatingDelivery, setIsUpdatingDelivery] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [storeInfo, setStoreInfo] = useState<StoreInfo | null>(null);
  const [customerPhone, setCustomerPhone] = useState('');
  const { toast } = useToast();

  const fetchOrdersFn = useCallback(async (from: number, to: number) => {
    const { data, error, count } = await supabase
      .from('orders')
      .select('*, order_items(*)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to);
    if (error) toast({ title: 'Error', description: error.message, variant: 'destructive' });
    return { data: (data || []) as unknown as Order[], count: count || 0 };
  }, []);

  const { items: orders, isLoading, isLoadingMore, hasMore, sentinelRef, fetchInitial: fetchOrders } = usePaginatedFetch<Order>({
    pageSize: 30,
    fetchFn: fetchOrdersFn,
  });

  useEffect(() => { fetchOrders(); fetchStoreInfo(); }, []);

  const fetchStoreInfo = async () => {
    const { data } = await supabase.from('store_settings').select('value').eq('key', 'store_info').single();
    if (data) setStoreInfo(data.value as unknown as StoreInfo);
  };

  const fetchOrderDetails = async (orderId: string) => {
    const [itemsRes, deliveryRes, paymentsRes] = await Promise.all([
      supabase.from('order_items').select('*').eq('order_id', orderId),
      supabase.from('deliveries').select('*').eq('order_id', orderId).single(),
      supabase.from('payments').select('*').eq('order_id', orderId),
    ]);
    setOrderItems((itemsRes.data || []) as unknown as OrderItem[]);
    const del = deliveryRes.data as unknown as Delivery || null;
    setDelivery(del);
    setDeliveryEdit(del ? { ...del } : {});
    setPayments((paymentsRes.data || []) as unknown as Payment[]);
  };

  const handleRowClick = (order: Order) => {
    setSelectedOrder(order);
    fetchOrderDetails(order.id);
    // Fetch customer phone
    if (order.user_id) {
      supabase.from('profiles').select('mobile_number').eq('user_id', order.user_id).single().then(({ data }) => {
        setCustomerPhone(data?.mobile_number || '');
      });
    }
  };

  const handleBack = () => {
    setSelectedOrder(null);
    setOrderItems([]);
    setDelivery(null);
    setPayments([]);
    setCustomerPhone('');
  };

  // WhatsApp template helper
  const sendWhatsApp = (phone: string, message: string) => {
    const cleaned = phone.replace(/\D/g, '');
    const intlPhone = cleaned.startsWith('91') ? cleaned : `91${cleaned}`;
    const encoded = encodeURIComponent(message);
    window.open(`https://wa.me/${intlPhone}?text=${encoded}`, '_blank');
  };

  const storeName = storeInfo?.name || 'Our Store';

  const getOrderConfirmationMsg = () => {
    if (!selectedOrder) return '';
    const addr = getAddress();
    const items = orderItems.map(i => `${i.product_name} x${i.quantity}`).join(', ');
    return `Hi ${addr?.full_name || 'there'} 👋\nYour order #${selectedOrder.order_number} has been placed successfully ✅\n\n🛍 Product(s): ${items}\n💰 Order Amount: Rs ${Number(selectedOrder.total).toFixed(0)}\n📍 Delivery Address: ${addr ? `${addr.address_line1}, ${addr.city} - ${addr.pincode}` : 'N/A'}\n\nWe'll notify you once it's shipped 🚚\n– ${storeName}`;
  };

  const getPaymentReminderMsg = () => {
    if (!selectedOrder) return '';
    const addr = getAddress();
    return `Hi ${addr?.full_name || 'there'},\nYour payment of Rs ${Number(selectedOrder.total).toFixed(0)} for order #${selectedOrder.order_number} is still pending ⏳\n\nPlease complete your payment soon.\n\nNeed help? Just reply to this message 😊\n– ${storeName}`;
  };

  const getShippingUpdateMsg = () => {
    if (!selectedOrder) return '';
    const addr = getAddress();
    return `Hi ${addr?.full_name || 'there'} 🎉\nYour order #${selectedOrder.order_number} has been shipped 🚚\n\n📦 Courier: ${delivery?.partner_name || 'N/A'}\n🔗 Track here: ${delivery?.tracking_url || 'N/A'}\n\nSit tight! Your order will reach you soon 😊\n– ${storeName}`;
  };

  const getDeliveryConfirmMsg = () => {
    if (!selectedOrder) return '';
    const addr = getAddress();
    return `Hi ${addr?.full_name || 'there'} 👋\nYour order #${selectedOrder.order_number} has been delivered successfully ✅\n\nWe hope you love your purchase 💖\n\n– ${storeName}`;
  };

  // Fire email trigger (non-blocking)
  const fireEmailTrigger = async (trigger: string, data: Record<string, any>) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      await fetch(
        `https://riqjidlyjyhfpgnjtbqi.supabase.co/functions/v1/email-triggers`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
          body: JSON.stringify({ trigger, data }),
        }
      );
    } catch (e) {
      console.error('Email trigger failed:', e);
    }
  };

  const handleStatusUpdate = async (newStatus: OrderStatus) => {
    if (!selectedOrder) return;
    setIsUpdating(true);
    const { error } = await supabase.from('orders').update({ status: newStatus }).eq('id', selectedOrder.id);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      const addr = getAddress();
      const customerEmail = addr ? (await supabase.from('profiles').select('email').eq('user_id', selectedOrder.user_id).single())?.data?.email : null;
      const customerName = addr?.full_name || 'there';
      const items = orderItems.map(i => `${i.product_name} x${i.quantity}`).join(', ');

      // Auto-create delivery record when status becomes 'packed' (if not already exists)
      if (newStatus === 'packed' && !delivery) {
        const { data: newDel } = await supabase.from('deliveries').insert({
          order_id: selectedOrder.id,
          status: 'pending',
          is_cod: selectedOrder.payment_method === 'cod',
          cod_amount: selectedOrder.payment_method === 'cod' ? selectedOrder.total : null,
          delivery_charge: selectedOrder.shipping_charge || 0,
        }).select().single();
        if (newDel) {
          setDelivery(newDel as unknown as Delivery);
          setDeliveryEdit(newDel as unknown as Delivery);
        }
      }

      // Auto-update delivery status when order is shipped or delivered
      if (newStatus === 'shipped' && delivery) {
        await supabase.from('deliveries').update({ status: 'in_transit' }).eq('id', delivery.id);
        setDelivery({ ...delivery, status: 'in_transit' });
        setDeliveryEdit(prev => ({ ...prev, status: 'in_transit' }));
        await supabase.rpc('finalize_order_stock', { p_order_id: selectedOrder.id });

        // Fire order_shipped email
        if (customerEmail) {
          fireEmailTrigger('order_shipped', {
            email: customerEmail,
            customer_name: customerName,
            order_number: selectedOrder.order_number,
            courier_name: delivery.partner_name || 'Our Delivery Partner',
            tracking_number: delivery.tracking_number || 'N/A',
            estimated_delivery: delivery.estimated_date ? new Date(delivery.estimated_date).toLocaleDateString('en-IN') : '2-5 days',
            tracking_url: delivery.tracking_url || '',
            shop_url: window.location.origin,
          });
        }
      }

      if (newStatus === 'delivered' && delivery) {
        await supabase.from('deliveries').update({ status: 'delivered', delivered_at: new Date().toISOString() }).eq('id', delivery.id);
        setDelivery({ ...delivery, status: 'delivered', delivered_at: new Date().toISOString() });
        setDeliveryEdit(prev => ({ ...prev, status: 'delivered' }));
        await supabase.rpc('finalize_order_stock', { p_order_id: selectedOrder.id });

        // Fire order_delivered email
        if (customerEmail) {
          fireEmailTrigger('order_delivered', {
            email: customerEmail,
            customer_name: customerName,
            order_number: selectedOrder.order_number,
            review_url: `${window.location.origin}/my-orders`,
            next_order_coupon: 'COMEBACK10',
          });
        }
      }

      // Fire order_confirmed email
      if (newStatus === 'confirmed' && customerEmail) {
        fireEmailTrigger('order_created', {
          email: customerEmail,
          customer_name: customerName,
          order_number: selectedOrder.order_number,
          order_items: items,
          order_total: String(Number(selectedOrder.total).toFixed(0)),
          delivery_address: addr ? `${addr.address_line1}, ${addr.city} - ${addr.pincode}` : '',
          tracking_url: `${window.location.origin}/order-tracking/${selectedOrder.order_number}`,
        });
      }

      // Release hold on cancel/return without stock deduction
      if (newStatus === 'cancelled' || newStatus === 'returned') {
        await supabase.rpc('release_stock_hold', { p_user_id: selectedOrder.user_id, p_order_id: selectedOrder.id });
      }
      toast({ title: 'Status updated' });
      setSelectedOrder({ ...selectedOrder, status: newStatus });
      fetchOrders();
    }
    setIsUpdating(false);
  };

  const handleSaveDelivery = async () => {
    if (!delivery) return;
    setIsUpdatingDelivery(true);
    const updateData = {
      status: deliveryEdit.status,
      partner_name: deliveryEdit.partner_name || null,
      tracking_number: deliveryEdit.tracking_number || null,
      tracking_url: deliveryEdit.tracking_url || null,
      estimated_date: deliveryEdit.estimated_date || null,
      notes: deliveryEdit.notes || null,
      delivered_at: deliveryEdit.status === 'delivered' ? new Date().toISOString() : delivery.delivered_at,
    };
    const { error } = await supabase.from('deliveries').update(updateData).eq('id', delivery.id);
    if (error) toast({ title: 'Error', description: error.message, variant: 'destructive' });
    else {
      toast({ title: 'Delivery saved' });
      const updated = { ...delivery, ...updateData } as Delivery;
      setDelivery(updated);
      setDeliveryEdit(updated);
    }
    setIsUpdatingDelivery(false);
  };

  // Keep old handleDeliveryUpdate for status select inline
  const handleDeliveryUpdate = async (field: string, value: string) => {
    setDeliveryEdit(prev => ({ ...prev, [field]: value }));
  };



  const getAddress = (): ShippingAddress | null => {
    if (!selectedOrder?.shipping_address) return null;
    return selectedOrder.shipping_address as ShippingAddress;
  };

  const generateInvoicePDF = () => {
    if (!selectedOrder) return;
    const doc = new jsPDF();
    const addr = getAddress();
    const pw = doc.internal.pageSize.getWidth();
    const ph = doc.internal.pageSize.getHeight();
    const margin = 14;
    const rightEdge = pw - margin;

    // Outer border
    doc.setDrawColor(60);
    doc.setLineWidth(0.6);
    doc.rect(8, 8, pw - 16, ph - 16);

    // === HEADER BAND ===
    doc.setFillColor(30, 30, 30);
    doc.rect(8, 8, pw - 16, 32, 'F');

    // Company name (left)
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(255, 255, 255);
    doc.text(storeInfo?.name || 'Company', margin + 2, 22);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    let chy = 27;
    if (storeInfo?.address) { doc.text(storeInfo.address, margin + 2, chy); chy += 4; }
    if (storeInfo?.contact_phone) { doc.text(`Ph: ${storeInfo.contact_phone}`, margin + 2, chy); chy += 4; }
    if (storeInfo?.contact_email) { doc.text(`Email: ${storeInfo.contact_email}`, margin + 2, chy); }

    // TAX INVOICE (right)
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('TAX INVOICE', rightEdge - 2, 22, { align: 'right' });
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(`Invoice #: ${selectedOrder.order_number}`, rightEdge - 2, 28, { align: 'right' });
    doc.text(`Date: ${new Date(selectedOrder.created_at).toLocaleDateString('en-IN')}`, rightEdge - 2, 33, { align: 'right' });

    // Reset text color
    doc.setTextColor(0, 0, 0);

    // Payment status badge area
    const pmMethod = (selectedOrder.payment_method || 'N/A').toUpperCase();
    const pmStatus = (selectedOrder.payment_status || '').toUpperCase();
    doc.setFillColor(pmStatus === 'PAID' ? 34 : 220, pmStatus === 'PAID' ? 197 : 120, pmStatus === 'PAID' ? 94 : 0);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    const pmText = `${pmMethod} · ${pmStatus}`;
    const pmW = doc.getTextWidth(pmText) + 6;
    doc.rect(rightEdge - pmW - 2, 41, pmW + 4, 7, 'F');
    doc.text(pmText, rightEdge, 46, { align: 'right' });
    doc.setTextColor(0, 0, 0);

    // Divider after header
    doc.setDrawColor(200);
    doc.setLineWidth(0.3);
    doc.line(margin, 52, rightEdge, 52);

    // BILL TO
    doc.setFillColor(248, 248, 248);
    doc.rect(margin, 54, (pw - 28) / 2 - 2, 38, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(80, 80, 80);
    doc.text('BILL TO / SHIP TO:', margin + 3, 61);
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    if (addr) {
      let ay = 67;
      doc.setFont('helvetica', 'bold');
      doc.text(addr.full_name, margin + 3, ay); ay += 5;
      doc.setFont('helvetica', 'normal');
      doc.text(addr.address_line1, margin + 3, ay); ay += 4;
      if (addr.address_line2) { doc.text(addr.address_line2, margin + 3, ay); ay += 4; }
      doc.text(`${addr.city}, ${addr.state} - ${addr.pincode}`, margin + 3, ay); ay += 4;
      doc.text(`Ph: ${addr.mobile_number}`, margin + 3, ay);
    }

    // ITEMS TABLE
    let y = 97;
    // Table header row
    doc.setFillColor(30, 30, 30);
    doc.rect(margin, y - 5, pw - 28, 9, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(255, 255, 255);
    // Columns: sno(14), product(40), variant(90), qty(130), rate(155), amount(180)
    const C = { sno: margin + 2, prod: margin + 10, var: margin + 80, qty: margin + 118, rate: margin + 140, amt: rightEdge - 2 };
    doc.text('S.No', C.sno, y);
    doc.text('Product', C.prod, y);
    doc.text('Variant', C.var, y);
    doc.text('Qty', C.qty, y);
    doc.text('Rate', C.rate, y);
    doc.text('Amount', C.amt, y + 0.5, { align: 'right' });
    y += 7;
    doc.setTextColor(0, 0, 0);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    orderItems.forEach((item, idx) => {
      const rowBg = idx % 2 === 0;
      if (rowBg) {
        doc.setFillColor(250, 250, 250);
        doc.rect(margin, y - 5, pw - 28, 8, 'F');
      }
      doc.text(String(idx + 1), C.sno, y);
      doc.text(item.product_name.substring(0, 35), C.prod, y);
      doc.text((item.variant_name || '-').substring(0, 18), C.var, y);
      doc.text(String(item.quantity), C.qty, y);
      doc.text(`Rs ${Number(item.price).toFixed(2)}`, C.rate, y);
      doc.text(`Rs ${Number(item.total).toFixed(2)}`, C.amt, y, { align: 'right' });
      y += 8;
      doc.setDrawColor(230);
      doc.setLineWidth(0.2);
      doc.line(margin, y - 3, rightEdge, y - 3);
    });

    // Totals section (right-aligned box)
    y += 4;
    const totBoxX = pw / 2 + 10;
    const totBoxW = rightEdge - totBoxX;
    doc.setDrawColor(180);
    doc.setLineWidth(0.3);
    doc.line(totBoxX, y, rightEdge, y);
    y += 5;
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');

    const printTotRow = (label: string, val: string, bold = false) => {
      if (bold) { doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5); } else { doc.setFont('helvetica', 'normal'); doc.setFontSize(8); }
      doc.text(label, totBoxX, y);
      doc.text(val, rightEdge, y, { align: 'right' });
      y += bold ? 0 : 6;
    };

    printTotRow('Subtotal:', `Rs ${Number(selectedOrder.subtotal).toFixed(2)}`);
    if (Number(selectedOrder.discount) > 0) printTotRow('Discount:', `-Rs ${Number(selectedOrder.discount).toFixed(2)}`);
    printTotRow('Shipping:', `Rs ${Number(selectedOrder.shipping_charge).toFixed(2)}`);
    if (Number(selectedOrder.tax) > 0) printTotRow('Tax:', `Rs ${Number(selectedOrder.tax).toFixed(2)}`);
    doc.setDrawColor(40);
    doc.setLineWidth(0.5);
    doc.line(totBoxX, y, rightEdge, y);
    y += 5;
    printTotRow('Grand Total:', `Rs ${Number(selectedOrder.total).toFixed(2)}`, true);

    // Footer
    const footerY = ph - 22;
    doc.setDrawColor(150);
    doc.setLineWidth(0.3);
    doc.line(margin, footerY, rightEdge, footerY);
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7);
    doc.setTextColor(100, 100, 100);
    doc.text('Thank you for your purchase!', pw / 2, footerY + 6, { align: 'center' });
    doc.text(`${storeInfo?.name || ''} | ${storeInfo?.contact_email || ''} | ${storeInfo?.contact_phone || ''}`, pw / 2, footerY + 11, { align: 'center' });

    doc.save(`Invoice-${selectedOrder.order_number}.pdf`);
  };

  const generateChallanPDF = () => {
    if (!selectedOrder) return;
    const doc = new jsPDF({ orientation: 'landscape', format: 'a5' });
    const addr = getAddress();
    const pw = doc.internal.pageSize.getWidth();
    const ph = doc.internal.pageSize.getHeight();
    const margin = 8;

    // Border
    doc.setDrawColor(40);
    doc.setLineWidth(0.7);
    doc.rect(5, 5, pw - 10, ph - 10);

    // Header
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('DELIVERY CHALLAN', pw / 2, 16, { align: 'center' });

    doc.setDrawColor(100);
    doc.setLineWidth(0.3);
    doc.line(margin, 20, pw - margin, 20);

    // Order info row
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(`Order #: ${selectedOrder.order_number}`, margin + 2, 26);
    doc.text(`Date: ${new Date(selectedOrder.created_at).toLocaleDateString('en-IN')}`, pw / 2, 26, { align: 'center' });
    doc.text(`Payment: ${selectedOrder.payment_method?.toUpperCase() || 'N/A'} (${selectedOrder.payment_status?.toUpperCase()})`, pw - margin - 2, 26, { align: 'right' });

    doc.line(margin, 29, pw - margin, 29);

    // Two columns: DELIVER TO (left) | Company details (right)
    const colMid = pw / 2;

    // LEFT: Deliver To
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('DELIVER TO:', margin + 2, 36);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    if (addr) {
      let ay = 42;
      doc.setFont('helvetica', 'bold');
      doc.text(addr.full_name, margin + 2, ay); ay += 4;
      doc.setFont('helvetica', 'normal');
      doc.text(addr.address_line1, margin + 2, ay); ay += 4;
      if (addr.address_line2) { doc.text(addr.address_line2, margin + 2, ay); ay += 4; }
      doc.text(`${addr.city}, ${addr.state} - ${addr.pincode}`, margin + 2, ay); ay += 4;
      doc.text(`Phone: ${addr.mobile_number}`, margin + 2, ay);
      if (addr.landmark) { ay += 4; doc.text(`Landmark: ${addr.landmark}`, margin + 2, ay); }
    }

    // Vertical divider
    doc.setDrawColor(180);
    doc.line(colMid, 30, colMid, 64);

    // RIGHT: Company / Store details
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text(storeInfo?.name || 'Company', colMid + 5, 36);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    let cy = 41;
    if (storeInfo?.address) { doc.text(storeInfo.address, colMid + 5, cy); cy += 4; }
    if (storeInfo?.contact_phone) { doc.text(`Ph: ${storeInfo.contact_phone}`, colMid + 5, cy); cy += 4; }
    if (storeInfo?.contact_email) { doc.text(`Email: ${storeInfo.contact_email}`, colMid + 5, cy); cy += 4; }

    // COD info below company
    if (delivery?.is_cod) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      cy += 2;
      doc.text(`COD: Rs ${Number(delivery.cod_amount).toFixed(0)} (${delivery.cod_collected ? 'Collected' : 'Pending'})`, colMid + 5, cy);
    }

    // Items table
    let y = 68;
    doc.setDrawColor(40);
    doc.setLineWidth(0.5);
    doc.line(margin, y - 2, pw - margin, y - 2);

    // Table header
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    const cols = [10, 20, 95, 120, 148, 175];
    doc.text('S.No', cols[0], y);
    doc.text('Product Name', cols[1], y);
    doc.text('Variant', cols[2], y);
    doc.text('Qty', cols[3], y);
    doc.text('Rate (Rs)', cols[4], y);
    doc.text('Amount (Rs)', cols[5], y);
    y += 2;
    doc.line(margin, y, pw - margin, y);
    y += 5;

    // Table rows
    doc.setFont('helvetica', 'normal');
    orderItems.forEach((item, idx) => {
      doc.text(String(idx + 1), cols[0], y);
      doc.text(item.product_name.substring(0, 38), cols[1], y);
      doc.text(item.variant_name || '-', cols[2], y);
      doc.text(String(item.quantity), cols[3], y);
      doc.text(`Rs ${Number(item.price).toFixed(0)}`, cols[4], y);
      doc.text(`Rs ${Number(item.total).toFixed(0)}`, cols[5], y);
      y += 6;
    });

    // Totals
    doc.line(margin, y, pw - margin, y);
    y += 5;
    doc.setFontSize(8);
    doc.text('Subtotal:', cols[4], y); doc.text(`Rs ${Number(selectedOrder.subtotal).toFixed(0)}`, cols[5], y); y += 5;
    if (Number(selectedOrder.discount) > 0) {
      doc.text('Discount:', cols[4], y); doc.text(`-Rs ${Number(selectedOrder.discount).toFixed(0)}`, cols[5], y); y += 5;
    }
    doc.text('Shipping:', cols[4], y); doc.text(`Rs ${Number(selectedOrder.shipping_charge).toFixed(0)}`, cols[5], y); y += 5;
    doc.line(cols[4], y - 2, pw - margin, y - 2);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('Grand Total:', cols[4], y + 2); doc.text(`Rs ${Number(selectedOrder.total).toFixed(0)}`, cols[5], y + 2);

    // Footer signatures
    y = ph - 22;
    doc.setDrawColor(100);
    doc.setLineWidth(0.3);
    doc.line(margin, y - 4, pw - margin, y - 4);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.text('Received By: ___________________', 10, y);
    doc.text('Date: ___________________', pw / 2 - 20, y);
    doc.text('Signature: ___________________', pw - 65, y);

    doc.save(`Challan-${selectedOrder.order_number}.pdf`);
  };

  const filteredOrders = orders.filter(o =>
    o.order_number.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Order detail view
  if (selectedOrder) {
    const address = getAddress();
    return (
      <AdminLayout title={`Order ${selectedOrder.order_number}`} description="Manage order details">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <Button variant="ghost" onClick={handleBack} size="sm">
            <ArrowLeft className="h-4 w-4 mr-1" /> Back
          </Button>
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={generateInvoicePDF}>
              <Download className="h-4 w-4 mr-1" /> Invoice
            </Button>
            <Button variant="outline" size="sm" onClick={generateChallanPDF}>
              <Download className="h-4 w-4 mr-1" /> Challan
            </Button>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 space-y-4">
            {/* Status */}
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="space-y-1">
                    <Label className="text-xs">Order Status</Label>
                    <Select value={selectedOrder.status} onValueChange={handleStatusUpdate} disabled={isUpdating}>
                      <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {ORDER_STATUSES.map(s => (
                          <SelectItem key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {isUpdating && <Loader2 className="h-4 w-4 animate-spin" />}
                  {/* Payment status */}
                  <div className="space-y-1">
                    <Label className="text-xs">Payment</Label>
                    {selectedOrder.payment_method === 'cod' ? (
                      <Select
                        value={selectedOrder.payment_status}
                        onValueChange={async (val) => {
                          const typedVal = val as 'pending' | 'paid' | 'failed' | 'refunded' | 'partial';
                          await supabase.from('orders').update({ payment_status: typedVal }).eq('id', selectedOrder.id);
                          const { data: paymentRecord } = await supabase.from('payments').select('id').eq('order_id', selectedOrder.id).eq('method', 'cod').single();
                          if (paymentRecord) {
                            await supabase.from('payments').update({ status: typedVal }).eq('id', paymentRecord.id);
                          }
                          setSelectedOrder({ ...selectedOrder, payment_status: typedVal });
                          fetchOrders();
                          toast({ title: 'Payment status updated' });
                        }}
                      >
                        <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="paid">Received</SelectItem>
                          <SelectItem value="partial">Partial</SelectItem>
                          <SelectItem value="failed">Failed</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ${paymentStatusColors[selectedOrder.payment_status] || ''}`}>
                        {selectedOrder.payment_status}
                      </span>
                    )}
                  </div>
                  <Badge variant="outline" className="mt-5">{selectedOrder.payment_method?.toUpperCase() || 'N/A'}</Badge>
                </div>
              </CardContent>
            </Card>

            {/* Items */}
            <Card>
              <CardHeader className="py-3 px-4"><CardTitle className="text-base">Order Items</CardTitle></CardHeader>
              <CardContent className="px-4 pb-4">
                <div className="space-y-3">
                  {/* Group bundle items */}
                  {(() => {
                    const bundleGroups: Record<string, any[]> = {};
                    const individuals: any[] = [];
                    orderItems.forEach(item => {
                      if (item.bundle_id) {
                        if (!bundleGroups[item.bundle_id]) bundleGroups[item.bundle_id] = [];
                        bundleGroups[item.bundle_id].push(item);
                      } else {
                        individuals.push(item);
                      }
                    });
                    return (
                      <>
                        {Object.entries(bundleGroups).map(([bId, items]) => (
                          <div key={bId} className="border border-primary/30 rounded-lg overflow-hidden">
                            <div className="bg-primary/10 px-3 py-2 flex items-center gap-2">
                              <span className="text-xs font-semibold text-primary">🎁 Bundle: {items[0]?.bundle_name || 'Bundle Deal'}</span>
                            </div>
                            <div className="divide-y">
                              {items.map((item: any) => (
                                <div key={item.id} className="flex justify-between items-start p-3">
                                  <div>
                                    <p className="font-medium text-sm">{item.product_name}</p>
                                    {item.variant_name && (
                                      <Badge className="text-[10px] mt-0.5 bg-secondary text-secondary-foreground">{item.variant_name}</Badge>
                                    )}
                                    <p className="text-xs text-muted-foreground mt-0.5">SKU: {item.sku || 'N/A'} · Qty: {item.quantity} × ₹{Number(item.price).toFixed(2)}</p>
                                  </div>
                                  <p className="font-semibold text-sm">₹{Number(item.total).toFixed(2)}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                        {individuals.map((item: any) => (
                          <div key={item.id} className="flex justify-between items-start p-3 bg-muted/50 rounded-lg">
                            <div>
                              <p className="font-medium text-sm">{item.product_name}</p>
                              {item.variant_name && (
                                <Badge className="text-[10px] mt-0.5 bg-secondary text-secondary-foreground">{item.variant_name}</Badge>
                              )}
                              <p className="text-xs text-muted-foreground mt-0.5">SKU: {item.sku || 'N/A'} · Qty: {item.quantity} × ₹{Number(item.price).toFixed(2)}</p>
                            </div>
                            <p className="font-semibold text-sm">₹{Number(item.total).toFixed(2)}</p>
                          </div>
                        ))}
                      </>
                    );
                  })()}

                  <Separator />
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>₹{Number(selectedOrder.subtotal).toFixed(2)}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Discount</span><span>-₹{Number(selectedOrder.discount).toFixed(2)}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Shipping</span><span>₹{Number(selectedOrder.shipping_charge).toFixed(2)}</span></div>
                    <Separator />
                    <div className="flex justify-between font-bold"><span>Total</span><span>₹{Number(selectedOrder.total).toFixed(2)}</span></div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Delivery */}
            {delivery && (
              <Card>
                <CardHeader className="py-3 px-4">
                  <CardTitle className="text-base flex items-center gap-2"><Truck className="h-4 w-4" /> Delivery Details</CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4 space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Status</Label>
                      <Select value={deliveryEdit.status || delivery.status} onValueChange={v => handleDeliveryUpdate('status', v)}>
                        <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {DELIVERY_STATUSES.map(s => (
                            <SelectItem key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1).replace('_', ' ')}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Courier / Partner</Label>
                      <Input className="h-9" value={deliveryEdit.partner_name || ''} onChange={e => setDeliveryEdit(p => ({ ...p, partner_name: e.target.value }))} placeholder="BlueDart, Delhivery, DTDC..." />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Tracking Number</Label>
                      <Input className="h-9" value={deliveryEdit.tracking_number || ''} onChange={e => setDeliveryEdit(p => ({ ...p, tracking_number: e.target.value }))} placeholder="AWB / Consignment #" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Tracking URL</Label>
                      <Input className="h-9" value={deliveryEdit.tracking_url || ''} onChange={e => setDeliveryEdit(p => ({ ...p, tracking_url: e.target.value }))} placeholder="https://..." />
                    </div>
                    <div className="space-y-1.5 col-span-2">
                      <Label className="text-xs">Expected Delivery Date</Label>
                      <Input type="datetime-local" className="h-9" value={deliveryEdit.estimated_date?.slice(0, 16) || ''} onChange={e => setDeliveryEdit(p => ({ ...p, estimated_date: e.target.value }))} />
                    </div>
                    <div className="space-y-1.5 col-span-2">
                      <Label className="text-xs">Notes</Label>
                      <Input className="h-9" value={deliveryEdit.notes || ''} onChange={e => setDeliveryEdit(p => ({ ...p, notes: e.target.value }))} placeholder="Any delivery notes..." />
                    </div>
                  </div>
                  {delivery.is_cod && (
                    <div className="p-2 bg-amber-50 dark:bg-amber-950 rounded text-xs flex items-center gap-3">
                      <span className="font-medium text-amber-800 dark:text-amber-200">COD: ₹{Number(delivery.cod_amount).toFixed(0)}</span>
                      <span className="text-amber-700 dark:text-amber-300">· {delivery.cod_collected ? '✓ Collected' : 'Pending collection'}</span>
                    </div>
                  )}
                  <Button size="sm" className="w-full" onClick={handleSaveDelivery} disabled={isUpdatingDelivery}>
                    {isUpdatingDelivery ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                    Save Delivery Details
                  </Button>
                </CardContent>
              </Card>
            )}


            {/* Refund history */}
            {payments.filter(p => p.status === 'refunded').length > 0 && (
              <Card>
                <CardHeader className="py-3 px-4"><CardTitle className="text-base">Refund History</CardTitle></CardHeader>
                <CardContent className="px-4 pb-4 space-y-2">
                  {payments.filter(p => p.status === 'refunded').map(p => (
                    <div key={p.id} className="flex justify-between items-center p-2 bg-destructive/5 rounded text-sm">
                      <div>
                        <p className="font-medium">₹{Number(p.refund_amount).toFixed(2)}</p>
                        {p.refund_reason && <p className="text-xs text-muted-foreground">{p.refund_reason}</p>}
                      </div>
                      <span className="text-xs text-muted-foreground">{new Date(p.created_at).toLocaleDateString()}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* WhatsApp Section */}
            {customerPhone && (
              <Card>
                <CardHeader className="py-3 px-4">
                  <CardTitle className="text-base flex items-center gap-2">
                    <MessageCircle className="h-4 w-4 text-green-600" /> WhatsApp
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4 space-y-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full justify-start text-xs"
                    onClick={() => sendWhatsApp(customerPhone, getOrderConfirmationMsg())}
                  >
                    ✅ Order Confirmation
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full justify-start text-xs"
                    onClick={() => sendWhatsApp(customerPhone, getPaymentReminderMsg())}
                  >
                    ⏳ Payment Reminder
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full justify-start text-xs"
                    onClick={() => sendWhatsApp(customerPhone, getShippingUpdateMsg())}
                  >
                    🚚 Shipping Update
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full justify-start text-xs"
                    onClick={() => sendWhatsApp(customerPhone, getDeliveryConfirmMsg())}
                  >
                    📦 Delivery Confirmation
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            <Card>
              <CardHeader className="py-3 px-4"><CardTitle className="text-sm flex items-center gap-1.5"><CreditCard className="h-4 w-4" /> Summary</CardTitle></CardHeader>
              <CardContent className="px-4 pb-4 space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Order #</span><span className="font-medium">{selectedOrder.order_number}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Date</span><span>{new Date(selectedOrder.created_at).toLocaleDateString()}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Time</span><span>{new Date(selectedOrder.created_at).toLocaleTimeString()}</span></div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="py-3 px-4"><CardTitle className="text-sm flex items-center gap-1.5"><MapPin className="h-4 w-4" /> Shipping</CardTitle></CardHeader>
              <CardContent className="px-4 pb-4">
                {address ? (
                  <div className="text-sm space-y-0.5">
                    <p className="font-medium">{address.full_name}</p>
                    <p className="text-muted-foreground">{address.address_line1}</p>
                    {address.address_line2 && <p className="text-muted-foreground">{address.address_line2}</p>}
                    <p className="text-muted-foreground">{address.city}, {address.state} - {address.pincode}</p>
                    <p className="text-muted-foreground mt-1">Ph: {address.mobile_number}</p>
                  </div>
                ) : <p className="text-muted-foreground text-sm">No address</p>}
              </CardContent>
            </Card>

            {selectedOrder.notes && (
              <Card>
                <CardHeader className="py-3 px-4"><CardTitle className="text-sm">Notes</CardTitle></CardHeader>
                <CardContent className="px-4 pb-4">
                  <p className="text-sm text-muted-foreground">{selectedOrder.notes}</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </AdminLayout>
    );
  }

  // Orders grid view
  return (
    <AdminLayout title="Orders" description="View and manage customer orders">
      <div className="mb-4">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by order number..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="animate-pulse bg-muted rounded-lg h-40" />
          ))}
        </div>
      ) : filteredOrders.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">No orders found.</CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {filteredOrders.map((order) => {
            const items = (order as any).order_items || [];
            return (
              <Card
                key={order.id}
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => handleRowClick(order)}
              >
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm">{order.order_number}</span>
                    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-medium ${orderStatusColors[order.status]}`}>
                      {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                    </span>
                  </div>
                  <p className="text-xl font-bold">₹{Number(order.total).toFixed(0)}</p>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-medium ${paymentStatusColors[order.payment_status] || ''}`}>
                      {order.payment_status}
                    </span>
                    <span>{new Date(order.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
                  </div>
                  {/* Show item count and variant info */}
                  <div className="text-xs text-muted-foreground border-t pt-2 mt-1">
                    {items.length} item{items.length !== 1 ? 's' : ''}
                    {items.some((i: any) => i.variant_name) && (
                      <span className="ml-1">
                        ({items.filter((i: any) => i.variant_name).map((i: any) => i.variant_name).join(', ')})
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
      {/* Infinite scroll sentinel */}
      <div ref={sentinelRef} className="flex justify-center py-4">
        {isLoadingMore && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">Loading more orders...</span>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}