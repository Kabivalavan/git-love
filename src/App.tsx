import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { ThemeProvider } from "@/hooks/useTheme";
import { ScrollToTop } from "@/components/ScrollToTop";
import NotFound from "./pages/NotFound";
import CustomerAuth from "./pages/auth/CustomerAuth";
import AdminAuth from "./pages/auth/AdminAuth";
import AdminDashboard from "./pages/admin/Dashboard";
import AdminProducts from "./pages/admin/Products";
import AdminCategories from "./pages/admin/Categories";
import AdminOrders from "./pages/admin/Orders";
import AdminBanners from "./pages/admin/Banners";
import AdminOffersAndCoupons from "./pages/admin/OffersAndCoupons";
import AdminDeliveries from "./pages/admin/Deliveries";
import AdminPayments from "./pages/admin/Payments";
import AdminExpenses from "./pages/admin/Expenses";
import AdminCustomers from "./pages/admin/Customers";
import AdminReports from "./pages/admin/Reports";
import AdminSettings from "./pages/admin/Settings";
import AdminAnalytics from "./pages/admin/Analytics";
import AdminBundles from "./pages/admin/Bundles";

// Public storefront pages
import HomePage from "./pages/store/Home";
import ProductsPage from "./pages/store/Products";
import ProductDetailPage from "./pages/store/ProductDetail";
import CartPage from "./pages/store/Cart";
import CheckoutPage from "./pages/store/Checkout";
import OrderSuccessPage from "./pages/store/OrderSuccess";
import AccountPage from "./pages/store/Account";
import MyOrdersPage from "./pages/store/MyOrders";
import OrderTrackingPage from "./pages/store/OrderTracking";
import SavedAddressesPage from "./pages/store/SavedAddresses";
import ProfileSettingsPage from "./pages/store/ProfileSettings";
import ShippingPolicyPage from "./pages/store/ShippingPolicy";
import ReturnPolicyPage from "./pages/store/ReturnPolicy";
import PrivacyPolicyPage from "./pages/store/PrivacyPolicy";
import TermsConditionsPage from "./pages/store/TermsConditions";
import ContactUsPage from "./pages/store/ContactUs";
import FAQPage from "./pages/store/FAQ";
import WishlistPage from "./pages/store/Wishlist";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 2 * 60 * 1000,
      gcTime: 5 * 60 * 1000,
    },
  },
});

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
      <Route path="*" element={<NotFound />} />
    </Routes>
  </>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <ThemeProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <AppRoutes />
          </BrowserRouter>
        </TooltipProvider>
      </ThemeProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
