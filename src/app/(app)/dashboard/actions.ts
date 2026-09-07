"use server";

import { requireModule } from "@/lib/auth/rbac";
import { getEffectiveStoreId } from "@/lib/auth/store-scope";
import { getDashboardData } from "./data";

export async function getDashboardDataAction(startDate: string, endDate: string) {
  const session = await requireModule("dashboard");
  const storeId = await getEffectiveStoreId(session);
  return getDashboardData(storeId, startDate, endDate);
}
