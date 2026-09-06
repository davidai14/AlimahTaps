"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createSupplier } from "./actions";
import type { SupplierRow } from "@/lib/domain-types";

export function SuppliersTab({
  suppliers,
  onViewHistory,
}: {
  suppliers: SupplierRow[];
  onViewHistory: (supplierId: string) => void;
}) {
  const [showForm, setShowForm] = useState(false);

  return (
    <div>
      <div className="flex justify-between items-center mb-3">
        <h2 className="font-semibold text-neutral-800">Suppliers</h2>
        <button
          onClick={() => setShowForm(true)}
          className="px-4 py-2 rounded-xl bg-amber-600 text-white text-sm font-medium"
        >
          + Add Supplier
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {suppliers.map((s) => (
          <div key={s.id} className="bg-white rounded-2xl shadow p-4">
            <p className="font-semibold text-neutral-800">{s.name}</p>
            {s.contact_person && <p className="text-sm text-neutral-500">{s.contact_person}</p>}
            {s.phone && <p className="text-sm text-neutral-500">{s.phone}</p>}
            {s.email && <p className="text-sm text-neutral-500">{s.email}</p>}
            {s.address && <p className="text-xs text-neutral-400 mt-1">{s.address}</p>}
            <button
              onClick={() => onViewHistory(s.id)}
              className="mt-2 text-xs font-medium text-amber-700 underline"
            >
              View PO history
            </button>
          </div>
        ))}
      </div>

      {showForm && <SupplierForm onClose={() => setShowForm(false)} />}
    </div>
  );
}

function SupplierForm({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [contactPerson, setContactPerson] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit() {
    startTransition(async () => {
      const res = await createSupplier({
        name,
        contactPerson: contactPerson || null,
        phone: phone || null,
        email: email || null,
        address: address || null,
      });
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
        <h3 className="font-semibold text-neutral-800 mb-2">Add Supplier</h3>
        <input
          placeholder="Supplier name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
        />
        <input
          placeholder="Contact person"
          value={contactPerson}
          onChange={(e) => setContactPerson(e.target.value)}
          className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
        />
        <input
          placeholder="Phone"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
        />
        <input
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
        />
        <input
          placeholder="Address"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
        />
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <div className="flex gap-2 pt-2">
          <button
            onClick={submit}
            disabled={isPending || !name.trim()}
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
