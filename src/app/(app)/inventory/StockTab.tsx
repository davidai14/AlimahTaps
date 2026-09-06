"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { adjustInventoryStock } from "./actions";
import type { InventoryItemRow } from "@/lib/domain-types";

const REASONS = ["spoilage", "breakage", "correction", "waste", "other"];

export function StockTab({ items }: { items: InventoryItemRow[] }) {
  const [adjusting, setAdjusting] = useState<InventoryItemRow | null>(null);
  const lowStockCount = items.filter((i) => i.current_stock <= i.reorder_point).length;

  return (
    <div>
      {lowStockCount > 0 && (
        <div className="mb-3 rounded-xl bg-red-50 text-red-700 px-4 py-3 text-sm font-medium">
          ⚠ {lowStockCount} item(s) at or below reorder point
        </div>
      )}
      <div className="bg-white rounded-2xl shadow overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-neutral-500 border-b border-neutral-100">
              <th className="px-4 py-3">Item</th>
              <th className="px-4 py-3">Stock</th>
              <th className="px-4 py-3">Reorder At</th>
              <th className="px-4 py-3">Weighted Avg Cost</th>
              <th className="px-4 py-3">Value</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const low = item.current_stock <= item.reorder_point;
              return (
                <tr key={item.id} className={`border-b border-neutral-50 ${low ? "bg-red-50" : ""}`}>
                  <td className="px-4 py-3 font-medium text-neutral-800">{item.name}</td>
                  <td className={`px-4 py-3 ${low ? "text-red-600 font-semibold" : ""}`}>
                    {item.current_stock.toFixed(2)} {item.unit}
                  </td>
                  <td className="px-4 py-3 text-neutral-500">
                    {item.reorder_point.toFixed(2)} {item.unit}
                  </td>
                  <td className="px-4 py-3">₱{item.weighted_avg_cost.toFixed(4)}</td>
                  <td className="px-4 py-3">₱{(item.current_stock * item.weighted_avg_cost).toFixed(2)}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => setAdjusting(item)}
                      className="text-amber-700 text-xs font-medium underline"
                    >
                      Adjust
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {adjusting && <AdjustModal item={adjusting} onClose={() => setAdjusting(null)} />}
    </div>
  );
}

function AdjustModal({ item, onClose }: { item: InventoryItemRow; onClose: () => void }) {
  const router = useRouter();
  const [direction, setDirection] = useState<"remove" | "add">("remove");
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState(REASONS[0]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit() {
    const qty = Number(quantity);
    if (!qty || qty <= 0) {
      setError("Enter a quantity greater than zero.");
      return;
    }
    startTransition(async () => {
      const res = await adjustInventoryStock(item.id, direction === "remove" ? -qty : qty, reason);
      if (res.error) setError(res.error);
      else {
        router.refresh();
        onClose();
      }
    });
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-xl p-5 w-full max-w-sm">
        <h3 className="font-semibold text-neutral-800 mb-1">Adjust: {item.name}</h3>
        <p className="text-xs text-neutral-400 mb-4">
          Current stock: {item.current_stock.toFixed(2)} {item.unit}
        </p>

        <div className="flex gap-2 mb-3">
          <button
            onClick={() => setDirection("remove")}
            className={`flex-1 py-2 rounded-lg text-sm font-medium ${
              direction === "remove" ? "bg-red-600 text-white" : "bg-neutral-100"
            }`}
          >
            Remove (waste/loss)
          </button>
          <button
            onClick={() => setDirection("add")}
            className={`flex-1 py-2 rounded-lg text-sm font-medium ${
              direction === "add" ? "bg-green-600 text-white" : "bg-neutral-100"
            }`}
          >
            Add (correction)
          </button>
        </div>

        <input
          type="number"
          min="0"
          step="0.01"
          placeholder={`Quantity (${item.unit})`}
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm mb-3"
        />

        <select
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm mb-3 capitalize"
        >
          {REASONS.map((r) => (
            <option key={r} value={r} className="capitalize">
              {r}
            </option>
          ))}
        </select>

        {error && <p className="text-red-600 text-sm mb-3">{error}</p>}

        <div className="flex gap-2">
          <button
            onClick={submit}
            disabled={isPending}
            className="flex-1 rounded-xl bg-amber-600 text-white font-semibold py-3 disabled:opacity-40"
          >
            {isPending ? "Saving..." : "Save Adjustment"}
          </button>
          <button onClick={onClose} className="px-4 text-sm text-neutral-500">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
