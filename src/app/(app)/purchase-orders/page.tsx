import { requireModule } from "@/lib/auth/rbac";
import { getSuppliers, getInventoryItemsLite, getPurchaseOrders } from "./data";
import { PurchaseOrdersClient } from "./PurchaseOrdersClient";

export default async function PurchaseOrdersPage() {
  await requireModule("purchase_orders");
  const [suppliers, inventoryItems, purchaseOrders] = await Promise.all([
    getSuppliers(),
    getInventoryItemsLite(),
    getPurchaseOrders(),
  ]);

  return (
    <PurchaseOrdersClient
      suppliers={suppliers}
      inventoryItems={inventoryItems}
      purchaseOrders={purchaseOrders}
    />
  );
}
