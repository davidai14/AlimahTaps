import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { InventoryItemRow } from "@/lib/domain-types";

export async function getInventoryItems(storeId: string): Promise<InventoryItemRow[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("inventory_items")
    .select("id, name, unit, current_stock, weighted_avg_cost, reorder_point, updated_at")
    .eq("store_id", storeId)
    .order("name");

  if (error) throw new Error(error.message);
  return data ?? [];
}

export type CogsRow = { inventoryItemId: string; name: string; unit: string; quantity: number; cost: number };

// COGS = sum of every sale_deduction transaction's cost in the window,
// i.e. Σ(component quantity × weighted-avg unit cost at time of sale) —
// exactly the formula in spec 4.3.
export async function getCogsReport(storeId: string, startDate: string, endDate: string): Promise<{
  byItem: CogsRow[];
  totalCost: number;
}> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("inventory_transactions")
    .select("inventory_item_id, quantity_change, unit_cost, inventory_items(name, unit)")
    .eq("store_id", storeId)
    .eq("type", "sale_deduction")
    .gte("created_at", startDate)
    .lte("created_at", endDate);

  if (error) throw new Error(error.message);

  const byItemMap = new Map<string, CogsRow>();
  for (const txn of data ?? []) {
    const item = txn.inventory_items as unknown as { name: string; unit: string } | null;
    const qty = -txn.quantity_change; // stored negative
    const cost = qty * txn.unit_cost;
    const existing = byItemMap.get(txn.inventory_item_id);
    if (existing) {
      existing.quantity += qty;
      existing.cost += cost;
    } else {
      byItemMap.set(txn.inventory_item_id, {
        inventoryItemId: txn.inventory_item_id,
        name: item?.name ?? "Unknown",
        unit: item?.unit ?? "",
        quantity: qty,
        cost,
      });
    }
  }

  const byItem = [...byItemMap.values()].sort((a, b) => b.cost - a.cost);
  const totalCost = byItem.reduce((s, r) => s + r.cost, 0);
  return { byItem, totalCost };
}
