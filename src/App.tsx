import { lazy, Suspense } from 'react';
import { Toaster } from '@/components/ui/toaster';
import { Toaster as Sonner } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/hooks/useAuth';
import { ThemeProvider } from '@/hooks/useTheme';
import { GlobalStoreProvider } from '@/hooks/useGlobalStore';
import { ScrollToTop } from '@/components/ScrollToTop';

import HomePage from './pages/store/Home';

const NotFound = lazy(() => import('./pages/NotFound'));
const CustomerAuth = lazy(() => import('./pages/auth/CustomerAuth'));
const AdminAuth = lazy(() => import('./pages/auth/AdminAuth'));

const AdminDashboard = lazy(() => import('./pages/admin/Dashboard'));
const AdminProducts = lazy(() => import('./pages/admin/Products'));
const AdminCategories = lazy(() => import('./pages/admin/Categories'));
const AdminOrders = lazy(() => import('./pages/admin/Orders'));
const AdminBanners = lazy(() => import('./pages/admin/Banners'));
const AdminOffersAndCoupons = lazy(() => import('./pages/admin/OffersAndCoupons'));
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

function RouteLoadingFallback() {
  return <div className="min-h-screen bg-background flex items-center justify-center text-muted-foreground">Loading...</div>;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, isAdmin, isLoading } = useAuth();
  if (isLoading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  if (!user) return <Navigate to="/admin/login" replace />;
  if (!isAdmin) return <Navigate to="/" replace />;
  return <>{children}</>;
}

const AppRoutes = () => (
  <>
    <ScrollToTop />
    <Suspense fallback={<RouteLoadingFallback />}>
      <Routes>
        {/* Public Storefront */}
        <Route path="/" element={<HomePage />} />
        <Route path="/products" element={<ProductsPage />} />
        <Route path="/product/:slug" element={<ProductDetailPage />} />
        <Route path="/cart" element={<CartPage />} />
        <Route path="/checkout" element={<CheckoutPage />} />
        <Route path="/order-success" element={<OrderSuccessPage />} />
        <Route path="/auth" element={<CustomerAuth />} />
        <Route path="/shipping-policy" element={<ShippingPolicyPage />} />
        <Route path="/return-policy" element={<ReturnPolicyPage />} />
        <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
        <Route path="/terms" element={<TermsConditionsPage />} />
        <Route path="/contact" element={<ContactUsPage />} />
        <Route path="/faq" element={<FAQPage />} />
        <Route path="/wishlist" element={<WishlistPage />} />
        <Route path="/bundles/:slug" element={<BundleDetailPage />} />

        {/* User Account */}
        <Route path="/account" element={<AccountPage />}>
          <Route index element={<MyOrdersPage />} />
          <Route path="order/:orderId" element={<OrderTrackingPage />} />
          <Route path="addresses" element={<SavedAddressesPage />} />
          <Route path="profile" element={<ProfileSettingsPage />} />
        </Route>

        {/* Admin */}
        <Route path="/admin/login" element={<AdminAuth />} />
        <Route path="/admin" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
        <Route path="/admin/banners" element={<AdminRoute><AdminBanners /></AdminRoute>} />
        <Route path="/admin/products" element={<AdminRoute><AdminProducts /></AdminRoute>} />
        <Route path="/admin/categories" element={<AdminRoute><AdminCategories /></AdminRoute>} />
        <Route path="/admin/offers" element={<AdminRoute><AdminOffersAndCoupons /></AdminRoute>} />
        <Route path="/admin/orders" element={<AdminRoute><AdminOrders /></AdminRoute>} />
        <Route path="/admin/deliveries" element={<AdminRoute><AdminDeliveries /></AdminRoute>} />
        <Route path="/admin/payments" element={<AdminRoute><AdminPayments /></AdminRoute>} />
        <Route path="/admin/expenses" element={<AdminRoute><AdminExpenses /></AdminRoute>} />
        <Route path="/admin/customers" element={<AdminRoute><AdminCustomers /></AdminRoute>} />
        <Route path="/admin/reports" element={<AdminRoute><AdminReports /></AdminRoute>} />
        <Route path="/admin/settings" element={<AdminRoute><AdminSettings /></AdminRoute>} />
        <Route path="/admin/analytics" element={<AdminRoute><AdminAnalytics /></AdminRoute>} />
        <Route path="/admin/bundles" element={<AdminRoute><AdminBundles /></AdminRoute>} />
        <Route path="/admin/notifications" element={<AdminRoute><AdminNotifications /></AdminRoute>} />
        <Route path="/admin/activity-log" element={<AdminRoute><AdminActivityLog /></AdminRoute>} />
        <Route path="/admin/sales-boost" element={<AdminRoute><AdminConversionOptimization /></AdminRoute>} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  </>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <ThemeProvider>
        <GlobalStoreProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <AppRoutes />
            </BrowserRouter>
          </TooltipProvider>
        </GlobalStoreProvider>
      </ThemeProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
