-- Bulk menu import (Excel-driven "add items for sale + their inventory
-- components" workflow). Matches categories/items/variants by name
-- (case-insensitive) within the store, creating or updating as needed.
-- Runs as one transaction: any unresolvable inventory item or variant name
-- aborts the whole import so a typo never leaves a partially-imported menu
-- with an incomplete recipe (which would silently under-deduct inventory
-- on sale). The application layer pre-validates the same references with
-- friendlier row-level messages before ever calling this function.

create or replace function import_menu_items(p_store_id uuid, p_payload jsonb)
returns jsonb
language plpgsql
as $$
declare
  v_item jsonb;
  v_variant jsonb;
  v_component jsonb;
  v_category_id uuid;
  v_item_id uuid;
  v_existing_item_id uuid;
  v_variant_id uuid;
  v_inventory_item_id uuid;
  v_variant_ids_kept uuid[];
  v_items_created int := 0;
  v_items_updated int := 0;
  v_categories_created int := 0;
begin
  for v_item in select * from jsonb_array_elements(p_payload->'items')
  loop
    v_category_id := null;
    if coalesce(trim(v_item->>'category'), '') <> '' then
      select id into v_category_id from menu_categories
        where store_id = p_store_id and lower(name) = lower(trim(v_item->>'category'));
      if v_category_id is null then
        insert into menu_categories (store_id, name, sort_order)
          values (p_store_id, trim(v_item->>'category'), 0)
          returning id into v_category_id;
        v_categories_created := v_categories_created + 1;
      end if;
    end if;

    select id into v_existing_item_id from menu_items
      where store_id = p_store_id and lower(name) = lower(trim(v_item->>'name'));

    if v_existing_item_id is null then
      insert into menu_items (store_id, category_id, name, description, price, is_active)
        values (
          p_store_id, v_category_id, trim(v_item->>'name'),
          nullif(trim(v_item->>'description'), ''),
          (v_item->>'price')::numeric,
          coalesce((v_item->>'is_active')::boolean, true)
        )
        returning id into v_item_id;
      v_items_created := v_items_created + 1;
    else
      v_item_id := v_existing_item_id;
      update menu_items set
        category_id = v_category_id,
        description = nullif(trim(v_item->>'description'), ''),
        price = (v_item->>'price')::numeric,
        is_active = coalesce((v_item->>'is_active')::boolean, true),
        updated_at = now()
      where id = v_item_id;
      v_items_updated := v_items_updated + 1;
    end if;

    -- Variants: upsert each named variant, then drop any existing variant
    -- not present in this import (their components cascade-delete).
    v_variant_ids_kept := array[]::uuid[];
    for v_variant in select * from jsonb_array_elements(coalesce(v_item->'variants', '[]'::jsonb))
    loop
      select id into v_variant_id from menu_item_variants
        where menu_item_id = v_item_id and lower(name) = lower(trim(v_variant->>'name'));
      if v_variant_id is null then
        insert into menu_item_variants (menu_item_id, name, price_delta)
          values (v_item_id, trim(v_variant->>'name'), (v_variant->>'price_delta')::numeric)
          returning id into v_variant_id;
      else
        update menu_item_variants set price_delta = (v_variant->>'price_delta')::numeric
          where id = v_variant_id;
      end if;
      v_variant_ids_kept := array_append(v_variant_ids_kept, v_variant_id);
    end loop;
    delete from menu_item_variants
      where menu_item_id = v_item_id
        and not (id = any(v_variant_ids_kept));

    -- Components: this import's component list becomes the item's complete
    -- recipe/BOM — wipe and rebuild rather than merge, so removing a row
    -- from the sheet actually removes it from the recipe.
    delete from menu_item_components where menu_item_id = v_item_id;
    for v_component in select * from jsonb_array_elements(coalesce(v_item->'components', '[]'::jsonb))
    loop
      select id into v_inventory_item_id from inventory_items
        where store_id = p_store_id and lower(name) = lower(trim(v_component->>'inventory_item'));
      if v_inventory_item_id is null then
        raise exception 'Inventory item "%" not found for menu item "%"',
          v_component->>'inventory_item', v_item->>'name';
      end if;

      v_variant_id := null;
      if coalesce(trim(v_component->>'variant'), '') <> '' then
        select id into v_variant_id from menu_item_variants
          where menu_item_id = v_item_id and lower(name) = lower(trim(v_component->>'variant'));
        if v_variant_id is null then
          raise exception 'Variant "%" not found for menu item "%"',
            v_component->>'variant', v_item->>'name';
        end if;
      end if;

      insert into menu_item_components (menu_item_id, variant_id, inventory_item_id, quantity, unit)
        values (
          v_item_id, v_variant_id, v_inventory_item_id,
          (v_component->>'quantity')::numeric, v_component->>'unit'
        );
    end loop;
  end loop;

  return jsonb_build_object(
    'items_created', v_items_created,
    'items_updated', v_items_updated,
    'categories_created', v_categories_created
  );
end;
$$;
