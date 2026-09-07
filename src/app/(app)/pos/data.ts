import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type {
  MenuCategory,
  MenuItem,
  OrderRow,
  RestaurantTable,
} from "@/lib/domain-types";

export async function getMenuData(storeId: string): Promise<{
  categories: MenuCategory[];
  items: MenuItem[];
}> {
  const admin = createAdminClient();

  const [{ data: categories, error: catErr }, { data: items, error: itemErr }] =
    await Promise.all([
      admin
        .from("menu_categories")
        .select("id, name, sort_order")
        .eq("store_id", storeId)
        .order("sort_order"),
      admin
        .from("menu_items")
        .select(
          "id, category_id, name, description, price, image_url, is_active, menu_item_variants(id, name, price_delta)"
        )
        .eq("store_id", storeId)
        .eq("is_active", true)
        .order("name"),
    ]);

  if (catErr) throw new Error(catErr.message);
  if (itemErr) throw new Error(itemErr.message);

  return {
    categories: categories ?? [],
    items: (items ?? []) as unknown as MenuItem[],
  };
}

export async function getTables(storeId: string): Promise<RestaurantTable[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("restaurant_tables")
    .select("id, table_number, capacity, status")
    .eq("store_id", storeId)
    .order("table_number");

  if (error) throw new Error(error.message);
  return data ?? [];
}

const ORDER_SELECT = `
  id, channel, external_reference, table_id, customer_name, customer_contact,
  status, subtotal, discount_type, discount_id_number, discount_amount,
  platform_commission, tax_amount, total_amount, void_reason, created_at, updated_at,
  customer_id, loyalty_points_redeemed, loyalty_discount_amount,
  restaurant_tables(table_number),
  customers(full_name, loyalty_points_balance),
  order_items(id, menu_item_id, variant_id, quantity, unit_price, notes, status,
    menu_items(name), menu_item_variants(name)),
  payments(id, method, amount, reference_number, screenshot_url, verified_by, verified_at, created_at)
`;

// Today's orders not yet fully closed out — what the POS "Active Orders"
// tab shows. Paid/voided/cancelled orders roll off after today.
export async function getActiveOrders(storeId: string): Promise<OrderRow[]> {
  const admin = createAdminClient();
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const { data, error } = await admin
    .from("orders")
    .select(ORDER_SELECT)
    .eq("store_id", storeId)
    .gte("created_at", startOfDay.toISOString())
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as OrderRow[];
}

export async function getOrder(orderId: string): Promise<OrderRow | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("orders")
    .select(ORDER_SELECT)
    .eq("id", orderId)
    .single();

  if (error) return null;
  return data as unknown as OrderRow;
}
