import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { DEFAULT_STORE_ID } from "@/lib/constants";
import type { OrderRow } from "@/lib/domain-types";

const KITCHEN_ORDER_SELECT = `
  id, channel, external_reference, table_id, customer_name, customer_contact,
  status, subtotal, discount_type, discount_id_number, discount_amount,
  platform_commission, tax_amount, total_amount, void_reason, created_at, updated_at,
  restaurant_tables(table_number),
  order_items(id, menu_item_id, variant_id, quantity, unit_price, notes, status,
    menu_items(name), menu_item_variants(name)),
  payments(id, method, amount, reference_number, screenshot_url, verified_by, verified_at, created_at)
`;

export async function getKitchenOrders(): Promise<OrderRow[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("orders")
    .select(KITCHEN_ORDER_SELECT)
    .eq("store_id", DEFAULT_STORE_ID)
    .in("status", ["pending", "preparing", "ready"])
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as OrderRow[];
}

export async function getTargetPrepTimeMinutes(): Promise<number> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("stores")
    .select("target_prep_time_minutes")
    .eq("id", DEFAULT_STORE_ID)
    .single();
  return data?.target_prep_time_minutes ?? 15;
}
