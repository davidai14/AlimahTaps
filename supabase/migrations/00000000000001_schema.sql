-- Alimah Restaurant Management System — core schema (Phase 1)
-- Single store today, but every business table carries store_id so a
-- second branch never requires a schema rewrite (see spec Section 3/5).

create extension if not exists "pgcrypto";

-- ============================================================================
-- ENUMS
-- ============================================================================

create type vat_status as enum ('non_vat', 'vat');

create type staff_role as enum (
  'owner', 'manager', 'cashier', 'kitchen', 'server', 'encoder'
);

create type pay_type as enum ('daily', 'hourly', 'monthly');

create type order_channel as enum (
  'dine_in', 'phone', 'landline', 'facebook', 'grabfood', 'foodpanda', 'online'
);

create type order_status as enum (
  'pending', 'preparing', 'ready', 'served', 'completed', 'paid',
  'cancelled', 'voided'
);

create type order_item_status as enum (
  'pending', 'in_progress', 'ready', 'served'
);

create type discount_type as enum ('none', 'senior', 'pwd', 'promo');

create type payment_method as enum ('cash', 'gcash', 'bank_transfer');

create type po_status as enum (
  'draft', 'sent', 'partially_received', 'received', 'cancelled'
);

create type inventory_txn_type as enum (
  'sale_deduction', 'po_receipt', 'adjustment', 'waste', 'correction'
);

create type table_status as enum ('available', 'occupied', 'reserved');

create type reservation_status as enum (
  'pending', 'confirmed', 'seated', 'completed', 'no_show', 'cancelled'
);

create type waitlist_status as enum (
  'waiting', 'seated', 'cancelled', 'no_show'
);

-- ============================================================================
-- CORE: stores & employees
-- ============================================================================

create table stores (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text,
  phone text,
  landline text,
  facebook_page text,
  tin text,
  vat_status vat_status not null default 'non_vat',
  target_prep_time_minutes int not null default 15,
  created_at timestamptz not null default now()
);

