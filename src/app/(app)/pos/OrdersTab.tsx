"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  advanceOrderStatus,
  recordPayment,
  uploadPaymentScreenshot,
  verifyPayment,
  voidOrder,
} from "@/lib/orders/actions";
import {
  CHANNEL_LABEL,
  ORDER_STATUS_LABEL,
  PAYMENT_METHOD_LABEL,
} from "@/lib/constants";
import type { OrderRow, OrderStatus, PaymentMethod } from "@/lib/domain-types";

const NEXT_STATUS: Partial<Record<OrderStatus, { label: string; value: OrderStatus }>> = {
  pending: { label: "Start Preparing", value: "preparing" },
  preparing: { label: "Mark Ready", value: "ready" },
  ready: { label: "Mark Served", value: "served" },
  served: { label: "Complete Order", value: "completed" },
  completed: { label: "Mark Paid (no more owed)", value: "paid" },
};

const STATUS_COLOR: Record<OrderStatus, string> = {
  pending: "bg-neutral-200 text-neutral-700",
  preparing: "bg-blue-100 text-blue-700",
  ready: "bg-purple-100 text-purple-700",
  served: "bg-indigo-100 text-indigo-700",
  completed: "bg-teal-100 text-teal-700",
  paid: "bg-green-100 text-green-700",
  cancelled: "bg-neutral-300 text-neutral-600",
  voided: "bg-red-100 text-red-700",
};

const OPEN_STATUSES: OrderStatus[] = ["pending", "preparing", "ready", "served", "completed"];

