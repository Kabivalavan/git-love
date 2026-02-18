import { useEffect, useState } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { DataTable, Column } from '@/components/admin/DataTable';
import { DetailPanel, DetailField, DetailSection } from '@/components/admin/DetailPanel';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { ExternalLink } from 'lucide-react';

interface Delivery {
  id: string;
  order_id: string;
  status: string;
  partner_name: string | null;
  tracking_number: string | null;
  tracking_url: string | null;
  estimated_date: string | null;
  delivered_at: string | null;
  delivery_charge: number;
  is_cod: boolean;
  cod_amount: number | null;
  cod_collected: boolean;
  notes: string | null;
  created_at: string;
  order?: { order_number: string };
}

const DELIVERY_STATUSES = [
  { value: 'pending', label: 'Pending', color: 'secondary' },
  { value: 'assigned', label: 'Assigned', color: 'default' },
  { value: 'picked', label: 'Picked Up', color: 'default' },
  { value: 'in_transit', label: 'In Transit', color: 'default' },
  { value: 'delivered', label: 'Delivered', color: 'default' },
  { value: 'failed', label: 'Failed', color: 'destructive' },
];

export default function AdminDeliveries() {
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDelivery, setSelectedDelivery] = useState<Delivery | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [editData, setEditData] = useState<Partial<Delivery>>({});
  const { toast } = useToast();

  useEffect(() => {
    fetchDeliveries();
  }, []);

  const fetchDeliveries = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('deliveries')
      .select('*, order:orders(order_number)')
      .order('created_at', { ascending: false });

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      setDeliveries((data || []) as unknown as Delivery[]);
    }
    setIsLoading(false);
  };

  const handleRowClick = (delivery: Delivery) => {
    setSelectedDelivery(delivery);
    setEditData(delivery);
    setIsDetailOpen(true);
  };

  const handleUpdate = async () => {
    if (!selectedDelivery) return;
    setIsUpdating(true);

    const updateData = {
      status: editData.status as 'pending' | 'assigned' | 'picked' | 'in_transit' | 'delivered' | 'failed',
      partner_name: editData.partner_name,
      tracking_number: editData.tracking_number,
      tracking_url: editData.tracking_url,
      estimated_date: editData.estimated_date,
      delivered_at: editData.status === 'delivered' ? new Date().toISOString() : editData.delivered_at,
      cod_collected: editData.cod_collected,
      notes: editData.notes,
    };

    const { error } = await supabase
      .from('deliveries')
      .update(updateData)
      .eq('id', selectedDelivery.id);

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Success', description: 'Delivery updated successfully' });
      fetchDeliveries();
      setSelectedDelivery({ ...selectedDelivery, ...updateData } as Delivery);
    }
    setIsUpdating(false);
  };

  const getStatusColor = (status: string) => {
    const found = DELIVERY_STATUSES.find(s => s.value === status);
    return (found?.color || 'secondary') as 'default' | 'secondary' | 'destructive';
  };

  const columns: Column<Delivery>[] = [
    {
      key: 'order_id',
      header: 'Order',
      render: (d) => d.order?.order_number || d.order_id.slice(0, 8),
    },
    {
      key: 'status',
      header: 'Status',
      render: (d) => (
        <Badge variant={getStatusColor(d.status)}>
          {DELIVERY_STATUSES.find(s => s.value === d.status)?.label || d.status}
        </Badge>
      ),
    },
    { key: 'partner_name', header: 'Partner' },
    { key: 'tracking_number', header: 'Tracking #' },
    {
      key: 'is_cod',
      header: 'COD',
      render: (d) => d.is_cod ? (
        <Badge variant={d.cod_collected ? 'default' : 'secondary'}>
          ₹{d.cod_amount} {d.cod_collected ? '✓' : ''}
        </Badge>
      ) : '-',
    },
    {
      key: 'created_at',
      header: 'Date',
      render: (d) => new Date(d.created_at).toLocaleDateString(),
    },
  ];

  return (
    <AdminLayout
      title="Deliveries"
      description="Track and manage order deliveries"
    >
      <DataTable<Delivery>
        columns={columns}
        data={deliveries}
        isLoading={isLoading}
        onRowClick={handleRowClick}
        searchable
        searchPlaceholder="Search by tracking number..."
        searchKeys={['tracking_number', 'partner_name']}
        getRowId={(d) => d.id}
        emptyMessage="No deliveries found."
      />

      <DetailPanel
        isOpen={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
        title={`Delivery for ${selectedDelivery?.order?.order_number || 'Order'}`}
        canEdit={false}
        canDelete={false}
      >
        {selectedDelivery && (
          <div className="space-y-6">
            <DetailSection title="Status">
              <div className="col-span-2 space-y-2">
                <Label>Delivery Status</Label>
                <Select
                  value={editData.status || selectedDelivery.status}
                  onValueChange={(value) => setEditData({ ...editData, status: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DELIVERY_STATUSES.map((status) => (
                      <SelectItem key={status.value} value={status.value}>
                        {status.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </DetailSection>

            <DetailSection title="Shipping Partner">
              <div className="space-y-2">
                <Label>Partner Name</Label>
                <Input
                  value={editData.partner_name || ''}
                  onChange={(e) => setEditData({ ...editData, partner_name: e.target.value })}
                  placeholder="e.g., BlueDart, Delhivery"
                />
              </div>
              <div className="space-y-2">
                <Label>Tracking Number</Label>
                <Input
                  value={editData.tracking_number || ''}
                  onChange={(e) => setEditData({ ...editData, tracking_number: e.target.value })}
                />
              </div>
            </DetailSection>

            <div className="space-y-2">
              <Label>Tracking URL</Label>
              <div className="flex gap-2">
                <Input
                  value={editData.tracking_url || ''}
                  onChange={(e) => setEditData({ ...editData, tracking_url: e.target.value })}
                  placeholder="https://..."
                  className="flex-1"
                />
                {editData.tracking_url && (
                  <Button variant="outline" size="icon" asChild>
                    <a href={editData.tracking_url} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </Button>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Estimated Delivery Date</Label>
              <Input
                type="datetime-local"
                value={editData.estimated_date?.slice(0, 16) || ''}
                onChange={(e) => setEditData({ ...editData, estimated_date: e.target.value })}
              />
            </div>

            {selectedDelivery.is_cod && (
              <DetailSection title="COD Details">
                <DetailField label="COD Amount" value={`₹${selectedDelivery.cod_amount}`} />
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="cod_collected"
                    checked={editData.cod_collected}
                    onChange={(e) => setEditData({ ...editData, cod_collected: e.target.checked })}
                    className="h-4 w-4 rounded border-border"
                  />
                  <Label htmlFor="cod_collected">COD Collected</Label>
                </div>
              </DetailSection>
            )}

            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                rows={3}
                value={editData.notes || ''}
                onChange={(e) => setEditData({ ...editData, notes: e.target.value })}
                placeholder="Add delivery notes..."
              />
            </div>

            <DetailSection title="Timestamps">
              <DetailField label="Created" value={new Date(selectedDelivery.created_at).toLocaleString()} />
              <DetailField label="Delivered At" value={selectedDelivery.delivered_at ? new Date(selectedDelivery.delivered_at).toLocaleString() : '-'} />
            </DetailSection>

            <Button onClick={handleUpdate} disabled={isUpdating} className="w-full">
              {isUpdating ? 'Updating...' : 'Update Delivery'}
            </Button>
          </div>
        )}
      </DetailPanel>
    </AdminLayout>
  );
}
