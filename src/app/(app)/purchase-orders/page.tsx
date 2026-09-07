import { requireModule } from "@/lib/auth/rbac";
import { getEffectiveStoreId } from "@/lib/auth/store-scope";
import { getSuppliers, getSupplierItems, getInventoryItemsLite, getPurchaseOrders } from "./data";
import { PurchaseOrdersClient } from "./PurchaseOrdersClient";

export default async function PurchaseOrdersPage() {
  const session = await requireModule("purchase_orders");
  const storeId = await getEffectiveStoreId(session);
  const [suppliers, supplierItems, inventoryItems, purchaseOrders] = await Promise.all([
    getSuppliers(storeId),
    getSupplierItems(storeId),
    getInventoryItemsLite(storeId),
    getPurchaseOrders(storeId),
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
