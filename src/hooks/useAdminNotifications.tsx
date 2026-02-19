import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface AdminNotification {
  id: string;
  type: 'new_customer' | 'new_order' | 'order_status' | 'payment';
  title: string;
  description: string;
  timestamp: string;
  read: boolean;
  link?: string;
  metadata?: Record<string, any>;
}

const STORAGE_KEY = 'admin_notifications';
const LAST_SEEN_KEY = 'admin_notifications_last_seen';

function loadNotifications(): AdminNotification[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveNotifications(items: AdminNotification[]) {
  // Keep max 100
  const trimmed = items.slice(0, 100);
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed)); } catch {}
}

function getLastSeen(): Record<string, string> {
  try {
    const raw = localStorage.getItem(LAST_SEEN_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

function setLastSeen(key: string) {
  const current = getLastSeen();
  current[key] = new Date().toISOString();
  try { localStorage.setItem(LAST_SEEN_KEY, JSON.stringify(current)); } catch {}
}

export function useAdminNotifications() {
  const [notifications, setNotifications] = useState<AdminNotification[]>(loadNotifications);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const notificationsRef = useRef(notifications);

  useEffect(() => {
    notificationsRef.current = notifications;
  }, [notifications]);

  const addNotification = useCallback((notif: Omit<AdminNotification, 'id' | 'read' | 'timestamp'>) => {
    const newNotif: AdminNotification = {
      ...notif,
      id: crypto.randomUUID(),
      read: false,
      timestamp: new Date().toISOString(),
    };
    const updated = [newNotif, ...notificationsRef.current];
    notificationsRef.current = updated;
    setNotifications(updated);
    saveNotifications(updated);
  }, []);

  const markAllRead = useCallback(() => {
    const updated = notificationsRef.current.map(n => ({ ...n, read: true }));
    notificationsRef.current = updated;
    setNotifications(updated);
    saveNotifications(updated);
  }, []);

  const markSectionSeen = useCallback((section: string) => {
    setLastSeen(section);
    // Recalc counts
    computeUnreadCounts(notificationsRef.current);
  }, []);

  const computeUnreadCounts = useCallback((items: AdminNotification[]) => {
    const lastSeen = getLastSeen();
    const counts: Record<string, number> = {};
    
    items.forEach(n => {
      if (!n.read) {
        const section = n.type === 'new_customer' ? 'customers' 
          : n.type === 'new_order' || n.type === 'order_status' ? 'orders' 
          : n.type === 'payment' ? 'payments' : 'other';
        
        const sectionLastSeen = lastSeen[section];
        if (!sectionLastSeen || new Date(n.timestamp) > new Date(sectionLastSeen)) {
          counts[section] = (counts[section] || 0) + 1;
        }
      }
    });

    counts['total'] = Object.values(counts).reduce((a, b) => a + b, 0);
    setUnreadCounts(counts);
  }, []);

  // Compute counts whenever notifications change
  useEffect(() => {
    computeUnreadCounts(notifications);
  }, [notifications, computeUnreadCounts]);

  // Subscribe to realtime
  useEffect(() => {
    const ordersChannel = supabase
      .channel('admin-orders-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, (payload) => {
        const order = payload.new as any;
        addNotification({
          type: 'new_order',
          title: 'New Order',
          description: `Order ${order.order_number} placed — ₹${Number(order.total).toFixed(0)}`,
          link: '/admin/orders',
          metadata: { order_id: order.id, order_number: order.order_number },
        });
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders' }, (payload) => {
        const order = payload.new as any;
        const old = payload.old as any;
        if (order.status !== old.status) {
          addNotification({
            type: 'order_status',
            title: 'Order Updated',
            description: `Order ${order.order_number} → ${order.status}`,
            link: '/admin/orders',
            metadata: { order_id: order.id },
          });
        }
      })
      .subscribe();

    const profilesChannel = supabase
      .channel('admin-profiles-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'profiles' }, (payload) => {
        const profile = payload.new as any;
        addNotification({
          type: 'new_customer',
          title: 'New Customer',
          description: `${profile.full_name || profile.email || 'A new user'} signed up`,
          link: '/admin/customers',
          metadata: { user_id: profile.user_id },
        });
      })
      .subscribe();

    const paymentsChannel = supabase
      .channel('admin-payments-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'payments' }, (payload) => {
        const payment = payload.new as any;
        addNotification({
          type: 'payment',
          title: 'New Payment',
          description: `₹${Number(payment.amount).toFixed(0)} via ${payment.method} — ${payment.status}`,
          link: '/admin/payments',
          metadata: { payment_id: payment.id },
        });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(ordersChannel);
      supabase.removeChannel(profilesChannel);
      supabase.removeChannel(paymentsChannel);
    };
  }, [addNotification]);

  return {
    notifications,
    unreadCounts,
    markAllRead,
    markSectionSeen,
    totalUnread: unreadCounts['total'] || 0,
  };
}
