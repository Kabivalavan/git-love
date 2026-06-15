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
import { StorefrontLayout } from '@/modules/storefront/components/storefront/StorefrontLayout';
import { AdminLayout } from '@/modules/admin/components/AdminLayout';
import { Shimmer, ShimmerProductGrid, ShimmerTable } from '@/components/ui/shimmer';

import HomePage from './modules/storefront/pages/Home';

const NotFound = lazy(() => import('./pages/NotFound'));
const CustomerAuth = lazy(() => import('./pages/auth/CustomerAuth'));
const AdminAuth = lazy(() => import('./pages/auth/AdminAuth'));

const AdminDashboard = lazy(() => import('./modules/admin/pages/Dashboard'));
const AdminProducts = lazy(() => import('./modules/admin/pages/Products'));
const AdminCategories = lazy(() => import('./modules/admin/pages/Categories'));
const AdminOrders = lazy(() => import('./modules/admin/pages/Orders'));
const AdminBanners = lazy(() => import('./modules/admin/pages/Banners'));
const AdminOffers = lazy(() => import('./modules/admin/pages/Offers'));
const AdminCoupons = lazy(() => import('./modules/admin/pages/Coupons'));
const AdminDeliveries = lazy(() => import('./modules/admin/pages/Deliveries'));
const AdminPayments = lazy(() => import('./modules/admin/pages/Payments'));
const AdminExpenses = lazy(() => import('./modules/admin/pages/Expenses'));
const AdminCustomers = lazy(() => import('./modules/admin/pages/Customers'));
const AdminReports = lazy(() => import('./modules/admin/pages/Reports'));
const AdminSettings = lazy(() => import('./modules/admin/pages/Settings'));
const AdminAnalytics = lazy(() => import('./modules/admin/pages/Analytics'));
const AdminBundles = lazy(() => import('./modules/admin/pages/Bundles'));
const AdminNotifications = lazy(() => import('./modules/admin/pages/Notifications'));
const AdminActivityLog = lazy(() => import('./modules/admin/pages/ActivityLog'));
const AdminConversionOptimization = lazy(() => import('./modules/admin/pages/ConversionOptimization'));
const AdminWhatsAppMarketing = lazy(() => import('./modules/admin/pages/WhatsAppMarketing'));
const AdminReturns = lazy(() => import('./modules/admin/pages/Returns'));
const AdminReports2 = lazy(() => import('./modules/admin/pages/Reports2'));

const ProductsPage = lazy(() => import('./modules/storefront/pages/Products'));
const ProductDetailPage = lazy(() => import('./modules/storefront/pages/ProductDetail'));
const CartPage = lazy(() => import('./modules/storefront/pages/Cart'));
const CheckoutPage = lazy(() => import('./modules/storefront/pages/Checkout'));
const OrderSuccessPage = lazy(() => import('./modules/storefront/pages/OrderSuccess'));
const AccountPage = lazy(() => import('./modules/storefront/pages/Account'));
const MyOrdersPage = lazy(() => import('./modules/storefront/pages/MyOrders'));
const OrderTrackingPage = lazy(() => import('./modules/storefront/pages/OrderTracking'));
const SavedAddressesPage = lazy(() => import('./modules/storefront/pages/SavedAddresses'));
const ProfileSettingsPage = lazy(() => import('./modules/storefront/pages/ProfileSettings'));
const ShippingPolicyPage = lazy(() => import('./modules/storefront/pages/ShippingPolicy'));
const ReturnPolicyPage = lazy(() => import('./modules/storefront/pages/ReturnPolicy'));
const PrivacyPolicyPage = lazy(() => import('./modules/storefront/pages/PrivacyPolicy'));
const TermsConditionsPage = lazy(() => import('./modules/storefront/pages/TermsConditions'));
const ContactUsPage = lazy(() => import('./modules/storefront/pages/ContactUs'));
const FAQPage = lazy(() => import('./modules/storefront/pages/FAQ'));
const WishlistPage = lazy(() => import('./modules/storefront/pages/Wishlist'));
const BundleDetailPage = lazy(() => import('./modules/storefront/pages/BundleDetail'));
const CategoriesPage = lazy(() => import('./modules/storefront/pages/Categories'));
const AllBundlesPage = lazy(() => import('./modules/storefront/pages/AllBundles'));
const ReturnRequestPage = lazy(() => import('./modules/storefront/pages/ReturnRequest'));
const MyReturnsPage = lazy(() => import('./modules/storefront/pages/MyReturns'));

// Storefront client: long staleTime, aggressive cache, no focus refetch
const storeQueryClient = new QueryClient({
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
    mutations: { retry: 1 },
  },
});

// Admin client: shorter staleTime, focus refetch on (realtime-friendly)
const adminQueryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000,
      gcTime: 5 * 60 * 1000,
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
      retry: 1,
      structuralSharing: true,
    },
    mutations: { retry: 1 },
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
    return (
      <QueryClientProvider client={adminQueryClient}>
        {children}
      </QueryClientProvider>
    );
  }

  return (
    <QueryClientProvider client={storeQueryClient}>
      <GlobalStoreProvider>{children}</GlobalStoreProvider>
    </QueryClientProvider>
  );
}

const App = () => (
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
);

export default App;
