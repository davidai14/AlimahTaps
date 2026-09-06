"use client";

import { useState } from "react";
import { ReservationsTab } from "./ReservationsTab";
import { WaitlistTab } from "./WaitlistTab";
import type { ReservationRow, RestaurantTable, WaitlistRow } from "@/lib/domain-types";

type Tab = "reservations" | "waitlist";

export function ReservationsClient({
  reservations,
  waitlist,
  tables,
}: {
  reservations: ReservationRow[];
  waitlist: WaitlistRow[];
  tables: RestaurantTable[];
}) {
  const [tab, setTab] = useState<Tab>("reservations");

  return (
    <div>
      <div className="flex gap-2 mb-4">
        {(
          [
            ["reservations", `Reservations (${reservations.filter((r) => r.status === "pending").length} new)`],
            ["waitlist", `Waitlist (${waitlist.length})`],
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

      {tab === "reservations" && <ReservationsTab reservations={reservations} tables={tables} />}
      {tab === "waitlist" && <WaitlistTab waitlist={waitlist} />}
    </div>
  );
}
