"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireModule } from "@/lib/auth/rbac";
import { getEffectiveStoreId } from "@/lib/auth/store-scope";
import { getInventoryItems } from "./data";
import { parseMenuWorkbook, validateAndBuildPayload } from "./menu-xlsx";

export type MenuImportResult = {
  error?: string;
  errors?: string[];
  summary?: { itemsCreated: number; itemsUpdated: number; categoriesCreated: number };
};

export async function uploadMenuWorkbook(formData: FormData): Promise<MenuImportResult> {
  const session = await requireModule("inventory");
  const storeId = await getEffectiveStoreId(session);

  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) return { error: "No file selected." };

  const buffer = Buffer.from(await file.arrayBuffer());
  const parsed = await parseMenuWorkbook(buffer);
  if (parsed.error) return { error: parsed.error };

  if (parsed.items.length === 0) {
    return { error: "No rows found in the Items sheet." };
  }

  const inventoryItems = await getInventoryItems(storeId);
  const { payload, errors } = validateAndBuildPayload(parsed, inventoryItems);
  if (errors.length > 0) return { errors };

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("import_menu_items", {
    p_store_id: storeId,
    p_payload: payload,
  });
  if (error) return { error: error.message };

  revalidatePath("/inventory");
  revalidatePath("/pos");
  return {
    summary: {
      itemsCreated: data?.items_created ?? 0,
      itemsUpdated: data?.items_updated ?? 0,
      categoriesCreated: data?.categories_created ?? 0,
    },
  };
}

export async function toggleMenuItemActive(itemId: string, isActive: boolean): Promise<{ error?: string }> {
  await requireModule("inventory");
  const admin = createAdminClient();
  const { error } = await admin
    .from("menu_items")
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq("id", itemId);

  if (error) return { error: error.message };
  revalidatePath("/inventory");
  revalidatePath("/pos");
  return {};
}
