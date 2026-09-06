"use client";

import { useMemo } from "react";
import { CHANNEL_LABEL, PAYMENT_METHOD_LABEL } from "@/lib/constants";
import type { OrderRow } from "@/lib/domain-types";

export function ClosingReport({ orders }: { orders: OrderRow[] }) {
  const stats = useMemo(() => {
    const valid = orders.filter((o) => !["voided", "cancelled"].includes(o.status));
    const voided = orders.filter((o) => o.status === "voided");

    const grossSales = valid.reduce((s, o) => s + o.total_amount, 0);
    const totalCommission = valid.reduce((s, o) => s + o.platform_commission, 0);
    const totalDiscounts = valid.reduce((s, o) => s + o.discount_amount, 0);
    const voidedAmount = voided.reduce((s, o) => s + o.total_amount, 0);

    const byChannel = new Map<string, { count: number; amount: number }>();
    for (const o of valid) {
      const cur = byChannel.get(o.channel) ?? { count: 0, amount: 0 };
      byChannel.set(o.channel, { count: cur.count + 1, amount: cur.amount + o.total_amount });
    }

    const byMethod = new Map<string, number>();
    for (const o of valid) {
      for (const p of o.payments) {
        byMethod.set(p.method, (byMethod.get(p.method) ?? 0) + p.amount);
      }
    }

    return {
      grossSales,
      netSales: grossSales - totalCommission,
      totalCommission,
      totalDiscounts,
      voidedCount: voided.length,
      voidedAmount,
      byChannel,
      byMethod,
    };
  }, [orders]);

  return (
    <div className="space-y-4 max-w-2xl">
      <h2 className="font-semibold text-neutral-800">Today&apos;s Closing Report</h2>

      <div className="grid grid-cols-2 gap-3">
        <StatCard label="Gross Sales" value={stats.grossSales} highlight />
        <StatCard label="Net Sales (after commission)" value={stats.netSales} />
        <StatCard label="Discounts Given" value={stats.totalDiscounts} />
        <StatCard label="Platform Commission" value={stats.totalCommission} />
      </div>

      <div className="bg-white rounded-2xl shadow p-4">
        <p className="text-sm font-medium text-neutral-500 mb-2">By Channel</p>
        <div className="space-y-1">
          {[...stats.byChannel.entries()].map(([channel, v]) => (
            <div key={channel} className="flex justify-between text-sm">
              <span>
                {CHANNEL_LABEL[channel]} ({v.count})
              </span>
              <span>₱{v.amount.toFixed(2)}</span>
            </div>
          ))}
          {stats.byChannel.size === 0 && <p className="text-sm text-neutral-400">No sales yet today.</p>}
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow p-4">
        <p className="text-sm font-medium text-neutral-500 mb-2">By Payment Method</p>
        <div className="space-y-1">
          {[...stats.byMethod.entries()].map(([method, amount]) => (
            <div key={method} className="flex justify-between text-sm">
              <span>{PAYMENT_METHOD_LABEL[method]}</span>
              <span>₱{amount.toFixed(2)}</span>
            </div>
          ))}
          {stats.byMethod.size === 0 && <p className="text-sm text-neutral-400">No payments recorded yet.</p>}
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow p-4">
        <p className="text-sm font-medium text-neutral-500 mb-2">Voided Orders</p>
        <p className="text-sm">
          {stats.voidedCount} order(s), ₱{stats.voidedAmount.toFixed(2)}
        </p>
      </div>
    </div>
  );
}

function StatCard({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div className={`rounded-2xl shadow p-4 ${highlight ? "bg-amber-600 text-white" : "bg-white text-neutral-800"}`}>
      <p className={`text-xs ${highlight ? "text-amber-100" : "text-neutral-500"}`}>{label}</p>
      <p className="text-xl font-bold mt-1">₱{value.toFixed(2)}</p>
    </div>
  );
}
