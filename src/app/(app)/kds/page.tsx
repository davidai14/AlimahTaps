import { requireModule } from "@/lib/auth/rbac";
import { getEffectiveStoreId } from "@/lib/auth/store-scope";
import { getKitchenOrders, getTargetPrepTimeMinutes } from "./data";
import { KdsClient } from "./KdsClient";

export default async function KdsPage() {
  const session = await requireModule("kds");
  const storeId = await getEffectiveStoreId(session);
  const [orders, targetPrepTimeMinutes] = await Promise.all([
    getKitchenOrders(storeId),
    getTargetPrepTimeMinutes(storeId),
  ]);

  return <KdsClient initialOrders={orders} targetPrepTimeMinutes={targetPrepTimeMinutes} />;
}
