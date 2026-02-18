import { ReactNode, useState, useEffect } from 'react';
import { AdminSidebar } from './AdminSidebar';
import { cn } from '@/lib/utils';

interface AdminLayoutProps {
  children: ReactNode;
  title?: string;
  description?: string;
  actions?: ReactNode;
}

export function AdminLayout({ children, title, description, actions }: AdminLayoutProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Sync with localStorage-persisted sidebar state
  useEffect(() => {
    const checkSidebar = () => {
      const collapsed = localStorage.getItem('admin_sidebar_collapsed') === 'true';
      setSidebarCollapsed(collapsed);
    };
    checkSidebar();

    // Watch for DOM changes on sidebar
    const observer = new MutationObserver(checkSidebar);
    const sidebar = document.querySelector('aside');
    if (sidebar) {
      observer.observe(sidebar, { attributes: true, attributeFilter: ['class'] });
    }

    // Also listen for storage events  
    window.addEventListener('storage', checkSidebar);
    // Poll briefly to catch same-tab changes
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
        sidebarCollapsed ? "ml-16" : "ml-64"
      )}>
        {(title || description || actions) && (
          <header className="sticky top-0 z-30 bg-card border-b border-border shadow-sm">
            <div className="flex items-center justify-between px-6 py-4">
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
          </header>
        )}
        <div className="p-6">{children}</div>
      </main>
    </div>
  );
}

// Stats card for dashboard
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
    <div className={cn("rounded-lg border bg-card p-5 shadow-sm", className)}>
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-muted-foreground">{title}</p>
        {icon && <div className="text-primary">{icon}</div>}
      </div>
      <div className="mt-2">
        <p className="text-2xl font-bold text-foreground">{value}</p>
        {description && (
          <p className="text-xs text-muted-foreground mt-1">{description}</p>
        )}
        {trend && (
          <p
            className={cn(
              "text-xs mt-1 font-medium",
              trend.isPositive ? "text-green-600" : "text-red-600"
            )}
          >
            {trend.isPositive ? "↑" : "↓"} {Math.abs(trend.value)}% from last period
          </p>
        )}
      </div>
    </div>
  );
}
