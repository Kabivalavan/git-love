import { useEffect, useState, useCallback } from 'react';
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
export const ADMIN_NOTIFICATION_SETTINGS_CACHE_KEY = 'admin_notification_settings_cache';

type AdminNotificationSettings = {
  browser_enabled: boolean;
  new_order_alerts: boolean;
  low_stock_alerts: boolean;
  customer_alerts: boolean;
  payment_alerts: boolean;
};

const DEFAULT_NOTIFICATION_SETTINGS: AdminNotificationSettings = {
  browser_enabled: false,
  new_order_alerts: true,
  low_stock_alerts: true,
  customer_alerts: true,
  payment_alerts: true,
};

const listeners = new Set<() => void>();
let notificationsStore: AdminNotification[] = loadNotifications();
let unreadCountsStore: Record<string, number> = {};
let activeSubscribers = 0;
let channelsCleanup: (() => void) | null = null;
let notificationSettingsStore: AdminNotificationSettings = loadNotificationSettingsFromCache();
let lastSettingsRefreshAt = 0;
const SETTINGS_REFRESH_INTERVAL_MS = 5 * 60 * 1000;

function emitStoreUpdate() {
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function loadNotifications(): AdminNotification[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveNotifications(items: AdminNotification[]) {
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

function loadNotificationSettingsFromCache(): AdminNotificationSettings {
  try {
    const raw = localStorage.getItem(ADMIN_NOTIFICATION_SETTINGS_CACHE_KEY);
    if (!raw) return DEFAULT_NOTIFICATION_SETTINGS;
    return { ...DEFAULT_NOTIFICATION_SETTINGS, ...(JSON.parse(raw) as Partial<AdminNotificationSettings>) };
  } catch {
    return DEFAULT_NOTIFICATION_SETTINGS;
  }
}

function persistNotificationSettingsToCache(settings: AdminNotificationSettings) {
  notificationSettingsStore = settings;
  try {
    localStorage.setItem(ADMIN_NOTIFICATION_SETTINGS_CACHE_KEY, JSON.stringify(settings));
  } catch {
    // Ignore cache write failures
  }
}

async function refreshNotificationSettings() {
  if (Date.now() - lastSettingsRefreshAt < SETTINGS_REFRESH_INTERVAL_MS) return;

  const { data } = await supabase
    .from('store_settings')
    .select('value')
    .eq('key', 'notification_settings')
    .maybeSingle();

  const incoming = (data?.value as Partial<AdminNotificationSettings> | undefined) || {};
  persistNotificationSettingsToCache({ ...DEFAULT_NOTIFICATION_SETTINGS, ...incoming });
  lastSettingsRefreshAt = Date.now();
}

function computeUnreadCounts(items: AdminNotification[]) {
  const lastSeen = getLastSeen();
  const counts: Record<string, number> = {};

  items.forEach((n) => {
    if (!n.read) {
      const section = n.type === 'new_customer'
        ? 'customers'
        : n.type === 'new_order' || n.type === 'order_status'
          ? 'orders'
          : n.type === 'payment'
            ? 'payments'
            : 'other';

      const sectionLastSeen = lastSeen[section];
      if (!sectionLastSeen || new Date(n.timestamp) > new Date(sectionLastSeen)) {
        counts[section] = (counts[section] || 0) + 1;
      }
    }
  });

  counts.total = Object.values(counts).reduce((sum, count) => sum + count, 0);
  return counts;
}

function shouldNotify(type: AdminNotification['type']) {
  if (type === 'new_order' || type === 'order_status') return notificationSettingsStore.new_order_alerts;
  if (type === 'payment') return notificationSettingsStore.payment_alerts;
  if (type === 'new_customer') return notificationSettingsStore.customer_alerts;
  return true;
}

function triggerBrowserNotification(notification: AdminNotification) {
  if (!notificationSettingsStore.browser_enabled) return;
  if (!shouldNotify(notification.type)) return;
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;

  try {
    const browserNotification = new Notification(notification.title, {
      body: notification.description,
      tag: `admin-${notification.type}-${notification.id}`,
      requireInteraction: false,
    });
    browserNotification.onclick = () => {
      window.focus();
      if (notification.link) {
        window.location.href = notification.link;
      }
    };
  } catch {
    // Ignore Notification API errors on unsupported mobile browsers
  }
}

function addNotificationToStore(notif: Omit<AdminNotification, 'id' | 'read' | 'timestamp'>) {
  const notification: AdminNotification = {
    ...notif,
    id: crypto.randomUUID(),
    read: false,
    timestamp: new Date().toISOString(),
  };

  notificationsStore = [notification, ...notificationsStore].slice(0, 100);
  unreadCountsStore = computeUnreadCounts(notificationsStore);
  saveNotifications(notificationsStore);
  triggerBrowserNotification(notification);
  emitStoreUpdate();
}

function markAllReadInStore() {
  notificationsStore = notificationsStore.map((item) => ({ ...item, read: true }));
  unreadCountsStore = computeUnreadCounts(notificationsStore);
  saveNotifications(notificationsStore);
  emitStoreUpdate();
}

function markSectionSeenInStore(section: string) {
  setLastSeen(section);
  unreadCountsStore = computeUnreadCounts(notificationsStore);
  emitStoreUpdate();
}

function setupRealtimeChannels() {
  if (channelsCleanup) return;

  void refreshNotificationSettings();

  const ordersChannel = supabase
    .channel('admin-notif-orders')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, (payload) => {
      const order = payload.new as any;
      addNotificationToStore({
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
        addNotificationToStore({
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
    .channel('admin-notif-profiles')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'profiles' }, (payload) => {
      const profile = payload.new as any;
      addNotificationToStore({
        type: 'new_customer',
        title: 'New Customer',
        description: `${profile.full_name || profile.email || 'A new user'} signed up`,
        link: '/admin/customers',
        metadata: { user_id: profile.user_id },
      });
    })
    .subscribe();

  const paymentsChannel = supabase
    .channel('admin-notif-payments')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'payments' }, (payload) => {
      const payment = payload.new as any;
      addNotificationToStore({
        type: 'payment',
        title: 'New Payment',
        description: `₹${Number(payment.amount).toFixed(0)} via ${payment.method} — ${payment.status}`,
        link: '/admin/payments',
        metadata: { payment_id: payment.id },
      });
    })
    .subscribe();

  channelsCleanup = () => {
    supabase.removeChannel(ordersChannel);
    supabase.removeChannel(profilesChannel);
    supabase.removeChannel(paymentsChannel);
  };
}

unreadCountsStore = computeUnreadCounts(notificationsStore);

export function useAdminNotifications() {
  const [notifications, setNotifications] = useState<AdminNotification[]>(notificationsStore);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>(unreadCountsStore);

  useEffect(() => {
    const unsubscribe = subscribe(() => {
      setNotifications([...notificationsStore]);
      setUnreadCounts({ ...unreadCountsStore });
    });

    activeSubscribers += 1;
    setupRealtimeChannels();

    return () => {
      unsubscribe();
      activeSubscribers -= 1;
      if (activeSubscribers <= 0 && channelsCleanup) {
        channelsCleanup();
        channelsCleanup = null;
      }
    };
  }, []);

  const markAllRead = useCallback(() => {
    markAllReadInStore();
  }, []);

  const markSectionSeen = useCallback((section: string) => {
    markSectionSeenInStore(section);
  }, []);

  return {
    notifications,
    unreadCounts,
    markAllRead,
    markSectionSeen,
    totalUnread: unreadCounts['total'] || 0,
  };
}
