"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createPurchaseOrder, receivePurchaseOrderItem, setPurchaseOrderStatus } from "./actions";
import type { PurchaseOrderRow, SupplierRow } from "@/lib/domain-types";

const STATUS_COLOR: Record<string, string> = {
  draft: "bg-neutral-200 text-neutral-700",
  sent: "bg-blue-100 text-blue-700",
  partially_received: "bg-amber-100 text-amber-700",
  received: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-700",
};

export function PurchaseOrdersTab({
  suppliers,
  inventoryItems,
  purchaseOrders,
  supplierFilter,
  onClearFilter,
}: {
  suppliers: SupplierRow[];
  inventoryItems: { id: string; name: string; unit: string }[];
  purchaseOrders: PurchaseOrderRow[];
  supplierFilter: string | null;
  onClearFilter: () => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [selected, setSelected] = useState<PurchaseOrderRow | null>(null);
  const filterName = supplierFilter ? suppliers.find((s) => s.id === supplierFilter)?.name : null;

  return (
    <div>
      <div className="flex justify-between items-center mb-3">
        <h2 className="font-semibold text-neutral-800">
          Purchase Orders {filterName && <span className="text-sm text-neutral-500">— {filterName}</span>}
        </h2>
        <div className="flex gap-2">
          {filterName && (
            <button onClick={onClearFilter} className="text-sm text-neutral-500 underline">
              Clear filter
            </button>
          )}
          <button
            onClick={() => setShowForm(true)}
            className="px-4 py-2 rounded-xl bg-amber-600 text-white text-sm font-medium"
          >
            + Create PO
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {purchaseOrders.map((po) => (
          <button
            key={po.id}
            onClick={() => setSelected(po)}
            className="text-left bg-white rounded-2xl shadow p-4 hover:ring-2 hover:ring-amber-300 transition"
          >
            <div className="flex justify-between items-start mb-2">
              <span className="font-medium text-neutral-800">{po.suppliers?.name}</span>
              <span className={`text-xs font-semibold px-2 py-1 rounded-full ${STATUS_COLOR[po.status]}`}>
                {po.status.replace("_", " ")}
              </span>
            </div>
            <p className="text-xs text-neutral-500">Ordered {po.order_date}</p>
            <p className="text-sm text-neutral-500">{po.purchase_order_items.length} item(s)</p>
            <p className="mt-2 font-semibold text-amber-700">₱{po.total_cost.toFixed(2)}</p>
          </button>
        ))}
        {purchaseOrders.length === 0 && <p className="text-neutral-400 text-sm">No purchase orders yet.</p>}
      </div>

      {showForm && (
        <CreatePoForm
          suppliers={suppliers}
          inventoryItems={inventoryItems}
          onClose={() => setShowForm(false)}
        />
      )}
      {selected && <PoDetail po={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

function CreatePoForm({
  suppliers,
  inventoryItems,
  onClose,
}: {
  suppliers: SupplierRow[];
  inventoryItems: { id: string; name: string; unit: string }[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [supplierId, setSupplierId] = useState(suppliers[0]?.id ?? "");
  const [expectedDate, setExpectedDate] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<{ inventoryItemId: string; quantity: string; unitCost: string }[]>([
    { inventoryItemId: inventoryItems[0]?.id ?? "", quantity: "", unitCost: "" },
  ]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function addLine() {
    setLines((l) => [...l, { inventoryItemId: inventoryItems[0]?.id ?? "", quantity: "", unitCost: "" }]);
  }
  function removeLine(idx: number) {
    setLines((l) => l.filter((_, i) => i !== idx));
  }
  function updateLine(idx: number, patch: Partial<{ inventoryItemId: string; quantity: string; unitCost: string }>) {
    setLines((l) => l.map((line, i) => (i === idx ? { ...line, ...patch } : line)));
  }

  function submit() {
    const items = lines
      .filter((l) => l.inventoryItemId && Number(l.quantity) > 0 && Number(l.unitCost) >= 0)
      .map((l) => ({
        inventoryItemId: l.inventoryItemId,
        quantity: Number(l.quantity),
        unitCost: Number(l.unitCost),
      }));

    if (items.length === 0) {
      setError("Add at least one valid line item.");
      return;
    }

    startTransition(async () => {
      const res = await createPurchaseOrder({
        supplierId,
        expectedDate: expectedDate || null,
        notes: notes || null,
        items,
      });
      if (res.error) setError(res.error);
      else {
        router.refresh();
        onClose();
      }
    });
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-xl p-5 w-full max-w-xl my-8">
        <h3 className="font-semibold text-neutral-800 mb-3">Create Purchase Order</h3>

        <label className="text-xs text-neutral-500">Supplier</label>
        <select
          value={supplierId}
          onChange={(e) => setSupplierId(e.target.value)}
          className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm mb-3"
        >
          {suppliers.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>

        <label className="text-xs text-neutral-500">Expected Delivery Date</label>
        <input
          type="date"
          value={expectedDate}
          onChange={(e) => setExpectedDate(e.target.value)}
          className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm mb-3"
        />

        <p className="text-xs text-neutral-500 mb-1">Line Items</p>
        <div className="space-y-2 mb-2">
          {lines.map((line, idx) => (
            <div key={idx} className="grid grid-cols-[1fr_80px_100px_24px] gap-2 items-center">
              <select
                value={line.inventoryItemId}
                onChange={(e) => updateLine(idx, { inventoryItemId: e.target.value })}
                className="rounded-lg border border-neutral-300 px-2 py-2 text-sm"
              >
                {inventoryItems.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name} ({i.unit})
                  </option>
                ))}
              </select>
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="Qty"
                value={line.quantity}
                onChange={(e) => updateLine(idx, { quantity: e.target.value })}
                className="rounded-lg border border-neutral-300 px-2 py-2 text-sm"
              />
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="Unit cost"
                value={line.unitCost}
                onChange={(e) => updateLine(idx, { unitCost: e.target.value })}
                className="rounded-lg border border-neutral-300 px-2 py-2 text-sm"
              />
              <button onClick={() => removeLine(idx)} className="text-neutral-400">
                ×
              </button>
            </div>
          ))}
        </div>
        <button onClick={addLine} className="text-xs text-amber-700 underline mb-3">
          + Add line
        </button>

        <textarea
          placeholder="Notes (optional)"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm mb-3"
        />

        {error && <p className="text-red-600 text-sm mb-2">{error}</p>}

        <div className="flex gap-2">
          <button
            onClick={submit}
            disabled={isPending}
            className="flex-1 rounded-xl bg-amber-600 text-white font-semibold py-3 disabled:opacity-40"
          >
            {isPending ? "Saving..." : "Create PO (Draft)"}
          </button>
          <button onClick={onClose} className="px-4 text-sm text-neutral-500">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

function PoDetail({ po, onClose }: { po: PurchaseOrderRow; onClose: () => void }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [receiveQty, setReceiveQty] = useState<Record<string, string>>({});
  const [isPending, startTransition] = useTransition();

  function receive(poItemId: string) {
    const qty = Number(receiveQty[poItemId]);
    if (!qty || qty <= 0) {
      setError("Enter a quantity to receive.");
      return;
    }
    startTransition(async () => {
      const res = await receivePurchaseOrderItem(poItemId, qty);
      if (res.error) setError(res.error);
      else {
        router.refresh();
        onClose();
      }
    });
  }

  function changeStatus(status: "sent" | "cancelled") {
    startTransition(async () => {
      const res = await setPurchaseOrderStatus(po.id, status);
      if (res.error) setError(res.error);
      else {
        router.refresh();
        onClose();
      }
    });
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-xl p-5 w-full max-w-lg my-8">
        <div className="flex justify-between items-start mb-3">
          <div>
            <h3 className="font-semibold text-neutral-800">{po.suppliers?.name}</h3>
            <p className="text-xs text-neutral-500">
              Ordered {po.order_date} {po.expected_date && `· Expected ${po.expected_date}`}
            </p>
          </div>
          <button onClick={onClose} className="text-neutral-400 text-xl leading-none">
            ×
          </button>
        </div>

        <span className={`inline-block text-xs font-semibold px-2 py-1 rounded-full mb-3 ${STATUS_COLOR[po.status]}`}>
          {po.status.replace("_", " ")}
        </span>

        <div className="space-y-3">
          {po.purchase_order_items.map((item) => {
            const remaining = item.quantity_ordered - item.quantity_received;
            return (
              <div key={item.id} className="border-b border-neutral-100 pb-2">
                <div className="flex justify-between text-sm">
                  <span className="font-medium text-neutral-800">{item.inventory_items?.name}</span>
                  <span>₱{item.unit_cost.toFixed(2)} / {item.inventory_items?.unit}</span>
                </div>
                <p className="text-xs text-neutral-500">
                  {item.quantity_received} / {item.quantity_ordered} {item.inventory_items?.unit} received
                </p>
                {remaining > 0 && po.status !== "cancelled" && po.status !== "received" && (
                  <div className="flex gap-2 mt-1">
                    <input
                      type="number"
                      min="0"
                      max={remaining}
                      step="0.01"
                      placeholder={`Up to ${remaining}`}
                      value={receiveQty[item.id] ?? ""}
                      onChange={(e) => setReceiveQty((r) => ({ ...r, [item.id]: e.target.value }))}
                      className="w-32 rounded-lg border border-neutral-300 px-2 py-1.5 text-sm"
                    />
                    <button
                      disabled={isPending}
                      onClick={() => receive(item.id)}
                      className="px-3 py-1.5 rounded-lg bg-green-600 text-white text-xs font-medium disabled:opacity-40"
                    >
                      Receive
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {error && <p className="text-red-600 text-sm mt-3">{error}</p>}

        {po.status === "draft" && (
          <div className="mt-4 flex gap-2">
            <button
              disabled={isPending}
              onClick={() => changeStatus("sent")}
              className="px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-medium disabled:opacity-40"
            >
              Mark Sent to Supplier
            </button>
            <button
              disabled={isPending}
              onClick={() => changeStatus("cancelled")}
              className="px-4 py-2 rounded-xl bg-red-50 text-red-700 text-sm font-medium disabled:opacity-40"
            >
              Cancel PO
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
