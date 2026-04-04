

## Plan: Eliminate Theme & Store Info Flash on Storefront Entry

### Problem

On first load (or cleared cache), the storefront briefly shows the **default theme** (blue/white) and a generic "Store" name before the RPC data arrives and applies the admin-configured theme/logo/name. This "flash of wrong content" (FOWC) is caused by:

1. **Theme**: `getCachedTheme()` returns `'default'` when `localStorage` has no cache yet
2. **Store info**: `storeInfo` is `null` until `get_homepage_data` RPC completes, so the Header shows "Store" as fallback text and no logo
3. **No loading gate**: The Header and StorefrontLayout render immediately with empty/default data while the RPC is still in-flight

### Strategy: Cache Everything + Show Breather Until Data Arrives

**Two-pronged approach:**

1. **Cache store identity in localStorage** alongside theme — so repeat visits are instant
2. **For first-ever visit (cold cache)**: keep the LoadingBreather visible until RPC data arrives, then render the storefront with correct theme/branding in one paint

### Changes

#### 1. Cache store info in localStorage (like theme)
**File**: `src/hooks/useGlobalStore.tsx`
- On RPC success, persist `storeInfo` (name, logo_url, favicon_url) and theme to localStorage
- On mount, read cached storeInfo as initial value so the Header renders correctly even before RPC completes
- Add a `hasCachedData` boolean that's true when localStorage has prior store data

#### 2. Gate storefront render on first data load
**File**: `src/components/storefront/StorefrontLayout.tsx`
- Check `isLoading` from global store AND whether we have cached data
- If `isLoading && !hasCachedData` (first-ever visit, no cache): show the `LoadingBreather` instead of the shell
- If we have cached data: render immediately with cached values (no flash), then silently update when RPC completes

#### 3. Sync theme to DOM before first paint on cached visits  
**File**: `src/hooks/useTheme.tsx`
- Already reads from localStorage on mount — no change needed here
- The `_setThemeFromRPC` callback already updates cache — good

#### 4. Header uses cached storeInfo seamlessly
**File**: `src/components/storefront/Header.tsx`
- No changes needed — it already reads `storeInfo` from global store. Once we seed the global store with cached values, it renders correctly from the start.

### Result

| Scenario | Before | After |
|----------|--------|-------|
| First visit (no cache) | Flash of default theme + "Store" text for 1-2s | LoadingBreather shown until RPC completes, then correct theme + branding in one paint |
| Repeat visit (cached) | Flash of default then correct | Instant correct theme + branding from localStorage, RPC updates silently |

### Files to modify (2 files)
1. `src/hooks/useGlobalStore.tsx` — add localStorage cache for storeInfo, expose `hasCachedData`
2. `src/components/storefront/StorefrontLayout.tsx` — show LoadingBreather when no cached data and RPC is loading

