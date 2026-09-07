import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export type MenuItemComponentFull = {
  id: string;
  variant_id: string | null;
  variant_name: string | null;
  inventory_item_id: string;
  inventory_item_name: string;
  quantity: number;
  unit: string;
};

export type MenuItemFull = {
  id: string;
  category_id: string | null;
  category_name: string | null;
  name: string;
  description: string | null;
  price: number;
  is_active: boolean;
  variants: { id: string; name: string; price_delta: number }[];
  components: MenuItemComponentFull[];
};

const MENU_ITEM_SELECT = `
  id, category_id, name, description, price, is_active,
  menu_categories(name),
  menu_item_variants(id, name, price_delta),
  menu_item_components(id, variant_id, quantity, unit, inventory_items(id, name))
`;

type MenuItemRow = {
  id: string;
  category_id: string | null;
  name: string;
  description: string | null;
  price: number;
  is_active: boolean;
  menu_categories: { name: string } | null;
  menu_item_variants: { id: string; name: string; price_delta: number }[];
  menu_item_components: {
    id: string;
    variant_id: string | null;
    quantity: number;
    unit: string;
    inventory_items: { id: string; name: string } | null;
  }[];
};

export async function getMenuItemsFull(storeId: string): Promise<MenuItemFull[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("menu_items")
    .select(MENU_ITEM_SELECT)
    .eq("store_id", storeId)
    .order("name");

  if (error) throw new Error(error.message);

  const rows = (data ?? []) as unknown as MenuItemRow[];
  return rows.map((r) => {
    const variantNameById = new Map(r.menu_item_variants.map((v) => [v.id, v.name]));
    return {
      id: r.id,
      category_id: r.category_id,
      category_name: r.menu_categories?.name ?? null,
      name: r.name,
      description: r.description,
      price: r.price,
      is_active: r.is_active,
      variants: r.menu_item_variants,
      components: r.menu_item_components
        .filter((c) => c.inventory_items)
        .map((c) => ({
          id: c.id,
          variant_id: c.variant_id,
          variant_name: c.variant_id ? variantNameById.get(c.variant_id) ?? null : null,
          inventory_item_id: c.inventory_items!.id,
          inventory_item_name: c.inventory_items!.name,
          quantity: c.quantity,
          unit: c.unit,
        })),
    };
  });
}

export async function getCategoriesLite(storeId: string): Promise<{ id: string; name: string }[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("menu_categories")
    .select("id, name")
    .eq("store_id", storeId)
    .order("sort_order");

  if (error) throw new Error(error.message);
  return data ?? [];
}
