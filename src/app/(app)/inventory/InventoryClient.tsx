"use client";

import { useState } from "react";
import { StockTab } from "./StockTab";
import { CogsReportTab } from "./CogsReportTab";
import type { InventoryItemRow } from "@/lib/domain-types";

type Tab = "stock" | "cogs";

export function InventoryClient({ items }: { items: InventoryItemRow[] }) {
  const [tab, setTab] = useState<Tab>("stock");

  return (
    <div>
      <div className="flex gap-2 mb-4">
        {(
          [
            ["stock", "Stock & Adjustments"],
            ["cogs", "COGS Report"],
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
    </div>
  );
}
