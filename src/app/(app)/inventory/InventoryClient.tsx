"use client";

import { useState } from "react";
import { StockTab } from "./StockTab";
import { CogsReportTab } from "./CogsReportTab";
import { MenuItemsTab } from "./MenuItemsTab";
import type { InventoryItemRow } from "@/lib/domain-types";
import type { MenuItemFull } from "./menu-data";

type Tab = "stock" | "cogs" | "menu";

export function InventoryClient({ items, menuItems }: { items: InventoryItemRow[]; menuItems: MenuItemFull[] }) {
  const [tab, setTab] = useState<Tab>("stock");

  return (
    <div>
      <div className="flex gap-2 mb-4">
        {(
          [
            ["stock", "Stock & Adjustments"],
            ["cogs", "COGS Report"],
            ["menu", "Menu Items"],
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

      {tab === "stock" && <StockTab items={items} />}
      {tab === "cogs" && <CogsReportTab />}
      {tab === "menu" && <MenuItemsTab items={menuItems} />}
    </div>
  );
}
