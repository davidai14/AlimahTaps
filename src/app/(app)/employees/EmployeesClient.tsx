"use client";

import { useState } from "react";
import { DirectoryTab } from "./DirectoryTab";
import { ScheduleTab } from "./ScheduleTab";
import type { EmployeeRow } from "@/lib/domain-types";

type Tab = "directory" | "schedule";

export function EmployeesClient({
  employees,
  canSeePayRate,
}: {
  employees: EmployeeRow[];
  canSeePayRate: boolean;
}) {
  const [tab, setTab] = useState<Tab>("directory");

  return (
    <div>
      <div className="flex gap-2 mb-4">
        {(
          [
            ["directory", "Directory"],
            ["schedule", "Shift Schedule"],
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

      {tab === "directory" && <DirectoryTab employees={employees} canSeePayRate={canSeePayRate} />}
      {tab === "schedule" && <ScheduleTab employees={employees.filter((e) => e.is_active)} />}
    </div>
  );
}
