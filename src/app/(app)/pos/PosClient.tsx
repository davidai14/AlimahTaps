"use client";

import { useState } from "react";
import { NewOrderTab } from "./NewOrderTab";
import { OrdersTab } from "./OrdersTab";
import { ClosingReport } from "./ClosingReport";
import type { MenuCategory, MenuItem, OrderRow, RestaurantTable } from "@/lib/domain-types";

type Tab = "new" | "active" | "report";

export function PosClient({
  categories,
  items,
  tables,
  initialOrders,
  canTakePayments,
}: {
  categories: MenuCategory[];
  items: MenuItem[];
  tables: RestaurantTable[];
  initialOrders: OrderRow[];
  canTakePayments: boolean;
}) {
  const [tab, setTab] = useState<Tab>("new");

  return (
    <div>
      <div className="flex gap-2 mb-4">
        {(
          [
            ["new", "New Order"],
            ["active", "Active Orders"],
            ["report", "Closing Report"],
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

      {tab === "new" && (
        <NewOrderTab
          categories={categories}
          items={items}
          tables={tables}
          onOrderCreated={() => setTab("active")}
        />
      )}
      {tab === "active" && <OrdersTab orders={initialOrders} canTakePayments={canTakePayments} />}
      {tab === "report" && <ClosingReport orders={initialOrders} />}
    </div>
  );
}
