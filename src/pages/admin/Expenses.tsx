import { useEffect, useState } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { DataTable, Column } from '@/components/admin/DataTable';
import { DetailPanel, DetailField, DetailSection } from '@/components/admin/DetailPanel';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Download } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { ImageUpload } from '@/components/ui/image-upload';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface Expense {
  id: string;
  category: string;
  description: string;
  amount: number;
  date: string;
  receipt_url: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
}

const EXPENSE_CATEGORIES = [
  { value: 'ads', label: 'Advertising', color: 'default' },
  { value: 'packaging', label: 'Packaging', color: 'secondary' },
  { value: 'delivery', label: 'Delivery', color: 'secondary' },
  { value: 'staff', label: 'Staff', color: 'default' },
  { value: 'rent', label: 'Rent', color: 'secondary' },
  { value: 'utilities', label: 'Utilities', color: 'secondary' },
  { value: 'software', label: 'Software', color: 'default' },
  { value: 'other', label: 'Other', color: 'secondary' },
];

export default function AdminExpenses() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState<Partial<Expense>>({});
  const [summary, setSummary] = useState({ total: 0, thisMonth: 0 });
  const { toast } = useToast();

  useEffect(() => {
    fetchExpenses();
  }, []);

  const fetchExpenses = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('expenses')
      .select('*')
      .order('date', { ascending: false });

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      const expenseData = (data || []) as Expense[];
      setExpenses(expenseData);
      
      // Calculate summary
      const total = expenseData.reduce((sum, e) => sum + Number(e.amount), 0);
      const thisMonth = expenseData
        .filter(e => {
          const expenseDate = new Date(e.date);
          const now = new Date();
          return expenseDate.getMonth() === now.getMonth() && expenseDate.getFullYear() === now.getFullYear();
        })
        .reduce((sum, e) => sum + Number(e.amount), 0);
      
      setSummary({ total, thisMonth });
    }
    setIsLoading(false);
  };

  const handleRowClick = (expense: Expense) => {
    setSelectedExpense(expense);
    setIsDetailOpen(true);
  };

  const handleEdit = () => {
    if (selectedExpense) {
      setFormData(selectedExpense);
      setIsDetailOpen(false);
      setIsFormOpen(true);
    }
  };

  const handleCreate = () => {
    setFormData({
      category: 'other',
      date: new Date().toISOString().split('T')[0],
    });
    setSelectedExpense(null);
    setIsFormOpen(true);
  };

  const handleDelete = async () => {
    if (!selectedExpense) return;
    setIsDeleting(true);

    const { error } = await supabase.from('expenses').delete().eq('id', selectedExpense.id);

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Success', description: 'Expense deleted successfully' });
      setIsDetailOpen(false);
      fetchExpenses();
    }
    setIsDeleting(false);
  };

  const handleSave = async () => {
    if (!formData.description || !formData.amount || !formData.date) {
      toast({ title: 'Error', description: 'Description, amount, and date are required', variant: 'destructive' });
      return;
    }

    setIsSaving(true);

    const expenseData = {
      category: (formData.category || 'other') as 'ads' | 'packaging' | 'delivery' | 'staff' | 'rent' | 'utilities' | 'software' | 'other',
      description: formData.description,
      amount: formData.amount,
      date: formData.date,
      receipt_url: formData.receipt_url,
      notes: formData.notes,
    };

    if (selectedExpense) {
      const { error } = await supabase.from('expenses').update(expenseData).eq('id', selectedExpense.id);
      if (error) {
        toast({ title: 'Error', description: error.message, variant: 'destructive' });
      } else {
        toast({ title: 'Success', description: 'Expense updated successfully' });
        setIsFormOpen(false);
        fetchExpenses();
      }
    } else {
      const { error } = await supabase.from('expenses').insert([expenseData]);
      if (error) {
        toast({ title: 'Error', description: error.message, variant: 'destructive' });
      } else {
        toast({ title: 'Success', description: 'Expense added successfully' });
        setIsFormOpen(false);
        fetchExpenses();
      }
    }
    setIsSaving(false);
  };

  const columns: Column<Expense>[] = [
    {
      key: 'date',
      header: 'Date',
      render: (e) => new Date(e.date).toLocaleDateString(),
    },
    {
      key: 'category',
      header: 'Category',
      render: (e) => (
        <Badge variant="secondary">
          {EXPENSE_CATEGORIES.find(c => c.value === e.category)?.label || e.category}
        </Badge>
      ),
    },
    { key: 'description', header: 'Description' },
    {
      key: 'amount',
      header: 'Amount',
      render: (e) => `₹${Number(e.amount).toFixed(2)}`,
    },
    {
      key: 'receipt_url',
      header: 'Receipt',
      render: (e) => e.receipt_url ? '✓' : '-',
    },
  ];

  return (
    <AdminLayout
      title="Expenses"
      description="Track business expenses and costs"
      actions={
        <Button onClick={handleCreate} className="bg-primary hover:bg-primary/90">
          <Plus className="h-4 w-4 mr-2" />
          Add Expense
        </Button>
      }
    >
      <div className="space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">This Month</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">₹{summary.thisMonth.toFixed(2)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Expenses</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">₹{summary.total.toFixed(2)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Records</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{expenses.length}</p>
            </CardContent>
          </Card>
        </div>

        <DataTable<Expense>
          columns={columns}
          data={expenses}
          isLoading={isLoading}
          onRowClick={handleRowClick}
          searchable
          searchPlaceholder="Search expenses..."
          searchKeys={['description', 'category']}
          getRowId={(e) => e.id}
          emptyMessage="No expenses recorded."
        />
      </div>

      <DetailPanel
        isOpen={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
        title="Expense Details"
        onEdit={handleEdit}
        onDelete={handleDelete}
        isDeleting={isDeleting}
      >
        {selectedExpense && (
          <div className="space-y-6">
            <DetailSection title="Expense Info">
              <DetailField label="Date" value={new Date(selectedExpense.date).toLocaleDateString()} />
              <DetailField label="Category" value={EXPENSE_CATEGORIES.find(c => c.value === selectedExpense.category)?.label} />
              <DetailField label="Amount" value={`₹${Number(selectedExpense.amount).toFixed(2)}`} />
            </DetailSection>
            <div className="col-span-2">
              <DetailField label="Description" value={selectedExpense.description} />
            </div>
            {selectedExpense.notes && (
              <div className="col-span-2">
                <DetailField label="Notes" value={selectedExpense.notes} />
              </div>
            )}
            {selectedExpense.receipt_url && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase">Receipt</p>
                <a href={selectedExpense.receipt_url} target="_blank" rel="noopener noreferrer">
                  <img src={selectedExpense.receipt_url} alt="Receipt" className="max-w-full h-auto rounded-lg border" />
                </a>
              </div>
            )}
          </div>
        )}
      </DetailPanel>

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedExpense ? 'Edit Expense' : 'Add Expense'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="date">Date *</Label>
                <Input
                  id="date"
                  type="date"
                  value={formData.date || ''}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <Select
                  value={formData.category || 'other'}
                  onValueChange={(value) => setFormData({ ...formData, category: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EXPENSE_CATEGORIES.map((cat) => (
                      <SelectItem key={cat.value} value={cat.value}>
                        {cat.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="amount">Amount *</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                value={formData.amount || ''}
                onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description *</Label>
              <Input
                id="description"
                value={formData.description || ''}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                rows={2}
                value={formData.notes || ''}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>Receipt</Label>
              <ImageUpload
                bucket="store"
                value={formData.receipt_url || undefined}
                onChange={(url) => setFormData({ ...formData, receipt_url: url })}
                folder="receipts"
                aspectRatio="video"
                placeholder="Upload receipt image"
              />
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button variant="outline" onClick={() => setIsFormOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={isSaving}>
                {isSaving ? 'Saving...' : 'Save Expense'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
