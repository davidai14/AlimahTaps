"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireModule } from "@/lib/auth/rbac";
import { DEFAULT_STORE_ID } from "@/lib/constants";
import type { PoStatus } from "@/lib/domain-types";

export async function createSupplier(input: {
  name: string;
  contactPerson: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
}): Promise<{ error?: string }> {
  await requireModule("purchase_orders");
  if (!input.name.trim()) return { error: "Supplier name is required." };

  const admin = createAdminClient();
  const { error } = await admin.from("suppliers").insert({
    store_id: DEFAULT_STORE_ID,
    name: input.name,
    contact_person: input.contactPerson,
    phone: input.phone,
    email: input.email,
    address: input.address,
  });
  if (error) return { error: error.message };

  revalidatePath("/purchase-orders");
  return {};
}

export type NewPoItemInput = { inventoryItemId: string; quantity: number; unitCost: number };

export async function createPurchaseOrder(input: {
  supplierId: string;
  expectedDate: string | null;
  notes: string | null;
  items: NewPoItemInput[];
}): Promise<{ error?: string; purchaseOrderId?: string }> {
  const session = await requireModule("purchase_orders");
  if (!input.supplierId) return { error: "Choose a supplier." };
  if (input.items.length === 0) return { error: "Add at least one line item." };

  const admin = createAdminClient();
  const totalCost = input.items.reduce((s, i) => s + i.quantity * i.unitCost, 0);

  const { data: po, error } = await admin
    .from("purchase_orders")
    .insert({
      store_id: DEFAULT_STORE_ID,
      supplier_id: input.supplierId,
      status: "draft" as PoStatus,
      expected_date: input.expectedDate,
      notes: input.notes,
      total_cost: totalCost,
      created_by: session.employeeId,
    })
    .select("id")
    .single();

  if (error || !po) return { error: error?.message ?? "Could not create purchase order." };

  const { error: itemsError } = await admin.from("purchase_order_items").insert(
    input.items.map((i) => ({
      purchase_order_id: po.id,
      inventory_item_id: i.inventoryItemId,
      quantity_ordered: i.quantity,
      unit_cost: i.unitCost,
    }))
  );
  if (itemsError) return { error: itemsError.message };

  revalidatePath("/purchase-orders");
  return { purchaseOrderId: po.id };
}

export async function setPurchaseOrderStatus(
  purchaseOrderId: string,
  status: Extract<PoStatus, "sent" | "cancelled">
): Promise<{ error?: string }> {
  await requireModule("purchase_orders");
  const admin = createAdminClient();
  const { error } = await admin.from("purchase_orders").update({ status }).eq("id", purchaseOrderId);
  if (error) return { error: error.message };

  revalidatePath("/purchase-orders");
  return {};
}

export async function receivePurchaseOrderItem(
  purchaseOrderItemId: string,
  quantity: number
): Promise<{ error?: string }> {
  const session = await requireModule("purchase_orders");
  if (quantity <= 0) return { error: "Enter a quantity greater than zero." };

  const admin = createAdminClient();
  const { error } = await admin.rpc("receive_purchase_order_item", {
    p_po_item_id: purchaseOrderItemId,
    p_receive_qty: quantity,
    p_employee_id: session.employeeId,
  });
  if (error) return { error: error.message };

  revalidatePath("/purchase-orders");
  revalidatePath("/inventory");
  return {};
}
