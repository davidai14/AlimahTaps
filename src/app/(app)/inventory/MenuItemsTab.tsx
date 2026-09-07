"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toggleMenuItemActive, uploadMenuWorkbook, type MenuImportResult } from "./menu-actions";
import type { MenuItemFull } from "./menu-data";

export function MenuItemsTab({ items }: { items: MenuItemFull[] }) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<MenuImportResult | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const byCategory = new Map<string, MenuItemFull[]>();
  for (const item of items) {
    const key = item.category_name ?? "Uncategorized";
    byCategory.set(key, [...(byCategory.get(key) ?? []), item]);
  }

  function toggleExpanded(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleUpload(file: File) {
    setResult(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("file", file);
      const res = await uploadMenuWorkbook(fd);
      setResult(res);
      if (fileInputRef.current) fileInputRef.current.value = "";
      if (res.summary) router.refresh();
    });
  }

  function handleToggleActive(id: string, next: boolean) {
    startTransition(async () => {
      await toggleMenuItemActive(id, next);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl shadow p-4">
        <h2 className="font-semibold text-neutral-800 mb-1">Bulk add / edit via Excel</h2>
        <p className="text-sm text-neutral-500 mb-3">
          Download the current menu as a spreadsheet, edit item names, prices, and their inventory
          components (the recipe used for automatic stock deduction), then upload it back. New
          items/categories are created automatically; existing ones (matched by name) are updated.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <a
            href="/inventory/menu-template"
            className="px-4 py-2 rounded-xl bg-white border border-neutral-300 text-neutral-700 font-medium text-sm"
          >
            Download template (.xlsx)
          </a>
          <label className="px-4 py-2 rounded-xl bg-amber-600 text-white font-medium text-sm cursor-pointer">
            {isPending ? "Uploading…" : "Upload filled template"}
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx"
              className="hidden"
              disabled={isPending}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleUpload(f);
              }}
            />
          </label>
        </div>

        {result?.error && <p className="text-red-600 text-sm mt-3">{result.error}</p>}
        {result?.errors && (
          <div className="mt-3 p-3 rounded-xl bg-red-50 text-sm text-red-700 space-y-1 max-h-64 overflow-y-auto">
            <p className="font-medium">Nothing was imported — fix these and re-upload:</p>
            {result.errors.map((e, i) => (
              <p key={i}>• {e}</p>
            ))}
          </div>
        )}
        {result?.summary && (
          <p className="mt-3 text-sm text-green-700">
            Imported: {result.summary.itemsCreated} new item(s), {result.summary.itemsUpdated} updated,{" "}
            {result.summary.categoriesCreated} new categor{result.summary.categoriesCreated === 1 ? "y" : "ies"}.
          </p>
        )}
      </div>

      <div className="space-y-4">
        {[...byCategory.entries()].map(([category, categoryItems]) => (
          <div key={category} className="bg-white rounded-2xl shadow p-4">
            <p className="text-sm font-medium text-neutral-500 mb-2">{category}</p>
            <div className="space-y-1">
              {categoryItems.map((item) => (
                <div key={item.id} className="border-t border-neutral-100 first:border-t-0 pt-2 first:pt-0">
                  <div className="flex items-center justify-between gap-2">
                    <button
                      onClick={() => toggleExpanded(item.id)}
                      className="flex-1 text-left flex items-center gap-2"
                    >
                      <span className={`font-medium ${item.is_active ? "text-neutral-800" : "text-neutral-400"}`}>
                        {item.name}
                      </span>
                      {!item.is_active && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-500">Inactive</span>
                      )}
                      <span className="text-xs text-neutral-400">
                        {item.components.length} component(s), {item.variants.length} variant(s)
                      </span>
                    </button>
                    <span className="text-sm font-semibold text-amber-700">₱{item.price.toFixed(2)}</span>
                    <button
                      disabled={isPending}
                      onClick={() => handleToggleActive(item.id, !item.is_active)}
                      className="text-xs px-2 py-1 rounded-lg border border-neutral-200 text-neutral-500 disabled:opacity-40"
                    >
                      {item.is_active ? "Deactivate" : "Activate"}
                    </button>
                  </div>

                  {expanded.has(item.id) && (
                    <div className="mt-2 mb-1 pl-1 space-y-2 text-sm">
                      {item.variants.length > 0 && (
                        <div>
                          <p className="text-xs font-medium text-neutral-400">Variants</p>
                          {item.variants.map((v) => (
                            <p key={v.id} className="text-neutral-600">
                              {v.name} ({v.price_delta >= 0 ? "+" : ""}
                              ₱{v.price_delta.toFixed(2)})
                            </p>
                          ))}
                        </div>
                      )}
                      <div>
                        <p className="text-xs font-medium text-neutral-400">Components (inventory used per sale)</p>
                        {item.components.length === 0 && (
                          <p className="text-neutral-400">No components set — selling this item won&apos;t deduct any inventory.</p>
                        )}
                        {item.components.map((c) => (
                          <p key={c.id} className="text-neutral-600">
                            {c.quantity}
                            {c.unit} {c.inventory_item_name}
                            {c.variant_name ? ` (only for "${c.variant_name}")` : ""}
                          </p>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
        {items.length === 0 && (
          <p className="text-neutral-400 text-sm">No menu items yet — download the template to add your first ones.</p>
        )}
      </div>
    </div>
  );
}
