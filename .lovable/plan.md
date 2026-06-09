## Plan: Multi-Module Bug Fixes & Improvements

### 1. BUGS — Razorpay Payment Cancellation

**Problem:** When user cancels at Razorpay checkout, order stays as `status='new'` + `payment_status='pending'` instead of being marked cancelled.

**Fix:**
- In `Checkout.tsx`, on Razorpay `ondismiss` / `onFailure` for online payments, update the just-created order: `status='cancelled'`, `payment_status='failed'` (or `cancelled`), release stock holds, log activity.
- In `MyOrders.tsx` / order cards: add a light red background tint (`bg-red-50 dark:bg-red-950/20`) for cancelled orders.
- Same treatment on admin Orders list cancelled rows.

---

### 2. MARKETING — Bulk WhatsApp & Email

**Bulk WhatsApp (replace deep-link approach):**
- New edge function `whatsapp-bulk-send` using Meta Cloud API (uses connected token + phone_number_id from `store_settings.whatsapp`).
- Supports text + media (image/document) — uploads local media to `store` bucket first, then sends via API URL.
- Refactor `BulkWhatsApp.tsx`: remove `window.open`, add file upload (image/video/document), call edge function, show real per-recipient send results from API.

**Bulk Email:**
- Add local media file upload (attach images inline / as attachment URL) to `BulkEmail.tsx` and route via existing `send-smtp-email` function with attachment support.

**Email Templates:**
- Audit all 9 lifecycle email triggers (order_confirmation, shipped, delivered, returned, refunded, signup_welcome, password_reset, abandoned_cart, review_request) in `email-triggers` edge function.
- Ensure toggle flags in `store_settings.email_automation` properly gate each trigger; add missing trigger wiring if found.

---

### 3. EXPENSES

**KPI accuracy (backend aggregation):**
- New RPC `get_expenses_summary(p_from, p_to)` returning: total_count, total_amount, this_month_amount, top_categories. Replaces frontend computation that breaks with paginated scroll.
- `Expenses.tsx`: call RPC for KPI cards independently of paginated list.

**Detail modal UI/UX:**
- Redesign `Expenses.tsx` detail modal with sectioned layout (Header w/ amount + category, Meta grid, Description, Receipt viewer in cleaner card, action footer).

---

### 4. ACTIVITY LOG

**Architecture (no refetch on revisit):**
- Migrate `ActivityLog.tsx` to React Query (`useQuery` with `staleTime: 5min`) so navigating away and back uses cached data.
- Add infinite query with proper `getNextPageParam` — fix scroll crash (current crash likely from unbounded state / dup keys → use `dedupeById` and `keepPreviousData`).

**KPI backend aggregation:**
- New RPC `get_activity_log_summary(p_from, p_to, p_module, p_action)` returning total count + breakdown by action + by module.

**Richer audit capture (from → to diffs):**
- Extend `useActivityLog` to accept `before` and `after` snapshots; store as JSON in `details.changes`.
- Update all admin mutation sites (Products, Categories, Orders status, Coupons, Offers, Banners, Bundles, Customers block/unblock, Settings, Returns, Deliveries, Expenses) to capture before/after.
- In `ActivityLog.tsx` detail panel: render a clean diff table — Field | Old → New.

**Display:**
- Add module filter, action filter, search by entity ID, date range — all server-side via RPC.

---

### Files to modify

**Bugs (Razorpay):**
- `src/pages/store/Checkout.tsx`
- `src/pages/store/MyOrders.tsx`
- `src/pages/admin/Orders.tsx`

**Marketing:**
- new: `supabase/functions/whatsapp-bulk-send/index.ts`
- `src/components/admin/BulkWhatsApp.tsx`
- `src/components/admin/BulkEmail.tsx`
- `supabase/functions/email-triggers/index.ts`

**Expenses:**
- new migration: `get_expenses_summary` RPC
- `src/pages/admin/Expenses.tsx`

**Activity Log:**
- new migration: `get_activity_log_summary` RPC + index on `activity_logs(created_at desc)`
- `src/hooks/useActivityLog.tsx` (add diff capture)
- `src/pages/admin/ActivityLog.tsx` (React Query + infinite + diff UI)
- Mutation call sites listed above to pass before/after snapshots (incremental — start with Products, Orders, Coupons, Offers, Settings; extend others as quick follow-ups)

### Out of scope
- Designing dedicated WhatsApp template manager UI (existing 8 templates in marketing memory unchanged).
- Rewriting Bulk Email composer entirely — only adding media upload.
