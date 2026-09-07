"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { adjustCustomerPoints, createCustomer, getCustomerTransactionsAction } from "./actions";
import type { CustomerRow, LoyaltyTransactionRow } from "@/lib/domain-types";

export function CustomersTab({
  customers,
  programEnabled,
}: {
  customers: CustomerRow[];
  programEnabled: boolean;
}) {
  const [showForm, setShowForm] = useState(false);
  const [selected, setSelected] = useState<CustomerRow | null>(null);

  return (
    <div>
      <div className="flex justify-between items-center mb-3">
        <h2 className="font-semibold text-neutral-800">Customers</h2>
        <button
          onClick={() => setShowForm(true)}
          className="px-4 py-2 rounded-xl bg-amber-600 text-white text-sm font-medium"
        >
          + Add Customer
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-neutral-500 border-b border-neutral-100">
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Contact</th>
              <th className="px-4 py-3">Points Balance</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {customers.map((c) => (
              <tr key={c.id} className="border-b border-neutral-50">
                <td className="px-4 py-3 font-medium text-neutral-800">{c.full_name}</td>
                <td className="px-4 py-3 text-neutral-500">{c.contact_number}</td>
                <td className="px-4 py-3">{c.loyalty_points_balance.toFixed(2)}</td>
                <td className="px-4 py-3">
                  <button onClick={() => setSelected(c)} className="text-amber-700 text-xs font-medium underline">
                    View
                  </button>
                </td>
              </tr>
            ))}
            {customers.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-neutral-400">
                  No customers yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showForm && <AddCustomerForm onClose={() => setShowForm(false)} />}
      {selected && (
        <CustomerDetail customer={selected} programEnabled={programEnabled} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}

function AddCustomerForm({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [contactNumber, setContactNumber] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit() {
    startTransition(async () => {
      const res = await createCustomer({ fullName, contactNumber, email: email || null });
      if (res.error) setError(res.error);
      else {
        router.refresh();
        onClose();
      }
    });
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-xl p-5 w-full max-w-sm space-y-2">
        <h3 className="font-semibold text-neutral-800 mb-2">Add Customer</h3>
        <input
          placeholder="Full name"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
        />
        <input
          placeholder="Contact number"
          value={contactNumber}
          onChange={(e) => setContactNumber(e.target.value)}
          className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
        />
        <input
          placeholder="Email (optional)"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
        />
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <div className="flex gap-2 pt-2">
          <button
            onClick={submit}
            disabled={isPending || !fullName.trim() || !contactNumber.trim()}
            className="flex-1 rounded-xl bg-amber-600 text-white font-semibold py-3 disabled:opacity-40"
          >
            {isPending ? "Saving..." : "Save"}
          </button>
          <button onClick={onClose} className="px-4 text-sm text-neutral-500">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

const TXN_LABEL: Record<string, string> = { earn: "Earned", redeem: "Redeemed", adjustment: "Adjustment" };

function CustomerDetail({
  customer,
  programEnabled,
  onClose,
}: {
  customer: CustomerRow;
  programEnabled: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [transactions, setTransactions] = useState<LoyaltyTransactionRow[] | null>(null);
  const [showAdjust, setShowAdjust] = useState(false);
  const [points, setPoints] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    getCustomerTransactionsAction(customer.id).then(setTransactions);
  }, [customer.id]);

  function submitAdjustment() {
    startTransition(async () => {
      const res = await adjustCustomerPoints(customer.id, Number(points), notes);
      if (res.error) setError(res.error);
      else {
        router.refresh();
        onClose();
      }
    });
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-5">
        <div className="flex justify-between items-start mb-3">
          <div>
            <h3 className="font-semibold text-lg text-neutral-800">{customer.full_name}</h3>
            <p className="text-sm text-neutral-500">{customer.contact_number}</p>
            {customer.email && <p className="text-sm text-neutral-500">{customer.email}</p>}
          </div>
          <button onClick={onClose} className="text-neutral-400 text-xl leading-none">
            ×
          </button>
        </div>

        <div className="bg-amber-50 rounded-xl p-3 mb-3">
          <p className="text-xs text-amber-700">Points Balance</p>
          <p className="text-2xl font-bold text-amber-800">{customer.loyalty_points_balance.toFixed(2)}</p>
        </div>

        {!programEnabled && (
          <p className="text-xs text-neutral-400 mb-3">
            The loyalty program is currently disabled — this customer&apos;s balance won&apos;t change from new
            orders until it&apos;s turned on.
          </p>
        )}

        <p className="text-sm font-medium text-neutral-600 mb-1">History</p>
        <div className="space-y-1 mb-3">
          {transactions === null && <p className="text-sm text-neutral-400">Loading...</p>}
          {transactions?.map((t) => (
            <div key={t.id} className="flex justify-between text-sm">
              <span>
                {TXN_LABEL[t.type]}
                {t.notes && <span className="text-neutral-400"> — {t.notes}</span>}
              </span>
              <span className={t.points < 0 ? "text-red-600" : "text-green-600"}>
                {t.points > 0 ? "+" : ""}
                {t.points.toFixed(2)}
              </span>
            </div>
          ))}
          {transactions?.length === 0 && <p className="text-sm text-neutral-400">No activity yet.</p>}
        </div>

        {!showAdjust ? (
          <button onClick={() => setShowAdjust(true)} className="text-xs font-medium text-amber-700 underline">
            Manual point adjustment
          </button>
        ) : (
          <div className="p-3 rounded-xl bg-neutral-50 space-y-2">
            <input
              type="number"
              step="0.01"
              placeholder="Points (negative to deduct)"
              value={points}
              onChange={(e) => setPoints(e.target.value)}
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
            />
            <input
              placeholder="Reason (required)"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
            />
            {error && <p className="text-red-600 text-sm">{error}</p>}
            <button
              onClick={submitAdjustment}
              disabled={isPending}
              className="w-full rounded-xl bg-amber-600 text-white font-medium py-2.5 disabled:opacity-40"
            >
              Save Adjustment
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
