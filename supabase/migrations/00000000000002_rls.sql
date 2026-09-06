-- Row Level Security
--
-- MVP posture: this is a single-store, staff-operated back office, not a
-- public-facing app. All real business rules (who can see payroll, who can
-- void an order) are enforced in the Next.js server actions/route handlers,
-- which run either as the signed-in Supabase Auth user (owner/manager) or,
-- for PIN-based staff, via the service-role client after verifying the PIN
-- server-side (staff never receive direct table access with their own
-- credentials — there is no Supabase Auth session for cashier/kitchen/server
-- roles in Phase 1). So: authenticated (owner/manager) users get read access
-- for the dashboard; all writes go through the service role from trusted
-- server code. This keeps RLS on (required for any anon/public exposure)
-- without re-implementing the whole RBAC matrix twice.

alter table stores enable row level security;
alter table employees enable row level security;
alter table menu_categories enable row level security;
alter table menu_items enable row level security;
alter table menu_item_variants enable row level security;
alter table inventory_items enable row level security;
alter table menu_item_components enable row level security;
alter table restaurant_tables enable row level security;
alter table orders enable row level security;
alter table order_items enable row level security;
alter table payments enable row level security;
alter table inventory_transactions enable row level security;
alter table suppliers enable row level security;
alter table supplier_items enable row level security;
alter table purchase_orders enable row level security;
alter table purchase_order_items enable row level security;
alter table shifts enable row level security;
alter table attendance enable row level security;
alter table reservations enable row level security;
alter table waitlist enable row level security;
alter table audit_log enable row level security;

-- Authenticated (owner/manager Supabase Auth sessions) can read everything.
-- Payroll-sensitive fields (pay_rate) are still filtered at the query layer
-- in application code for cashier-role UIs, since those never hold a
-- Supabase Auth session in Phase 1.
do $$
declare
  t text;
begin
  for t in
    select unnest(array[
      'stores', 'employees', 'menu_categories', 'menu_items',
      'menu_item_variants', 'inventory_items', 'menu_item_components',
      'restaurant_tables', 'orders', 'order_items', 'payments',
      'inventory_transactions', 'suppliers', 'supplier_items',
      'purchase_orders', 'purchase_order_items', 'shifts', 'attendance',
      'reservations', 'waitlist', 'audit_log'
    ])
  loop
    execute format(
      'create policy "authenticated read %1$s" on %1$s for select to authenticated using (true);',
      t
    );
  end loop;
end $$;

-- No insert/update/delete policies for the `authenticated` role: all writes
-- go through the service-role client in server actions, which bypasses RLS
-- by design. This is intentional for the MVP's single-store back office.
