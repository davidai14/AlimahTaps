import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { CustomerRow, LoyaltySettingsRow, LoyaltyTransactionRow } from "@/lib/domain-types";

export async function getLoyaltySettings(storeId: string): Promise<LoyaltySettingsRow | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("loyalty_settings")
    .select("store_id, enabled, points_per_peso_spent, peso_value_per_point, min_redeem_points")
    .eq("store_id", storeId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data;
}

export async function getCustomers(storeId: string): Promise<CustomerRow[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("customers")
    .select("id, full_name, contact_number, email, loyalty_points_balance, created_at")
    .eq("store_id", storeId)
    .order("full_name");

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getCustomerTransactions(customerId: string): Promise<LoyaltyTransactionRow[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("loyalty_transactions")
    .select("id, customer_id, order_id, type, points, notes, created_at")
    .eq("customer_id", customerId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return data ?? [];
}
