"use client";

import { useEffect, useState, useTransition } from "react";
import { pollKitchenOrders, updateOrderItemStatus, advanceOrderStatus } from "./actions";
import { CHANNEL_LABEL } from "@/lib/constants";
import type { OrderRow } from "@/lib/domain-types";

const POLL_MS = 8000;

export function KdsClient({
  initialOrders,
  targetPrepTimeMinutes,
}: {
  initialOrders: OrderRow[];
  targetPrepTimeMinutes: number;
}) {
  const [orders, setOrders] = useState(initialOrders);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const poll = setInterval(async () => {
      try {
        const fresh = await pollKitchenOrders();
        setOrders(fresh);
      } catch {
        // transient network/auth hiccup — next poll will retry
      }
    }, POLL_MS);
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      clearInterval(poll);
      clearInterval(tick);
    };
  }, []);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-neutral-800">Kitchen Display</h1>
        <span className="text-xs text-neutral-400">Refreshes every {POLL_MS / 1000}s</span>
      </div>
      {orders.length === 0 && <p className="text-neutral-400">No active orders. Nice and clear!</p>}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {orders.map((o) => (
          <Ticket
            key={o.id}
            order={o}
            now={now}
            targetPrepTimeMinutes={targetPrepTimeMinutes}
            onChanged={(updated) =>
              setOrders((prev) => prev.map((p) => (p.id === updated.id ? updated : p)))
            }
          />
        ))}
      </div>
    </div>
  );
}

function Ticket({
  order,
  now,
  targetPrepTimeMinutes,
  onChanged,
}: {
  order: OrderRow;
  now: number;
  targetPrepTimeMinutes: number;
  onChanged: (order: OrderRow) => void;
}) {
  const [isPending, startTransition] = useTransition();
  const elapsedMinutes = Math.floor((now - new Date(order.created_at).getTime()) / 60000);
  const isLate = elapsedMinutes >= targetPrepTimeMinutes;
  const allReady = order.order_items.every((i) => i.status === "ready" || i.status === "served");

  function setItemStatus(itemId: string, status: "in_progress" | "ready") {
    const updated: OrderRow = {
      ...order,
      order_items: order.order_items.map((i) => (i.id === itemId ? { ...i, status } : i)),
    };
    onChanged(updated);
    startTransition(async () => {
      await updateOrderItemStatus(itemId, status);
    });
  }

  function markOrderReady() {
    startTransition(async () => {
      await advanceOrderStatus(order.id, "ready");
      onChanged({ ...order, status: "ready" });
    });
  }

  return (
    <div
      className={`rounded-2xl shadow p-4 border-2 ${
        isLate ? "border-red-400 bg-red-50" : "border-transparent bg-white"
      }`}
    >
      <div className="flex justify-between items-start mb-2">
        <div>
          <p className="text-xs font-medium text-neutral-500">{CHANNEL_LABEL[order.channel]}</p>
          <p className="font-semibold text-neutral-800">
            {order.restaurant_tables ? `Table ${order.restaurant_tables.table_number}` : order.customer_name || "Guest"}
          </p>
        </div>
        <span className={`text-sm font-bold ${isLate ? "text-red-600" : "text-neutral-400"}`}>
          {elapsedMinutes}m{isLate ? " ⚠" : ""}
        </span>
      </div>

      <div className="space-y-2">
        {order.order_items.map((item) => (
          <div key={item.id} className="flex items-center justify-between gap-2 border-b border-neutral-100 pb-2">
            <div>
              <p className="text-sm font-medium text-neutral-800">
                {item.quantity}× {item.menu_items?.name}
                {item.menu_item_variants ? ` (${item.menu_item_variants.name})` : ""}
              </p>
              {item.notes && <p className="text-xs text-amber-700">{item.notes}</p>}
            </div>
            {item.status === "pending" && (
              <button
                disabled={isPending}
                onClick={() => setItemStatus(item.id, "in_progress")}
                className="text-xs font-medium px-2 py-1.5 rounded-lg bg-blue-100 text-blue-700"
              >
                Start
              </button>
            )}
            {item.status === "in_progress" && (
              <button
                disabled={isPending}
                onClick={() => setItemStatus(item.id, "ready")}
                className="text-xs font-medium px-2 py-1.5 rounded-lg bg-green-100 text-green-700"
              >
                Ready
              </button>
            )}
            {(item.status === "ready" || item.status === "served") && (
              <span className="text-xs font-medium px-2 py-1.5 rounded-lg bg-neutral-100 text-neutral-400">
                Ready
              </span>
            )}
          </div>
        ))}
      </div>

      {allReady && order.status !== "ready" && (
        <button
          disabled={isPending}
          onClick={markOrderReady}
          className="mt-3 w-full rounded-xl bg-amber-600 text-white font-semibold py-3 disabled:opacity-40"
        >
          Mark Order Ready
        </button>
      )}
      {order.status === "ready" && (
        <p className="mt-3 text-center text-sm font-medium text-green-700">
          Ready — waiting for server/cashier
        </p>
      )}
    </div>
  );
}
