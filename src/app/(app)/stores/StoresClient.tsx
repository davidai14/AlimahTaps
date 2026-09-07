"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createStore, switchActiveStore, updateStore } from "./actions";
import type { StoreRow } from "./data";

export function StoresClient({ stores, activeStoreId }: { stores: StoreRow[]; activeStoreId: string }) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<StoreRow | null>(null);
  const [isPending, startTransition] = useTransition();

  function switchTo(storeId: string) {
    startTransition(async () => {
      await switchActiveStore(storeId);
      router.refresh();
    });
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-3">
        <div>
          <h2 className="font-semibold text-neutral-800">Branches</h2>
          <p className="text-xs text-neutral-400">
            You&apos;re currently operating in: {stores.find((s) => s.id === activeStoreId)?.name}
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="px-4 py-2 rounded-xl bg-amber-600 text-white text-sm font-medium"
        >
          + Add Branch
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {stores.map((s) => (
          <div
            key={s.id}
            className={`bg-white rounded-2xl shadow p-4 ${s.id === activeStoreId ? "ring-2 ring-amber-400" : ""}`}
          >
            <p className="font-semibold text-neutral-800">{s.name}</p>
            {s.address && <p className="text-sm text-neutral-500">{s.address}</p>}
            {s.phone && <p className="text-sm text-neutral-500">{s.phone}</p>}
            <p className="text-xs text-neutral-400 mt-1 uppercase">{s.vat_status.replace("_", "-")}</p>
            <div className="flex gap-2 mt-2">
              <button onClick={() => setEditing(s)} className="text-xs font-medium text-amber-700 underline">
                Edit
              </button>
              {s.id !== activeStoreId && (
                <button
                  disabled={isPending}
                  onClick={() => switchTo(s.id)}
                  className="text-xs font-medium text-neutral-500 underline disabled:opacity-40"
                >
                  Switch to this branch
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {showForm && (
        <NewStoreForm
          existingStores={stores}
          onClose={() => setShowForm(false)}
          onCreated={() => {
            setShowForm(false);
            router.refresh();
          }}
        />
      )}
      {editing && (
        <EditStoreForm
          store={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function NewStoreForm({
  existingStores,
  onClose,
  onCreated,
}: {
  existingStores: StoreRow[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [landline, setLandline] = useState("");
  const [vatStatus, setVatStatus] = useState<"non_vat" | "vat">(existingStores[0]?.vat_status ?? "non_vat");
  const [cloneFrom, setCloneFrom] = useState(existingStores[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit() {
    startTransition(async () => {
      const res = await createStore({
        name,
        address: address || null,
        phone: phone || null,
        landline: landline || null,
        vatStatus,
        cloneFromStoreId: cloneFrom || null,
      });
      if (res.error) setError(res.error);
      else onCreated();
    });
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-xl p-5 w-full max-w-sm my-8 space-y-2">
        <h3 className="font-semibold text-neutral-800 mb-2">Add Branch</h3>
        <input
          placeholder="Branch name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
        />
        <input
          placeholder="Address"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
        />
        <input
          placeholder="Mobile number"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
        />
        <input
          placeholder="Landline (optional)"
          value={landline}
          onChange={(e) => setLandline(e.target.value)}
          className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
        />
        <select
          value={vatStatus}
          onChange={(e) => setVatStatus(e.target.value as "non_vat" | "vat")}
          className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
        >
          <option value="non_vat">Non-VAT / Percentage Tax</option>
          <option value="vat">VAT-registered</option>
        </select>
        {existingStores.length > 0 && (
          <div>
            <label className="text-xs text-neutral-500">Clone menu &amp; inventory from</label>
            <select
              value={cloneFrom}
              onChange={(e) => setCloneFrom(e.target.value)}
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
            >
              <option value="">Start empty</option>
              {existingStores.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <p className="text-xs text-neutral-400 mt-1">
              Copies categories, menu items, recipes, and inventory items (opening stock starts at 0 — receive a PO
              to bring the new branch&apos;s stock in).
            </p>
          </div>
        )}
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <div className="flex gap-2 pt-2">
          <button
            onClick={submit}
            disabled={isPending || !name.trim()}
            className="flex-1 rounded-xl bg-amber-600 text-white font-semibold py-3 disabled:opacity-40"
          >
            {isPending ? "Creating..." : "Create Branch"}
          </button>
          <button onClick={onClose} className="px-4 text-sm text-neutral-500">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

function EditStoreForm({ store, onClose, onSaved }: { store: StoreRow; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(store.name);
  const [address, setAddress] = useState(store.address ?? "");
  const [phone, setPhone] = useState(store.phone ?? "");
  const [targetPrepTime, setTargetPrepTime] = useState(store.target_prep_time_minutes.toString());
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit() {
    startTransition(async () => {
      const res = await updateStore(store.id, {
        name,
        address: address || null,
        phone: phone || null,
        targetPrepTimeMinutes: Number(targetPrepTime) || 15,
      });
      if (res.error) setError(res.error);
      else onSaved();
    });
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-xl p-5 w-full max-w-sm space-y-2">
        <h3 className="font-semibold text-neutral-800 mb-2">Edit {store.name}</h3>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
        />
        <input
          placeholder="Address"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
        />
        <input
          placeholder="Phone"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
        />
        <div>
          <label className="text-xs text-neutral-500">KDS target prep time (minutes)</label>
          <input
            type="number"
            min="1"
            value={targetPrepTime}
            onChange={(e) => setTargetPrepTime(e.target.value)}
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
          />
        </div>
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <div className="flex gap-2 pt-2">
          <button
            onClick={submit}
            disabled={isPending}
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
