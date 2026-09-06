# Alimah Restaurant Management System

Phase 1 MVP for Alimah, a Filipino tapsihan-style eatery on Evangelista
Street, Bacoor City, Cavite. Next.js (App Router) + PostgreSQL/Supabase +
Tailwind CSS, per the project spec.

## What's built (Phase 1)

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
- **Purchase Orders & Suppliers** — supplier directory, PO lifecycle
  (draft → sent → partially received → received / cancelled), receiving
  recalculates weighted-average cost, PO history per supplier.
- **Owner Dashboard** — sales by channel/payment method, best/slow sellers,
  COGS vs. revenue margin, inventory valuation, low-stock alerts, estimated
  labor cost %, PO spend by supplier, net vs. gross (platform commission),
  CSV export + print-to-PDF.
- **Employees** — directory (role, pay type/rate — daily, hourly, or
  monthly), manual shift schedule grid. Payroll computation and PIN
  clock-in/out attendance are Phase 2, per spec.
- **Auth & RBAC** — PIN login for cashier/kitchen/server/encoder,
  email+password (Supabase Auth) for owner/manager, module access gated by
  role throughout.

Reservations/waitlist tables exist in the schema (spec 5) but their UI is
Phase 2, as scoped.

## Assumptions confirmed with the owner

Per spec Section 8: staff pay is a **mix of daily and monthly** (not
all-daily as originally drafted), the business is **Non-VAT/Percentage
Tax**, receipts are **informal** (not BIR-accredited) for now, and SC/PWD
discounts are supported but **kept lightweight** since they're low-volume
for this customer base.

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
in order (`00000000000001` → `00000000000004`).

### 3. Seed sample data

Paste `supabase/seed/seed.sql` into the SQL Editor and run it (or
`psql "$DATABASE_URL" -f supabase/seed/seed.sql`). It seeds the store, menu
with recipes/BOM, inventory, suppliers, employees, sample orders across
every channel/status, a received + a draft purchase order, and this week's
shift schedule — enough to exercise every Phase 1 screen immediately.

This migrations + seed pipeline (schema, RLS, the weighted-average-cost and
inventory-deduction functions, and the seed data itself) was validated
end-to-end against a real local Postgres instance during development —
the weighted-average cost math and inventory ledger came back correct
before this was ever pointed at Supabase.

### 4. Configure environment variables

```bash
cp .env.example .env.local
```

Fill in `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
`SUPABASE_SERVICE_ROLE_KEY`, and generate a `SESSION_SECRET`
(`openssl rand -base64 32`). Leave `NEXT_PUBLIC_DEFAULT_STORE_ID` as-is — it
matches the store row the seed script creates.

### 5. Create the owner/manager login accounts

The seed data creates the *employee* rows for the owner and manager, but
Supabase Auth accounts (for email+password login) have to be created via
the Auth API, not raw SQL. Run:

```bash
node scripts/bootstrap-owner-login.mjs
```

This prints the email/password for both accounts — change the password
after first login (there's no self-service reset flow yet in Phase 1).

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

## Notes on money-related logic

Per the spec's instruction to never silently invent pricing/discount/tax/
payroll logic: SC/PWD discounts are a flat 20% of subtotal (no VAT strip,
since the business is Non-VAT); promo discounts are staff-entered amounts;
tax is left at ₱0 on every order (Percentage Tax is a business-level tax on
gross sales, not itemized on the customer's receipt); the dashboard's labor
cost is explicitly labeled as an **estimate** from scheduled shifts × pay
rate (not actual attendance, and not a real payslip) — full payroll with
editable statutory deductions is Phase 2, as scoped.
