import { ReactNode, useState, useEffect } from 'react';
import { AdminSidebar } from './AdminSidebar';
import { cn } from '@/lib/utils';
import { Bell, Search, Settings, LayoutDashboard, ShoppingCart, Users, Package, Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/hooks/useAuth';
import { Link, useLocation, NavLink } from 'react-router-dom';
import { useAdminNotifications } from '@/hooks/useAdminNotifications';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';

interface AdminLayoutProps {
  children: ReactNode;
  title?: string;
  description?: string;
  actions?: ReactNode;
}

const mobileBottomNav = [
  { path: '/admin', icon: LayoutDashboard, label: 'Home', exact: true },
  { path: '/admin/orders', icon: ShoppingCart, label: 'Orders' },
  { path: '/admin/products', icon: Package, label: 'Items' },
  { path: '/admin/customers', icon: Users, label: 'Customers' },
];

export function AdminLayout({ children, title, description, actions }: AdminLayoutProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const { profile } = useAuth();
  const { totalUnread } = useAdminNotifications();
  const location = useLocation();

  useEffect(() => {
    const checkSidebar = () => {
      const collapsed = localStorage.getItem('admin_sidebar_collapsed') === 'true';
      setSidebarCollapsed(collapsed);
    };
    checkSidebar();
    const observer = new MutationObserver(checkSidebar);
    const sidebar = document.querySelector('aside');
    if (sidebar) {
      observer.observe(sidebar, { attributes: true, attributeFilter: ['class'] });
    }
    window.addEventListener('storage', checkSidebar);
    const interval = setInterval(checkSidebar, 200);
    return () => {
      observer.disconnect();
      window.removeEventListener('storage', checkSidebar);
      clearInterval(interval);
    };
  }, []);

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop Sidebar - hidden on mobile */}
      <div className="hidden md:block">
        <AdminSidebar />
      </div>
      <main className={cn(
        "min-h-screen transition-all duration-300",
        "md:ml-56",
        sidebarCollapsed ? "md:ml-16" : "md:ml-56",
        "pb-16 md:pb-0" // bottom padding for mobile nav
      )}>
        {/* Top bar */}
        <header className="sticky top-0 z-30 bg-card border-b border-border h-14 flex items-center px-4 md:px-6 gap-4">
          {/* Mobile: hamburger for full sidebar */}
          <Sheet>
            <SheetTrigger asChild className="md:hidden">
              <Button variant="ghost" size="icon" className="h-9 w-9">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 w-64 bg-[hsl(var(--sidebar-background))]">
              <AdminSidebar />
            </SheetContent>
          </Sheet>

          <div className="flex-1 max-w-md hidden md:block">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search in Customers ( / )"
                className="pl-9 h-9 text-sm bg-muted/50 border-0 focus-visible:ring-1"
              />
            </div>
          </div>
          <div className="flex items-center gap-2 ml-auto">
            <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground relative" asChild>
              <Link to="/admin/notifications">
                <Bell className="h-4.5 w-4.5" />
                {totalUnread > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-1 flex items-center justify-center rounded-full bg-destructive text-white text-[10px] font-bold">
                    {totalUnread > 9 ? '9+' : totalUnread}
                  </span>
                )}
              </Link>
            </Button>
            <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground" asChild>
              <Link to="/admin/settings">
                <Settings className="h-4.5 w-4.5" />
              </Link>
            </Button>
            <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-sm font-semibold ml-1">
              {(profile?.full_name || 'A').charAt(0).toUpperCase()}
            </div>
          </div>
        </header>

        {/* Page header */}
        {(title || description || actions) && (
          <div className="px-4 md:px-6 pt-5 pb-4">
            <div className="flex items-center justify-between">
              <div>
                {title && (
                  <h1 className="text-xl font-semibold text-foreground">{title}</h1>
                )}
                {description && (
                  <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
                )}
              </div>
              {actions && <div className="flex items-center gap-3">{actions}</div>}
            </div>
          </div>
        )}
        <div className="px-4 md:px-6 pb-6">{children}</div>
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-[hsl(var(--sidebar-background))] border-t border-[hsl(var(--sidebar-border))] md:hidden">
        <div className="flex items-center justify-around h-14">
          {mobileBottomNav.map((item) => {
            const isActive = item.exact
              ? location.pathname === item.path
              : location.pathname.startsWith(item.path);
            return (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.exact}
                className={cn(
                  "flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-colors",
                  isActive
                    ? "text-[hsl(142,76%,36%)]"
                    : "text-[hsl(var(--sidebar-foreground))] opacity-70"
                )}
              >
                <item.icon className="h-5 w-5" />
                <span className="text-[10px] font-medium">{item.label}</span>
              </NavLink>
            );
          })}
          {/* More button - opens sheet */}
          <Sheet>
            <SheetTrigger className={cn(
              "flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-colors",
              "text-[hsl(var(--sidebar-foreground))] opacity-70"
            )}>
              <Menu className="h-5 w-5" />
              <span className="text-[10px] font-medium">More</span>
            </SheetTrigger>
            <SheetContent side="bottom" className="bg-[hsl(var(--sidebar-background))] text-[hsl(var(--sidebar-foreground))] rounded-t-2xl pb-8">
              <div className="grid grid-cols-3 gap-4 pt-6">
                {[
                  { path: '/admin/analytics', icon: '📊', label: 'Analytics' },
                  { path: '/admin/deliveries', icon: '🚚', label: 'Deliveries' },
                  { path: '/admin/payments', icon: '💳', label: 'Payments' },
                  { path: '/admin/categories', icon: '📁', label: 'Categories' },
                  { path: '/admin/bundles', icon: '📦', label: 'Collections' },
                  { path: '/admin/offers', icon: '🏷️', label: 'Offers' },
                  { path: '/admin/banners', icon: '🖼️', label: 'Banners' },
                  { path: '/admin/expenses', icon: '🧾', label: 'Expenses' },
                  { path: '/admin/reports', icon: '📈', label: 'Reports' },
                  { path: '/admin/notifications', icon: '🔔', label: 'Alerts' },
                  { path: '/admin/settings', icon: '⚙️', label: 'Settings' },
                  { path: '/', icon: '🛍️', label: 'View Store' },
                ].map((item) => (
                  <Link
                    key={item.path}
                    to={item.path}
                    className="flex flex-col items-center gap-2 p-3 rounded-xl bg-[hsl(var(--sidebar-accent))] hover:opacity-90 transition-opacity"
                  >
                    <span className="text-2xl">{item.icon}</span>
                    <span className="text-xs text-white text-center">{item.label}</span>
                  </Link>
                ))}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </nav>
    </div>
  );
}

// Stats card for dashboard - Zoho style
interface StatCardProps {
  title: string;
  value: string | number;
  description?: string;
  icon?: ReactNode;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  className?: string;
}

export function StatCard({ title, value, description, icon, trend, className }: StatCardProps) {
  return (
    <div className={cn("rounded-lg border bg-card p-5 hover:shadow-md transition-shadow", className)}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{title}</p>
          <p className="text-2xl font-bold text-foreground mt-2">{value}</p>
          {description && (
            <p className="text-xs text-muted-foreground mt-1">{description}</p>
          )}
          {trend && (
            <p
              className={cn(
                "text-xs mt-1 font-medium",
                trend.isPositive ? "text-[hsl(142,76%,36%)]" : "text-destructive"
              )}
            >
              {trend.isPositive ? "↑" : "↓"} {Math.abs(trend.value)}% from last period
            </p>
          )}
        </div>
        {icon && (
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}
