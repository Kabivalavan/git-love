import { lazy, Suspense } from 'react';
import { Toaster } from '@/components/ui/toaster';
import { Toaster as Sonner } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/hooks/useAuth';
import { ThemeProvider } from '@/hooks/useTheme';
import { GlobalStoreProvider } from '@/hooks/useGlobalStore';
import { ScrollToTop } from '@/components/ScrollToTop';
import { ScrollToTopButton } from '@/components/ScrollToTopButton';
import { StorefrontLayout } from '@/components/storefront/StorefrontLayout';
import { AdminLayout } from '@/components/admin/AdminLayout';

import HomePage from './pages/store/Home';

const NotFound = lazy(() => import('./pages/NotFound'));
const CustomerAuth = lazy(() => import('./pages/auth/CustomerAuth'));
const AdminAuth = lazy(() => import('./pages/auth/AdminAuth'));

const AdminDashboard = lazy(() => import('./pages/admin/Dashboard'));
const AdminProducts = lazy(() => import('./pages/admin/Products'));
const AdminCategories = lazy(() => import('./pages/admin/Categories'));
const AdminOrders = lazy(() => import('./pages/admin/Orders'));
const AdminBanners = lazy(() => import('./pages/admin/Banners'));
const AdminOffers = lazy(() => import('./pages/admin/Offers'));
const AdminCoupons = lazy(() => import('./pages/admin/Coupons'));
const AdminDeliveries = lazy(() => import('./pages/admin/Deliveries'));
const AdminPayments = lazy(() => import('./pages/admin/Payments'));
const AdminExpenses = lazy(() => import('./pages/admin/Expenses'));
const AdminCustomers = lazy(() => import('./pages/admin/Customers'));
const AdminReports = lazy(() => import('./pages/admin/Reports'));
const AdminSettings = lazy(() => import('./pages/admin/Settings'));
const AdminAnalytics = lazy(() => import('./pages/admin/Analytics'));
const AdminBundles = lazy(() => import('./pages/admin/Bundles'));
const AdminNotifications = lazy(() => import('./pages/admin/Notifications'));
const AdminActivityLog = lazy(() => import('./pages/admin/ActivityLog'));
const AdminConversionOptimization = lazy(() => import('./pages/admin/ConversionOptimization'));
const AdminWhatsAppMarketing = lazy(() => import('./pages/admin/WhatsAppMarketing'));
const AdminReturns = lazy(() => import('./pages/admin/Returns'));
const AdminReports2 = lazy(() => import('./pages/admin/Reports2'));

const ProductsPage = lazy(() => import('./pages/store/Products'));
const ProductDetailPage = lazy(() => import('./pages/store/ProductDetail'));
const CartPage = lazy(() => import('./pages/store/Cart'));
const CheckoutPage = lazy(() => import('./pages/store/Checkout'));
const OrderSuccessPage = lazy(() => import('./pages/store/OrderSuccess'));
const AccountPage = lazy(() => import('./pages/store/Account'));
const MyOrdersPage = lazy(() => import('./pages/store/MyOrders'));
const OrderTrackingPage = lazy(() => import('./pages/store/OrderTracking'));
const SavedAddressesPage = lazy(() => import('./pages/store/SavedAddresses'));
const ProfileSettingsPage = lazy(() => import('./pages/store/ProfileSettings'));
const ShippingPolicyPage = lazy(() => import('./pages/store/ShippingPolicy'));
const ReturnPolicyPage = lazy(() => import('./pages/store/ReturnPolicy'));
const PrivacyPolicyPage = lazy(() => import('./pages/store/PrivacyPolicy'));
const TermsConditionsPage = lazy(() => import('./pages/store/TermsConditions'));
const ContactUsPage = lazy(() => import('./pages/store/ContactUs'));
const FAQPage = lazy(() => import('./pages/store/FAQ'));
const WishlistPage = lazy(() => import('./pages/store/Wishlist'));
const BundleDetailPage = lazy(() => import('./pages/store/BundleDetail'));
const CategoriesPage = lazy(() => import('./pages/store/Categories'));
const AllBundlesPage = lazy(() => import('./pages/store/AllBundles'));
const ReturnRequestPage = lazy(() => import('./pages/store/ReturnRequest'));
const MyReturnsPage = lazy(() => import('./pages/store/MyReturns'));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 2 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
      retry: 2,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 8000),
      structuralSharing: true,
    },
    mutations: {
      retry: 1,
    },
  },
});

