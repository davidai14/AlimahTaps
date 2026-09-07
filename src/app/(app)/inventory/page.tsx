import { requireModule } from "@/lib/auth/rbac";
import { getEffectiveStoreId } from "@/lib/auth/store-scope";
import { getInventoryItems } from "./data";
import { InventoryClient } from "./InventoryClient";

export default async function InventoryPage() {
  const session = await requireModule("inventory");
  const storeId = await getEffectiveStoreId(session);
  const items = await getInventoryItems(storeId);
  return <InventoryClient items={items} />;
}
