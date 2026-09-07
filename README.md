# Alimah Restaurant Management System

Phase 1 + Phase 2 + Phase 3 for Alimah, a Filipino tapsihan-style eatery on
Evangelista Street, Bacoor City, Cavite. Next.js (App Router) +
PostgreSQL/Supabase + Tailwind CSS, per the project spec.

## What's built

**Phase 1 (MVP):**
- **POS** — order entry across all 7 channels (dine-in, phone, landline,
  Facebook, GrabFood, FoodPanda, online), table management, SC/PWD + promo
  discounts, order status pipeline, cash/GCash/bank-transfer payments with
  split/partial support, void with logged reason, manual GrabFood/FoodPanda
  entry with commission tracking, end-of-day closing report.
- **KDS** — polling kitchen queue, per-item prep status, late-order flag
  against a configurable target prep time.
- **Inventory** — recipe/BOM-driven automatic deduction on order completion,
  weighted-average costing, manual adjustments with required reason codes,
  low-stock alerts, COGS report by date range/item. Menu items (and which
  inventory items make up each one) are managed from Inventory → Menu Items
  by downloading an Excel template, editing it, and re-uploading — see
  "Bulk menu import" below.
- **Purchase Orders & Suppliers** — supplier directory (with per-item agreed
  pricing), PO lifecycle (draft → sent → partially received → received /
  cancelled), receiving recalculates weighted-average cost, PO history per
  supplier.
- **Owner Dashboard** — sales by channel/payment method, best/slow sellers,
  COGS vs. revenue margin, inventory valuation, low-stock alerts, estimated
  labor cost %, PO spend by supplier, net vs. gross (platform commission),
  CSV export + print-to-PDF.
- **Employees** — directory (role, pay type/rate — daily, hourly, or
  monthly), manual shift schedule grid.
- **Auth & RBAC** — PIN login for cashier/kitchen/server/encoder,
  email+password (Supabase Auth) for owner/manager, module access gated by
  role throughout.

**Phase 2 (built so far):**
- **Attendance** — PIN clock-in/out at `/clock` (public, tablet-friendly,
  no staff login required — tap your name, enter your PIN, it toggles
  in/out), linked to the day's scheduled shift when one exists. Manager
  override for manual/corrected entries, with a weekly Attendance view
  (Employees → Attendance) flagging Late/Absent against the schedule.
- **Payroll** — owner-only. Create a pay period, generate payslips (gross
  pay computed from attendance: daily = rate × days worked, hourly = rate ×
  hours worked, monthly = fixed rate for the period), manually enter
  overtime pay and deduction line items (SSS, PhilHealth, Pag-IBIG, tax,
  cash advances — all free-text/amount, never auto-computed), finalize a
  period to lock it.
- **Reservations** — public booking page at `/reserve` (date/time/party
  size/contact/notes, optional GCash/bank-transfer down payment with
  screenshot upload). Staff-side screen (Reservations tab) to verify the
  payment proof, confirm, assign a table, mark seated/completed/no-show/
  cancelled, and a manual "mark customer notified" action — no SMS/Messenger
  automation, per owner decision.
- **Walk-in waitlist** — staff-only queue (Waitlist tab): add a party,
  track position and estimated wait, seat/remove.

**Phase 3 (built):**
- **Branches (multi-store)** — a real store-scoping refactor, not just a
  schema column left unused: every module (POS, KDS, Inventory, Purchase
  Orders, Dashboard, Employees, Payroll, Reservations, the public `/clock`
  and `/reserve` pages) reads and writes only the current branch's data.
  Non-owner staff are permanently scoped to their own branch — there is no
  way for a cashier to see another branch's orders. The owner alone can
  switch which branch they're currently viewing/operating (a header
  dropdown, "Branches" nav item), which is enforced server-side by role,
  not by trusting a client-side value. Creating a new branch (Branches
  page, owner-only) can optionally clone an existing branch's menu
  categories, menu items/variants, recipes (BOM), and inventory item list
  as a starting point — stock quantities start at zero, but the cost
  estimate carries over so COGS reporting has a sane starting point on day
  one.
