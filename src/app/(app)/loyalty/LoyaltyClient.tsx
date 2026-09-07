"use client";

import { useState } from "react";
import { CustomersTab } from "./CustomersTab";
import { SettingsTab } from "./SettingsTab";
import type { CustomerRow, LoyaltySettingsRow } from "@/lib/domain-types";

type Tab = "customers" | "settings";

export function LoyaltyClient({
  settings,
  customers,
  isOwner,
}: {
  settings: LoyaltySettingsRow | null;
  customers: CustomerRow[];
  isOwner: boolean;
}) {
  const [tab, setTab] = useState<Tab>("customers");
  const programEnabled = settings?.enabled ?? false;

  return (
    <div>
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setTab("customers")}
          className={`px-4 py-2 rounded-xl font-medium text-sm ${
            tab === "customers" ? "bg-neutral-800 text-white" : "bg-white text-neutral-600 shadow"
          }`}
        >
          Customers
        </button>
        {isOwner && (
          <button
            onClick={() => setTab("settings")}
            className={`px-4 py-2 rounded-xl font-medium text-sm ${
              tab === "settings" ? "bg-neutral-800 text-white" : "bg-white text-neutral-600 shadow"
            }`}
          >
            Loyalty Settings
          </button>
        )}
        <span
          className={`ml-auto self-center text-xs font-semibold px-3 py-1.5 rounded-full ${
            programEnabled ? "bg-green-100 text-green-700" : "bg-neutral-200 text-neutral-600"
          }`}
        >
          Loyalty program: {programEnabled ? "Enabled" : "Disabled"}
        </span>
      </div>

      {tab === "customers" && <CustomersTab customers={customers} programEnabled={programEnabled} />}
      {tab === "settings" && isOwner && <SettingsTab settings={settings} />}
    </div>
  );
}
