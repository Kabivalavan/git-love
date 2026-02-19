import { useEffect, useState } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { DataTable, Column } from '@/components/admin/DataTable';
import { DetailPanel, DetailField, DetailSection } from '@/components/admin/DetailPanel';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, ShoppingCart, DollarSign, MessageCircle, LayoutGrid, List, UserPlus, Clock } from 'lucide-react';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Shimmer } from '@/components/ui/shimmer';

const VIEW_MODE_KEY = 'admin-customers-view-mode';

interface Customer {
  id: string;
  user_id: string;
  full_name: string | null;
  email: string | null;
  mobile_number: string | null;
  avatar_url: string | null;
  is_blocked: boolean;
  created_at: string;
  order_count?: number;
  total_spent?: number;
}

export default function AdminCustomers() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [customerOrders, setCustomerOrders] = useState<any[]>([]);
  const [customerCart, setCustomerCart] = useState<any[]>([]);
  const [isUpdating, setIsUpdating] = useState(false);
  const [stats, setStats] = useState({ total: 0, active: 0, blocked: 0, todayCount: 0 });
  const [storeName, setStoreName] = useState('Our Store');
  const [viewMode, setViewMode] = useState<string>(() => localStorage.getItem(VIEW_MODE_KEY) || 'list');
  const [searchQuery, setSearchQuery] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    localStorage.setItem(VIEW_MODE_KEY, viewMode);
  }, [viewMode]);

  useEffect(() => {
    fetchCustomers();
    supabase.from('store_settings').select('value').eq('key', 'store_info').single().then(({ data }) => {
      if (data) setStoreName((data.value as any)?.name || 'Our Store');
    });
  }, []);

  const fetchCustomers = async () => {
    setIsLoading(true);
    
    const { data: profiles, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      setIsLoading(false);
      return;
    }

    const { data: orders } = await supabase
      .from('orders')
      .select('user_id, total');

    const orderStats: Record<string, { count: number; total: number }> = {};
    (orders || []).forEach((order: any) => {
      if (order.user_id) {
        if (!orderStats[order.user_id]) {
          orderStats[order.user_id] = { count: 0, total: 0 };
        }
        orderStats[order.user_id].count++;
        orderStats[order.user_id].total += Number(order.total);
      }
    });

    const customersWithStats = (profiles || []).map((profile: any) => ({
      ...profile,
      order_count: orderStats[profile.user_id]?.count || 0,
      total_spent: orderStats[profile.user_id]?.total || 0,
    }));

    setCustomers(customersWithStats);
    
    const total = customersWithStats.length;
    const blocked = customersWithStats.filter((c: Customer) => c.is_blocked).length;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayCount = customersWithStats.filter((c: Customer) => new Date(c.created_at) >= today).length;
    setStats({ total, active: total - blocked, blocked, todayCount });

    setIsLoading(false);
  };

  const handleRowClick = async (customer: Customer) => {
    setSelectedCustomer(customer);
    setIsDetailOpen(true);

    const { data } = await supabase
      .from('orders')
      .select('*')
      .eq('user_id', customer.user_id)
      .order('created_at', { ascending: false })
      .limit(10);
    setCustomerOrders(data || []);

    // Fetch cart with proper joins
    const { data: cart } = await supabase.from('cart').select('id').eq('user_id', customer.user_id).single();
    if (cart) {
      const { data: items } = await supabase
        .from('cart_items')
        .select('*, product:products(name, price, images:product_images(image_url, is_primary))')
        .eq('cart_id', cart.id);
      setCustomerCart(items || []);
    } else {
      setCustomerCart([]);
    }
  };

  const sendWhatsApp = (phone: string, message: string) => {
    const cleaned = phone.replace(/\D/g, '');
    const intlPhone = cleaned.startsWith('91') ? cleaned : `91${cleaned}`;
    window.open(`https://wa.me/${intlPhone}?text=${encodeURIComponent(message)}`, '_blank');
  };

  const getAbandonedCartMsg = (customer: Customer) => {
    const items = customerCart.map((i: any) => i.product?.name).filter(Boolean).join(', ');
    const totalPrice = customerCart.reduce((sum: number, i: any) => sum + (Number(i.product?.price || 0) * i.quantity), 0);
    return `Hi ${customer.full_name || 'there'} 👋\nYou left something awesome in your cart 🛒\n\n🛍 ${items || 'Your items'}\n💰 Price: Rs ${totalPrice.toFixed(0)}\n\nComplete your order now before it goes out of stock 👇\n\n– ${storeName}`;
  };

  const getOfferMsg = (customer: Customer) => {
    return `Hi ${customer.full_name || 'there'} 🎉\nSpecial offer just for you!\n\n💥 Flat __% OFF\n🏷 Coupon Code: ____\n⏰ Valid till: ____\n\nShop now 👇\n\n– ${storeName}`;
  };

  const handleBlockToggle = async (blocked: boolean) => {
    if (!selectedCustomer) return;
    setIsUpdating(true);

    const { error } = await supabase
      .from('profiles')
      .update({ is_blocked: blocked })
      .eq('id', selectedCustomer.id);

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ 
        title: 'Success', 
        description: `Customer ${blocked ? 'blocked' : 'unblocked'} successfully` 
      });
      setSelectedCustomer({ ...selectedCustomer, is_blocked: blocked });
      fetchCustomers();
    }
    setIsUpdating(false);
  };

  const filteredCustomers = customers.filter(c => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (c.full_name?.toLowerCase().includes(q) || c.email?.toLowerCase().includes(q) || c.mobile_number?.includes(q));
  });

  const columns: Column<Customer>[] = [
    {
      key: 'full_name',
      header: 'Name',
      render: (c) => (
        <div className="flex items-center gap-3">
          {c.avatar_url ? (
            <img src={c.avatar_url} alt="" className="h-8 w-8 rounded-full object-cover" />
          ) : (
            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-medium text-sm">
              {(c.full_name?.[0] || c.email?.[0] || '?').toUpperCase()}
            </div>
          )}
          <span>{c.full_name || 'No name'}</span>
        </div>
      ),
    },
    { key: 'email', header: 'Email' },
    { key: 'mobile_number', header: 'Mobile' },
    {
      key: 'order_count',
      header: 'Orders',
      render: (c) => c.order_count || 0,
    },
    {
      key: 'total_spent',
      header: 'Total Spent',
      render: (c) => `₹${(c.total_spent || 0).toFixed(2)}`,
    },
    {
      key: 'is_blocked',
      header: 'Status',
      render: (c) => (
        <Badge variant={c.is_blocked ? 'destructive' : 'default'}>
          {c.is_blocked ? 'Blocked' : 'Active'}
        </Badge>
      ),
    },
  ];

  const todayCustomers = customers.filter(c => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return new Date(c.created_at) >= today;
  });

  return (
    <AdminLayout
      title="Customers"
      description="View and manage customer accounts"
    >
      <div className="space-y-6">
        {/* Today's Snapshot */}
        {stats.todayCount > 0 && (
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="py-3 px-4">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center">
                  <UserPlus className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold">{stats.todayCount} new customer{stats.todayCount > 1 ? 's' : ''} today</p>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {todayCustomers.slice(0, 5).map(c => (
                      <Badge key={c.id} variant="secondary" className="text-xs cursor-pointer" onClick={() => handleRowClick(c)}>
                        {c.full_name || c.mobile_number || 'Unknown'}
                      </Badge>
                    ))}
                    {todayCustomers.length > 5 && (
                      <Badge variant="outline" className="text-xs">+{todayCustomers.length - 5} more</Badge>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  Today
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Customers</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{stats.total}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">Active</CardTitle>
              <ShoppingCart className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-green-600">{stats.active}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">Blocked</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-red-600">{stats.blocked}</p>
            </CardContent>
          </Card>
        </div>

        {/* View toggle + search */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Search customers..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full max-w-sm px-3 py-2 text-sm border rounded-md bg-background"
            />
          </div>
          <ToggleGroup type="single" value={viewMode} onValueChange={(v) => v && setViewMode(v)}>
            <ToggleGroupItem value="list" aria-label="List view">
              <List className="h-4 w-4" />
            </ToggleGroupItem>
            <ToggleGroupItem value="grid" aria-label="Grid view">
              <LayoutGrid className="h-4 w-4" />
            </ToggleGroupItem>
          </ToggleGroup>
        </div>

        {viewMode === 'list' ? (
          <DataTable<Customer>
            columns={columns}
            data={filteredCustomers}
            isLoading={isLoading}
            onRowClick={handleRowClick}
            searchable={false}
            getRowId={(c) => c.id}
            emptyMessage="No customers found."
          />
        ) : (
          isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3, 4, 5, 6].map(i => <Shimmer key={i} className="h-48" />)}
            </div>
          ) : filteredCustomers.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">No customers found.</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredCustomers.map((c) => (
                <Card
                  key={c.id}
                  className="cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => handleRowClick(c)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3 mb-3">
                      {c.avatar_url ? (
                        <img src={c.avatar_url} alt="" className="h-12 w-12 rounded-full object-cover" />
                      ) : (
                        <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-lg">
                          {(c.full_name?.[0] || c.email?.[0] || '?').toUpperCase()}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold truncate">{c.full_name || 'No name'}</p>
                        <p className="text-xs text-muted-foreground truncate">{c.email}</p>
                      </div>
                      <Badge variant={c.is_blocked ? 'destructive' : 'default'} className="text-xs flex-shrink-0">
                        {c.is_blocked ? 'Blocked' : 'Active'}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="bg-muted/50 rounded-md p-2">
                        <p className="text-xs text-muted-foreground">Orders</p>
                        <p className="font-semibold text-sm">{c.order_count || 0}</p>
                      </div>
                      <div className="bg-muted/50 rounded-md p-2">
                        <p className="text-xs text-muted-foreground">Spent</p>
                        <p className="font-semibold text-sm">₹{(c.total_spent || 0).toFixed(0)}</p>
                      </div>
                      <div className="bg-muted/50 rounded-md p-2">
                        <p className="text-xs text-muted-foreground">Phone</p>
                        <p className="font-semibold text-xs truncate">{c.mobile_number || '—'}</p>
                      </div>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-2">
                      Joined {new Date(c.created_at).toLocaleDateString()}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )
        )}
      </div>

      <DetailPanel
        isOpen={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
        title={selectedCustomer?.full_name || 'Customer Details'}
        canEdit={false}
        canDelete={false}
      >
        {selectedCustomer && (
          <div className="space-y-6">
            <div className="flex items-center gap-4">
              {selectedCustomer.avatar_url ? (
                <img src={selectedCustomer.avatar_url} alt="" className="h-16 w-16 rounded-full object-cover" />
              ) : (
                <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xl">
                  {(selectedCustomer.full_name?.[0] || selectedCustomer.email?.[0] || '?').toUpperCase()}
                </div>
              )}
              <div>
                <h3 className="font-semibold text-lg">{selectedCustomer.full_name || 'No name'}</h3>
                <p className="text-sm text-muted-foreground">{selectedCustomer.email}</p>
              </div>
            </div>

            <DetailSection title="Contact Info">
              <DetailField label="Email" value={selectedCustomer.email} />
              <DetailField label="Mobile" value={selectedCustomer.mobile_number} />
              <DetailField label="Joined" value={new Date(selectedCustomer.created_at).toLocaleDateString()} />
            </DetailSection>

            <DetailSection title="Order Summary">
              <DetailField label="Total Orders" value={selectedCustomer.order_count || 0} />
              <DetailField label="Total Spent" value={`₹${(selectedCustomer.total_spent || 0).toFixed(2)}`} />
            </DetailSection>

            <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
              <div>
                <Label className="text-sm font-medium">Block Customer</Label>
                <p className="text-xs text-muted-foreground">Prevent customer from placing orders</p>
              </div>
              <Switch
                checked={selectedCustomer.is_blocked}
                onCheckedChange={handleBlockToggle}
                disabled={isUpdating}
              />
            </div>

            {/* Cart Items */}
            {customerCart.length > 0 && (
              <div className="space-y-3">
                <h3 className="font-semibold text-sm flex items-center gap-2">
                  <ShoppingCart className="h-4 w-4" /> Cart Items ({customerCart.length})
                </h3>
                <div className="space-y-2">
                  {customerCart.map((item: any) => {
                    const imgUrl = item.product?.images?.find((img: any) => img.is_primary)?.image_url || item.product?.images?.[0]?.image_url;
                    return (
                      <div key={item.id} className="flex items-center gap-3 p-2 bg-muted/50 rounded-lg">
                        {imgUrl && (
                          <img src={imgUrl} alt="" className="h-10 w-10 rounded object-cover" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{item.product?.name || 'Unknown'}</p>
                          <p className="text-xs text-muted-foreground">Qty: {item.quantity} · Rs {Number(item.product?.price || 0).toFixed(0)}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* WhatsApp */}
            {selectedCustomer.mobile_number && (
              <div className="space-y-2">
                <h3 className="font-semibold text-sm flex items-center gap-2">
                  <MessageCircle className="h-4 w-4 text-green-600" /> WhatsApp
                </h3>
                {customerCart.length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full justify-start text-xs"
                    onClick={() => sendWhatsApp(selectedCustomer.mobile_number!, getAbandonedCartMsg(selectedCustomer))}
                  >
                    🛒 Abandoned Cart Reminder
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start text-xs"
                  onClick={() => sendWhatsApp(selectedCustomer.mobile_number!, getOfferMsg(selectedCustomer))}
                >
                  🎉 Offer / Coupon Broadcast
                </Button>
              </div>
            )}

            {customerOrders.length > 0 && (
              <div className="space-y-3">
                <h3 className="font-semibold text-sm">Recent Orders</h3>
                <div className="space-y-2">
                  {customerOrders.map((order) => (
                    <div key={order.id} className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                      <div>
                        <p className="font-medium text-sm">{order.order_number}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(order.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">Rs {Number(order.total).toFixed(0)}</p>
                        <Badge variant="secondary" className="text-xs">{order.status}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </DetailPanel>
    </AdminLayout>
  );
}