// Storefront loading fallback - shows within the layout shell
function StorefrontLoadingFallback() {
  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      <div className="animate-pulse rounded-xl bg-muted h-8 w-3/4" />
      <div className="animate-pulse rounded-xl bg-muted h-4 w-1/2" />
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {[1, 2, 3, 4, 5, 6].map(i => (
          <div key={i} className="space-y-3">
            <div className="animate-pulse rounded-xl bg-muted aspect-square" />
            <div className="animate-pulse rounded bg-muted h-4 w-3/4" />
            <div className="animate-pulse rounded bg-muted h-4 w-1/2" />
          </div>
        ))}
      </div>
    </div>
  );
}

// Admin loading fallback - shows within the admin layout shell
function AdminLoadingFallback() {
  return (
    <div className="space-y-4">
      <div className="animate-pulse rounded-xl bg-muted h-8 w-1/3" />
      <div className="animate-pulse rounded-xl bg-muted h-4 w-1/4" />
      <div className="animate-pulse rounded-xl bg-muted h-64 w-full" />
    </div>
  );
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, isAdmin, isLoading } = useAuth();
  if (isLoading) return (
    <AdminLayout>
      <AdminLoadingFallback />
    </AdminLayout>
  );
  if (!user) return <Navigate to="/admin/login" replace />;
  if (!isAdmin) return <Navigate to="/" replace />;
  return <>{children}</>;
}

