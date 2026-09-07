"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { switchActiveStore } from "./stores/actions";

export function BranchSwitcher({
  stores,
  activeStoreId,
}: {
  stores: { id: string; name: string }[];
  activeStoreId: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  if (stores.length <= 1) return null;

  function onChange(storeId: string) {
    startTransition(async () => {
      await switchActiveStore(storeId);
      router.refresh();
    });
  }

  return (
    <select
      value={activeStoreId}
      disabled={isPending}
      onChange={(e) => onChange(e.target.value)}
      className="text-sm rounded-lg border border-neutral-200 px-2 py-1.5 bg-white text-neutral-700 disabled:opacity-50"
    >
      {stores.map((s) => (
        <option key={s.id} value={s.id}>
          {s.name}
        </option>
      ))}
    </select>
  );
}
