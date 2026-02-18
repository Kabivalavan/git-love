import React, { useRef, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Palette,
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
  Truck,
  PackageOpen,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';

const menuItems = [
  { path: '/admin', icon: LayoutDashboard, label: 'Dashboard', exact: true },
  { path: '/admin/analytics', icon: BarChart3, label: 'Analytics' },
  { path: '/admin/banners', icon: Image, label: 'Banners & Media' },
  { path: '/admin/products', icon: Package, label: 'Products' },
  { path: '/admin/bundles', icon: PackageOpen, label: 'Bundles' },
  { path: '/admin/offers', icon: Percent, label: 'Offers & Coupons' },
  { path: '/admin/orders', icon: ShoppingCart, label: 'Orders' },
  { path: '/admin/deliveries', icon: Truck, label: 'Deliveries' },
  { path: '/admin/payments', icon: CreditCard, label: 'Payments' },
  { path: '/admin/expenses', icon: Receipt, label: 'Expenses' },
  { path: '/admin/customers', icon: Users, label: 'Customers' },
  { path: '/admin/reports', icon: BarChart3, label: 'Reports' },
  { path: '/admin/settings', icon: Settings, label: 'Settings' },
];

// Persist collapsed state
const COLLAPSED_KEY = 'admin_sidebar_collapsed';
function getInitialCollapsed() {
  try { return localStorage.getItem(COLLAPSED_KEY) === 'true'; } catch { return false; }
}

export function AdminSidebar() {
  const [collapsed, setCollapsedState] = React.useState(getInitialCollapsed);
  const { signOut, profile } = useAuth();
  const location = useLocation();
  const navRef = useRef<HTMLElement>(null);
  const scrollPosRef = useRef(0);

  // Persist collapsed
  const setCollapsed = (val: boolean) => {
    setCollapsedState(val);
    try { localStorage.setItem(COLLAPSED_KEY, String(val)); } catch {}
  };

  // Save scroll position before navigation re-render
  useEffect(() => {
    const nav = navRef.current;
    if (nav) {
      nav.scrollTop = scrollPosRef.current;
    }
  }, [location.pathname]);

  const handleNavScroll = () => {
    if (navRef.current) {
      scrollPosRef.current = navRef.current.scrollTop;
    }
  };

  const isActive = (path: string, exact?: boolean) => {
    if (exact) return location.pathname === path;
    return location.pathname.startsWith(path) && path !== '/admin';
  };

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 z-40 h-screen transition-all duration-300 flex flex-col",
        "bg-[hsl(var(--sidebar-background))] text-[hsl(var(--sidebar-foreground))]",
        collapsed ? "w-16" : "w-64"
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-[hsl(var(--sidebar-border))]">
        {!collapsed && (
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-[hsl(var(--sidebar-primary))] flex items-center justify-center">
              <Store className="h-5 w-5 text-white" />
            </div>
            <span className="font-semibold text-white">Admin Panel</span>
          </div>
        )}
        {collapsed && (
          <div className="h-8 w-8 rounded-lg bg-[hsl(var(--sidebar-primary))] flex items-center justify-center mx-auto">
            <Store className="h-5 w-5 text-white" />
          </div>
        )}
      </div>

      {/* Toggle button */}
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setCollapsed(!collapsed)}
        className={cn(
          "absolute -right-3 top-16 h-6 w-6 rounded-full border shadow-md",
          "bg-card text-foreground hover:bg-accent"
        )}
      >
        {collapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />}
      </Button>

      {/* Navigation */}
      <nav ref={navRef} onScroll={handleNavScroll} className="flex-1 overflow-y-auto p-2 scrollbar-thin">
        <ul className="space-y-1">
          {menuItems.map((item) => {
            const active = item.exact
              ? location.pathname === item.path
              : isActive(item.path, item.exact);

            return (
              <li key={item.path}>
                <NavLink
                  to={item.path}
                  end={item.exact}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-all",
                    active
                      ? "bg-[hsl(var(--sidebar-primary))] text-white"
                      : "text-[hsl(var(--sidebar-foreground))] hover:bg-[hsl(var(--sidebar-accent))]"
                  )}
                >
                  <item.icon className="h-5 w-5 shrink-0" />
                  {!collapsed && <span>{item.label}</span>}
                </NavLink>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Footer */}
      <div className="p-2 border-t border-[hsl(var(--sidebar-border))]">
        {!collapsed && profile && (
          <div className="px-3 py-2 mb-2">
            <p className="text-sm font-medium text-white truncate">
              {profile.full_name || 'Admin'}
            </p>
            <p className="text-xs text-[hsl(var(--sidebar-foreground))] opacity-70 truncate">
              {profile.email}
            </p>
          </div>
        )}
        <Button
          variant="ghost"
          className={cn(
            "w-full justify-start gap-3 text-[hsl(var(--sidebar-foreground))] hover:bg-[hsl(var(--sidebar-accent))] hover:text-white",
            collapsed && "justify-center"
          )}
          onClick={signOut}
        >
          <LogOut className="h-5 w-5" />
          {!collapsed && <span>Sign Out</span>}
        </Button>
      </div>
    </aside>
  );
}