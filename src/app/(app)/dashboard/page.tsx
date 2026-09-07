import { requireModule } from "@/lib/auth/rbac";
import { getEffectiveStoreId } from "@/lib/auth/store-scope";
import { getDashboardData } from "./data";
import { DashboardClient } from "./DashboardClient";

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

export default async function DashboardPage() {
  const session = await requireModule("dashboard");
  const storeId = await getEffectiveStoreId(session);
  const today = isoDate(new Date());
  const initialData = await getDashboardData(storeId, `${today}T00:00:00`, `${today}T23:59:59`);

  return <DashboardClient initialData={initialData} initialStart={today} initialEnd={today} />;
}
