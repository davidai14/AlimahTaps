import { requireModule } from "@/lib/auth/rbac";
import { getKitchenOrders, getTargetPrepTimeMinutes } from "./data";
import { KdsClient } from "./KdsClient";

export default async function KdsPage() {
  await requireModule("kds");
  const [orders, targetPrepTimeMinutes] = await Promise.all([
    getKitchenOrders(),
    getTargetPrepTimeMinutes(),
  ]);

  return <KdsClient initialOrders={orders} targetPrepTimeMinutes={targetPrepTimeMinutes} />;
}
