import { useEffect, useState, useMemo } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { DataTable, Column } from '@/components/admin/DataTable';
import { DetailPanel, DetailField, DetailSection } from '@/components/admin/DetailPanel';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Plus, LayoutGrid, List, ChevronDown, ChevronUp, Eye } from 'lucide-react';
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
import { Progress } from '@/components/ui/progress';

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
  { value: 'ads', label: 'Advertising', color: 'bg-blue-500' },
  { value: 'packaging', label: 'Packaging', color: 'bg-amber-500' },
  { value: 'delivery', label: 'Delivery', color: 'bg-green-500' },
  { value: 'staff', label: 'Staff', color: 'bg-purple-500' },
  { value: 'rent', label: 'Rent', color: 'bg-red-500' },
  { value: 'utilities', label: 'Utilities', color: 'bg-cyan-500' },
  { value: 'software', label: 'Software', color: 'bg-indigo-500' },
  { value: 'purchase', label: 'Purchase', color: 'bg-pink-500' },
  { value: 'other', label: 'Other', color: 'bg-gray-500' },
];

const getCatColor = (cat: string) => EXPENSE_CATEGORIES.find(c => c.value === cat)?.color || 'bg-gray-500';
const getCatLabel = (cat: string) => EXPENSE_CATEGORIES.find(c => c.value === cat)?.label || cat;

const VIEW_MODE_KEY = 'expenses_view_mode';

const getAmountColor = (amount: number) => {
  if (amount >= 50000) return 'text-red-700 dark:text-red-400 font-bold';
  if (amount >= 25000) return 'text-red-600 dark:text-red-400';
  if (amount >= 10000) return 'text-orange-600 dark:text-orange-400';
  if (amount >= 5000) return 'text-amber-600 dark:text-amber-400';
  if (amount >= 1000) return 'text-blue-600 dark:text-blue-400';
  return 'text-green-600 dark:text-green-400';
};

const getAmountBadgeClass = (amount: number) => {
  if (amount >= 50000) return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 border border-red-200 dark:border-red-800';
  if (amount >= 25000) return 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400 border border-red-100 dark:border-red-900';
  if (amount >= 10000) return 'bg-orange-50 text-orange-700 dark:bg-orange-900/20 dark:text-orange-400 border border-orange-100 dark:border-orange-900';
  if (amount >= 5000) return 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400 border border-amber-100 dark:border-amber-900';
  if (amount >= 1000) return 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400 border border-blue-100 dark:border-blue-900';
  return 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400 border border-green-100 dark:border-green-900';
};

