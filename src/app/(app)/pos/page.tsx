import { requireModule } from "@/lib/auth/rbac";
import { getEffectiveStoreId } from "@/lib/auth/store-scope";
import { getLoyaltySettings } from "@/app/(app)/loyalty/data";
import { getMenuData, getTables, getActiveOrders } from "./data";
import { PosClient } from "./PosClient";

export default async function PosPage() {
  const session = await requireModule("pos");
  const storeId = await getEffectiveStoreId(session);
  const [{ categories, items }, tables, orders, loyaltySettings] = await Promise.all([
    getMenuData(storeId),
    getTables(storeId),
    getActiveOrders(storeId),
    getLoyaltySettings(storeId),
  ]);

  return (
    <PosClient
      categories={categories}
      items={items}
      tables={tables}
      initialOrders={orders}
      canTakePayments={["owner", "manager", "cashier"].includes(session.role)}
      loyalty={
        loyaltySettings?.enabled
          ? {
              pesoValuePerPoint: loyaltySettings.peso_value_per_point ?? 0,
              minRedeemPoints: loyaltySettings.min_redeem_points,
            }
          : null
      }
    />
  );
}