export function OrdersTab({
  orders,
  canTakePayments,
}: {
  orders: OrderRow[];
  canTakePayments: boolean;
}) {
  const [showAll, setShowAll] = useState(false);
  const [selected, setSelected] = useState<OrderRow | null>(null);

  const visible = useMemo(
    () => (showAll ? orders : orders.filter((o) => OPEN_STATUSES.includes(o.status))),
    [orders, showAll]
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold text-neutral-800">Today&apos;s Orders</h2>
        <label className="flex items-center gap-2 text-sm text-neutral-500">
          <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} />
          Show paid/voided too
        </label>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {visible.map((o) => (
          <button
            key={o.id}
            onClick={() => setSelected(o)}
            className="text-left bg-white rounded-2xl shadow p-4 hover:ring-2 hover:ring-amber-300 transition"
          >
            <div className="flex justify-between items-start mb-2">
              <span className="text-xs font-medium text-neutral-500">{CHANNEL_LABEL[o.channel]}</span>
              <span className={`text-xs font-semibold px-2 py-1 rounded-full ${STATUS_COLOR[o.status]}`}>
                {ORDER_STATUS_LABEL[o.status]}
              </span>
            </div>
            <p className="font-medium text-neutral-800">
              {o.restaurant_tables ? `Table ${o.restaurant_tables.table_number}` : o.customer_name || "Guest"}
            </p>
            <p className="text-sm text-neutral-500">{o.order_items.length} item(s)</p>
            <p className="mt-2 font-semibold text-amber-700">₱{o.total_amount.toFixed(2)}</p>
          </button>
        ))}
        {visible.length === 0 && <p className="text-neutral-400 text-sm">No orders to show.</p>}
      </div>

      {selected && (
        <OrderDrawer
          order={selected}
          canTakePayments={canTakePayments}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}

function OrderDrawer({
  order,
  canTakePayments,
  onClose,
}: {
  order: OrderRow;
  canTakePayments: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [voidReason, setVoidReason] = useState("");
  const [showVoid, setShowVoid] = useState(false);
  const [payMethod, setPayMethod] = useState<PaymentMethod>("cash");
  const [payAmount, setPayAmount] = useState(order.total_amount.toString());
  const [payReference, setPayReference] = useState("");
  const [payFile, setPayFile] = useState<File | null>(null);

  const totalPaid = order.payments.reduce((s, p) => s + p.amount, 0);
  const balance = Math.round((order.total_amount - totalPaid) * 100) / 100;
  const nextStatus = NEXT_STATUS[order.status];
  const canVoid = ["pending", "preparing", "ready", "served"].includes(order.status);

  function runAndRefresh(fn: () => Promise<{ error?: string }>) {
    setError(null);
    startTransition(async () => {
      const res = await fn();
      if (res.error) setError(res.error);
      else router.refresh();
    });
  }

  function submitPayment() {
    startTransition(async () => {
      setError(null);
      let screenshotUrl: string | null = null;
      if (payFile) {
        const fd = new FormData();
        fd.set("file", payFile);
        const uploadRes = await uploadPaymentScreenshot(fd);
        if (uploadRes.error) {
          setError(uploadRes.error);
          return;
        }
        screenshotUrl = uploadRes.url ?? null;
      }
      const res = await recordPayment(
        order.id,
        payMethod,
        Number(payAmount),
        payReference || null,
        screenshotUrl
      );
      if (res.error) setError(res.error);
      else {
        setPayReference("");
        setPayFile(null);
        router.refresh();
      }
    });
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-5">
        <div className="flex justify-between items-start mb-3">
          <div>
            <p className="text-xs text-neutral-500">{CHANNEL_LABEL[order.channel]}</p>
            <h3 className="font-semibold text-lg text-neutral-800">
              {order.restaurant_tables
                ? `Table ${order.restaurant_tables.table_number}`
                : order.customer_name || "Guest"}
            </h3>
            {order.external_reference && (
              <p className="text-xs text-neutral-400">Ref: {order.external_reference}</p>
            )}
          </div>
          <button onClick={onClose} className="text-neutral-400 text-xl leading-none">
            ×
          </button>
        </div>

        <span className={`inline-block text-xs font-semibold px-2 py-1 rounded-full mb-3 ${STATUS_COLOR[order.status]}`}>
          {ORDER_STATUS_LABEL[order.status]}
        </span>

        <div className="space-y-1 mb-3">
          {order.order_items.map((oi) => (
            <div key={oi.id} className="flex justify-between text-sm">
              <span>
                {oi.quantity}× {oi.menu_items?.name}
                {oi.menu_item_variants ? ` (${oi.menu_item_variants.name})` : ""}
                {oi.notes && <span className="text-neutral-400"> — {oi.notes}</span>}
              </span>
              <span>₱{(oi.quantity * oi.unit_price).toFixed(2)}</span>
            </div>
          ))}
        </div>

        <div className="border-t border-neutral-100 pt-2 space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-neutral-500">Subtotal</span>
            <span>₱{order.subtotal.toFixed(2)}</span>
          </div>
          {order.discount_amount > 0 && (
            <div className="flex justify-between text-red-600">
              <span>
                Discount ({order.discount_type}
                {order.discount_id_number ? ` #${order.discount_id_number}` : ""})
              </span>
              <span>−₱{order.discount_amount.toFixed(2)}</span>
            </div>
          )}
          {order.platform_commission > 0 && (
            <div className="flex justify-between text-neutral-400">
              <span>Platform commission (net impact only)</span>
              <span>₱{order.platform_commission.toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between font-semibold text-base">
            <span>Total</span>
            <span>₱{order.total_amount.toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-neutral-500">Paid</span>
            <span>₱{totalPaid.toFixed(2)}</span>
          </div>
          {balance > 0 && (
            <div className="flex justify-between text-red-600 font-medium">
              <span>Balance</span>
              <span>₱{balance.toFixed(2)}</span>
            </div>
          )}
        </div>

        {order.payments.length > 0 && (
          <div className="mt-3 space-y-1">
            <p className="text-xs font-medium text-neutral-500">Payments</p>
            {order.payments.map((p) => (
              <div key={p.id} className="flex justify-between items-center text-sm">
                <span>
                  {PAYMENT_METHOD_LABEL[p.method]} — ₱{p.amount.toFixed(2)}
                  {p.reference_number ? ` (${p.reference_number})` : ""}
                  {p.screenshot_url && (
                    <>
                      {" "}
                      <a
                        href={p.screenshot_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-amber-700 underline"
                      >
                        View proof
                      </a>
                    </>
                  )}
                </span>
                {p.verified_at ? (
                  <span className="text-xs text-green-600">Verified</span>
                ) : canTakePayments ? (
                  <button
                    onClick={() => runAndRefresh(() => verifyPayment(p.id))}
                    className="text-xs text-amber-700 underline"
                  >
                    Verify
                  </button>
                ) : (
                  <span className="text-xs text-neutral-400">Unverified</span>
                )}
              </div>
            ))}
          </div>
        )}

        {error && <p className="text-red-600 text-sm mt-3">{error}</p>}

        <div className="mt-4 flex flex-wrap gap-2">
          {nextStatus && order.status !== "completed" && (
            <button
              disabled={isPending}
              onClick={() => runAndRefresh(() => advanceOrderStatus(order.id, nextStatus.value))}
              className="px-4 py-3 rounded-xl bg-amber-600 text-white font-medium disabled:opacity-40"
            >
              {nextStatus.label}
            </button>
          )}
          {canVoid && canTakePayments && (
            <button
              onClick={() => setShowVoid(true)}
              className="px-4 py-3 rounded-xl bg-red-50 text-red-700 font-medium"
            >
              Void Order
            </button>
          )}
        </div>

        {showVoid && (
          <div className="mt-3 p-3 rounded-xl bg-red-50 space-y-2">
            <input
              placeholder="Reason for void (required)"
              value={voidReason}
              onChange={(e) => setVoidReason(e.target.value)}
              className="w-full rounded-lg border border-red-200 px-3 py-2 text-sm"
            />
            <div className="flex gap-2">
              <button
                onClick={() => runAndRefresh(() => voidOrder(order.id, voidReason))}
                disabled={isPending}
                className="px-3 py-2 rounded-lg bg-red-600 text-white text-sm font-medium"
              >
                Confirm Void
              </button>
              <button onClick={() => setShowVoid(false)} className="px-3 py-2 text-sm text-neutral-500">
                Cancel
              </button>
            </div>
          </div>
        )}

        {canTakePayments && balance > 0 && !["voided", "cancelled"].includes(order.status) && (
          <div className="mt-4 p-3 rounded-xl bg-neutral-50 space-y-2">
            <p className="text-sm font-medium text-neutral-600">Record Payment</p>
            <div className="flex gap-2">
              {(["cash", "gcash", "bank_transfer"] as PaymentMethod[]).map((m) => (
                <button
                  key={m}
                  onClick={() => setPayMethod(m)}
                  className={`px-3 py-2 rounded-lg text-xs font-medium ${
                    payMethod === m ? "bg-neutral-800 text-white" : "bg-white border border-neutral-200"
                  }`}
                >
                  {PAYMENT_METHOD_LABEL[m]}
                </button>
              ))}
            </div>
            <input
              type="number"
              step="0.01"
              value={payAmount}
              onChange={(e) => setPayAmount(e.target.value)}
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
              placeholder="Amount"
            />
            {payMethod !== "cash" && (
              <>
                <input
                  placeholder="Reference number"
                  value={payReference}
                  onChange={(e) => setPayReference(e.target.value)}
                  className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
                />
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setPayFile(e.target.files?.[0] ?? null)}
                  className="w-full text-xs"
                />
                <p className="text-xs text-neutral-400">
                  Upload the customer&apos;s payment screenshot; a manager or cashier verifies it above.
                </p>
              </>
            )}
            <button
              onClick={submitPayment}
              disabled={isPending}
              className="w-full rounded-xl bg-neutral-800 text-white font-medium py-3 disabled:opacity-40"
            >
              Record Payment
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
