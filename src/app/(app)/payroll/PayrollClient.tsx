"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createPayrollPeriod, getPayslipsForPeriodAction } from "./actions";
import { PayslipList } from "./PayslipList";
import type { PayrollPeriodRow, PayslipRow } from "@/lib/domain-types";

export function PayrollClient({ periods }: { periods: PayrollPeriodRow[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<PayrollPeriodRow | null>(periods[0] ?? null);
  const [payslips, setPayslips] = useState<PayslipRow[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [isPending, startTransition] = useTransition();

  function selectPeriod(period: PayrollPeriodRow) {
    setSelected(period);
    startTransition(async () => {
      const data = await getPayslipsForPeriodAction(period.id);
      setPayslips(data);
    });
  }

  function refreshSelected() {
    if (selected) selectPeriod(selected);
    router.refresh();
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div className="lg:col-span-1">
        <div className="flex justify-between items-center mb-3">
          <h2 className="font-semibold text-neutral-800">Pay Periods</h2>
          <button
            onClick={() => setShowForm(true)}
            className="px-3 py-2 rounded-xl bg-amber-600 text-white text-sm font-medium"
          >
            + New Period
          </button>
        </div>
        <div className="space-y-2">
          {periods.map((p) => (
            <button
              key={p.id}
              onClick={() => selectPeriod(p)}
              className={`w-full text-left rounded-xl p-3 shadow ${
                selected?.id === p.id ? "bg-neutral-800 text-white" : "bg-white text-neutral-700"
              }`}
            >
              <p className="text-sm font-medium">
                {p.start_date} → {p.end_date}
              </p>
              <span
                className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                  p.status === "finalized" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
                }`}
              >
                {p.status}
              </span>
            </button>
          ))}
          {periods.length === 0 && <p className="text-sm text-neutral-400">No pay periods yet.</p>}
        </div>

        {showForm && (
          <NewPeriodForm
            onClose={() => setShowForm(false)}
            onCreated={() => {
              setShowForm(false);
              router.refresh();
            }}
          />
        )}
      </div>

      <div className="lg:col-span-2">
        {selected ? (
          <PayslipList
            period={selected}
            payslips={payslips}
            isLoading={isPending}
            onChanged={refreshSelected}
          />
        ) : (
          <p className="text-neutral-400 text-sm">Select or create a pay period to get started.</p>
        )}
      </div>
    </div>
  );
}

function NewPeriodForm({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit() {
    startTransition(async () => {
      const res = await createPayrollPeriod(startDate, endDate);
      if (res.error) setError(res.error);
      else onCreated();
    });
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-xl p-5 w-full max-w-xs">
        <h3 className="font-semibold text-neutral-800 mb-3">New Pay Period</h3>
        <label className="text-xs text-neutral-500">Start date</label>
        <input
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm mb-2"
        />
        <label className="text-xs text-neutral-500">End date</label>
        <input
          type="date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm mb-3"
        />
        {error && <p className="text-red-600 text-sm mb-2">{error}</p>}
        <div className="flex gap-2">
          <button
            onClick={submit}
            disabled={isPending}
            className="flex-1 rounded-xl bg-amber-600 text-white font-semibold py-3 disabled:opacity-40"
          >
            {isPending ? "Creating..." : "Create"}
          </button>
          <button onClick={onClose} className="px-4 text-sm text-neutral-500">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
