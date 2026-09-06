"use client";

import { useState, useTransition } from "react";
import { getDashboardDataAction } from "./actions";
import { CHANNEL_LABEL, PAYMENT_METHOD_LABEL } from "@/lib/constants";
import type { DashboardData } from "./data";

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

const PRESETS: { label: string; days: number }[] = [
  { label: "Today", days: 0 },
  { label: "This Week", days: 7 },
  { label: "This Month", days: 30 },
];

function toCsv(data: DashboardData): string {
  const lines: string[] = [];
  lines.push("Metric,Value");
  lines.push(`Gross Sales,${data.grossSales.toFixed(2)}`);
  lines.push(`Net Sales (after commission),${data.netSales.toFixed(2)}`);
  lines.push(`Platform Commission,${data.totalCommission.toFixed(2)}`);
  lines.push(`Discounts Given,${data.totalDiscounts.toFixed(2)}`);
  lines.push(`COGS,${data.cogsTotal.toFixed(2)}`);
  lines.push(`Gross Margin,${(data.grossSales - data.cogsTotal).toFixed(2)}`);
  lines.push(`Labor Cost (estimate),${data.laborCostEstimate.toFixed(2)}`);
  lines.push(`Inventory Valuation,${data.inventoryValuation.toFixed(2)}`);
  lines.push("");
  lines.push("Channel,Orders,Amount");
  for (const c of data.byChannel) lines.push(`${CHANNEL_LABEL[c.channel] ?? c.channel},${c.count},${c.amount.toFixed(2)}`);
  lines.push("");
  lines.push("Payment Method,Amount");
  for (const m of data.byPaymentMethod)
    lines.push(`${PAYMENT_METHOD_LABEL[m.method] ?? m.method},${m.amount.toFixed(2)}`);
  lines.push("");
  lines.push("Menu Item,Quantity Sold,Revenue");
  for (const i of data.itemSales) lines.push(`${i.name},${i.quantity},${i.revenue.toFixed(2)}`);
  lines.push("");
  lines.push("Supplier,PO Spend");
  for (const s of data.supplierSpend) lines.push(`${s.name},${s.amount.toFixed(2)}`);
  return lines.join("\n");
}

