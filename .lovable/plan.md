

## Plan: Properly Account for Refunds in Reports

### Problem
Refunded amounts from returns are fetched but only displayed in the Cashflow "Refunds" metric block. They are never deducted from Revenue, Profit, or trend calculations, making financial reports inaccurate.

### Current Issues
1. **Revenue** includes orders that were returned/refunded
2. **Profit** = paidRevenue - expenses, with no refund deduction
3. **Revenue trend chart** doesn't subtract refund amounts per day
4. **Top Products** revenue includes returned items
5. **AOV** is inflated by counting returned orders

### Changes

#### 1. `src/api/reports2.ts` — Fetch refund `order_id` and `status` for proper matching
- Add `order_id` and `return_id` to the refunds select query so we can link refunds back to orders

#### 2. `src/pages/admin/Reports2.tsx` — Deduct refunds from all financial metrics

**Revenue calculation:**
- Exclude orders with `status = 'returned'` or `status = 'cancelled'` from revenue totals
- OR: keep gross revenue but add a "Net Revenue" KPI that subtracts completed refunds

**Approach — Net Revenue model (clearer for business owners):**
- `Gross Revenue` = sum of all order totals (current behavior, kept as-is)
- `Net Revenue` = Gross Revenue - total completed refunds
- `Profit` = Net Revenue - Expenses (instead of current paidRevenue - expenses)
- Add a "Refunds" KPI card showing total refunded amount
- Revenue trend: subtract daily refund amounts from daily revenue to show net trend

**Specific code changes:**
- Add `refundTotal` deduction in profit calculation: `profit = paidRevenue - refundTotal - totalExpenses`
- Add refund amounts per day to the revenue trend chart as a third line or deduct from profit line
- Add "Net Revenue" and "Refunds" KPI cards to the dashboard
- Update AI Insights to flag high refund rates

### Files to modify (2 files)
1. `src/api/reports2.ts` — add `order_id` to refunds query, filter by completed refund status
2. `src/pages/admin/Reports2.tsx` — adjust profit calc, add Net Revenue KPI, add Refunds KPI card, update trend chart

