-- Core business logic: unit conversion, weighted-average costing on PO
-- receipt, and recipe-driven inventory deduction on order completion.
-- These run as single atomic functions (not multi-step client code) so a
-- concurrent order/receipt can never read a stale stock/cost value.

-- ----------------------------------------------------------------------------
-- Unit conversion: inventory is stocked in g/kg/mL/L/pc; recipes may be
-- written in either unit of a g/kg or mL/L pair. pc has no conversion.
-- ----------------------------------------------------------------------------
create or replace function convert_quantity(
  p_quantity numeric, p_from_unit text, p_to_unit text
) returns numeric
language plpgsql
immutable
as $$
begin
  if p_from_unit = p_to_unit then
    return p_quantity;
  elsif p_from_unit = 'kg' and p_to_unit = 'g' then
    return p_quantity * 1000;
  elsif p_from_unit = 'g' and p_to_unit = 'kg' then
    return p_quantity / 1000;
  elsif p_from_unit = 'L' and p_to_unit = 'mL' then
    return p_quantity * 1000;
  elsif p_from_unit = 'mL' and p_to_unit = 'L' then
    return p_quantity / 1000;
  else
    raise exception 'Incompatible units: % -> %', p_from_unit, p_to_unit;
  end if;
end;
$$;

-- ----------------------------------------------------------------------------
-- Receive a purchase order line (full or partial), updating stock and
-- recalculating weighted-average cost:
--   new_avg = (current_stock * current_avg + qty_received * unit_cost)
--             / (current_stock + qty_received)
-- ----------------------------------------------------------------------------
create or replace function receive_purchase_order_item(
  p_po_item_id uuid, p_receive_qty numeric, p_employee_id uuid
) returns void
language plpgsql
as $$
declare
  v_po_item purchase_order_items%rowtype;
  v_item inventory_items%rowtype;
  v_new_stock numeric;
  v_new_avg numeric;
  v_po_id uuid;
  v_all_received boolean;
  v_any_received boolean;
begin
  if p_receive_qty <= 0 then
    raise exception 'receive_qty must be positive';
  end if;

  select * into v_po_item from purchase_order_items where id = p_po_item_id for update;
  if not found then
    raise exception 'purchase_order_item % not found', p_po_item_id;
  end if;

  select * into v_item from inventory_items where id = v_po_item.inventory_item_id for update;

  v_new_stock := v_item.current_stock + p_receive_qty;
  if v_new_stock = 0 then
    v_new_avg := v_item.weighted_avg_cost;
  else
    v_new_avg := (v_item.current_stock * v_item.weighted_avg_cost
                  + p_receive_qty * v_po_item.unit_cost) / v_new_stock;
  end if;

  update inventory_items
    set current_stock = v_new_stock,
        weighted_avg_cost = v_new_avg,
        updated_at = now()
    where id = v_item.id;

  update purchase_order_items
    set quantity_received = quantity_received + p_receive_qty
    where id = p_po_item_id;

  insert into inventory_transactions (
    store_id, inventory_item_id, type, quantity_change, unit_cost,
    reference_type, reference_id, created_by
  ) values (
    v_item.store_id, v_item.id, 'po_receipt', p_receive_qty, v_po_item.unit_cost,
    'purchase_order', v_po_item.purchase_order_id, p_employee_id
  );

  select purchase_order_id into v_po_id from purchase_order_items where id = p_po_item_id;

  select
    bool_and(quantity_received >= quantity_ordered),
    bool_or(quantity_received > 0)
    into v_all_received, v_any_received
    from purchase_order_items where purchase_order_id = v_po_id;

  update purchase_orders
    set status = case
          when v_all_received then 'received'
          when v_any_received then 'partially_received'
          else status
        end,
        updated_at = now()
    where id = v_po_id;
end;
$$;

-- ----------------------------------------------------------------------------
-- Deduct recipe/BOM inventory for every line item on an order, once, when the
-- order is completed/paid. Idempotent: a second call is a no-op so a status
-- transition can never double-deduct.
-- ----------------------------------------------------------------------------
create or replace function complete_order_inventory_deduction(
  p_order_id uuid, p_employee_id uuid
) returns void
language plpgsql
as $$
declare
  v_order orders%rowtype;
  v_line record;
  v_component record;
  v_deduct_qty numeric;
  v_already_done boolean;
begin
  select exists (
    select 1 from inventory_transactions
    where reference_type = 'order' and reference_id = p_order_id
  ) into v_already_done;
  if v_already_done then
    return;
  end if;

  select * into v_order from orders where id = p_order_id;
  if not found then
    raise exception 'order % not found', p_order_id;
  end if;

  for v_line in
    select * from order_items where order_id = p_order_id
  loop
    for v_component in
      select * from menu_item_components
      where menu_item_id = v_line.menu_item_id
        and (variant_id is null or variant_id = v_line.variant_id)
    loop
      v_deduct_qty := v_line.quantity * v_component.quantity;

      update inventory_items
        set current_stock = current_stock
          - convert_quantity(v_deduct_qty, v_component.unit, unit),
            updated_at = now()
        where id = v_component.inventory_item_id;

      insert into inventory_transactions (
        store_id, inventory_item_id, type, quantity_change, unit_cost,
        reference_type, reference_id, created_by
      )
      select
        v_order.store_id, i.id, 'sale_deduction',
        -convert_quantity(v_deduct_qty, v_component.unit, i.unit),
        i.weighted_avg_cost, 'order', p_order_id, p_employee_id
      from inventory_items i where i.id = v_component.inventory_item_id;
    end loop;
  end loop;
end;
$$;

-- ----------------------------------------------------------------------------
-- Manual stock adjustment (spoilage, waste, breakage, correction). Always
-- requires a reason code so it is auditable (spec 4.3).
-- ----------------------------------------------------------------------------
create or replace function adjust_inventory_stock(
  p_inventory_item_id uuid, p_quantity_change numeric, p_reason_code text,
  p_employee_id uuid
) returns void
language plpgsql
as $$
declare
  v_item inventory_items%rowtype;
begin
  if p_reason_code is null or length(trim(p_reason_code)) = 0 then
    raise exception 'reason_code is required for manual stock adjustments';
  end if;

  select * into v_item from inventory_items where id = p_inventory_item_id for update;
  if not found then
    raise exception 'inventory_item % not found', p_inventory_item_id;
  end if;

  update inventory_items
    set current_stock = current_stock + p_quantity_change, updated_at = now()
    where id = p_inventory_item_id;

  insert into inventory_transactions (
    store_id, inventory_item_id, type, quantity_change, unit_cost,
    reference_type, reason_code, created_by
  ) values (
    v_item.store_id, v_item.id,
    case when p_quantity_change < 0 then 'waste' else 'adjustment' end,
    p_quantity_change, v_item.weighted_avg_cost, 'manual', p_reason_code, p_employee_id
  );

  insert into audit_log (store_id, action_type, entity_type, entity_id, performed_by, details)
  values (
    v_item.store_id, 'stock_adjustment', 'inventory_item', v_item.id, p_employee_id,
    jsonb_build_object('quantity_change', p_quantity_change, 'reason_code', p_reason_code)
  );
end;
$$;
