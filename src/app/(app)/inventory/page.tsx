import { requireModule } from "@/lib/auth/rbac";
import { getInventoryItems } from "./data";
import { InventoryClient } from "./InventoryClient";

export default async function InventoryPage() {
  await requireModule("inventory");
  const items = await getInventoryItems();
  return <InventoryClient items={items} />;
}
