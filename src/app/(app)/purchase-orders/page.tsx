import { requireModule } from "@/lib/auth/rbac";
import { getSuppliers, getSupplierItems, getInventoryItemsLite, getPurchaseOrders } from "./data";
import { PurchaseOrdersClient } from "./PurchaseOrdersClient";

export default async function PurchaseOrdersPage() {
  await requireModule("purchase_orders");
  const [suppliers, supplierItems, inventoryItems, purchaseOrders] = await Promise.all([
    getSuppliers(),
    getSupplierItems(),
    getInventoryItemsLite(),
    getPurchaseOrders(),
  ]);

  return (
    <PurchaseOrdersClient
      suppliers={suppliers}
      supplierItems={supplierItems}
      inventoryItems={inventoryItems}
      purchaseOrders={purchaseOrders}
    />
  );
}
