import { requireModule } from "@/lib/auth/rbac";
import { getMenuData, getTables, getActiveOrders } from "./data";
import { PosClient } from "./PosClient";

export default async function PosPage() {
  const session = await requireModule("pos");
  const [{ categories, items }, tables, orders] = await Promise.all([
    getMenuData(),
    getTables(),
    getActiveOrders(),
  ]);

  return (
    <PosClient
      categories={categories}
      items={items}
      tables={tables}
      initialOrders={orders}
      canTakePayments={["owner", "manager", "cashier"].includes(session.role)}
    />
  );
}