- **Loyalty / CRM** — a customer directory (name + contact number,
  found-or-created by phone at the POS) with a points-balance ledger and
  full transaction history. **Disabled by default** and gated so it can
  never silently invent a peso value: the owner must explicitly turn it on
  from Loyalty → Settings and set both the earn rate (points per peso
  spent) and the redemption rate (peso value per point) before the system
  will allow it to be enabled — turning it on with either rate blank is
  rejected server-side, not just in the UI. While disabled, every
  points-earning hook in the order flow is a silent no-op: normal checkout
  behavior is completely unaffected by an unconfigured or disabled
  program. Once enabled, the POS lets staff look up a customer by phone,
  see their points balance, and apply a points redemption (capped at the
  order's remaining total, subject to the owner-configured minimum
  redemption) as a discount line at checkout; points are earned
  automatically when an order is completed/paid, at the owner's configured
  rate. Manual point adjustments (Loyalty → Customers) are available for
  corrections, each logged to the transaction history with the amount and
  who made it.

**Explicitly not built (owner decision, not a gap):** real
GrabFood/FoodPanda/PayMongo API integrations, and SMS/Messenger
notification automation. The business has no partner API access to the
delivery platforms or a payment gateway account, so manual entry (already
built in Phase 1) stays the permanent way these are handled, and
notifications stay a manual "I called them" checkbox rather than an
automated message.

## POS improvement: bulk menu import (Excel)

Loyverse-style bulk item management: instead of adding menu items one at a
time, go to **Inventory → Menu Items** and:

1. **Download template** — exports the current menu (categories, items,
   prices, variants, and each item's recipe/BOM) as an .xlsx with four
   sheets: **Items**, **Variants**, **Components**, and a read-only
   **Inventory Items (reference)** sheet listing valid inventory item names
   to type into Components.
2. Edit it in Excel/Google Sheets/Numbers — add rows for new items, change
   prices, add/remove recipe ingredients.
3. **Upload filled template** — creates new categories/items/variants
   automatically and updates existing ones, matched by name (case-insensitive).

Two behaviors worth knowing:
- **Components import replaces, it doesn't merge.** For any item that
  appears in the Components sheet, the uploaded rows become that item's
  *entire* recipe — remove a row and re-upload, and that ingredient stops
  being deducted from inventory on sale.
- **Nothing is written unless everything validates.** An inventory item
  name that doesn't match anything in Inventory (typo, or an item that
  doesn't exist yet), an incompatible unit (e.g. mL against something
  stocked in kg), or a missing price aborts the *entire* upload with a row-
  by-row error list — never a partial import with a silently incomplete
  recipe. Add missing inventory items in Inventory first, then reference
  them by name.

## Assumptions confirmed with the owner

Per spec Section 8 (Phase 1): staff pay is a **mix of daily and monthly**
(not all-daily as originally drafted), the business is **Non-VAT/Percentage
Tax**, receipts are **informal** (not BIR-accredited) for now, and SC/PWD
discounts are supported but **kept lightweight** since they're low-volume
for this customer base.

For Phase 2: no GrabFood/FoodPanda partner API access and no payment
gateway account exist yet, so those integrations are skipped rather than
stubbed (see above); notifications are manual, not automated; and overtime
pay has **no automatic multiplier** — hours are tracked, but the peso
amount is entered manually per payslip by whoever runs payroll.

## Setup

### 1. Create a Supabase project

