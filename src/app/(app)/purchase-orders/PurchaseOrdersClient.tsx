"use client";

import { useMemo, useState } from "react";
import { PurchaseOrdersTab } from "./PurchaseOrdersTab";
import { SuppliersTab } from "./SuppliersTab";
import type { PurchaseOrderRow, SupplierRow } from "@/lib/domain-types";

type Tab = "pos" | "suppliers";

export function PurchaseOrdersClient({
  suppliers,
  inventoryItems,
  purchaseOrders,
}: {
  suppliers: SupplierRow[];
  inventoryItems: { id: string; name: string; unit: string }[];
  purchaseOrders: PurchaseOrderRow[];
}) {
  const [tab, setTab] = useState<Tab>("pos");
  const [supplierFilter, setSupplierFilter] = useState<string | null>(null);

  const filteredPos = useMemo(
    () => (supplierFilter ? purchaseOrders.filter((po) => po.supplier_id === supplierFilter) : purchaseOrders),
    [purchaseOrders, supplierFilter]
  );

  return (
    <div>
      <div className="flex gap-2 mb-4">
        {(
          [
            ["pos", "Purchase Orders"],
            ["suppliers", "Suppliers"],
          ] as [Tab, string][]
        ).map(([value, label]) => (
          <button
            key={value}
            onClick={() => setTab(value)}
            className={`px-4 py-2 rounded-xl font-medium text-sm ${
              tab === value ? "bg-neutral-800 text-white" : "bg-white text-neutral-600 shadow"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "pos" && (
        <PurchaseOrdersTab
          suppliers={suppliers}
          inventoryItems={inventoryItems}
          purchaseOrders={filteredPos}
          supplierFilter={supplierFilter}
          onClearFilter={() => setSupplierFilter(null)}
        />
      )}
      {tab === "suppliers" && (
        <SuppliersTab
          suppliers={suppliers}
          onViewHistory={(supplierId) => {
            setSupplierFilter(supplierId);
            setTab("pos");
          }}
        />
      )}
    </div>
  );
}
