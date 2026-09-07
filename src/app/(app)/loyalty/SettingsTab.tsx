"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateLoyaltySettings } from "./actions";
import type { LoyaltySettingsRow } from "@/lib/domain-types";

export function SettingsTab({ settings }: { settings: LoyaltySettingsRow | null }) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(settings?.enabled ?? false);
  const [pointsPerPeso, setPointsPerPeso] = useState(settings?.points_per_peso_spent?.toString() ?? "");
  const [pesoPerPoint, setPesoPerPoint] = useState(settings?.peso_value_per_point?.toString() ?? "");
  const [minRedeem, setMinRedeem] = useState(settings?.min_redeem_points?.toString() ?? "0");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();

  function submit() {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const res = await updateLoyaltySettings({
        enabled,
        pointsPerPesoSpent: pointsPerPeso ? Number(pointsPerPeso) : null,
        pesoValuePerPoint: pesoPerPoint ? Number(pesoPerPoint) : null,
        minRedeemPoints: Number(minRedeem) || 0,
      });
      if (res.error) setError(res.error);
      else {
        setSaved(true);
        router.refresh();
      }
    });
  }

  const example =
    pointsPerPeso && pesoPerPoint
      ? `Example: a ₱500 order earns ${(500 * Number(pointsPerPeso)).toFixed(0)} points. ${Number(minRedeem) || 0} points can be redeemed for ₱${((Number(minRedeem) || 0) * Number(pesoPerPoint)).toFixed(2)} off a future order.`
      : null;

  return (
    <div className="max-w-md bg-white rounded-2xl shadow p-5 space-y-3">
      <p className="text-sm text-neutral-500">
        These rates are entirely up to you — nothing is pre-filled or assumed. The program stays off until you set
        both rates and turn it on.
      </p>

      <div>
        <label className="text-xs text-neutral-500">Points earned per ₱1 spent</label>
        <input
          type="number"
          min="0"
          step="0.01"
          placeholder="e.g. 1"
          value={pointsPerPeso}
          onChange={(e) => setPointsPerPeso(e.target.value)}
          className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="text-xs text-neutral-500">Peso value per point when redeemed</label>
        <input
          type="number"
          min="0"
          step="0.01"
          placeholder="e.g. 0.50"
          value={pesoPerPoint}
          onChange={(e) => setPesoPerPoint(e.target.value)}
          className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="text-xs text-neutral-500">Minimum points required to redeem</label>
        <input
          type="number"
          min="0"
          step="1"
          value={minRedeem}
          onChange={(e) => setMinRedeem(e.target.value)}
          className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
        />
      </div>

      {example && <p className="text-xs text-neutral-400 bg-neutral-50 rounded-lg p-2">{example}</p>}

      <label className="flex items-center gap-2 text-sm text-neutral-700 pt-2 border-t border-neutral-100">
        <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
        Loyalty program is active (customers earn/redeem points in POS)
      </label>

      {error && <p className="text-red-600 text-sm">{error}</p>}
      {saved && !error && <p className="text-green-600 text-sm">Saved.</p>}

      <button
        onClick={submit}
        disabled={isPending}
        className="w-full rounded-xl bg-amber-600 text-white font-semibold py-3 disabled:opacity-40"
      >
        {isPending ? "Saving..." : "Save Settings"}
      </button>
    </div>
  );
}
