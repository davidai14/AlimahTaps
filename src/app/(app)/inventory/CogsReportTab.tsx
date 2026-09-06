"use client";

import { useEffect, useState, useTransition } from "react";
import { getCogsReportAction } from "./actions";
import type { CogsRow } from "./data";

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

const PRESETS = [
  { label: "Today", days: 0 },
  { label: "Last 7 Days", days: 7 },
  { label: "Last 30 Days", days: 30 },
];

export function CogsReportTab() {
  const [start, setStart] = useState(() => isoDate(new Date()));
  const [end, setEnd] = useState(() => isoDate(new Date()));
  const [report, setReport] = useState<{ byItem: CogsRow[]; totalCost: number } | null>(null);
  const [isPending, startTransition] = useTransition();

  function load(startDate: string, endDate: string) {
    startTransition(async () => {
      const res = await getCogsReportAction(`${startDate}T00:00:00`, `${endDate}T23:59:59`);
      setReport(res);
    });
  }

  useEffect(() => {
    load(start, end);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function applyPreset(days: number) {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    setStart(isoDate(startDate));
    setEnd(isoDate(endDate));
    load(isoDate(startDate), isoDate(endDate));
  }

  return (
    <div>
      <div className="bg-white rounded-2xl shadow p-4 mb-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex gap-2">
            {PRESETS.map((p) => (
              <button
                key={p.label}
                onClick={() => applyPreset(p.days)}
                className="px-3 py-2 rounded-lg text-sm font-medium bg-neutral-100 hover:bg-amber-100"
              >
                {p.label}
              </button>
            ))}
          </div>
          <div className="flex items-end gap-2">
            <label className="text-xs text-neutral-500">
              From
              <input
                type="date"
                value={start}
                onChange={(e) => setStart(e.target.value)}
                className="block rounded-lg border border-neutral-300 px-2 py-1.5 text-sm"
              />
            </label>
            <label className="text-xs text-neutral-500">
              To
              <input
                type="date"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
                className="block rounded-lg border border-neutral-300 px-2 py-1.5 text-sm"
              />
            </label>
            <button
              onClick={() => load(start, end)}
              className="px-4 py-2 rounded-lg bg-amber-600 text-white text-sm font-medium"
            >
              Apply
            </button>
          </div>
        </div>
      </div>

      {isPending && <p className="text-neutral-400 text-sm">Loading...</p>}

      {report && !isPending && (
        <>
          <div className="bg-amber-600 text-white rounded-2xl shadow p-4 mb-4 w-fit">
            <p className="text-xs text-amber-100">Total COGS ({start} to {end})</p>
            <p className="text-2xl font-bold">₱{report.totalCost.toFixed(2)}</p>
          </div>

          <div className="bg-white rounded-2xl shadow overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-neutral-500 border-b border-neutral-100">
                  <th className="px-4 py-3">Inventory Item</th>
                  <th className="px-4 py-3">Quantity Consumed</th>
                  <th className="px-4 py-3">Cost</th>
                </tr>
              </thead>
              <tbody>
                {report.byItem.map((row) => (
                  <tr key={row.inventoryItemId} className="border-b border-neutral-50">
                    <td className="px-4 py-3 font-medium text-neutral-800">{row.name}</td>
                    <td className="px-4 py-3">
                      {row.quantity.toFixed(3)} {row.unit}
                    </td>
                    <td className="px-4 py-3">₱{row.cost.toFixed(2)}</td>
                  </tr>
                ))}
                {report.byItem.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-4 py-6 text-center text-neutral-400">
                      No sales in this range.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
