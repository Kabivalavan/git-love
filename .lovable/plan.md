

## Plan: Admin Performance Optimization — Eliminate Redundant DB Requests

### Problem
Despite having a centralized query layer (`useAdminQueries.tsx` + `src/api/admin.ts`), several admin pages still make **direct `supabase.from()` calls**, bypassing the cache entirely. Additionally, some pages that do use the hooks also have leftover direct calls. This results in 200+ requests when navigating all admin pages.

### Root Causes Identified

1. **Pages still using direct Supabase calls (not migrated):**
   - `Orders.tsx` — fetches orders, store_settings, order details, profiles all directly
   - `Returns.tsx` — fetches returns, orders, profiles, return_items, refunds directly  
   - `Analytics.tsx` — fetches analytics_events, orders, profiles, sessions directly
   - `OffersAndCoupons.tsx` — fetches offers, categories, products directly (legacy duplicate of Offers/Coupons pages)
   - `ConversionOptimization.tsx` — fetches/saves store_settings directly
   - `WhatsAppMarketing.tsx` — fetches store_settings directly
   - `Settings.tsx` — line 1731 still has a direct `supabase.from('store_settings')` call for WhatsApp

2. **Duplicate data fetching across pages:**
   - `store_settings` is fetched independently by Orders, Settings (WhatsApp), ConversionOptimization, WhatsApp — should all share one cached query
   - Categories/Products are fetched independently by OffersAndCoupons — already cached in `useAdminCategories`/`useAdminProducts`

3. **AdminLayout polls every 200ms** (`setInterval(checkSidebar, 200)`) — wasteful DOM polling

### Implementation Plan

#### Step 1: Migrate Orders.tsx to centralized hooks
- Replace `fetchStoreInfo()` direct call with `useStoreSettingValue('store_info', null)` from existing hook
- Move `fetchOrdersFn` into `src/api/admin.ts` (already has `fetchOrders` and `fetchOrderDetails`)
- Use `usePaginatedFetch` backed by the centralized API function

#### Step 2: Migrate Returns.tsx to centralized hooks  
- Create `fetchAdminReturns()` in `src/api/admin.ts`
- Create `useAdminReturns()` hook in `useAdminQueries.tsx`
- Replace all direct Supabase calls with the hook

#### Step 3: Migrate Analytics.tsx to centralized hooks
- Create `fetchAnalyticsData()` in `src/api/admin.ts`
- Create `useAdminAnalytics(dateRange)` hook with proper caching
- Replace direct multi-query fetch

#### Step 4: Migrate ConversionOptimization.tsx
- Replace direct `store_settings` fetch/save with `useAdminStoreSettings()` + `useSaveStoreSetting()`

#### Step 5: Migrate WhatsAppMarketing.tsx
- Replace direct `store_settings` fetch/save with centralized hooks

#### Step 6: Remove or redirect OffersAndCoupons.tsx
- This page duplicates Offers.tsx and Coupons.tsx but with direct Supabase calls — replace its content with the already-migrated pages or migrate it to use hooks

#### Step 7: Fix Settings.tsx residual direct call
- Remove the direct `supabase.from('store_settings')` WhatsApp fetch on line 1731 — already covered by `useAdminStoreSettings()`

#### Step 8: Fix AdminLayout polling
- Replace the 200ms `setInterval` sidebar check with a proper event listener or CSS-based approach

#### Step 9: Deduplicate storefront store_settings calls
- Footer.tsx fetches `social_links` separately — should use `useGlobalStore` which already has this data from `get_homepage_data`

### Expected Result
- **Before**: ~200+ requests visiting all admin pages  
- **After**: ~30-50 requests (cached, deduplicated, shared across pages)
- Faster page transitions since cached data is instant

### Technical Details
- All new API functions go in `src/api/admin.ts`
- All new hooks go in `src/hooks/useAdminQueries.tsx` with proper `staleTime`/`gcTime`
- Realtime invalidation already handled by `useAdminRealtimeInvalidation`
- Pages that need paginated data (Orders, Deliveries, Payments) keep `usePaginatedFetch` but backed by centralized API functions