Create a project at [supabase.com](https://supabase.com), then grab the
Project URL, anon key, and service role key from Project Settings → API.

### 2. Run the database migrations

Using the [Supabase CLI](https://supabase.com/docs/guides/cli):

```bash
supabase link --project-ref <your-project-ref>
supabase db push
```

Or paste each file in `supabase/migrations/` into the Supabase SQL Editor,
**in order** (`00000000000001` → `00000000000010`).

### 3. Seed sample data

Paste `supabase/seed/seed.sql` into the SQL Editor and run it (or
`psql "$DATABASE_URL" -f supabase/seed/seed.sql`). It seeds the store, menu
with recipes/BOM, inventory, suppliers, employees, sample orders across
every channel/status, a received + a draft purchase order, and this week's
shift schedule.

Then run `supabase/seed/seed_phase2.sql` the same way — it's a separate
file (not appended to seed.sql) so it doesn't collide with rows seed.sql
already inserted on a project where you've run it before. It adds a few
sample reservations, a walk-in waitlist, and some attendance records so the
new Phase 2 screens have data too.

This migrations + seed pipeline (schema, RLS, every Postgres function, and
both seed files) was validated end-to-end against a real local Postgres
instance during development, including the specific bugs a live run
catches that a read-through can't: an enum cast that only fails inside a
`CASE` expression, and an ambiguous PostgREST embed on a table with two
foreign keys to the same target. Phase 3's branch cloning and loyalty
earn/redeem functions (idempotency, the disabled-program no-op, the
minimum-redemption and insufficient-balance guards) were exercised the
same way before shipping.

### 4. Configure environment variables

```bash
cp .env.example .env.local
```

Fill in `NEXT_PUBLIC_SUPABASE_URL` (no `/rest/v1/` suffix — just the bare
project URL), `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`,
and generate a `SESSION_SECRET` (`openssl rand -base64 32`). Leave
`NEXT_PUBLIC_DEFAULT_STORE_ID` exactly as it is in the template — it must
match the store row the seed script creates.

### 5. Create the owner/manager login accounts

The seed data creates the *employee* rows for the owner and manager, but
Supabase Auth accounts (for email+password login) have to be created via
the Auth API, not raw SQL. Run:

```bash
node scripts/bootstrap-owner-login.mjs
```

This prints the email/password for both accounts — change the password
after first login (there's no self-service reset flow yet).

### 6. Install and run

```bash
npm install
npm run dev
```

Open http://localhost:3000 — you'll land on the staff login screen.

## Default logins (seeded staff)

PIN-based (tap the name tile, then enter the PIN):

| Name | Role | PIN |
|---|---|---|
| Rosemarie Cruz | Cashier | 1234 |
| Bienvenido Reyes | Cashier | 2345 |
| Junjun Ramos | Kitchen | 3456 |
| Lito Mendoza | Kitchen | 4567 |
| Ana Liza Torres | Server | 5678 |
| Mika Villanueva | Encoder | 6789 |

Owner/manager: see the output of `scripts/bootstrap-owner-login.mjs`.

## Public pages (no login required)

- `/reserve` — customer-facing table reservation form
- `/clock` — staff time clock (PIN-based clock in/out)

With multiple branches, both pages resolve which branch they belong to via
a `?store=<store id>` query param — e.g. `/reserve?store=<id>` and
`/clock?store=<id>`, using the branch's `id` from the Branches page; with
no param they fall back to the original seeded branch, so existing
bookmarked single-branch links keep working unchanged after Phase 3.

## Notes on money-related logic

Per the spec's instruction to never silently invent pricing/discount/tax/
payroll logic: SC/PWD discounts are a flat 20% of subtotal (no VAT strip,
since the business is Non-VAT); promo discounts are staff-entered amounts;
tax is left at ₱0 on every order (Percentage Tax is a business-level tax on
gross sales, not itemized on the customer's receipt); the dashboard's labor
cost is explicitly labeled as an **estimate** from scheduled shifts × pay
rate (not actual attendance); actual payroll (Payroll module) computes
regular pay from real attendance records per employee pay type, with
overtime pay and all statutory deductions as manually entered, editable
amounts — never auto-computed from a formula or a government table.

Loyalty points follow the same rule: there is no built-in or default earn/
redemption rate anywhere in the code. Both rates are `null` until the owner
sets them, the program cannot be turned on without both being a positive
number (enforced in the server action, not just the form), and every peso
value the program ever produces — points earned on an order, or the peso
discount from a redemption — is a straight multiplication against whatever
rate the owner entered.