create table employees (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade,
  full_name text not null,
  role staff_role not null,
  contact_number text,
  email text,
  hire_date date,
  pay_type pay_type not null default 'daily',
  pay_rate numeric(12, 2) not null default 0,
  -- bcrypt hash of a 4-6 digit PIN, used for cashier/kitchen/server/encoder login.
  pin_hash text,
  -- set only for owner/manager, who log in via Supabase Auth email+password.
  auth_user_id uuid references auth.users(id) on delete set null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create unique index employees_auth_user_id_idx on employees(auth_user_id)
  where auth_user_id is not null;
create index employees_store_id_idx on employees(store_id);

-- ============================================================================
-- MENU: categories, items, variants
-- ============================================================================

create table menu_categories (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade,
  name text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table menu_items (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade,
  category_id uuid references menu_categories(id) on delete set null,
  name text not null,
  description text,
  price numeric(12, 2) not null,
  image_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index menu_items_store_id_idx on menu_items(store_id);
create index menu_items_category_id_idx on menu_items(category_id);

-- e.g. "Large" (+30), "Extra Rice" (+15). price_delta added to base price.
create table menu_item_variants (
  id uuid primary key default gen_random_uuid(),
  menu_item_id uuid not null references menu_items(id) on delete cascade,
  name text not null,
  price_delta numeric(12, 2) not null default 0,
  created_at timestamptz not null default now()
);

create index menu_item_variants_menu_item_id_idx on menu_item_variants(menu_item_id);

-- ============================================================================
-- INVENTORY: items & recipe/BOM
-- ============================================================================

create table inventory_items (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade,
  name text not null,
  -- stocking unit for this item: g, kg, mL, L, or pc. Recipes below are
  -- expressed in the same unit family; kg<->g and L<->mL are converted in
  -- application code (1000x), pc has no conversion.
  unit text not null check (unit in ('g', 'kg', 'mL', 'L', 'pc')),
  current_stock numeric(14, 3) not null default 0,
  -- weighted-average cost per unit, recalculated on every PO receipt.
  weighted_avg_cost numeric(14, 4) not null default 0,
  reorder_point numeric(14, 3) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index inventory_items_store_id_idx on inventory_items(store_id);

-- Recipe/BOM: how much of each inventory item one unit of a menu item (or
-- variant) consumes. One inventory item can serve many menu items.
create table menu_item_components (
  id uuid primary key default gen_random_uuid(),
  menu_item_id uuid not null references menu_items(id) on delete cascade,
  -- null = applies to the base item; set = only added when this variant is chosen
  -- (e.g. "Extra Rice" variant consumes an extra 150g of rice).
  variant_id uuid references menu_item_variants(id) on delete cascade,
  inventory_item_id uuid not null references inventory_items(id) on delete restrict,
  quantity numeric(14, 3) not null,
  unit text not null check (unit in ('g', 'kg', 'mL', 'L', 'pc')),
  created_at timestamptz not null default now()
);

create index menu_item_components_menu_item_id_idx on menu_item_components(menu_item_id);
create index menu_item_components_inventory_item_id_idx on menu_item_components(inventory_item_id);

-- ============================================================================
-- DINE-IN TABLES
-- ============================================================================

create table restaurant_tables (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade,
  table_number text not null,
  capacity int not null default 4,
  status table_status not null default 'available',
  created_at timestamptz not null default now()
);

create index restaurant_tables_store_id_idx on restaurant_tables(store_id);

-- ============================================================================
-- ORDERS
-- ============================================================================

create table orders (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade,
  channel order_channel not null,
  -- Phase 2 hook: GrabFood/FoodPanda order id, or online booking reference.
  external_reference text,
  table_id uuid references restaurant_tables(id) on delete set null,
  customer_name text,
  customer_contact text,
  status order_status not null default 'pending',

  subtotal numeric(12, 2) not null default 0,
  discount_type discount_type not null default 'none',
  -- SC/PWD ID number, logged per BIR practice when a government discount is applied.
  discount_id_number text,
  discount_amount numeric(12, 2) not null default 0,
  -- GrabFood/FoodPanda commission/fee for this order, so reporting can show
  -- net revenue separately from gross sales (spec Section 3 & 4.1).
  platform_commission numeric(12, 2) not null default 0,
  tax_amount numeric(12, 2) not null default 0,
  total_amount numeric(12, 2) not null default 0,

  void_reason text,
  voided_by uuid references employees(id) on delete set null,
  voided_at timestamptz,

  created_by uuid references employees(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index orders_store_id_idx on orders(store_id);
create index orders_status_idx on orders(status);
create index orders_channel_idx on orders(channel);
create index orders_created_at_idx on orders(created_at);

create table order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  menu_item_id uuid not null references menu_items(id) on delete restrict,
  variant_id uuid references menu_item_variants(id) on delete set null,
  quantity numeric(10, 2) not null default 1,
  unit_price numeric(12, 2) not null,
  notes text,
  status order_item_status not null default 'pending',
  created_at timestamptz not null default now()
);

create index order_items_order_id_idx on order_items(order_id);

create table payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  method payment_method not null,
  amount numeric(12, 2) not null,
  -- GCash/bank transfer reference number, or manual proof-of-payment reference.
  reference_number text,
  -- Supabase Storage path for uploaded payment screenshot (GCash/bank transfer).
  screenshot_url text,
  verified_by uuid references employees(id) on delete set null,
  verified_at timestamptz,
  created_at timestamptz not null default now()
);

create index payments_order_id_idx on payments(order_id);

-- ============================================================================
-- INVENTORY TRANSACTIONS (ledger driving weighted-avg cost + audit trail)
-- ============================================================================

create table inventory_transactions (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade,
  inventory_item_id uuid not null references inventory_items(id) on delete cascade,
  type inventory_txn_type not null,
  -- positive = stock added (PO receipt, correction up), negative = stock removed
  -- (sale deduction, waste, correction down).
  quantity_change numeric(14, 3) not null,
  -- unit cost at time of transaction: PO unit cost for receipts, current
  -- weighted-avg cost for deductions/waste (used for COGS reporting).
  unit_cost numeric(14, 4) not null default 0,
  reference_type text, -- 'order', 'purchase_order', 'manual'
  reference_id uuid,
  reason_code text, -- required for adjustment/waste: 'spoilage', 'breakage', 'correction', etc.
  created_by uuid references employees(id) on delete set null,
  created_at timestamptz not null default now()
);

create index inventory_transactions_store_id_idx on inventory_transactions(store_id);
create index inventory_transactions_item_id_idx on inventory_transactions(inventory_item_id);
create index inventory_transactions_created_at_idx on inventory_transactions(created_at);

-- ============================================================================
-- SUPPLIERS & PURCHASE ORDERS
-- ============================================================================

create table suppliers (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade,
  name text not null,
  contact_person text,
  phone text,
  email text,
  address text,
  created_at timestamptz not null default now()
);

create index suppliers_store_id_idx on suppliers(store_id);

create table supplier_items (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references suppliers(id) on delete cascade,
  inventory_item_id uuid not null references inventory_items(id) on delete cascade,
  agreed_price numeric(14, 4),
  created_at timestamptz not null default now(),
  unique (supplier_id, inventory_item_id)
);

create table purchase_orders (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade,
  supplier_id uuid not null references suppliers(id) on delete restrict,
  status po_status not null default 'draft',
  order_date date not null default current_date,
  expected_date date,
  notes text,
  total_cost numeric(14, 2) not null default 0,
  created_by uuid references employees(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index purchase_orders_store_id_idx on purchase_orders(store_id);
create index purchase_orders_supplier_id_idx on purchase_orders(supplier_id);

create table purchase_order_items (
  id uuid primary key default gen_random_uuid(),
  purchase_order_id uuid not null references purchase_orders(id) on delete cascade,
  inventory_item_id uuid not null references inventory_items(id) on delete restrict,
  quantity_ordered numeric(14, 3) not null,
  quantity_received numeric(14, 3) not null default 0,
  unit_cost numeric(14, 4) not null,
  created_at timestamptz not null default now()
);

create index purchase_order_items_po_id_idx on purchase_order_items(purchase_order_id);

-- ============================================================================
-- SHIFTS / ATTENDANCE (schedule now; attendance table ready for Phase 2)
-- ============================================================================

create table shifts (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade,
  employee_id uuid not null references employees(id) on delete cascade,
  shift_date date not null,
  start_time time not null,
  end_time time not null,
  notes text,
  created_at timestamptz not null default now()
);

create index shifts_store_id_idx on shifts(store_id);
create index shifts_employee_id_idx on shifts(employee_id);
create index shifts_shift_date_idx on shifts(shift_date);

create table attendance (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade,
  employee_id uuid not null references employees(id) on delete cascade,
  shift_id uuid references shifts(id) on delete set null,
  clock_in timestamptz,
  clock_out timestamptz,
  is_manual_override boolean not null default false,
  notes text,
  created_at timestamptz not null default now()
);

create index attendance_store_id_idx on attendance(store_id);
create index attendance_employee_id_idx on attendance(employee_id);

-- ============================================================================
-- RESERVATIONS & WAITLIST (Phase 2 UI, table ready now)
-- ============================================================================

create table reservations (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade,
  customer_name text not null,
  contact_number text not null,
  party_size int not null default 1,
  reservation_date date not null,
  reservation_time time not null,
  status reservation_status not null default 'pending',
  table_id uuid references restaurant_tables(id) on delete set null,
  down_payment_amount numeric(12, 2) default 0,
  payment_reference text,
  payment_screenshot_url text,
  verified_by uuid references employees(id) on delete set null,
  verified_at timestamptz,
  notes text,
  created_at timestamptz not null default now()
);

create index reservations_store_id_idx on reservations(store_id);

create table waitlist (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade,
  customer_name text not null,
  contact_number text,
  party_size int not null default 1,
  status waitlist_status not null default 'waiting',
  queue_position int,
  estimated_wait_minutes int,
  created_at timestamptz not null default now()
);

create index waitlist_store_id_idx on waitlist(store_id);

-- ============================================================================
-- AUDIT LOG
-- ============================================================================

create table audit_log (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade,
  action_type text not null, -- 'order_void', 'stock_adjustment', 'price_change', 'payroll_edit', 'discount_applied'
  entity_type text not null,
  entity_id uuid,
  performed_by uuid references employees(id) on delete set null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index audit_log_store_id_idx on audit_log(store_id);
create index audit_log_entity_idx on audit_log(entity_type, entity_id);
create index audit_log_created_at_idx on audit_log(created_at);
