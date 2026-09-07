"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireModule } from "@/lib/auth/rbac";
import { getEffectiveStoreId } from "@/lib/auth/store-scope";
import { getCustomerTransactions } from "./data";

export async function getCustomerTransactionsAction(customerId: string) {
  await requireModule("loyalty");
  return getCustomerTransactions(customerId);
}

// Loyalty rates are money logic (spec instruction 8: never invent this) —
// only the owner may set them, same posture as payroll. The program cannot
// be enabled until both rates are set to a positive number.
export async function updateLoyaltySettings(input: {
  enabled: boolean;
  pointsPerPesoSpent: number | null;
  pesoValuePerPoint: number | null;
  minRedeemPoints: number;
}): Promise<{ error?: string }> {
  const session = await requireModule("loyalty");
  if (session.role !== "owner") return { error: "Only the owner can change loyalty program rates." };

  const storeId = await getEffectiveStoreId(session);

  if (input.enabled) {
    if (!input.pointsPerPesoSpent || input.pointsPerPesoSpent <= 0) {
      return { error: "Set a positive points-earned-per-peso rate before enabling the program." };
    }
    if (!input.pesoValuePerPoint || input.pesoValuePerPoint <= 0) {
      return { error: "Set a positive peso-value-per-point rate before enabling the program." };
    }
  }

  const admin = createAdminClient();
  const { error } = await admin.from("loyalty_settings").upsert({
    store_id: storeId,
    enabled: input.enabled,
    points_per_peso_spent: input.pointsPerPesoSpent,
    peso_value_per_point: input.pesoValuePerPoint,
    min_redeem_points: input.minRedeemPoints,
    updated_at: new Date().toISOString(),
  });
  if (error) return { error: error.message };

  revalidatePath("/loyalty");
  return {};
}

export async function createCustomer(input: {
  fullName: string;
  contactNumber: string;
  email: string | null;
}): Promise<{ error?: string; customerId?: string }> {
  const session = await requireModule("loyalty");
  const storeId = await getEffectiveStoreId(session);

  if (!input.fullName.trim()) return { error: "Name is required." };
  if (!input.contactNumber.trim()) return { error: "Contact number is required." };

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("customers")
    .insert({
      store_id: storeId,
      full_name: input.fullName,
      contact_number: input.contactNumber,
      email: input.email,
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") return { error: "A customer with this contact number already exists." };
    return { error: error.message };
  }

  revalidatePath("/loyalty");
  return { customerId: data.id };
}

export async function adjustCustomerPoints(
  customerId: string,
  pointsChange: number,
  notes: string
): Promise<{ error?: string }> {
  const session = await requireModule("loyalty");
  const storeId = await getEffectiveStoreId(session);
  if (pointsChange === 0) return { error: "Enter a non-zero point amount." };
  if (!notes.trim()) return { error: "A reason is required for manual point adjustments." };

  const admin = createAdminClient();
  const { data: customer, error: custError } = await admin
    .from("customers")
    .select("loyalty_points_balance")
    .eq("id", customerId)
    .single();
  if (custError || !customer) return { error: "Customer not found." };

  const newBalance = customer.loyalty_points_balance + pointsChange;
  if (newBalance < 0) return { error: "This would take the customer's balance below zero." };

  const { error } = await admin
    .from("customers")
    .update({ loyalty_points_balance: newBalance })
    .eq("id", customerId);
  if (error) return { error: error.message };

  await admin.from("loyalty_transactions").insert({
    store_id: storeId,
    customer_id: customerId,
    type: "adjustment",
    points: pointsChange,
    notes,
    created_by: session.employeeId,
  });

  revalidatePath("/loyalty");
  return {};
}
