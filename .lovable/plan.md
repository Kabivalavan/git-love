

## Plan: Storefront Sub-3s Load — Eliminate Render-Blocking Waterfall

### Root Cause Analysis

The 7-10s load time comes from a **sequential waterfall of blocking fetches**:

```text
JS Bundle (1-2s)
  → ThemeProvider fetches theme (BLOCKS ALL RENDERING — returns null)     ~400ms
    → AuthProvider getSession() + profile + role (sequential chain)       ~800ms
      → GlobalStoreProvider calls get_homepage_data RPC                   ~600ms
      → StorefrontLayout fires 4 more individual queries:
          - ai_assistant config
          - conversion_optimization config  
          - cart (2 requests: cart → cart_items)
          - social_links (footer)
Total waterfall: ~3-4s of network time stacked sequentially
```

Additionally, `ai_assistant` setting is fetched **twice** (once in StorefrontLayout, once in AIAssistantWidget).

### Strategy: Parallel-First, Zero-Blocking Architecture

**Principle**: Nothing blocks rendering. All data loads in parallel. The user sees the shell + shimmers instantly.

### Changes

#### 1. Remove ThemeProvider render-blocking (biggest win)
**File**: `src/hooks/useTheme.tsx`
- Remove the `if (isLoading) return null;` line that blocks the entire app tree
- Instead, read cached theme from `localStorage` synchronously on mount as the initial value
- Apply theme attribute immediately from cache, then update silently when fetch completes
- This alone saves ~400-800ms of blank screen

#### 2. Consolidate storefront settings into `get_homepage_data` RPC
**Database**: Update `get_homepage_data` function to also return:
- `ai_assistant` config
- `conversion_optimization` config  
- `storefront_theme` config

This eliminates 3 separate `store_settings` queries. The RPC already fetches `store_info`, `announcement`, `storefront_display` from `store_settings` — just add 3 more keys in the same function.

**Files affected**:
- `src/hooks/useGlobalStore.tsx` — expose `aiConfig`, `conversionSettings`, `themeConfig` from RPC response
- `src/hooks/useTheme.tsx` — consume theme from global store instead of separate fetch
- `src/components/storefront/StorefrontLayout.tsx` — use `aiConfig` from global store, remove separate `useQuery` for ai_assistant
- `src/components/storefront/AIAssistantWidget.tsx` — use `aiConfig` from global store, remove duplicate query
- `src/hooks/useConversionOptimization.tsx` — use global store, remove separate query
- `src/components/storefront/ExitIntentPopup.tsx` — consume from global store
- `src/components/storefront/Footer.tsx` — move `social_links` into the RPC too

#### 3. Don't block on auth for anonymous visitors
**File**: `src/hooks/useAuth.tsx`
- The `getSession()` call is fine, but ensure it doesn't block the GlobalStoreProvider from mounting
- Currently it doesn't technically block GlobalStoreProvider, but the **ThemeProvider does** (step 1 fixes this)

#### 4. Defer cart fetch for logged-out users
**File**: `src/hooks/useCartQuery.tsx`
- Already gated on `!!user` — this is fine, no change needed

#### 5. Eager HomePage import (already done)
- `HomePage` is already non-lazy in App.tsx — good, no change needed

### Request Count: Before vs After

| Before | After |
|--------|-------|
| `storefront_theme` setting | Eliminated (in RPC) |
| `get_homepage_data` RPC | `get_homepage_data` RPC (expanded) |
| `ai_assistant` setting (x2!) | Eliminated (in RPC) |
| `conversion_optimization` setting | Eliminated (in RPC) |
| `social_links` setting | Eliminated (in RPC) |
| `profiles` query | Kept (auth-dependent) |
| `user_roles` query | Kept (auth-dependent) |
| `cart` + `cart_items` (2 req) | Kept (auth-dependent) |
| **~9 requests** | **~4 requests** (1 RPC + auth chain) |

### Loading Timeline: After

```text
JS Bundle (1-2s)
  → Instant shell render (cached theme, no blocking)
  → Parallel:
      ├── getSession() + profile/role (auth)        ~600ms
      ├── get_homepage_data RPC (all data)           ~500ms  
      └── cart (only if logged in)                   ~300ms
  → Content visible: ~2-2.5s total
```

### Technical Details

**Database migration**: Update `get_homepage_data` to add:
```sql
'ai_assistant', (SELECT s.value FROM store_settings s WHERE s.key = 'ai_assistant'),
'conversion_optimization', (SELECT s.value FROM store_settings s WHERE s.key = 'conversion_optimization'),
'storefront_theme', (SELECT s.value FROM store_settings s WHERE s.key = 'storefront_theme'),
'social_links', (SELECT s.value FROM store_settings s WHERE s.key = 'social_links')
```

**ThemeProvider cache**: On mount, read `localStorage.getItem('storefront_theme_cache')` synchronously. After RPC data arrives, update cache. No render blocking.

**Files to modify** (7 files + 1 migration):
1. `get_homepage_data` RPC — add 4 settings keys
2. `src/hooks/useTheme.tsx` — remove blocking, use localStorage cache
3. `src/hooks/useGlobalStore.tsx` — expose new settings from RPC
4. `src/components/storefront/StorefrontLayout.tsx` — remove ai_assistant query
5. `src/components/storefront/AIAssistantWidget.tsx` — use global store
6. `src/hooks/useConversionOptimization.tsx` — use global store for storefront
7. `src/components/storefront/Footer.tsx` — use global store for social_links

