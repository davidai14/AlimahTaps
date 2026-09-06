"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  markReservationNotified,
  updateReservationStatus,
  verifyReservationPayment,
} from "./actions";
import type { ReservationRow, ReservationStatus, RestaurantTable } from "@/lib/domain-types";

const STATUS_COLOR: Record<ReservationStatus, string> = {
  pending: "bg-neutral-200 text-neutral-700",
  confirmed: "bg-blue-100 text-blue-700",
  seated: "bg-purple-100 text-purple-700",
  completed: "bg-green-100 text-green-700",
  no_show: "bg-red-100 text-red-700",
  cancelled: "bg-neutral-300 text-neutral-600",
};

export function ReservationsTab({
  reservations,
  tables,
}: {
  reservations: ReservationRow[];
  tables: RestaurantTable[];
}) {
  const [selected, setSelected] = useState<ReservationRow | null>(null);

  return (
    <div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {reservations.map((r) => (
          <button
            key={r.id}
            onClick={() => setSelected(r)}
            className="text-left bg-white rounded-2xl shadow p-4 hover:ring-2 hover:ring-amber-300 transition"
          >
            <div className="flex justify-between items-start mb-2">
              <span className="text-xs font-medium text-neutral-500">
                {r.reservation_date} · {r.reservation_time.slice(0, 5)}
              </span>
              <span className={`text-xs font-semibold px-2 py-1 rounded-full ${STATUS_COLOR[r.status]}`}>
                {r.status.replace("_", " ")}
              </span>
            </div>
            <p className="font-medium text-neutral-800">{r.customer_name}</p>
            <p className="text-sm text-neutral-500">{r.party_size} guests</p>
            {r.down_payment_amount ? (
              <p className="mt-1 text-xs text-amber-700">
                ₱{r.down_payment_amount.toFixed(2)} down payment {r.verified_at ? "(verified)" : "(unverified)"}
              </p>
            ) : null}
          </button>
        ))}
        {reservations.length === 0 && <p className="text-neutral-400 text-sm">No reservations yet.</p>}
      </div>

      {selected && (
        <ReservationDrawer
          reservation={selected}
          tables={tables}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}

function ReservationDrawer({
  reservation,
  tables,
  onClose,
}: {
  reservation: ReservationRow;
  tables: RestaurantTable[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [tableId, setTableId] = useState(reservation.table_id ?? "");

  function run(fn: () => Promise<{ error?: string }>) {
    setError(null);
    startTransition(async () => {
      const res = await fn();
      if (res.error) setError(res.error);
      else router.refresh();
    });
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-5">
        <div className="flex justify-between items-start mb-3">
          <div>
            <h3 className="font-semibold text-lg text-neutral-800">{reservation.customer_name}</h3>
            <p className="text-sm text-neutral-500">{reservation.contact_number}</p>
            <p className="text-xs text-neutral-400">
              {reservation.reservation_date} at {reservation.reservation_time.slice(0, 5)} ·{" "}
              {reservation.party_size} guests
            </p>
          </div>
          <button onClick={onClose} className="text-neutral-400 text-xl leading-none">
            ×
          </button>
        </div>

        <span className={`inline-block text-xs font-semibold px-2 py-1 rounded-full mb-3 ${STATUS_COLOR[reservation.status]}`}>
          {reservation.status.replace("_", " ")}
        </span>

        {reservation.notes && <p className="text-sm text-neutral-600 mb-3">{reservation.notes}</p>}

        {reservation.down_payment_amount ? (
          <div className="p-3 rounded-xl bg-neutral-50 mb-3">
            <p className="text-sm font-medium text-neutral-700">
              Down payment: ₱{reservation.down_payment_amount.toFixed(2)}
              {reservation.payment_reference && ` (${reservation.payment_reference})`}
            </p>
            {reservation.payment_screenshot_url && (
              <a
                href={reservation.payment_screenshot_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-amber-700 underline"
              >
                View payment proof
              </a>
            )}
            <div className="mt-1">
              {reservation.verified_at ? (
                <span className="text-xs text-green-600">Verified</span>
              ) : (
                <button
                  disabled={isPending}
                  onClick={() => run(() => verifyReservationPayment(reservation.id))}
                  className="text-xs text-amber-700 underline"
                >
                  Mark payment verified
                </button>
              )}
            </div>
          </div>
        ) : null}

        <div className="mb-3">
          <label className="text-xs text-neutral-500">Assign table</label>
          <select
            value={tableId}
            onChange={(e) => setTableId(e.target.value)}
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
          >
            <option value="">Not assigned</option>
            {tables.map((t) => (
              <option key={t.id} value={t.id}>
                Table {t.table_number} (seats {t.capacity})
              </option>
            ))}
          </select>
        </div>

        {error && <p className="text-red-600 text-sm mb-3">{error}</p>}

        <div className="flex flex-wrap gap-2">
          {reservation.status === "pending" && (
            <button
              disabled={isPending}
              onClick={() => run(() => updateReservationStatus(reservation.id, "confirmed", tableId || null))}
              className="px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-medium disabled:opacity-40"
            >
              Confirm
            </button>
          )}
          {reservation.status === "confirmed" && (
            <button
              disabled={isPending}
              onClick={() => run(() => updateReservationStatus(reservation.id, "seated", tableId || null))}
              className="px-4 py-2 rounded-xl bg-purple-600 text-white text-sm font-medium disabled:opacity-40"
            >
              Mark Seated
            </button>
          )}
          {reservation.status === "seated" && (
            <button
              disabled={isPending}
              onClick={() => run(() => updateReservationStatus(reservation.id, "completed", tableId || null))}
              className="px-4 py-2 rounded-xl bg-green-600 text-white text-sm font-medium disabled:opacity-40"
            >
              Mark Completed
            </button>
          )}
          {["pending", "confirmed"].includes(reservation.status) && (
            <>
              <button
                disabled={isPending}
                onClick={() => run(() => updateReservationStatus(reservation.id, "no_show", tableId || null))}
                className="px-4 py-2 rounded-xl bg-red-50 text-red-700 text-sm font-medium disabled:opacity-40"
              >
                No-Show
              </button>
              <button
                disabled={isPending}
                onClick={() => run(() => updateReservationStatus(reservation.id, "cancelled", tableId || null))}
                className="px-4 py-2 rounded-xl bg-neutral-100 text-neutral-600 text-sm font-medium disabled:opacity-40"
              >
                Cancel
              </button>
            </>
          )}
          {reservation.notified_at ? (
            <span className="px-3 py-2 text-xs text-green-600 self-center">
              Customer notified {new Date(reservation.notified_at).toLocaleString()}
            </span>
          ) : (
            <button
              disabled={isPending}
              onClick={() => run(() => markReservationNotified(reservation.id))}
              className="px-4 py-2 rounded-xl bg-neutral-100 text-neutral-700 text-sm font-medium disabled:opacity-40"
            >
              Mark Customer Notified
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
