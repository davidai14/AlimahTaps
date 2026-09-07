-- Phase 3: customer-facing loyalty/CRM. Per spec instruction 8 ("never
-- silently invent money-related logic"), the actual peso rates are NOT
-- hardcoded anywhere in this migration or the app — loyalty_settings starts
-- disabled with both rates null, and application code refuses to enable the
-- program (or earn/redeem any points) until the owner has explicitly set
-- both rates via the Loyalty settings screen.

create type loyalty_txn_type as enum ('earn', 'redeem', 'adjustment');

create table customers (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade,
  full_name text not null,
  contact_number text not null,
  email text,
  loyalty_points_balance numeric(12, 2) not null default 0,
  created_at timestamptz not null default now(),
  unique (store_id, contact_number)
);

create index customers_store_id_idx on customers(store_id);

create table loyalty_settings (
  store_id uuid primary key references stores(id) on delete cascade,
  enabled boolean not null default false,
  -- Both null until the owner configures them; enabling the program with
  -- either unset is rejected at the application layer.
  points_per_peso_spent numeric(10, 4),
  peso_value_per_point numeric(10, 4),
  min_redeem_points numeric(10, 2) not null default 0,
  updated_at timestamptz not null default now()
);

create table loyalty_transactions (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade,
  customer_id uuid not null references customers(id) on delete cascade,
  order_id uuid references orders(id) on delete set null,
  type loyalty_txn_type not null,
  -- positive for earn/upward adjustment, negative for redeem/downward adjustment
  points numeric(12, 2) not null,
  notes text,
  created_by uuid references employees(id) on delete set null,
  created_at timestamptz not null default now()
);

create index loyalty_transactions_store_id_idx on loyalty_transactions(store_id);
create index loyalty_transactions_customer_id_idx on loyalty_transactions(customer_id);

-- Optional link from an order to the customer it earned/redeemed points
-- for — nullable, most orders (walk-ins who don't want to join) have none.
alter table orders add column customer_id uuid references customers(id) on delete set null;

alter table customers enable row level security;
alter table loyalty_settings enable row level security;
alter table loyalty_transactions enable row level security;

create policy "authenticated read customers" on customers for select to authenticated using (true);
create policy "authenticated read loyalty_settings" on loyalty_settings for select to authenticated using (true);
create policy "authenticated read loyalty_transactions" on loyalty_transactions for select to authenticated using (true);

-- ----------------------------------------------------------------------------
-- Earn points on a paid/completed order. Idempotent per order (checks for an
-- existing 'earn' transaction referencing this order first) and refuses to
-- run at all unless the program is enabled with both rates configured.
-- ----------------------------------------------------------------------------
create or replace function earn_loyalty_points_for_order(
  p_order_id uuid, p_customer_id uuid, p_employee_id uuid
) returns void
language plpgsql
as $$
declare
  v_order orders%rowtype;
  v_settings loyalty_settings%rowtype;
  v_points numeric;
  v_already_earned boolean;
begin
  select exists (
    select 1 from loyalty_transactions
    where order_id = p_order_id and type = 'earn'
  ) into v_already_earned;
  if v_already_earned then
    return;
  end if;

  select * into v_order from orders where id = p_order_id;
  if not found then
    raise exception 'order % not found', p_order_id;
  end if;

  select * into v_settings from loyalty_settings where store_id = v_order.store_id;
  if not found or not v_settings.enabled or v_settings.points_per_peso_spent is null then
    return; -- loyalty not configured/enabled for this store — silently no-op
  end if;

  v_points := round(v_order.total_amount * v_settings.points_per_peso_spent, 2);
  if v_points <= 0 then
    return;
  end if;

  update customers set loyalty_points_balance = loyalty_points_balance + v_points
    where id = p_customer_id;

  insert into loyalty_transactions (store_id, customer_id, order_id, type, points, created_by)
  values (v_order.store_id, p_customer_id, p_order_id, 'earn', v_points, p_employee_id);
end;
$$;

-- ----------------------------------------------------------------------------
-- Redeem points for a peso discount amount. Validates sufficient balance and
-- the store's minimum redemption threshold; the peso amount is computed
-- entirely from the owner-configured rate, never invented here.
-- ----------------------------------------------------------------------------
create or replace function redeem_loyalty_points(
  p_customer_id uuid, p_points numeric, p_order_id uuid, p_employee_id uuid
) returns numeric
language plpgsql
as $$
declare
  v_customer customers%rowtype;
  v_settings loyalty_settings%rowtype;
  v_peso_value numeric;
begin
  if p_points <= 0 then
    raise exception 'points to redeem must be positive';
  end if;

  select * into v_customer from customers where id = p_customer_id for update;
  if not found then
    raise exception 'customer % not found', p_customer_id;
  end if;

  select * into v_settings from loyalty_settings where store_id = v_customer.store_id;
  if not found or not v_settings.enabled or v_settings.peso_value_per_point is null then
    raise exception 'loyalty program is not enabled for this store';
  end if;

  if p_points < v_settings.min_redeem_points then
    raise exception 'minimum redemption is % points', v_settings.min_redeem_points;
  end if;

  if p_points > v_customer.loyalty_points_balance then
    raise exception 'insufficient points balance';
  end if;

  v_peso_value := round(p_points * v_settings.peso_value_per_point, 2);

  update customers set loyalty_points_balance = loyalty_points_balance - p_points
    where id = p_customer_id;

  insert into loyalty_transactions (store_id, customer_id, order_id, type, points, created_by)
  values (v_customer.store_id, p_customer_id, p_order_id, 'redeem', -p_points, p_employee_id);

  return v_peso_value;
end;
$$;