export default function AdminExpenses() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState<Partial<Expense>>({});
  const [viewMode, setViewMode] = useState<'list' | 'grid'>(() => {
    return (localStorage.getItem(VIEW_MODE_KEY) as 'list' | 'grid') || 'list';
  });
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterDateRange, setFilterDateRange] = useState<string>('all');
  const [showAllCategories, setShowAllCategories] = useState(false);
  const [receiptViewUrl, setReceiptViewUrl] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => { fetchExpenses(); }, []);
  useEffect(() => { localStorage.setItem(VIEW_MODE_KEY, viewMode); }, [viewMode]);

  const fetchExpenses = async () => {
    setIsLoading(true);
    const { data, error } = await supabase.from('expenses').select('*').order('date', { ascending: false });
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      setExpenses((data || []) as Expense[]);
    }
    setIsLoading(false);
  };

  const filteredExpenses = useMemo(() => {
    let result = expenses;
    if (filterCategory !== 'all') result = result.filter(e => e.category === filterCategory);
    if (filterDateRange !== 'all') {
      const now = new Date();
      const daysAgo = parseInt(filterDateRange);
      const start = new Date(now);
      start.setDate(start.getDate() - daysAgo);
      result = result.filter(e => new Date(e.date) >= start);
    }
    return result;
  }, [expenses, filterCategory, filterDateRange]);

  const summary = useMemo(() => {
    const now = new Date();
    const thisMonthExpenses = expenses.filter(e => {
      const d = new Date(e.date);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthExpenses = expenses.filter(e => {
      const d = new Date(e.date);
      return d.getMonth() === lastMonth.getMonth() && d.getFullYear() === lastMonth.getFullYear();
    });
    const thisMonthTotal = thisMonthExpenses.reduce((s, e) => s + Number(e.amount), 0);
    const lastMonthTotal = lastMonthExpenses.reduce((s, e) => s + Number(e.amount), 0);
    const percentChange = lastMonthTotal > 0 ? ((thisMonthTotal - lastMonthTotal) / lastMonthTotal) * 100 : thisMonthTotal > 0 ? 100 : 0;
    const total = expenses.reduce((s, e) => s + Number(e.amount), 0);

    const categoryBreakdown: Record<string, number> = {};
    thisMonthExpenses.forEach(e => {
      categoryBreakdown[e.category] = (categoryBreakdown[e.category] || 0) + Number(e.amount);
    });
    const sortedCategories = Object.entries(categoryBreakdown).sort((a, b) => b[1] - a[1]);

    return { total, thisMonthTotal, lastMonthTotal, percentChange, sortedCategories, totalRecords: expenses.length };
  }, [expenses]);

  const handleRowClick = (expense: Expense) => { setSelectedExpense(expense); setIsDetailOpen(true); };
  const handleEdit = () => { if (selectedExpense) { setFormData(selectedExpense); setIsDetailOpen(false); setIsFormOpen(true); } };
  const handleCreate = () => { setFormData({ category: 'other', date: new Date().toISOString().split('T')[0] }); setSelectedExpense(null); setIsFormOpen(true); };

  const handleDelete = async () => {
    if (!selectedExpense) return;
    setIsDeleting(true);
    const { error } = await supabase.from('expenses').delete().eq('id', selectedExpense.id);
    if (error) toast({ title: 'Error', description: error.message, variant: 'destructive' });
    else { toast({ title: 'Success', description: 'Expense deleted' }); setIsDetailOpen(false); fetchExpenses(); }
    setIsDeleting(false);
  };

  const handleSave = async () => {
    if (!formData.description || !formData.amount || !formData.date) {
      toast({ title: 'Error', description: 'Description, amount, and date are required', variant: 'destructive' });
      return;
    }
    setIsSaving(true);
    const expenseData = {
      category: (formData.category || 'other') as any,
      description: formData.description,
      amount: formData.amount,
      date: formData.date,
      receipt_url: formData.receipt_url,
      notes: formData.notes,
    };
    if (selectedExpense) {
      const { error } = await supabase.from('expenses').update(expenseData).eq('id', selectedExpense.id);
      if (error) toast({ title: 'Error', description: error.message, variant: 'destructive' });
      else { toast({ title: 'Success', description: 'Expense updated' }); setIsFormOpen(false); fetchExpenses(); }
    } else {
      const { error } = await supabase.from('expenses').insert([expenseData]);
      if (error) toast({ title: 'Error', description: error.message, variant: 'destructive' });
      else { toast({ title: 'Success', description: 'Expense added' }); setIsFormOpen(false); fetchExpenses(); }
    }
    setIsSaving(false);
  };

  const columns: Column<Expense>[] = [
    { key: 'date', header: 'Date', render: (e) => new Date(e.date).toLocaleDateString() },
    {
      key: 'category', header: 'Category',
      render: (e) => (
        <div className="flex items-center gap-2">
          <span className={`w-2.5 h-2.5 rounded-full ${getCatColor(e.category)}`} />
          <span>{getCatLabel(e.category)}</span>
        </div>
      ),
    },
    { key: 'description', header: 'Description' },
    {
      key: 'amount', header: 'Amount',
      render: (e) => (
        <span className={`inline-flex px-2 py-0.5 rounded-md text-sm font-semibold ${getAmountBadgeClass(Number(e.amount))}`}>
          ₹{Number(e.amount).toLocaleString()}
        </span>
      ),
    },
    {
      key: 'receipt_url', header: 'Receipt',
      render: (e) => e.receipt_url ? (
        <Button variant="ghost" size="sm" className="h-7 px-2" onClick={(ev) => { ev.stopPropagation(); setReceiptViewUrl(e.receipt_url); }}>
          <Eye className="h-3.5 w-3.5 mr-1" />View
        </Button>
      ) : <span className="text-muted-foreground">-</span>,
    },
  ];

  const topCategories = showAllCategories ? summary.sortedCategories : summary.sortedCategories.slice(0, 3);

  return (
    <AdminLayout
      title="Expenses"
      description="Track business expenses and costs"
      actions={
        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={() => setViewMode(viewMode === 'list' ? 'grid' : 'list')}>
            {viewMode === 'list' ? <LayoutGrid className="h-4 w-4" /> : <List className="h-4 w-4" />}
          </Button>
          <Button onClick={handleCreate}>
            <Plus className="h-4 w-4 mr-2" />Add Expense
          </Button>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Top 3 Category Breakdown */}
        {summary.sortedCategories.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">This Month by Category</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {topCategories.map(([cat, amount]) => (
                  <div key={cat} className="flex items-center gap-3">
                    <span className={`w-3 h-3 rounded-full flex-shrink-0 ${getCatColor(cat)}`} />
                    <span className="text-sm flex-1">{getCatLabel(cat)}</span>
                    <span className={`inline-flex px-2 py-0.5 rounded-md text-xs font-semibold ${getAmountBadgeClass(amount)}`}>₹{amount.toLocaleString()}</span>
                    <div className="w-24">
                      <Progress value={summary.thisMonthTotal > 0 ? (amount / summary.thisMonthTotal) * 100 : 0} className="h-1.5" />
                    </div>
                  </div>
                ))}
                {summary.sortedCategories.length > 3 && (
                  <Button variant="ghost" size="sm" className="w-full text-xs" onClick={() => setShowAllCategories(!showAllCategories)}>
                    {showAllCategories ? <><ChevronUp className="h-3 w-3 mr-1" />Show Less</> : <><ChevronDown className="h-3 w-3 mr-1" />Show {summary.sortedCategories.length - 3} More</>}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">This Month</CardTitle>
            </CardHeader>
            <CardContent>
              <p className={`text-2xl font-bold ${getAmountColor(summary.thisMonthTotal)}`}>₹{summary.thisMonthTotal.toLocaleString()}</p>
              <div className={`flex items-center gap-1 mt-1 text-xs font-medium ${summary.percentChange >= 0 ? 'text-red-500' : 'text-green-500'}`}>
                {summary.percentChange >= 0 ? '↑' : '↓'}
                {Math.abs(summary.percentChange).toFixed(1)}% vs last month
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Expenses</CardTitle>
            </CardHeader>
            <CardContent>
              <p className={`text-2xl font-bold ${getAmountColor(summary.total)}`}>₹{summary.total.toLocaleString()}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Records</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{summary.totalRecords}</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          <Select value={filterCategory} onValueChange={setFilterCategory}>
            <SelectTrigger className="w-40"><SelectValue placeholder="Category" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {EXPENSE_CATEGORIES.map(c => (
                <SelectItem key={c.value} value={c.value}>
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${c.color}`} />
                    {c.label}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterDateRange} onValueChange={setFilterDateRange}>
            <SelectTrigger className="w-40"><SelectValue placeholder="Date Range" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Time</SelectItem>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
              <SelectItem value="365">Last year</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Amount Color Legend */}
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500" />Under ₹1K</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500" />₹1K–5K</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500" />₹5K–10K</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-500" />₹10K–25K</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500" />₹25K–50K</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-700" />₹50K+</span>
        </div>

        {/* List or Grid View */}
        {viewMode === 'list' ? (
          <DataTable<Expense>
            columns={columns}
            data={filteredExpenses}
            isLoading={isLoading}
            onRowClick={handleRowClick}
            searchable
            searchPlaceholder="Search expenses..."
            searchKeys={['description', 'category']}
            getRowId={(e) => e.id}
            emptyMessage="No expenses recorded."
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredExpenses.map(expense => (
              <Card key={expense.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => handleRowClick(expense)}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className={`w-3 h-3 rounded-full ${getCatColor(expense.category)}`} />
                      <span className="text-xs text-muted-foreground">{getCatLabel(expense.category)}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">{new Date(expense.date).toLocaleDateString()}</span>
                  </div>
                  <p className="font-medium text-sm mb-1 line-clamp-1">{expense.description}</p>
                  <span className={`inline-flex px-2 py-0.5 rounded-md text-sm font-semibold ${getAmountBadgeClass(Number(expense.amount))}`}>
                    ₹{Number(expense.amount).toLocaleString()}
                  </span>
                  {expense.receipt_url && (
                    <Button variant="ghost" size="sm" className="mt-2 h-7 px-2 text-xs" onClick={(ev) => { ev.stopPropagation(); setReceiptViewUrl(expense.receipt_url); }}>
                      <Eye className="h-3 w-3 mr-1" />Receipt
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))}
            {filteredExpenses.length === 0 && <p className="col-span-full text-center text-muted-foreground py-12">No expenses recorded.</p>}
          </div>
        )}
      </div>

      {/* Receipt Viewer Dialog - clean close */}
      <Dialog open={!!receiptViewUrl} onOpenChange={(open) => { if (!open) setReceiptViewUrl(null); }}>
        <DialogContent className="max-w-2xl max-h-[90vh]">
          <DialogHeader><DialogTitle>Receipt</DialogTitle></DialogHeader>
          {receiptViewUrl && (
            <div className="flex items-center justify-center overflow-auto max-h-[75vh]">
              <img src={receiptViewUrl} alt="Receipt" className="max-w-full h-auto rounded-lg" />
            </div>
          )}
        </DialogContent>
      </Dialog>

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
              <DetailField label="Category" value={getCatLabel(selectedExpense.category)} />
              <DetailField label="Amount" value={`₹${Number(selectedExpense.amount).toLocaleString()}`} />
            </DetailSection>
            <div className="col-span-2"><DetailField label="Description" value={selectedExpense.description} /></div>
            {selectedExpense.notes && <div className="col-span-2"><DetailField label="Notes" value={selectedExpense.notes} /></div>}
            {selectedExpense.receipt_url && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase">Receipt</p>
                <img
                  src={selectedExpense.receipt_url}
                  alt="Receipt"
                  className="max-w-full h-auto rounded-lg border cursor-pointer"
                  onClick={() => setReceiptViewUrl(selectedExpense.receipt_url)}
                />
              </div>
            )}
          </div>
        )}
      </DetailPanel>

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{selectedExpense ? 'Edit Expense' : 'Add Expense'}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="date">Date *</Label>
                <Input id="date" type="date" value={formData.date || ''} onChange={(e) => setFormData({ ...formData, date: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <Select value={formData.category || 'other'} onValueChange={(value) => setFormData({ ...formData, category: value })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {EXPENSE_CATEGORIES.map((cat) => (
                      <SelectItem key={cat.value} value={cat.value}>
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${cat.color}`} />
                          {cat.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="amount">Amount *</Label>
              <Input id="amount" type="number" step="0.01" value={formData.amount || ''} onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description *</Label>
              <Input id="description" value={formData.description || ''} onChange={(e) => setFormData({ ...formData, description: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea id="notes" rows={2} value={formData.notes || ''} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Receipt</Label>
              <ImageUpload bucket="store" value={formData.receipt_url || undefined} onChange={(url) => setFormData({ ...formData, receipt_url: url })} folder="receipts" aspectRatio="video" placeholder="Upload receipt image" />
            </div>
            <div className="flex justify-end gap-3 pt-4">
              <Button variant="outline" onClick={() => setIsFormOpen(false)}>Cancel</Button>
              <Button onClick={handleSave} disabled={isSaving}>{isSaving ? 'Saving...' : 'Save Expense'}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
