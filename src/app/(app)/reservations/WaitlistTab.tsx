"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addWaitlistEntry, updateWaitlistStatus } from "./actions";
import type { WaitlistRow } from "@/lib/domain-types";

export function WaitlistTab({ waitlist }: { waitlist: WaitlistRow[] }) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [isPending, startTransition] = useTransition();

  function setStatus(id: string, status: "seated" | "cancelled" | "no_show") {
    startTransition(async () => {
      await updateWaitlistStatus(id, status);
      router.refresh();
    });
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-3">
        <h2 className="font-semibold text-neutral-800">Walk-in Waitlist</h2>
        <button
          onClick={() => setShowForm(true)}
          className="px-4 py-2 rounded-xl bg-amber-600 text-white text-sm font-medium"
        >
          + Add to Waitlist
        </button>
      </div>

      <div className="space-y-2">
        {waitlist.map((w) => (
          <div key={w.id} className="bg-white rounded-2xl shadow p-4 flex items-center justify-between">
            <div>
              <p className="font-semibold text-neutral-800">
                #{w.queue_position} · {w.customer_name}
              </p>
              <p className="text-sm text-neutral-500">
                {w.party_size} guests
                {w.contact_number && ` · ${w.contact_number}`}
                {w.estimated_wait_minutes != null && ` · ~${w.estimated_wait_minutes} min wait`}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                disabled={isPending}
                onClick={() => setStatus(w.id, "seated")}
                className="px-3 py-2 rounded-lg bg-green-600 text-white text-xs font-medium disabled:opacity-40"
              >
                Seat
              </button>
              <button
                disabled={isPending}
                onClick={() => setStatus(w.id, "no_show")}
                className="px-3 py-2 rounded-lg bg-red-50 text-red-700 text-xs font-medium disabled:opacity-40"
              >
                No-show
              </button>
              <button
                disabled={isPending}
                onClick={() => setStatus(w.id, "cancelled")}
                className="px-3 py-2 rounded-lg bg-neutral-100 text-neutral-600 text-xs font-medium disabled:opacity-40"
              >
                Remove
              </button>
            </div>
          </div>
        ))}
        {waitlist.length === 0 && <p className="text-neutral-400 text-sm">No one waiting right now.</p>}
      </div>

      {showForm && (
        <AddWaitlistForm
          onClose={() => setShowForm(false)}
          onAdded={() => {
            setShowForm(false);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function AddWaitlistForm({ onClose, onAdded }: { onClose: () => void; onAdded: () => void }) {
  const [customerName, setCustomerName] = useState("");
  const [contactNumber, setContactNumber] = useState("");
  const [partySize, setPartySize] = useState("2");
  const [estimatedWait, setEstimatedWait] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit() {
    startTransition(async () => {
      const res = await addWaitlistEntry({
        customerName,
        contactNumber: contactNumber || null,
        partySize: Number(partySize) || 1,
        estimatedWaitMinutes: estimatedWait ? Number(estimatedWait) : null,
      });
      if (res.error) setError(res.error);
      else onAdded();
    });
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-xl p-5 w-full max-w-xs space-y-2">
        <h3 className="font-semibold text-neutral-800 mb-1">Add to Waitlist</h3>
        <input
          placeholder="Name"
          value={customerName}
          onChange={(e) => setCustomerName(e.target.value)}
          className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
        />
        <input
          placeholder="Contact number (optional)"
          value={contactNumber}
          onChange={(e) => setContactNumber(e.target.value)}
          className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
        />
        <input
          type="number"
          min="1"
          placeholder="Party size"
          value={partySize}
          onChange={(e) => setPartySize(e.target.value)}
          className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
        />
        <input
          type="number"
          min="0"
          placeholder="Estimated wait (minutes)"
          value={estimatedWait}
          onChange={(e) => setEstimatedWait(e.target.value)}
          className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
        />
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <div className="flex gap-2 pt-2">
          <button
            onClick={submit}
            disabled={isPending || !customerName.trim()}
            className="flex-1 rounded-xl bg-amber-600 text-white font-semibold py-3 disabled:opacity-40"
          >
            {isPending ? "Adding..." : "Add"}
          </button>
          <button onClick={onClose} className="px-4 text-sm text-neutral-500">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
