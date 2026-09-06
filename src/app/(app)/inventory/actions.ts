"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireModule } from "@/lib/auth/rbac";
import { getCogsReport } from "./data";

export async function getCogsReportAction(startDate: string, endDate: string) {
  await requireModule("inventory");
  return getCogsReport(startDate, endDate);
}

const REASON_CODES = ["spoilage", "breakage", "correction", "waste", "other"] as const;

export async function adjustInventoryStock(
  inventoryItemId: string,
  quantityChange: number,
  reasonCode: string
): Promise<{ error?: string }> {
  const session = await requireModule("inventory");

  if (quantityChange === 0) return { error: "Enter a non-zero quantity." };
  if (!REASON_CODES.includes(reasonCode as (typeof REASON_CODES)[number])) {
    return { error: "Choose a reason." };
  }

  const admin = createAdminClient();
  const { error } = await admin.rpc("adjust_inventory_stock", {
    p_inventory_item_id: inventoryItemId,
    p_quantity_change: quantityChange,
    p_reason_code: reasonCode,
    p_employee_id: session.employeeId,
  });

  if (error) return { error: error.message };
  revalidatePath("/inventory");
  return {};
}
