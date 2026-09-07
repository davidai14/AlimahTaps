"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireModule } from "@/lib/auth/rbac";
import { setActiveStore } from "@/lib/auth/store-scope";

export type NewStoreInput = {
  name: string;
  address: string | null;
  phone: string | null;
  landline: string | null;
  vatStatus: "non_vat" | "vat";
  cloneFromStoreId: string | null;
};

export async function createStore(input: NewStoreInput): Promise<{ error?: string; storeId?: string }> {
  await requireModule("stores");
  if (!input.name.trim()) return { error: "Branch name is required." };

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("stores")
    .insert({
      name: input.name,
      address: input.address,
      phone: input.phone,
      landline: input.landline,
      vat_status: input.vatStatus,
    })
    .select("id")
    .single();

  if (error || !data) return { error: error?.message ?? "Could not create branch." };

  if (input.cloneFromStoreId) {
    const { error: cloneError } = await admin.rpc("clone_store_menu_and_inventory", {
      p_source_store_id: input.cloneFromStoreId,
      p_target_store_id: data.id,
    });
    if (cloneError) {
      return { error: `Branch created, but cloning the menu/inventory failed: ${cloneError.message}` };
    }
  }

  revalidatePath("/stores");
  return { storeId: data.id };
}

export async function updateStore(
  storeId: string,
  patch: {
    name?: string;
    address?: string | null;
    phone?: string | null;
    landline?: string | null;
    vatStatus?: "non_vat" | "vat";
    targetPrepTimeMinutes?: number;
  }
): Promise<{ error?: string }> {
  await requireModule("stores");
  const admin = createAdminClient();

  const update: Record<string, unknown> = {};
  if (patch.name !== undefined) update.name = patch.name;
  if (patch.address !== undefined) update.address = patch.address;
  if (patch.phone !== undefined) update.phone = patch.phone;
  if (patch.landline !== undefined) update.landline = patch.landline;
  if (patch.vatStatus !== undefined) update.vat_status = patch.vatStatus;
  if (patch.targetPrepTimeMinutes !== undefined) update.target_prep_time_minutes = patch.targetPrepTimeMinutes;

  const { error } = await admin.from("stores").update(update).eq("id", storeId);
  if (error) return { error: error.message };

  revalidatePath("/stores");
  return {};
}

// Owner-only branch switcher — see lib/auth/store-scope.ts for why this is
// safe (only ever honored server-side for the owner role).
export async function switchActiveStore(storeId: string): Promise<{ error?: string }> {
  const session = await requireModule("stores");
  if (session.role !== "owner") return { error: "Only the owner can switch branches." };

  await setActiveStore(storeId);
  revalidatePath("/", "layout");
  return {};
}
