import { useEffect, useState } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { DataTable, Column } from '@/components/admin/DataTable';
import { DetailPanel, DetailField, DetailSection } from '@/components/admin/DetailPanel';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { ExternalLink, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';

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
    setIsDetailOpen(true);
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
      description="View delivery records — manage delivery details from inside each Order"
    >
      <div className="mb-3 flex items-center gap-2 p-3 bg-muted/50 rounded-lg text-sm text-muted-foreground border">
        <Info className="h-4 w-4 shrink-0" />
        <span>Delivery records are created automatically when an order is marked as <strong>Packed</strong>. To update courier, tracking ID, and expected delivery — open the order and use the Delivery Details section.</span>
      </div>

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
              <DetailField label="Delivery Status" value={
                DELIVERY_STATUSES.find(s => s.value === selectedDelivery.status)?.label || selectedDelivery.status
              } />
            </DetailSection>

            <DetailSection title="Shipping Partner">
              <DetailField label="Partner Name" value={selectedDelivery.partner_name || '—'} />
              <DetailField label="Tracking Number" value={selectedDelivery.tracking_number || '—'} />
            </DetailSection>

            {selectedDelivery.tracking_url && (
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Tracking URL</p>
                <Button variant="outline" size="sm" asChild>
                  <a href={selectedDelivery.tracking_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1">
                    <ExternalLink className="h-3.5 w-3.5" /> Open Tracking
                  </a>
                </Button>
              </div>
            )}

            <DetailSection title="Dates">
              <DetailField label="Estimated Delivery" value={selectedDelivery.estimated_date ? new Date(selectedDelivery.estimated_date).toLocaleString() : '—'} />
              <DetailField label="Delivered At" value={selectedDelivery.delivered_at ? new Date(selectedDelivery.delivered_at).toLocaleString() : '—'} />
              <DetailField label="Created" value={new Date(selectedDelivery.created_at).toLocaleString()} />
            </DetailSection>

            {selectedDelivery.is_cod && (
              <DetailSection title="COD Details">
                <DetailField label="COD Amount" value={`₹${selectedDelivery.cod_amount}`} />
                <DetailField label="Collected" value={selectedDelivery.cod_collected ? 'Yes ✓' : 'No'} />
              </DetailSection>
            )}

            {selectedDelivery.notes && (
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Notes</p>
                <p className="text-sm">{selectedDelivery.notes}</p>
              </div>
            )}
          </div>
        )}
      </DetailPanel>
    </AdminLayout>
  );
}
