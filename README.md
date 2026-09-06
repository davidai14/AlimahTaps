# Alimah Restaurant Management System

Phase 1 + Phase 2 (partial) for Alimah, a Filipino tapsihan-style eatery on
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
  low-stock alerts, COGS report by date range/item.
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

**Explicitly not built (owner decision, not a Phase 2 gap):** real
GrabFood/FoodPanda/PayMongo API integrations, and SMS/Messenger
notification automation. The business has no partner API access to the
delivery platforms or a payment gateway account, so manual entry (already
built in Phase 1) stays the permanent way these are handled, and
notifications stay a manual "I called them" checkbox rather than an
automated message.

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
**in order** (`00000000000001` → `00000000000006`).

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
foreign keys to the same target.

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
