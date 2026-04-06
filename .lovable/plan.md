

## Plan: Storefront Performance Optimization — Reduce Load Time to Under 3 Seconds

### Root Cause Analysis

The slow load comes from a **sequential waterfall of blocking operations**:

```text
1. main.tsx renders static HTML loader
2. React hydrates → App mounts
3. AuthProvider calls getSession() → waits ~300-500ms
4. If user exists: fetchUserData (profile + role) → another ~400ms
5. RouteScopedProviders mounts GlobalStoreProvider
6. GlobalStoreProvider fires get_homepage_data RPC → ~800-1500ms
7. Only THEN does the shimmer gate lift and content renders
```

Total sequential wait: **1.5-2.5s of network** on top of **1-2s JS parse/hydrate**. That's 3-4.5s minimum.

### Key Bottlenecks

1. **AuthProvider blocks the render chain**: `isLoading=true` until `getSession()` + profile/role fetch complete. For anonymous storefront visitors, this is wasted time.
2. **`get_homepage_data` RPC is heavy**: Joins products, images, categories, reviews, bundles, offers, banners, and 7 store_settings rows in one call. With 200+ products this can take 1-2s.
3. **No parallel execution**: Auth and store data load sequentially instead of concurrently.
4. **Home page sections are eagerly imported**: HomeBestsellers, HomeFeatured, HomeNewArrivals, HomeBundles are all in the initial bundle even though most are below the fold.

### Changes

#### 1. Make AuthProvider non-blocking for storefront routes
**File**: `src/hooks/useAuth.tsx`
- Remove the `isLoading` gate for anonymous visitors — set `isLoading=false` immediately after `getSession()` returns null (no session)
- This already happens, but the initial `isLoading=true` state blocks `AdminRoute` — storefront routes don't depend on it, so this is fine
- The real issue: `useCartQuery` subscribes even when there's no user due to component tree

**Actually, AuthProvider already sets isLoading=false when no session.** The bottleneck is the RPC.

#### 2. Optimize `get_homepage_data` RPC — split into critical + deferred
**Migration**: Split the RPC into two parts:
- `get_homepage_critical`: banners, categories, store_info, announcement, storefront_theme, storefront_display (lightweight — renders above the fold)
- Keep full `get_homepage_data` as a deferred background fetch for products, bundles, offers, reviews, etc.

**File**: `src/hooks/useGlobalStore.tsx`
- Fire critical query first (renders header + hero + categories immediately)
- Fire full data query in parallel but don't block render on it
- Merge results as they arrive

#### 3. Lazy-load below-fold home sections
**File**: `src/pages/store/Home.tsx`
- Lazy import `HomeBestsellers`, `HomeFeatured`, `HomeNewArrivals`, `HomeBundles`, `HomeMiddleBanners`
- Wrap each in `Suspense` with shimmer fallbacks
- This reduces initial JS parse time

#### 4. Cache full homepage data in localStorage
**File**: `src/hooks/useGlobalStore.tsx`
- On RPC success, cache the entire homepage response (not just storeInfo) in localStorage with a timestamp
- On mount, hydrate from cache immediately if cache is < 10 minutes old
- This makes repeat visits instant (0ms network wait)

#### 5. Remove the static HTML loader in main.tsx
**File**: `src/main.tsx`
- Remove the `rootElement.innerHTML = ...` static loader. It adds visual delay before React takes over.
- Let the shimmer gate in StorefrontLayout handle loading state instead.

### Technical Detail

**New RPC: `get_homepage_critical`**
```sql
CREATE FUNCTION get_homepage_critical() RETURNS jsonb AS $$
SELECT jsonb_build_object(
  'banners', (SELECT ...banners query...),
  'categories', (SELECT ...categories query...),
  'store_info', (SELECT value FROM store_settings WHERE key='store_info'),
  'announcement', (SELECT value FROM store_settings WHERE key='announcement'),
  'storefront_theme', (SELECT value FROM store_settings WHERE key='storefront_theme'),
  'storefront_display', (SELECT value FROM store_settings WHERE key='storefront_display')
);
$$
```
This query touches only banners, categories, and store_settings — should execute in ~50-100ms.

**GlobalStoreProvider dual-query approach:**
```tsx
const { data: critical } = useQuery({
  queryKey: ['store-critical'],
  queryFn: fetchCriticalData,
  staleTime: 10 * 60 * 1000,
});

const { data: full } = useQuery({
  queryKey: ['store-full'],
  queryFn: fetchFullData,
  staleTime: 10 * 60 * 1000,
  enabled: !!critical, // fire after critical arrives (or in parallel)
});
```

**Full localStorage cache:**
```tsx
const FULL_CACHE_KEY = 'cached_homepage_full';
// On mount: read cache → hydrate immediately → background refresh
// On RPC success: write to cache
```

### Expected Result

| Scenario | Before | After |
|----------|--------|-------|
| First visit | 7-10s (sequential waterfall) | ~2-3s (critical RPC ~100ms + parallel full load) |
| Repeat visit | 3-5s (RPC wait) | <1s (full localStorage cache, background refresh) |
| Below-fold content | Blocks initial render | Lazy-loaded, doesn't affect FCP |

### Files to modify (4 files + 1 migration)

1. **Migration**: Create `get_homepage_critical` RPC function
2. `src/hooks/useGlobalStore.tsx` — dual-query architecture + full localStorage cache
3. `src/pages/store/Home.tsx` — lazy-load below-fold sections
4. `src/main.tsx` — remove static HTML loader (let shimmer handle it)
5. `src/components/storefront/StorefrontLayout.tsx` — update shimmer gate to use critical data loading state

