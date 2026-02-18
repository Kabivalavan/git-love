import { useState, useMemo } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Search,
  Star,
  FileText,
  ShoppingCart,
  Package,
  CreditCard,
  Users,
  Truck,
  BarChart3,
  TrendingUp,
  DollarSign,
  Percent,
  ArrowLeft,
} from 'lucide-react';
import { ReportViewer } from '@/components/admin/ReportViewer';

export interface ReportDefinition {
  id: string;
  name: string;
  category: string;
  description: string;
  icon: React.ElementType;
}

const REPORT_CATEGORIES = [
  { key: 'sales', label: 'Sales', icon: ShoppingCart },
  { key: 'inventory', label: 'Inventory', icon: Package },
  { key: 'payments', label: 'Payments Received', icon: CreditCard },
  { key: 'customers', label: 'Customers', icon: Users },
  { key: 'orders', label: 'Orders', icon: FileText },
  { key: 'delivery', label: 'Delivery', icon: Truck },
  { key: 'expenses', label: 'Expenses', icon: DollarSign },
  { key: 'analytics', label: 'Analytics', icon: BarChart3 },
];

const REPORTS: ReportDefinition[] = [
  // Sales
  { id: 'sales-by-customer', name: 'Sales by Customer', category: 'sales', description: 'Revenue breakdown by customer', icon: Users },
  { id: 'sales-by-category', name: 'Sales by Category', category: 'sales', description: 'Revenue breakdown by product category', icon: Package },
  { id: 'sales-by-product', name: 'Sales by Product', category: 'sales', description: 'Revenue breakdown by individual product', icon: ShoppingCart },
  { id: 'sales-by-variant', name: 'Sales by Variant', category: 'sales', description: 'Revenue breakdown by product variant', icon: Package },
  { id: 'sales-by-coupon', name: 'Sales by Coupon', category: 'sales', description: 'Orders and revenue per coupon code', icon: Percent },
  { id: 'sales-summary', name: 'Sales Summary', category: 'sales', description: 'Overall sales summary with trends', icon: TrendingUp },
  { id: 'sales-by-date', name: 'Daily Sales Report', category: 'sales', description: 'Day-wise sales breakdown', icon: BarChart3 },
  { id: 'sales-return-history', name: 'Sales Return History', category: 'sales', description: 'Returned and cancelled orders', icon: FileText },
  // Inventory
  { id: 'stock-summary', name: 'Stock Summary', category: 'inventory', description: 'Current stock levels for all products', icon: Package },
  { id: 'low-stock', name: 'Low Stock Alert', category: 'inventory', description: 'Products below low stock threshold', icon: Package },
  { id: 'out-of-stock', name: 'Out of Stock Items', category: 'inventory', description: 'Products with zero stock', icon: Package },
  { id: 'product-performance', name: 'Product Performance', category: 'inventory', description: 'Products ranked by sales volume', icon: TrendingUp },
  // Payments
  { id: 'payments-received', name: 'Payments Received', category: 'payments', description: 'All received payments with status', icon: CreditCard },
  { id: 'payments-by-method', name: 'Payments by Method', category: 'payments', description: 'Breakdown by payment method (COD, Online)', icon: CreditCard },
  { id: 'payment-status', name: 'Payment Status Report', category: 'payments', description: 'Pending, paid, failed, refunded payments', icon: CreditCard },
  { id: 'refunds', name: 'Refund Report', category: 'payments', description: 'All refunded payments', icon: DollarSign },
  // Customers
  { id: 'customer-list', name: 'Customer List', category: 'customers', description: 'All registered customers', icon: Users },
  { id: 'top-customers', name: 'Top Customers', category: 'customers', description: 'Customers ranked by total spend', icon: Star },
  { id: 'new-customers', name: 'New Customers', category: 'customers', description: 'Recently registered customers', icon: Users },
  // Orders
  { id: 'order-fulfillment', name: 'Order Fulfillment', category: 'orders', description: 'Order fulfillment status breakdown', icon: FileText },
  { id: 'orders-by-status', name: 'Orders by Status', category: 'orders', description: 'Orders grouped by current status', icon: FileText },
  { id: 'orders-by-date', name: 'Orders by Date', category: 'orders', description: 'Daily order count and value', icon: BarChart3 },
  { id: 'cancelled-orders', name: 'Cancelled Orders', category: 'orders', description: 'All cancelled orders with reasons', icon: FileText },
  // Delivery
  { id: 'delivery-status', name: 'Delivery Status', category: 'delivery', description: 'Current delivery status of all shipments', icon: Truck },
  { id: 'cod-collection', name: 'COD Collection', category: 'delivery', description: 'Cash on delivery collection status', icon: DollarSign },
  { id: 'delivery-performance', name: 'Delivery Performance', category: 'delivery', description: 'Delivery time and success rates', icon: TrendingUp },
  // Expenses
  { id: 'expense-summary', name: 'Expense Summary', category: 'expenses', description: 'Monthly expense breakdown', icon: DollarSign },
  { id: 'expense-by-category', name: 'Expense by Category', category: 'expenses', description: 'Expenses grouped by category', icon: BarChart3 },
  { id: 'profit-loss', name: 'Profit & Loss', category: 'expenses', description: 'Revenue vs expenses P&L statement', icon: TrendingUp },
  // Analytics
  { id: 'page-views', name: 'Page Views', category: 'analytics', description: 'Most visited pages', icon: BarChart3 },
  { id: 'product-views', name: 'Product Views', category: 'analytics', description: 'Most viewed products', icon: Package },
  { id: 'conversion-funnel', name: 'Conversion Funnel', category: 'analytics', description: 'View to purchase conversion', icon: TrendingUp },
];

