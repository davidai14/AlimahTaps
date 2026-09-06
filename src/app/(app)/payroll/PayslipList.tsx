"use client";

import { useState, useTransition } from "react";
import {
  addPayslipDeduction,
  finalizePayrollPeriod,
  generatePayslipsForPeriod,
  removePayslipDeduction,
  updatePayslipOvertime,
} from "./actions";
import type { PayrollPeriodRow, PayslipRow } from "@/lib/domain-types";

export function PayslipList({
  period,
  payslips,
  isLoading,
  onChanged,
}: {
  period: PayrollPeriodRow;
  payslips: PayslipRow[];
  isLoading: boolean;
  onChanged: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const locked = period.status === "finalized";

  function generate() {
    startTransition(async () => {
      const res = await generatePayslipsForPeriod(period.id);
      if (res.error) setError(res.error);
      else onChanged();
    });
  }

  function finalize() {
    if (!confirm("Finalize this pay period? It will be locked from further edits.")) return;
    startTransition(async () => {
      const res = await finalizePayrollPeriod(period.id);
      if (res.error) setError(res.error);
      else onChanged();
    });
  }

  const totalNet = payslips.reduce((s, p) => s + p.net_pay, 0);

  return (
    <div>
      <div className="flex justify-between items-center mb-3">
        <div>
          <h2 className="font-semibold text-neutral-800">
            {period.start_date} → {period.end_date}
          </h2>
          <p className="text-xs text-neutral-400">Total net pay: ₱{totalNet.toFixed(2)}</p>
        </div>
        <div className="flex gap-2">
          {!locked && (
            <button
              onClick={generate}
              disabled={isPending}
              className="px-3 py-2 rounded-xl bg-neutral-800 text-white text-sm font-medium disabled:opacity-40"
            >
              {payslips.length === 0 ? "Generate Payslips" : "Recompute Hours"}
            </button>
          )}
          {!locked && payslips.length > 0 && (
            <button
              onClick={finalize}
              disabled={isPending}
              className="px-3 py-2 rounded-xl bg-green-600 text-white text-sm font-medium disabled:opacity-40"
            >
              Finalize
            </button>
          )}
        </div>
      </div>

      {error && <p className="text-red-600 text-sm mb-3">{error}</p>}
      {isLoading && <p className="text-neutral-400 text-sm">Loading...</p>}

      <div className="space-y-3">
        {payslips.map((p) => (
          <PayslipCard key={p.id} payslip={p} locked={locked} onChanged={onChanged} />
        ))}
        {!isLoading && payslips.length === 0 && (
          <p className="text-neutral-400 text-sm">
            No payslips yet — click &quot;Generate Payslips&quot; to compute regular pay from attendance for this
            period.
          </p>
        )}
      </div>
    </div>
  );
}

function PayslipCard({
  payslip,
  locked,
  onChanged,
}: {
  payslip: PayslipRow;
  locked: boolean;
  onChanged: () => void;
}) {
  const [showOvertime, setShowOvertime] = useState(false);
  const [showDeduction, setShowDeduction] = useState(false);
  const [otHours, setOtHours] = useState(payslip.overtime_hours.toString());
  const [otPay, setOtPay] = useState(payslip.overtime_pay.toString());
  const [dedLabel, setDedLabel] = useState("");
  const [dedAmount, setDedAmount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function saveOvertime() {
    startTransition(async () => {
      const res = await updatePayslipOvertime(payslip.id, Number(otHours) || 0, Number(otPay) || 0, payslip.notes);
      if (res.error) setError(res.error);
      else {
        setShowOvertime(false);
        onChanged();
      }
    });
  }

  function saveDeduction() {
    if (!dedLabel.trim() || !Number(dedAmount)) {
      setError("Enter a label and amount.");
      return;
    }
    startTransition(async () => {
      const res = await addPayslipDeduction(payslip.id, dedLabel, Number(dedAmount));
      if (res.error) setError(res.error);
      else {
        setDedLabel("");
        setDedAmount("");
        setShowDeduction(false);
        onChanged();
      }
    });
  }

  function removeDeduction(id: string) {
    startTransition(async () => {
      await removePayslipDeduction(id, payslip.id);
      onChanged();
    });
  }

  return (
    <div className="bg-white rounded-2xl shadow p-4">
      <div className="flex justify-between items-start mb-2">
        <div>
          <p className="font-semibold text-neutral-800">{payslip.employees?.full_name}</p>
          <p className="text-xs text-neutral-400 capitalize">
            {payslip.employees?.role} · {payslip.employees?.pay_type} rate ₱{payslip.employees?.pay_rate.toFixed(2)}
          </p>
        </div>
        <p className="text-lg font-bold text-amber-700">₱{payslip.net_pay.toFixed(2)}</p>
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
        <span className="text-neutral-500">Regular pay ({payslip.regular_hours}h)</span>
        <span className="text-right">₱{payslip.regular_pay.toFixed(2)}</span>
        <span className="text-neutral-500">Overtime pay ({payslip.overtime_hours}h)</span>
        <span className="text-right">₱{payslip.overtime_pay.toFixed(2)}</span>
        <span className="text-neutral-500 font-medium">Gross pay</span>
        <span className="text-right font-medium">₱{payslip.gross_pay.toFixed(2)}</span>
      </div>

      {payslip.payslip_deductions.length > 0 && (
        <div className="mt-2 pt-2 border-t border-neutral-100 space-y-1">
          {payslip.payslip_deductions.map((d) => (
            <div key={d.id} className="flex justify-between text-sm text-red-600">
              <span>
                {d.label}
                {!locked && (
                  <button onClick={() => removeDeduction(d.id)} className="ml-2 text-xs text-neutral-400 underline">
                    remove
                  </button>
                )}
              </span>
              <span>−₱{d.amount.toFixed(2)}</span>
            </div>
          ))}
        </div>
      )}

      {error && <p className="text-red-600 text-sm mt-2">{error}</p>}

      {!locked && (
        <div className="flex gap-2 mt-3">
          <button
            onClick={() => setShowOvertime((v) => !v)}
            className="text-xs font-medium text-amber-700 underline"
          >
            Edit overtime
          </button>
          <button
            onClick={() => setShowDeduction((v) => !v)}
            className="text-xs font-medium text-amber-700 underline"
          >
            + Add deduction
          </button>
        </div>
      )}

      {showOvertime && (
        <div className="mt-2 p-3 rounded-xl bg-neutral-50 flex gap-2 items-end">
          <div>
            <label className="text-xs text-neutral-500">OT hours</label>
            <input
              type="number"
              min="0"
              step="0.25"
              value={otHours}
              onChange={(e) => setOtHours(e.target.value)}
              className="w-20 rounded-lg border border-neutral-300 px-2 py-1.5 text-sm block"
            />
          </div>
          <div>
            <label className="text-xs text-neutral-500">OT pay (₱)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={otPay}
              onChange={(e) => setOtPay(e.target.value)}
              className="w-24 rounded-lg border border-neutral-300 px-2 py-1.5 text-sm block"
            />
          </div>
          <button
            onClick={saveOvertime}
            disabled={isPending}
            className="px-3 py-2 rounded-lg bg-amber-600 text-white text-xs font-medium"
          >
            Save
          </button>
        </div>
      )}

      {showDeduction && (
        <div className="mt-2 p-3 rounded-xl bg-neutral-50 flex gap-2 items-end flex-wrap">
          <div>
            <label className="text-xs text-neutral-500">Label</label>
            <input
              placeholder="SSS, PhilHealth, ..."
              value={dedLabel}
              onChange={(e) => setDedLabel(e.target.value)}
              className="w-32 rounded-lg border border-neutral-300 px-2 py-1.5 text-sm block"
            />
          </div>
          <div>
            <label className="text-xs text-neutral-500">Amount (₱)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={dedAmount}
              onChange={(e) => setDedAmount(e.target.value)}
              className="w-24 rounded-lg border border-neutral-300 px-2 py-1.5 text-sm block"
            />
          </div>
          <button
            onClick={saveDeduction}
            disabled={isPending}
            className="px-3 py-2 rounded-lg bg-amber-600 text-white text-xs font-medium"
          >
            Add
          </button>
        </div>
      )}
    </div>
  );
}
