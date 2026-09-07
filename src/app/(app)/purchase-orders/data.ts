import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { PurchaseOrderRow, SupplierRow } from "@/lib/domain-types";

export async function getSuppliers(storeId: string): Promise<SupplierRow[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("suppliers")
    .select("id, name, contact_person, phone, email, address")
    .eq("store_id", storeId)
    .order("name");

  if (error) throw new Error(error.message);
  return data ?? [];
}

export type SupplierItemRow = {
  id: string;
  supplier_id: string;
  inventory_item_id: string;
  agreed_price: number | null;
  inventory_items: { name: string; unit: string } | null;
};

// Spec 4.4: supplier directory shows "items supplied, agreed pricing".
// supplier_items has no store_id of its own, so scope via an inner join on
// its parent supplier's store_id.
export async function getSupplierItems(storeId: string): Promise<SupplierItemRow[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("supplier_items")
    .select("id, supplier_id, inventory_item_id, agreed_price, inventory_items(name, unit), suppliers!inner(store_id)")
    .eq("suppliers.store_id", storeId);

  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as SupplierItemRow[];
}

export async function getInventoryItemsLite(storeId: string): Promise<{ id: string; name: string; unit: string }[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("inventory_items")
    .select("id, name, unit")
    .eq("store_id", storeId)
    .order("name");

  if (error) throw new Error(error.message);
  return data ?? [];
}

const PO_SELECT = `
  id, supplier_id, status, order_date, expected_date, notes, total_cost, created_at,
  suppliers(name),
  purchase_order_items(id, inventory_item_id, quantity_ordered, quantity_received, unit_cost,
    inventory_items(name, unit))
`;

export async function getPurchaseOrders(storeId: string): Promise<PurchaseOrderRow[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("purchase_orders")
    .select(PO_SELECT)
    .eq("store_id", storeId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as PurchaseOrderRow[];
}
