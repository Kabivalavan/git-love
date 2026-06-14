## Plan: Finish Pending Items + Admin/Storefront Code Separation

### Part A — Finish previously pending follow-ups

**A1. Email triggers for new lifecycle events**
- Extend `supabase/functions/email-triggers/index.ts` with two new event types:
  - `order_cancelled` — branded template with order #, items, refund note.
  - `refund_completed` — branded template with refund amount, method, expected ETA.
- Wire automatic invocation:
  - `cancel-pending-order` edge function → fire `order_cancelled` after status flip.
  - Admin Returns "Mark Refunded" path (refunds insert) → fire `refund_completed`.
- Gate both with `store_settings.email_automation.{order_cancelled,refund_completed}` flags (default true).

**A2. Before/After diff capture across admin mutations**
Wire `useActivityLog({ before, after })` into the remaining admin pages so the diff renders in the Activity Log detail modal:
- `Products.tsx` (update + variant changes)
- `Categories.tsx`, `Banners.tsx`, `Bundles.tsx`
- `Coupons.tsx`, `Offers.tsx`
- `Settings.tsx` (per settings key)
- `Customers.tsx` (block/unblock + profile edit)
- `Returns.tsx` and `Deliveries.tsx` status transitions
- `Expenses.tsx` edits

Pattern: snapshot the row before `.update()`, snapshot the response after, pass both into `log()`.

---

### Part B — Admin / Storefront separation (architecture)

**B1. Route-level code split (compile-time isolation)**
- Group every admin lazy import into a single dynamic boundary so Vite/Rollup emits two distinct chunk graphs:
  - `chunk-admin-*` (admin pages + admin-only components/hooks)
  - `chunk-store-*` (storefront pages + storefront-only components/hooks)
- Add `manualChunks` in `vite.config.ts`:
  - `admin` → anything under `src/pages/admin`, `src/components/admin`, `src/hooks/useAdmin*`, `src/api/admin*`, `src/api/reports2*`, `src/pages/admin/Reports2`
  - `storefront` → `src/pages/store`, `src/components/storefront`, `src/components/home`, `src/components/product`, `src/hooks/useCartQuery`, `useGlobalStore`, `useConversionOptimization`, `useOffers`, `useProductQuery`
  - `vendor-react`, `vendor-ui` (radix + lucide), `vendor-charts` (recharts), `vendor-supabase`
- Net effect: a customer visiting `/` never downloads any admin code; an admin opening `/admin` doesn't download storefront-only widgets.

**B2. Provider scoping**
- `GlobalStoreProvider` and storefront-only providers (analytics, conversion optimization) already exist — confirm they wrap only storefront routes via an `<Outlet>`-based `StorefrontShell`, never admin.
- Introduce an `AdminShell` that wraps admin routes once with `AdminLayout` + admin-only providers (sidebar state, notifications channel, theme override), removing per-page `AdminLayout` mounts.
- Result: switching admin↔store no longer re-instantiates the wrong provider tree.

**B3. Folder/module boundaries**
Reorganize into clear domains (move-only, no logic changes) to enforce who-imports-what:
```text
src/
  app/                 # App.tsx, router, shells
    StorefrontShell.tsx
    AdminShell.tsx
  modules/
    storefront/
      pages/   (was pages/store)
      components/ (was components/storefront, home, product)
      hooks/   (cart, global store, offers, conversion)
      api/
    admin/
      pages/   (was pages/admin)
      components/ (was components/admin)
      hooks/   (useAdminQueries, useAdminNotifications, useActivityLog)
      api/     (admin.ts, reports2.ts)
  shared/              # ui/, lib/, integrations/, types/, hooks shared by both (useAuth, useTheme, useAnalytics)
```
Add an ESLint `no-restricted-imports` rule:
- `modules/storefront/**` cannot import from `modules/admin/**`
- `modules/admin/**` cannot import from `modules/storefront/**`
This makes accidental cross-pollution a build-time error.

**B4. Separate React Query clients (optional but high-impact)**
- One `storeQueryClient` (long staleTime, aggressive cache, no window-focus refetch — current default).
- One `adminQueryClient` (shorter staleTime, refetchOnWindowFocus true, realtime invalidation friendly).
- Mounted inside the respective Shell so admin invalidations never trigger storefront refetches and vice versa.

**B5. Asset & vendor optimizations (carry-over from perf rules)**
- Preconnect to Supabase + image CDN in `index.html`.
- Defer admin sidebar icons (lucide) to admin chunk via the manualChunks rule (already covered by B1).
- Confirm storefront pages don't transitively import `recharts` (admin Reports2/Analytics only).

---

### Files to touch
- `supabase/functions/email-triggers/index.ts` (+ template helpers)
- `supabase/functions/cancel-pending-order/index.ts` (invoke trigger)
- `src/pages/admin/Returns.tsx` (invoke refund trigger)
- Admin mutation pages listed in A2 (small inline diff captures)
- `vite.config.ts` (manualChunks + alias updates)
- `src/App.tsx` → split into `src/app/StorefrontShell.tsx` + `src/app/AdminShell.tsx`
- Move (git-mv equivalent) page/component folders into `src/modules/{storefront,admin}` and `src/shared`
- `eslint.config.js` — add `no-restricted-imports` boundary rule
- `index.html` — preconnect hints

### Execution order (to keep preview green)
1. Email triggers (A1) — isolated, no refactor risk.
2. Diff capture wiring (A2) — page-by-page, additive.
3. `vite.config.ts` `manualChunks` + preconnect (B1, B5) — zero file moves, immediate bundle win.
4. Shells + scoped query clients (B2, B4).
5. Folder reorg (B3) with path alias `@/modules/*`, `@/shared/*`; update imports via codemod; add ESLint boundary rule last.

### Out of scope
- Splitting into two separate Vite apps / subdomains (would break SPA routing and shared auth session).
- Server-side rendering.
- Rewriting any business logic during the move.

### Risk / rollback
- Folder reorg (step 5) is the only high-churn change. It is purely move + import-rewrite; can be reverted with a single revert. Steps 1–4 are independently shippable.
