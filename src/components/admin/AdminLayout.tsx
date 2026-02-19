import { ReactNode, useState, useEffect } from 'react';
import { AdminSidebar } from './AdminSidebar';
import { cn } from '@/lib/utils';
import { Bell, Search, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/hooks/useAuth';
import { Link } from 'react-router-dom';
import { useAdminNotifications } from '@/hooks/useAdminNotifications';

interface AdminLayoutProps {
  children: ReactNode;
  title?: string;
  description?: string;
  actions?: ReactNode;
}

export function AdminLayout({ children, title, description, actions }: AdminLayoutProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const { profile } = useAuth();
  const { totalUnread } = useAdminNotifications();

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
      <AdminSidebar />
      <main className={cn(
        "min-h-screen transition-all duration-300",
        sidebarCollapsed ? "ml-16" : "ml-56"
      )}>
        {/* Top bar */}
        <header className="sticky top-0 z-30 bg-card border-b border-border h-14 flex items-center px-6 gap-4">
          <div className="flex-1 max-w-md">
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
          <div className="px-6 pt-5 pb-4">
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
        <div className="px-6 pb-6">{children}</div>
      </main>
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
