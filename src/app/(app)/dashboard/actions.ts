"use server";

import { requireModule } from "@/lib/auth/rbac";
import { getDashboardData } from "./data";

export async function getDashboardDataAction(startDate: string, endDate: string) {
  await requireModule("dashboard");
  return getDashboardData(startDate, endDate);
}
