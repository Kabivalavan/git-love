import { useEffect } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { useAdminNotifications, AdminNotification } from '@/hooks/useAdminNotifications';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Bell, ShoppingCart, Users, CreditCard, CheckCheck, Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';

const typeConfig: Record<string, { icon: any; color: string; label: string }> = {
  new_order: { icon: ShoppingCart, color: 'text-blue-500 bg-blue-500/10', label: 'Order' },
  order_status: { icon: ShoppingCart, color: 'text-amber-500 bg-amber-500/10', label: 'Order Update' },
  new_customer: { icon: Users, color: 'text-green-500 bg-green-500/10', label: 'Customer' },
  payment: { icon: CreditCard, color: 'text-purple-500 bg-purple-500/10', label: 'Payment' },
};

function NotificationItem({ notif, onClick }: { notif: AdminNotification; onClick: () => void }) {
  const config = typeConfig[notif.type] || typeConfig.new_order;
  const Icon = config.icon;

  return (
    <div
      onClick={onClick}
      className={cn(
        "flex items-start gap-3 p-4 rounded-lg cursor-pointer transition-colors border",
        notif.read
          ? "bg-card border-border hover:bg-muted/50"
          : "bg-primary/5 border-primary/20 hover:bg-primary/10"
      )}
    >
      <div className={cn("h-9 w-9 rounded-full flex items-center justify-center flex-shrink-0", config.color)}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className={cn("text-sm font-medium", !notif.read && "text-foreground")}>{notif.title}</p>
          {!notif.read && <span className="h-2 w-2 rounded-full bg-destructive flex-shrink-0" />}
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">{notif.description}</p>
        <div className="flex items-center gap-2 mt-1">
          <Clock className="h-3 w-3 text-muted-foreground" />
          <span className="text-[11px] text-muted-foreground">
            {formatDistanceToNow(new Date(notif.timestamp), { addSuffix: true })}
          </span>
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{config.label}</Badge>
        </div>
      </div>
    </div>
  );
}

export default function AdminNotifications() {
  const { notifications, markAllRead, unreadCounts } = useAdminNotifications();
  const navigate = useNavigate();

  const filterByType = (types: string[]) =>
    notifications.filter(n => types.includes(n.type));

  const handleClick = (notif: AdminNotification) => {
    if (notif.link) navigate(notif.link);
  };

  return (
    <AdminLayout
      title="Notifications"
      description="Stay updated with real-time activity"
      actions={
        <Button variant="outline" size="sm" onClick={markAllRead} className="gap-1.5">
          <CheckCheck className="h-4 w-4" /> Mark all read
        </Button>
      }
    >
      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Orders', count: unreadCounts['orders'] || 0, icon: ShoppingCart, color: 'text-blue-500' },
          { label: 'Customers', count: unreadCounts['customers'] || 0, icon: Users, color: 'text-green-500' },
          { label: 'Payments', count: unreadCounts['payments'] || 0, icon: CreditCard, color: 'text-purple-500' },
          { label: 'Total Unread', count: unreadCounts['total'] || 0, icon: Bell, color: 'text-destructive' },
        ].map(s => (
          <Card key={s.label}>
            <CardContent className="p-4 flex items-center gap-3">
              <s.icon className={cn("h-5 w-5", s.color)} />
              <div>
                <p className="text-lg font-bold">{s.count}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="all">
        <TabsList>
          <TabsTrigger value="all">All ({notifications.length})</TabsTrigger>
          <TabsTrigger value="orders">
            Orders {(unreadCounts['orders'] || 0) > 0 && <Badge variant="destructive" className="ml-1.5 h-4 px-1 text-[10px]">{unreadCounts['orders']}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="customers">
            Customers {(unreadCounts['customers'] || 0) > 0 && <Badge variant="destructive" className="ml-1.5 h-4 px-1 text-[10px]">{unreadCounts['customers']}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="payments">
            Payments {(unreadCounts['payments'] || 0) > 0 && <Badge variant="destructive" className="ml-1.5 h-4 px-1 text-[10px]">{unreadCounts['payments']}</Badge>}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="mt-4 space-y-2">
          {notifications.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Bell className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No notifications yet</p>
              <p className="text-xs mt-1">Real-time updates will appear here</p>
            </div>
          ) : (
            notifications.map(n => <NotificationItem key={n.id} notif={n} onClick={() => handleClick(n)} />)
          )}
        </TabsContent>
        <TabsContent value="orders" className="mt-4 space-y-2">
          {filterByType(['new_order', 'order_status']).map(n => (
            <NotificationItem key={n.id} notif={n} onClick={() => handleClick(n)} />
          ))}
          {filterByType(['new_order', 'order_status']).length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">No order notifications</p>
          )}
        </TabsContent>
        <TabsContent value="customers" className="mt-4 space-y-2">
          {filterByType(['new_customer']).map(n => (
            <NotificationItem key={n.id} notif={n} onClick={() => handleClick(n)} />
          ))}
          {filterByType(['new_customer']).length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">No customer notifications</p>
          )}
        </TabsContent>
        <TabsContent value="payments" className="mt-4 space-y-2">
          {filterByType(['payment']).map(n => (
            <NotificationItem key={n.id} notif={n} onClick={() => handleClick(n)} />
          ))}
          {filterByType(['payment']).length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">No payment notifications</p>
          )}
        </TabsContent>
      </Tabs>
    </AdminLayout>
  );
}
