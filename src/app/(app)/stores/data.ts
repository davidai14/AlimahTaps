import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export type StoreRow = {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  landline: string | null;
  facebook_page: string | null;
  tin: string | null;
  vat_status: "non_vat" | "vat";
  target_prep_time_minutes: number;
  created_at: string;
};

export async function getStores(): Promise<StoreRow[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("stores")
    .select("id, name, address, phone, landline, facebook_page, tin, vat_status, target_prep_time_minutes, created_at")
    .order("created_at");

  if (error) throw new Error(error.message);
  return data ?? [];
}