const AppRoutes = () => (
  <>
    <ScrollToTop />
    <ScrollToTopButton />
    <Routes>
      {/* Public Storefront */}
      <Route path="/" element={<HomePage />} />
      <Route path="/category" element={<Suspense fallback={<StorefrontLayout><StorefrontLoadingFallback /></StorefrontLayout>}><CategoriesPage /></Suspense>} />
      <Route path="/category/:slug" element={<Suspense fallback={<StorefrontLayout><StorefrontLoadingFallback /></StorefrontLayout>}><ProductsPage /></Suspense>} />
      <Route path="/products" element={<Suspense fallback={<StorefrontLayout><StorefrontLoadingFallback /></StorefrontLayout>}><ProductsPage /></Suspense>} />
      <Route path="/product/:slug" element={<Suspense fallback={<StorefrontLayout><StorefrontLoadingFallback /></StorefrontLayout>}><ProductDetailPage /></Suspense>} />
      <Route path="/cart" element={<Suspense fallback={<StorefrontLayout><StorefrontLoadingFallback /></StorefrontLayout>}><CartPage /></Suspense>} />
      <Route path="/checkout" element={<Suspense fallback={<StorefrontLayout><StorefrontLoadingFallback /></StorefrontLayout>}><CheckoutPage /></Suspense>} />
      <Route path="/order-success" element={<Suspense fallback={<StorefrontLayout><StorefrontLoadingFallback /></StorefrontLayout>}><OrderSuccessPage /></Suspense>} />
      <Route path="/auth" element={<Suspense fallback={<StorefrontLayout><StorefrontLoadingFallback /></StorefrontLayout>}><CustomerAuth /></Suspense>} />
      <Route path="/shipping-policy" element={<Suspense fallback={<StorefrontLayout><StorefrontLoadingFallback /></StorefrontLayout>}><ShippingPolicyPage /></Suspense>} />
      <Route path="/return-policy" element={<Suspense fallback={<StorefrontLayout><StorefrontLoadingFallback /></StorefrontLayout>}><ReturnPolicyPage /></Suspense>} />
      <Route path="/privacy-policy" element={<Suspense fallback={<StorefrontLayout><StorefrontLoadingFallback /></StorefrontLayout>}><PrivacyPolicyPage /></Suspense>} />
      <Route path="/terms" element={<Suspense fallback={<StorefrontLayout><StorefrontLoadingFallback /></StorefrontLayout>}><TermsConditionsPage /></Suspense>} />
      <Route path="/contact" element={<Suspense fallback={<StorefrontLayout><StorefrontLoadingFallback /></StorefrontLayout>}><ContactUsPage /></Suspense>} />
      <Route path="/faq" element={<Suspense fallback={<StorefrontLayout><StorefrontLoadingFallback /></StorefrontLayout>}><FAQPage /></Suspense>} />
      <Route path="/wishlist" element={<Suspense fallback={<StorefrontLayout><StorefrontLoadingFallback /></StorefrontLayout>}><WishlistPage /></Suspense>} />
      <Route path="/bundles" element={<Suspense fallback={<StorefrontLayout><StorefrontLoadingFallback /></StorefrontLayout>}><AllBundlesPage /></Suspense>} />
      <Route path="/bundles/:slug" element={<Suspense fallback={<StorefrontLayout><StorefrontLoadingFallback /></StorefrontLayout>}><BundleDetailPage /></Suspense>} />

      {/* User Account */}
      <Route path="/account" element={<Suspense fallback={<StorefrontLayout><StorefrontLoadingFallback /></StorefrontLayout>}><AccountPage /></Suspense>}>
        <Route index element={<Suspense fallback={<StorefrontLoadingFallback />}><MyOrdersPage /></Suspense>} />
        <Route path="order/:orderId" element={<Suspense fallback={<StorefrontLoadingFallback />}><OrderTrackingPage /></Suspense>} />
        <Route path="returns" element={<Suspense fallback={<StorefrontLoadingFallback />}><MyReturnsPage /></Suspense>} />
        <Route path="return/:orderId" element={<Suspense fallback={<StorefrontLoadingFallback />}><ReturnRequestPage /></Suspense>} />
        <Route path="addresses" element={<Suspense fallback={<StorefrontLoadingFallback />}><SavedAddressesPage /></Suspense>} />
        <Route path="profile" element={<Suspense fallback={<StorefrontLoadingFallback />}><ProfileSettingsPage /></Suspense>} />
      </Route>

      {/* Admin */}
      <Route path="/admin/login" element={<Suspense fallback={<div className="min-h-screen bg-background" />}><AdminAuth /></Suspense>} />
      <Route path="/admin" element={<AdminRoute><Suspense fallback={<AdminLayout><AdminLoadingFallback /></AdminLayout>}><AdminDashboard /></Suspense></AdminRoute>} />
      <Route path="/admin/banners" element={<AdminRoute><Suspense fallback={<AdminLayout><AdminLoadingFallback /></AdminLayout>}><AdminBanners /></Suspense></AdminRoute>} />
      <Route path="/admin/products" element={<AdminRoute><Suspense fallback={<AdminLayout><AdminLoadingFallback /></AdminLayout>}><AdminProducts /></Suspense></AdminRoute>} />
      <Route path="/admin/categories" element={<AdminRoute><Suspense fallback={<AdminLayout><AdminLoadingFallback /></AdminLayout>}><AdminCategories /></Suspense></AdminRoute>} />
      <Route path="/admin/offers" element={<AdminRoute><Suspense fallback={<AdminLayout><AdminLoadingFallback /></AdminLayout>}><AdminOffers /></Suspense></AdminRoute>} />
      <Route path="/admin/coupons" element={<AdminRoute><Suspense fallback={<AdminLayout><AdminLoadingFallback /></AdminLayout>}><AdminCoupons /></Suspense></AdminRoute>} />
      <Route path="/admin/orders" element={<AdminRoute><Suspense fallback={<AdminLayout><AdminLoadingFallback /></AdminLayout>}><AdminOrders /></Suspense></AdminRoute>} />
      <Route path="/admin/deliveries" element={<AdminRoute><Suspense fallback={<AdminLayout><AdminLoadingFallback /></AdminLayout>}><AdminDeliveries /></Suspense></AdminRoute>} />
      <Route path="/admin/payments" element={<AdminRoute><Suspense fallback={<AdminLayout><AdminLoadingFallback /></AdminLayout>}><AdminPayments /></Suspense></AdminRoute>} />
      <Route path="/admin/expenses" element={<AdminRoute><Suspense fallback={<AdminLayout><AdminLoadingFallback /></AdminLayout>}><AdminExpenses /></Suspense></AdminRoute>} />
      <Route path="/admin/customers" element={<AdminRoute><Suspense fallback={<AdminLayout><AdminLoadingFallback /></AdminLayout>}><AdminCustomers /></Suspense></AdminRoute>} />
      <Route path="/admin/reports" element={<AdminRoute><Suspense fallback={<AdminLayout><AdminLoadingFallback /></AdminLayout>}><AdminReports /></Suspense></AdminRoute>} />
      <Route path="/admin/settings" element={<AdminRoute><Suspense fallback={<AdminLayout><AdminLoadingFallback /></AdminLayout>}><AdminSettings /></Suspense></AdminRoute>} />
      <Route path="/admin/analytics" element={<AdminRoute><Suspense fallback={<AdminLayout><AdminLoadingFallback /></AdminLayout>}><AdminAnalytics /></Suspense></AdminRoute>} />
      <Route path="/admin/bundles" element={<AdminRoute><Suspense fallback={<AdminLayout><AdminLoadingFallback /></AdminLayout>}><AdminBundles /></Suspense></AdminRoute>} />
      <Route path="/admin/notifications" element={<AdminRoute><Suspense fallback={<AdminLayout><AdminLoadingFallback /></AdminLayout>}><AdminNotifications /></Suspense></AdminRoute>} />
      <Route path="/admin/activity-log" element={<AdminRoute><Suspense fallback={<AdminLayout><AdminLoadingFallback /></AdminLayout>}><AdminActivityLog /></Suspense></AdminRoute>} />
      <Route path="/admin/sales-boost" element={<AdminRoute><Suspense fallback={<AdminLayout><AdminLoadingFallback /></AdminLayout>}><AdminConversionOptimization /></Suspense></AdminRoute>} />
      <Route path="/admin/whatsapp-marketing" element={<AdminRoute><Suspense fallback={<AdminLayout><AdminLoadingFallback /></AdminLayout>}><AdminWhatsAppMarketing /></Suspense></AdminRoute>} />
      <Route path="/admin/returns" element={<AdminRoute><Suspense fallback={<AdminLayout><AdminLoadingFallback /></AdminLayout>}><AdminReturns /></Suspense></AdminRoute>} />
      <Route path="/admin/reports2" element={<AdminRoute><Suspense fallback={<AdminLayout><AdminLoadingFallback /></AdminLayout>}><AdminReports2 /></Suspense></AdminRoute>} />
      <Route path="*" element={<Suspense fallback={<div className="min-h-screen bg-background" />}><NotFound /></Suspense>} />
    </Routes>
  </>
);

function RouteScopedProviders({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const isAdminRoute = location.pathname.startsWith('/admin');

  if (isAdminRoute) {
    return <>{children}</>;
  }

  return <GlobalStoreProvider>{children}</GlobalStoreProvider>;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <ThemeProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <RouteScopedProviders>
              <AppRoutes />
            </RouteScopedProviders>
          </BrowserRouter>
        </TooltipProvider>
      </ThemeProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
