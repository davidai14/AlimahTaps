import { requireModule } from "@/lib/auth/rbac";
import { getDashboardData } from "./data";
import { DashboardClient } from "./DashboardClient";

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

export default async function DashboardPage() {
  await requireModule("dashboard");
  const today = isoDate(new Date());
  const initialData = await getDashboardData(`${today}T00:00:00`, `${today}T23:59:59`);

  return <DashboardClient initialData={initialData} initialStart={today} initialEnd={today} />;
}
