-- Phase 3: multi-branch. A new branch starts with no menu/inventory/BOM of
-- its own (they're all store_id-scoped) — this lets the owner optionally
-- clone an existing branch's menu, inventory items, and recipes into a
-- newly created one instead of rebuilding it from scratch. Opening stock is
-- deliberately zeroed (a new branch hasn't actually received any stock
-- yet); weighted_avg_cost is copied as a starting estimate, corrected on
-- the branch's first real PO receipt.
create or replace function clone_store_menu_and_inventory(
  p_source_store_id uuid, p_target_store_id uuid
) returns void
language plpgsql
as $$
declare
  v_category record;
  v_item record;
  v_menu_item record;
  v_variant record;
  v_component record;
  v_new_category_id uuid;
  v_new_item_id uuid;
  v_new_menu_item_id uuid;
  v_new_variant_id uuid;
  category_map jsonb := '{}'::jsonb;
  item_map jsonb := '{}'::jsonb;
  menu_item_map jsonb := '{}'::jsonb;
  variant_map jsonb := '{}'::jsonb;
begin
  for v_category in select * from menu_categories where store_id = p_source_store_id loop
    insert into menu_categories (store_id, name, sort_order)
      values (p_target_store_id, v_category.name, v_category.sort_order)
      returning id into v_new_category_id;
    category_map := category_map || jsonb_build_object(v_category.id::text, v_new_category_id::text);
  end loop;

  for v_item in select * from inventory_items where store_id = p_source_store_id loop
    insert into inventory_items (store_id, name, unit, current_stock, weighted_avg_cost, reorder_point)
      values (p_target_store_id, v_item.name, v_item.unit, 0, v_item.weighted_avg_cost, v_item.reorder_point)
      returning id into v_new_item_id;
    item_map := item_map || jsonb_build_object(v_item.id::text, v_new_item_id::text);
  end loop;

  for v_menu_item in select * from menu_items where store_id = p_source_store_id loop
    insert into menu_items (store_id, category_id, name, description, price, image_url, is_active)
      values (
        p_target_store_id,
        nullif(category_map->>v_menu_item.category_id::text, '')::uuid,
        v_menu_item.name, v_menu_item.description, v_menu_item.price, v_menu_item.image_url, v_menu_item.is_active
      )
      returning id into v_new_menu_item_id;
    menu_item_map := menu_item_map || jsonb_build_object(v_menu_item.id::text, v_new_menu_item_id::text);

    for v_variant in select * from menu_item_variants where menu_item_id = v_menu_item.id loop
      insert into menu_item_variants (menu_item_id, name, price_delta)
        values (v_new_menu_item_id, v_variant.name, v_variant.price_delta)
        returning id into v_new_variant_id;
      variant_map := variant_map || jsonb_build_object(v_variant.id::text, v_new_variant_id::text);
    end loop;
  end loop;

  for v_component in
    select mic.* from menu_item_components mic
    join menu_items mi on mi.id = mic.menu_item_id
    where mi.store_id = p_source_store_id
  loop
    insert into menu_item_components (menu_item_id, variant_id, inventory_item_id, quantity, unit)
    values (
      (menu_item_map->>v_component.menu_item_id::text)::uuid,
      nullif(variant_map->>v_component.variant_id::text, '')::uuid,
      (item_map->>v_component.inventory_item_id::text)::uuid,
      v_component.quantity,
      v_component.unit
    );
  end loop;
end;
$$;
