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
import { Shimmer, ShimmerProductGrid, ShimmerTable } from '@/components/ui/shimmer';

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

// Storefront loading fallback - shimmer skeleton
function StorefrontLoadingFallback() {
  return (
    <div className="container mx-auto px-4 py-8">
      <ShimmerProductGrid items={4} />
    </div>
  );
}

// Admin loading fallback - shimmer skeleton
function AdminLoadingFallback() {
  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Shimmer className="h-8 w-48" />
          <Shimmer className="h-8 w-24" />
        </div>
        <ShimmerTable rows={8} columns={5} />
      </div>
    </AdminLayout>
  );
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, isAdmin, isLoading } = useAuth();
  if (isLoading) return <AdminLoadingFallback />;
  if (!user) return <Navigate to="/admin/login" replace />;
  if (!isAdmin) return <Navigate to="/" replace />;
  return <>{children}</>;
}

const AppRoutes = () => (
  <>
    <ScrollToTop />
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
      <Route path="/admin/login" element={<Suspense fallback={<AdminLoadingFallback />}><AdminAuth /></Suspense>} />
      <Route path="/admin" element={<AdminRoute><Suspense fallback={<AdminLoadingFallback />}><AdminDashboard /></Suspense></AdminRoute>} />
      <Route path="/admin/banners" element={<AdminRoute><Suspense fallback={<AdminLoadingFallback />}><AdminBanners /></Suspense></AdminRoute>} />
      <Route path="/admin/products" element={<AdminRoute><Suspense fallback={<AdminLoadingFallback />}><AdminProducts /></Suspense></AdminRoute>} />
      <Route path="/admin/categories" element={<AdminRoute><Suspense fallback={<AdminLoadingFallback />}><AdminCategories /></Suspense></AdminRoute>} />
      <Route path="/admin/offers" element={<AdminRoute><Suspense fallback={<AdminLoadingFallback />}><AdminOffers /></Suspense></AdminRoute>} />
      <Route path="/admin/coupons" element={<AdminRoute><Suspense fallback={<AdminLoadingFallback />}><AdminCoupons /></Suspense></AdminRoute>} />
      <Route path="/admin/orders" element={<AdminRoute><Suspense fallback={<AdminLoadingFallback />}><AdminOrders /></Suspense></AdminRoute>} />
      <Route path="/admin/deliveries" element={<AdminRoute><Suspense fallback={<AdminLoadingFallback />}><AdminDeliveries /></Suspense></AdminRoute>} />
      <Route path="/admin/payments" element={<AdminRoute><Suspense fallback={<AdminLoadingFallback />}><AdminPayments /></Suspense></AdminRoute>} />
      <Route path="/admin/expenses" element={<AdminRoute><Suspense fallback={<AdminLoadingFallback />}><AdminExpenses /></Suspense></AdminRoute>} />
      <Route path="/admin/customers" element={<AdminRoute><Suspense fallback={<AdminLoadingFallback />}><AdminCustomers /></Suspense></AdminRoute>} />
      <Route path="/admin/reports" element={<AdminRoute><Suspense fallback={<AdminLoadingFallback />}><AdminReports /></Suspense></AdminRoute>} />
      <Route path="/admin/settings" element={<AdminRoute><Suspense fallback={<AdminLoadingFallback />}><AdminSettings /></Suspense></AdminRoute>} />
      <Route path="/admin/analytics" element={<AdminRoute><Suspense fallback={<AdminLoadingFallback />}><AdminAnalytics /></Suspense></AdminRoute>} />
      <Route path="/admin/bundles" element={<AdminRoute><Suspense fallback={<AdminLoadingFallback />}><AdminBundles /></Suspense></AdminRoute>} />
      <Route path="/admin/notifications" element={<AdminRoute><Suspense fallback={<AdminLoadingFallback />}><AdminNotifications /></Suspense></AdminRoute>} />
      <Route path="/admin/activity-log" element={<AdminRoute><Suspense fallback={<AdminLoadingFallback />}><AdminActivityLog /></Suspense></AdminRoute>} />
      <Route path="/admin/sales-boost" element={<AdminRoute><Suspense fallback={<AdminLoadingFallback />}><AdminConversionOptimization /></Suspense></AdminRoute>} />
      <Route path="/admin/whatsapp-marketing" element={<AdminRoute><Suspense fallback={<AdminLoadingFallback />}><AdminWhatsAppMarketing /></Suspense></AdminRoute>} />
      <Route path="/admin/returns" element={<AdminRoute><Suspense fallback={<AdminLoadingFallback />}><AdminReturns /></Suspense></AdminRoute>} />
      <Route path="/admin/reports2" element={<AdminRoute><Suspense fallback={<AdminLoadingFallback />}><AdminReports2 /></Suspense></AdminRoute>} />
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