export default function AdminReports() {
  const [selectedCategory, setSelectedCategory] = useState('sales');
  const [searchQuery, setSearchQuery] = useState('');
  const [favorites, setFavorites] = useState<string[]>([]);
  const [activeReport, setActiveReport] = useState<ReportDefinition | null>(null);

  const filteredReports = useMemo(() => {
    let reports = REPORTS;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      reports = reports.filter(r => r.name.toLowerCase().includes(q) || r.description.toLowerCase().includes(q));
    } else {
      reports = reports.filter(r => r.category === selectedCategory);
    }
    return reports;
  }, [selectedCategory, searchQuery]);

  const toggleFavorite = (id: string) => {
    setFavorites(prev => prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id]);
  };

  const currentCategoryLabel = REPORT_CATEGORIES.find(c => c.key === selectedCategory)?.label || 'Reports';

  if (activeReport) {
    return (
      <AdminLayout
        title={activeReport.name}
        description={activeReport.description}
        actions={
          <Button variant="outline" onClick={() => setActiveReport(null)}>
            <ArrowLeft className="h-4 w-4 mr-2" />Back to Reports
          </Button>
        }
      >
        <ReportViewer report={activeReport} />
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Reports Center" description="Comprehensive business reports and analytics">
      <div className="flex items-center justify-center mb-6">
        <div className="relative w-full max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search reports..."
            className="pl-10"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* Sidebar */}
        <div className="col-span-12 lg:col-span-3">
          <Card>
            <CardContent className="p-0">
              <ScrollArea className="h-auto max-h-[600px]">
                <div className="p-2">
                  <p className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Report Category</p>
                  {REPORT_CATEGORIES.map((cat) => {
                    const Icon = cat.icon;
                    const count = REPORTS.filter(r => r.category === cat.key).length;
                    return (
                      <button
                        key={cat.key}
                        onClick={() => { setSelectedCategory(cat.key); setSearchQuery(''); }}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                          selectedCategory === cat.key && !searchQuery
                            ? 'bg-primary/10 text-primary font-medium'
                            : 'text-foreground hover:bg-muted'
                        }`}
                      >
                        <Icon className="h-4 w-4 flex-shrink-0" />
                        <span className="flex-1 text-left">{cat.label}</span>
                        <Badge variant="secondary" className="text-[10px] h-5 px-1.5">{count}</Badge>
                      </button>
                    );
                  })}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        {/* Reports List */}
        <div className="col-span-12 lg:col-span-9">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <CardTitle className="text-lg">{searchQuery ? 'Search Results' : currentCategoryLabel}</CardTitle>
                <Badge variant="outline">{filteredReports.length}</Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="border-t">
                {/* Table Header */}
                <div className="grid grid-cols-12 gap-4 px-6 py-3 bg-muted/50 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  <div className="col-span-1"></div>
                  <div className="col-span-5">Report Name</div>
                  <div className="col-span-6">Description</div>
                </div>
                {/* Report Rows */}
                {filteredReports.length === 0 ? (
                  <div className="px-6 py-12 text-center text-muted-foreground">No reports found.</div>
                ) : (
                  filteredReports.map((report) => (
                    <div
                      key={report.id}
                      className="grid grid-cols-12 gap-4 px-6 py-3.5 border-t items-center hover:bg-muted/30 cursor-pointer transition-colors group"
                      onClick={() => setActiveReport(report)}
                    >
                      <div className="col-span-1">
                        <button
                          onClick={(e) => { e.stopPropagation(); toggleFavorite(report.id); }}
                          className="text-muted-foreground hover:text-amber-500 transition-colors"
                        >
                          <Star className={`h-4 w-4 ${favorites.includes(report.id) ? 'fill-amber-400 text-amber-400' : ''}`} />
                        </button>
                      </div>
                      <div className="col-span-5">
                        <span className="text-sm font-medium text-primary group-hover:underline">{report.name}</span>
                      </div>
                      <div className="col-span-6">
                        <span className="text-sm text-muted-foreground">{report.description}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminLayout>
  );
}