function downloadCsv(data: DashboardData, start: string, end: string) {
  const csv = toCsv(data);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `alimah-dashboard-${start}_to_${end}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function DashboardClient({
  initialData,
  initialStart,
  initialEnd,
}: {
  initialData: DashboardData;
  initialStart: string;
  initialEnd: string;
}) {
  const [start, setStart] = useState(initialStart);
  const [end, setEnd] = useState(initialEnd);
  const [data, setData] = useState(initialData);
  const [isPending, startTransition] = useTransition();

  function load(s: string, e: string) {
    startTransition(async () => {
      const res = await getDashboardDataAction(`${s}T00:00:00`, `${e}T23:59:59`);
      setData(res);
    });
  }

  function applyPreset(days: number) {
    const endDate = new Date();
    const startDate = new Date();
    if (days > 0) startDate.setDate(startDate.getDate() - days);
    const s = isoDate(startDate);
    const e = isoDate(endDate);
    setStart(s);
    setEnd(e);
    load(s, e);
  }

  const grossMargin = data.grossSales - data.cogsTotal;
  const marginPct = data.grossSales > 0 ? (grossMargin / data.grossSales) * 100 : 0;
  const laborPct = data.grossSales > 0 ? (data.laborCostEstimate / data.grossSales) * 100 : 0;

  const bestSellers = data.itemSales.slice(0, 5);
  const slowMovers = [...data.itemSales].filter((i) => i.quantity > 0).slice(-5).reverse();

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl shadow p-4 flex flex-wrap items-end gap-3">
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
        <button onClick={() => load(start, end)} className="px-4 py-2 rounded-lg bg-amber-600 text-white text-sm font-medium">
          Apply
        </button>
        <div className="flex-1" />
        <button
          onClick={() => downloadCsv(data, start, end)}
          className="px-4 py-2 rounded-lg bg-neutral-800 text-white text-sm font-medium"
        >
          Export CSV
        </button>
        <button
          onClick={() => window.print()}
          className="px-4 py-2 rounded-lg bg-neutral-100 text-neutral-700 text-sm font-medium"
        >
          Print / Save PDF
        </button>
      </div>

      {isPending && <p className="text-neutral-400 text-sm">Loading...</p>}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Gross Sales" value={`₱${data.grossSales.toFixed(2)}`} highlight />
        <StatCard label="Net Sales (after commission)" value={`₱${data.netSales.toFixed(2)}`} />
        <StatCard label="COGS" value={`₱${data.cogsTotal.toFixed(2)}`} />
        <StatCard label="Gross Margin" value={`₱${grossMargin.toFixed(2)} (${marginPct.toFixed(1)}%)`} />
        <StatCard label="Labor Cost (est.)" value={`₱${data.laborCostEstimate.toFixed(2)} (${laborPct.toFixed(1)}%)`} />
        <StatCard label="Discounts Given" value={`₱${data.totalDiscounts.toFixed(2)}`} />
        <StatCard label="Platform Commission" value={`₱${data.totalCommission.toFixed(2)}`} />
        <StatCard label="Inventory Valuation" value={`₱${data.inventoryValuation.toFixed(2)}`} />
      </div>
      <p className="text-xs text-neutral-400">{data.laborCostAssumptions}</p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Panel title="Sales by Channel">
          {data.byChannel.map((c) => (
            <Row key={c.channel} label={`${CHANNEL_LABEL[c.channel] ?? c.channel} (${c.count})`} value={`₱${c.amount.toFixed(2)}`} />
          ))}
          {data.byChannel.length === 0 && <Empty />}
        </Panel>

        <Panel title="Sales by Payment Method">
          {data.byPaymentMethod.map((m) => (
            <Row key={m.method} label={PAYMENT_METHOD_LABEL[m.method] ?? m.method} value={`₱${m.amount.toFixed(2)}`} />
          ))}
          {data.byPaymentMethod.length === 0 && <Empty />}
        </Panel>

        <Panel title="Best-Selling Items">
          {bestSellers.map((i) => (
            <Row key={i.menuItemId} label={`${i.name} (${i.quantity} sold)`} value={`₱${i.revenue.toFixed(2)}`} />
          ))}
          {bestSellers.length === 0 && <Empty />}
        </Panel>

        <Panel title="Slow-Moving Items">
          {slowMovers.map((i) => (
            <Row key={i.menuItemId} label={`${i.name} (${i.quantity} sold)`} value={`₱${i.revenue.toFixed(2)}`} />
          ))}
          {slowMovers.length === 0 && <Empty />}
        </Panel>

        <Panel title="Low Stock Alerts">
          {data.lowStockItems.map((i) => (
            <Row
              key={i.id}
              label={i.name}
              value={`${i.currentStock.toFixed(2)} / ${i.reorderPoint.toFixed(2)} ${i.unit}`}
              danger
            />
          ))}
          {data.lowStockItems.length === 0 && <p className="text-sm text-neutral-400">All stock above reorder point.</p>}
        </Panel>

        <Panel title="Purchase Order Spend by Supplier">
          {data.supplierSpend.map((s) => (
            <Row key={s.supplierId} label={s.name} value={`₱${s.amount.toFixed(2)}`} />
          ))}
          {data.supplierSpend.length === 0 && <Empty />}
        </Panel>
      </div>
    </div>
  );
}

function StatCard({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-2xl shadow p-4 ${highlight ? "bg-amber-600 text-white" : "bg-white text-neutral-800"}`}>
      <p className={`text-xs ${highlight ? "text-amber-100" : "text-neutral-500"}`}>{label}</p>
      <p className="text-lg font-bold mt-1">{value}</p>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl shadow p-4">
      <p className="text-sm font-medium text-neutral-500 mb-2">{title}</p>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function Row({ label, value, danger }: { label: string; value: string; danger?: boolean }) {
  return (
    <div className={`flex justify-between text-sm ${danger ? "text-red-600 font-medium" : ""}`}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}

function Empty() {
  return <p className="text-sm text-neutral-400">No data in this range.</p>;
}
