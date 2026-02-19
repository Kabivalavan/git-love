import React, { useRef, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Image,
  Package,
  Percent,
  ShoppingCart,
  CreditCard,
  Receipt,
  Users,
  BarChart3,
  Settings,
  LogOut,
  Store,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Truck,
  PackageOpen,
  Megaphone,
  ShoppingBag,
  Globe,
  Star,
  FolderOpen,
  Layers,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { useAdminNotifications } from '@/hooks/useAdminNotifications';

interface MenuItem {
  path: string;
  icon: any;
  label: string;
  exact?: boolean;
}

interface MenuGroup {
  label: string;
  icon: any;
  items: MenuItem[];
}

type SidebarEntry = MenuItem | MenuGroup;

function isGroup(entry: SidebarEntry): entry is MenuGroup {
  return 'items' in entry;
}

const sidebarEntries: SidebarEntry[] = [
  { path: '/admin', icon: LayoutDashboard, label: 'Home', exact: true },
  {
    label: 'Items',
    icon: Package,
    items: [
      { path: '/admin/products', icon: ShoppingBag, label: 'Items' },
      { path: '/admin/categories', icon: FolderOpen, label: 'Categories' },
      { path: '/admin/bundles', icon: Layers, label: 'Collections' },
    ],
  },
  {
    label: 'Sales',
    icon: ShoppingCart,
    items: [
      { path: '/admin/orders', icon: ShoppingCart, label: 'Orders' },
      { path: '/admin/deliveries', icon: Truck, label: 'Deliveries' },
      { path: '/admin/payments', icon: CreditCard, label: 'Payments' },
    ],
  },
  {
    label: 'Online Store',
    icon: Globe,
    items: [
      { path: '/admin/banners', icon: Image, label: 'Banners & Media' },
      { path: '/admin/offers', icon: Percent, label: 'Offers & Coupons' },
    ],
  },
  {
    label: 'Marketing',
    icon: Megaphone,
    items: [
      { path: '/admin/analytics', icon: BarChart3, label: 'Analytics' },
      { path: '/admin/customers', icon: Users, label: 'Customers' },
    ],
  },
  { path: '/admin/reports', icon: BarChart3, label: 'Reports' },
  { path: '/admin/expenses', icon: Receipt, label: 'Expenses' },
  { path: '/admin/settings', icon: Settings, label: 'Settings' },
];

const COLLAPSED_KEY = 'admin_sidebar_collapsed';
function getInitialCollapsed() {
  try { return localStorage.getItem(COLLAPSED_KEY) === 'true'; } catch { return false; }
}

// Compute initial open groups synchronously to avoid flicker
function getInitialOpenGroups(): Record<string, boolean> {
  const path = window.location.pathname;
  const initial: Record<string, boolean> = {};
  sidebarEntries.forEach((entry) => {
    if (isGroup(entry)) {
      const hasActive = entry.items.some(item =>
        item.exact ? path === item.path : path.startsWith(item.path) && item.path !== '/admin'
      );
      if (hasActive) initial[entry.label] = true;
    }
  });
  return initial;
}

export function AdminSidebar() {
  const [collapsed, setCollapsedState] = React.useState(getInitialCollapsed);
  const [openGroups, setOpenGroups] = React.useState<Record<string, boolean>>(getInitialOpenGroups);
  const { signOut, profile } = useAuth();
  const location = useLocation();
  const navRef = useRef<HTMLElement>(null);
  const { unreadCounts, markSectionSeen } = useAdminNotifications();

  // Mark section as seen when navigating to it
  useEffect(() => {
    if (location.pathname === '/admin/customers') markSectionSeen('customers');
    if (location.pathname === '/admin/orders') markSectionSeen('orders');
    if (location.pathname === '/admin/payments') markSectionSeen('payments');
  }, [location.pathname, markSectionSeen]);

  const setCollapsed = (val: boolean) => {
    setCollapsedState(val);
    try { localStorage.setItem(COLLAPSED_KEY, String(val)); } catch {};
  };

  // When route changes, ensure the parent group stays open (no closing/reopening)
  useEffect(() => {
    sidebarEntries.forEach((entry) => {
      if (isGroup(entry)) {
        const hasActive = entry.items.some(item =>
          item.exact ? location.pathname === item.path : location.pathname.startsWith(item.path) && item.path !== '/admin'
        );
        if (hasActive && !openGroups[entry.label]) {
          setOpenGroups(prev => ({ ...prev, [entry.label]: true }));
        }
      }
    });
  }, [location.pathname]);

  const toggleGroup = (label: string) => {
    setOpenGroups(prev => ({ ...prev, [label]: !prev[label] }));
  };

  const isActive = (path: string, exact?: boolean) => {
    if (exact) return location.pathname === path;
    return location.pathname.startsWith(path) && path !== '/admin';
  };

  const getUnreadForPath = (path: string): number => {
    if (path === '/admin/customers') return unreadCounts['customers'] || 0;
    if (path === '/admin/orders') return unreadCounts['orders'] || 0;
    if (path === '/admin/payments') return unreadCounts['payments'] || 0;
    return 0;
  };

  const getGroupUnread = (items: MenuItem[]): number => {
    return items.reduce((sum, item) => sum + getUnreadForPath(item.path), 0);
  };

  const UnreadBadge = ({ count, small }: { count: number; small?: boolean }) => {
    if (count <= 0) return null;
    return (
      <span className={cn(
        "flex items-center justify-center rounded-full bg-destructive text-white font-bold flex-shrink-0",
        small ? "h-2 w-2" : "h-4 min-w-4 px-1 text-[10px]"
      )}>
        {!small && (count > 9 ? '9+' : count)}
      </span>
    );
  };

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 z-40 h-screen transition-all duration-300 flex flex-col",
        "bg-[hsl(var(--sidebar-background))] text-[hsl(var(--sidebar-foreground))]",
        collapsed ? "w-16" : "w-56"
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-4 border-b border-[hsl(var(--sidebar-border))]">
        <div className="h-8 w-8 rounded-lg bg-[hsl(var(--sidebar-primary))] flex items-center justify-center flex-shrink-0">
          <Store className="h-4.5 w-4.5 text-white" />
        </div>
        {!collapsed && (
          <span className="font-semibold text-sm text-white tracking-wide">Commerce</span>
        )}
      </div>

      {/* Toggle button */}
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setCollapsed(!collapsed)}
        className={cn(
          "absolute -right-3 top-16 h-6 w-6 rounded-full border shadow-md z-50",
          "bg-card text-foreground hover:bg-accent"
        )}
      >
        {collapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />}
      </Button>

      {/* Navigation */}
      <nav ref={navRef} className="flex-1 overflow-y-auto py-2">
        <ul className="space-y-0.5 px-2">
          {sidebarEntries.map((entry, idx) => {
            if (isGroup(entry)) {
              const isOpen = openGroups[entry.label] ?? false;
              const hasActive = entry.items.some(item => isActive(item.path, item.exact));

              if (collapsed) {
                // In collapsed mode, show only first item icon
                return entry.items.map((item) => {
                  const active = isActive(item.path, item.exact);
                  const itemUnread = getUnreadForPath(item.path);
                  return (
                    <li key={item.path}>
                      <NavLink
                        to={item.path}
                        end={item.exact}
                        title={item.label}
                        className={cn(
                          "flex items-center justify-center py-1.5 rounded-md text-sm transition-all relative",
                          active
                            ? "bg-[hsl(142,76%,36%)] text-white"
                            : "text-[hsl(var(--sidebar-foreground))] hover:bg-[hsl(var(--sidebar-accent))]"
                        )}
                      >
                        <item.icon className="h-4 w-4" />
                        {itemUnread > 0 && <span className="absolute top-0.5 right-1 h-2 w-2 rounded-full bg-destructive" />}
                      </NavLink>
                    </li>
                  );
                });
              }

              return (
                <li key={entry.label}>
                  <button
                    onClick={() => toggleGroup(entry.label)}
                    className={cn(
                      "flex items-center gap-2.5 w-full px-3 py-2 rounded-md text-[13px] font-medium transition-all",
                      hasActive
                        ? "text-white"
                        : "text-[hsl(var(--sidebar-foreground))] hover:bg-[hsl(var(--sidebar-accent))]"
                    )}
                  >
                    <entry.icon className="h-4 w-4 flex-shrink-0" />
                    <span className="flex-1 text-left">{entry.label}</span>
                    {(() => { const gu = getGroupUnread(entry.items); return gu > 0 ? <UnreadBadge count={gu} /> : null; })()}
                    <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", isOpen && "rotate-180")} />
                  </button>
                  <div className={cn("overflow-hidden transition-all duration-200", isOpen ? "max-h-96 opacity-100" : "max-h-0 opacity-0")}>
                    <ul className="ml-4 mt-0.5 space-y-0.5 border-l border-[hsl(var(--sidebar-border))] pl-3">
                      {entry.items.map((item) => {
                        const active = isActive(item.path, item.exact);
                        const itemUnread = getUnreadForPath(item.path);
                        return (
                          <li key={item.path}>
                            <NavLink
                              to={item.path}
                              end={item.exact}
                              className={cn(
                                "flex items-center gap-2 px-2 py-1.5 rounded-md text-[13px] transition-all",
                                active
                                  ? "bg-[hsl(142,76%,36%)] text-white font-medium"
                                  : "text-[hsl(var(--sidebar-foreground))] hover:bg-[hsl(var(--sidebar-accent))]"
                              )}
                            >
                              <span className="flex-1">{item.label}</span>
                              <UnreadBadge count={itemUnread} />
                            </NavLink>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                </li>
              );
            }

            // Single menu item
            const active = isActive(entry.path, entry.exact);
            return (
              <li key={entry.path}>
                <NavLink
                  to={entry.path}
                  end={entry.exact}
                  className={cn(
                    "flex items-center gap-2.5 px-3 py-2 rounded-md text-[13px] font-medium transition-all",
                    active
                      ? "bg-[hsl(142,76%,36%)] text-white"
                      : "text-[hsl(var(--sidebar-foreground))] hover:bg-[hsl(var(--sidebar-accent))]"
                  )}
                >
                  <entry.icon className="h-4 w-4 flex-shrink-0" />
                  {!collapsed && <span>{entry.label}</span>}
                </NavLink>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Footer */}
      <div className="p-2 border-t border-[hsl(var(--sidebar-border))]">
        {!collapsed && profile && (
          <div className="px-3 py-2 mb-1">
            <p className="text-xs font-medium text-white truncate">
              {profile.full_name || 'Admin'}
            </p>
            <p className="text-[10px] text-[hsl(var(--sidebar-foreground))] opacity-60 truncate">
              {profile.email}
            </p>
          </div>
        )}
        <Button
          variant="ghost"
          className={cn(
            "w-full justify-start gap-2.5 text-[13px] text-[hsl(var(--sidebar-foreground))] hover:bg-[hsl(var(--sidebar-accent))] hover:text-white",
            collapsed && "justify-center"
          )}
          onClick={signOut}
        >
          <LogOut className="h-4 w-4" />
          {!collapsed && <span>Sign Out</span>}
        </Button>
      </div>
    </aside>
  );
}
