"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createOrder, findCustomerByPhone, type NewOrderItemInput } from "@/lib/orders/actions";
import { CHANNEL_LABEL, PLATFORM_CHANNELS } from "@/lib/constants";
import type { LoyaltyPosSettings } from "./PosClient";
import type {
  DiscountType,
  MenuCategory,
  MenuItem,
  OrderChannel,
  RestaurantTable,
} from "@/lib/domain-types";

type CartLine = NewOrderItemInput & { key: string; menuItemName: string; variantName: string | null };

const CHANNELS: OrderChannel[] = [
  "dine_in",
  "phone",
  "landline",
  "facebook",
  "grabfood",
  "foodpanda",
  "online",
];

type LoyaltyLookup =
  | { status: "idle" }
  | { status: "found"; id: string; fullName: string; pointsBalance: number }
  | { status: "not_found" };

export function NewOrderTab({
  categories,
  items,
  tables,
  loyalty,
  onOrderCreated,
}: {
  categories: MenuCategory[];
  items: MenuItem[];
  tables: RestaurantTable[];
  loyalty: LoyaltyPosSettings | null;
  onOrderCreated: () => void;
}) {
  const router = useRouter();
  const [channel, setChannel] = useState<OrderChannel>("dine_in");
  const [tableId, setTableId] = useState<string | null>(null);
  const [customerName, setCustomerName] = useState("");
  const [customerContact, setCustomerContact] = useState("");
  const [externalReference, setExternalReference] = useState("");
  const [platformCommission, setPlatformCommission] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | "all">("all");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [variantPicker, setVariantPicker] = useState<MenuItem | null>(null);
  const [discountType, setDiscountType] = useState<DiscountType>("none");
  const [discountIdNumber, setDiscountIdNumber] = useState("");
  const [promoAmount, setPromoAmount] = useState("");
  const [loyaltyPhone, setLoyaltyPhone] = useState("");
  const [loyaltyLookup, setLoyaltyLookup] = useState<LoyaltyLookup>({ status: "idle" });
  const [loyaltyNewName, setLoyaltyNewName] = useState("");
  const [redeemPointsInput, setRedeemPointsInput] = useState("");
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const visibleItems = useMemo(
    () => (activeCategory === "all" ? items : items.filter((i) => i.category_id === activeCategory)),
    [items, activeCategory]
  );

  const subtotal = cart.reduce((s, l) => s + l.quantity * l.unitPrice, 0);
  const discountAmount =
    discountType === "senior" || discountType === "pwd"
      ? Math.round(subtotal * 0.2 * 100) / 100
      : discountType === "promo"
        ? Math.min(Math.max(Number(promoAmount) || 0, 0), subtotal)
        : 0;
  const afterStaffDiscount = Math.round((subtotal - discountAmount) * 100) / 100;

  const redeemPoints = Number(redeemPointsInput) || 0;
  const loyaltyDiscount =
    loyalty && loyaltyLookup.status === "found" && redeemPoints > 0
      ? Math.min(Math.round(redeemPoints * loyalty.pesoValuePerPoint * 100) / 100, afterStaffDiscount)
      : 0;

  const total = Math.round((afterStaffDiscount - loyaltyDiscount) * 100) / 100;

  function lookupCustomer() {
    if (!loyaltyPhone.trim()) return;
    setIsLookingUp(true);
    setLoyaltyLookup({ status: "idle" });
    findCustomerByPhone(loyaltyPhone).then((res) => {
      setIsLookingUp(false);
      setLoyaltyLookup(res ? { status: "found", ...res } : { status: "not_found" });
    });
  }

  function addToCart(item: MenuItem, variantId: string | null, variantName: string | null, priceDelta: number) {
    const key = `${item.id}:${variantId ?? "base"}`;
    setCart((prev) => {
      const existing = prev.find((l) => l.key === key);
      if (existing) {
        return prev.map((l) => (l.key === key ? { ...l, quantity: l.quantity + 1 } : l));
      }
      return [
        ...prev,
        {
          key,
          menuItemId: item.id,
          menuItemName: item.name,
          variantId,
          variantName,
          quantity: 1,
          unitPrice: item.price + priceDelta,
          notes: null,
        },
      ];
    });
  }

  function handleItemTap(item: MenuItem) {
    if (item.menu_item_variants.length > 0) {
      setVariantPicker(item);
    } else {
      addToCart(item, null, null, 0);
    }
  }

  function updateQty(key: string, delta: number) {
    setCart((prev) =>
      prev
        .map((l) => (l.key === key ? { ...l, quantity: l.quantity + delta } : l))
        .filter((l) => l.quantity > 0)
    );
  }

  function updateNotes(key: string, notes: string) {
    setCart((prev) => prev.map((l) => (l.key === key ? { ...l, notes } : l)));
  }

  function resetForm() {
    setCart([]);
    setTableId(null);
    setCustomerName("");
    setCustomerContact("");
    setExternalReference("");
    setPlatformCommission("");
    setDiscountType("none");
    setDiscountIdNumber("");
    setPromoAmount("");
    setLoyaltyPhone("");
    setLoyaltyLookup({ status: "idle" });
    setLoyaltyNewName("");
    setRedeemPointsInput("");
  }

  function submit() {
    setError(null);
    if (cart.length === 0) {
      setError("Add at least one item.");
      return;
    }
    startTransition(async () => {
      const res = await createOrder({
        channel,
        tableId,
        customerName: customerName || null,
        customerContact: customerContact || null,
        externalReference: externalReference || null,
        platformCommission: Number(platformCommission) || 0,
        discountType,
        discountIdNumber: discountIdNumber || null,
        promoDiscountAmount: Number(promoAmount) || 0,
        loyaltyCustomerPhone: loyaltyPhone || null,
        loyaltyCustomerName: loyaltyLookup.status === "not_found" ? loyaltyNewName || null : null,
        redeemPoints,
        items: cart.map(({ menuItemId, variantId, quantity, unitPrice, notes }) => ({
          menuItemId,
          variantId,
          quantity,
          unitPrice,
          notes,
        })),
      });
      if (res.error) {
        setError(res.error);
      } else {
        resetForm();
        router.refresh();
        onOrderCreated();
      }
    });
  }

  const isPlatform = PLATFORM_CHANNELS.includes(channel as (typeof PLATFORM_CHANNELS)[number]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div className="lg:col-span-2 space-y-4">
        <div className="bg-white rounded-2xl shadow p-4">
          <p className="text-sm font-medium text-neutral-500 mb-2">Order Channel</p>
          <div className="flex flex-wrap gap-2">
            {CHANNELS.map((c) => (
              <button
                key={c}
                onClick={() => setChannel(c)}
                className={`px-4 py-3 rounded-xl text-sm font-medium border-2 transition ${
                  channel === c
                    ? "bg-amber-600 border-amber-600 text-white"
                    : "bg-neutral-50 border-neutral-200 text-neutral-700 hover:border-amber-300"
                }`}
              >
                {CHANNEL_LABEL[c]}
              </button>
            ))}
          </div>

          {channel === "dine_in" && (
            <div className="mt-4">
              <p className="text-sm font-medium text-neutral-500 mb-2">Table</p>
              <div className="flex flex-wrap gap-2">
                {tables.map((t) => (
                  <button
                    key={t.id}
                    disabled={t.status === "occupied" && tableId !== t.id}
                    onClick={() => setTableId(t.id)}
                    className={`h-16 w-16 rounded-xl border-2 font-semibold transition ${
                      tableId === t.id
                        ? "bg-amber-600 border-amber-600 text-white"
                        : t.status === "occupied"
                          ? "bg-neutral-200 border-neutral-200 text-neutral-400 cursor-not-allowed"
                          : "bg-neutral-50 border-neutral-200 hover:border-amber-300"
                    }`}
                  >
                    {t.table_number}
                  </button>
                ))}
              </div>
            </div>
          )}

          {channel !== "dine_in" && !isPlatform && (
            <div className="mt-4 grid grid-cols-2 gap-3">
              <input
                placeholder="Customer name"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="rounded-lg border border-neutral-300 px-3 py-2"
              />
              <input
                placeholder="Contact number / FB name"
                value={customerContact}
                onChange={(e) => setCustomerContact(e.target.value)}
                className="rounded-lg border border-neutral-300 px-3 py-2"
              />
            </div>
          )}

          {isPlatform && (
            <div className="mt-4 grid grid-cols-2 gap-3">
              <input
                placeholder={`${CHANNEL_LABEL[channel]} order ID`}
                value={externalReference}
                onChange={(e) => setExternalReference(e.target.value)}
                className="rounded-lg border border-neutral-300 px-3 py-2"
              />
              <input
                placeholder="Platform commission (₱)"
                type="number"
                min="0"
                step="0.01"
                value={platformCommission}
                onChange={(e) => setPlatformCommission(e.target.value)}
                className="rounded-lg border border-neutral-300 px-3 py-2"
              />
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl shadow p-4">
          <div className="flex gap-2 overflow-x-auto pb-2 mb-3">
            <button
              onClick={() => setActiveCategory("all")}
              className={`px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap ${
                activeCategory === "all" ? "bg-neutral-800 text-white" : "bg-neutral-100 text-neutral-600"
              }`}
            >
              All
            </button>
            {categories.map((c) => (
              <button
                key={c.id}
                onClick={() => setActiveCategory(c.id)}
                className={`px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap ${
                  activeCategory === c.id ? "bg-neutral-800 text-white" : "bg-neutral-100 text-neutral-600"
                }`}
              >
                {c.name}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {visibleItems.map((item) => (
              <button
                key={item.id}
                onClick={() => handleItemTap(item)}
                className="text-left rounded-xl border-2 border-neutral-200 hover:border-amber-300 active:scale-95 transition p-3 min-h-[92px] flex flex-col justify-between"
              >
                <span className="font-medium text-neutral-800">{item.name}</span>
                <span className="text-amber-700 font-semibold">₱{item.price.toFixed(2)}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow p-4 flex flex-col h-fit lg:sticky lg:top-4">
        <h2 className="font-semibold text-neutral-800 mb-3">Cart</h2>
        {cart.length === 0 && <p className="text-sm text-neutral-400">No items yet</p>}
        <div className="space-y-3 max-h-[40vh] overflow-y-auto">
          {cart.map((l) => (
            <div key={l.key} className="border-b border-neutral-100 pb-2">
              <div className="flex justify-between items-start gap-2">
                <div>
                  <p className="text-sm font-medium text-neutral-800">
                    {l.menuItemName}
                    {l.variantName ? ` (${l.variantName})` : ""}
                  </p>
                  <p className="text-xs text-neutral-400">₱{l.unitPrice.toFixed(2)} each</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => updateQty(l.key, -1)}
                    className="h-7 w-7 rounded-full bg-neutral-100 font-bold"
                  >
                    −
                  </button>
                  <span className="w-5 text-center">{l.quantity}</span>
                  <button
                    onClick={() => updateQty(l.key, 1)}
                    className="h-7 w-7 rounded-full bg-neutral-100 font-bold"
                  >
                    +
                  </button>
                </div>
              </div>
              <input
                placeholder="Notes (e.g. no onions)"
                value={l.notes ?? ""}
                onChange={(e) => updateNotes(l.key, e.target.value)}
                className="mt-1 w-full text-xs rounded border border-neutral-200 px-2 py-1"
              />
            </div>
          ))}
        </div>

        <div className="mt-4">
          <p className="text-sm font-medium text-neutral-500 mb-1">Discount</p>
          <div className="flex gap-1 flex-wrap">
            {(["none", "senior", "pwd", "promo"] as DiscountType[]).map((d) => (
              <button
                key={d}
                onClick={() => setDiscountType(d)}
                className={`px-2 py-1.5 rounded-lg text-xs font-medium capitalize ${
                  discountType === d ? "bg-neutral-800 text-white" : "bg-neutral-100 text-neutral-600"
                }`}
              >
                {d === "none" ? "No Discount" : d}
              </button>
            ))}
          </div>
          {(discountType === "senior" || discountType === "pwd") && (
            <input
              placeholder={`${discountType === "senior" ? "Senior Citizen" : "PWD"} ID number`}
              value={discountIdNumber}
              onChange={(e) => setDiscountIdNumber(e.target.value)}
              className="mt-2 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
            />
          )}
          {discountType === "promo" && (
            <input
              placeholder="Discount amount (₱)"
              type="number"
              min="0"
              step="0.01"
              value={promoAmount}
              onChange={(e) => setPromoAmount(e.target.value)}
              className="mt-2 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
            />
          )}
        </div>

        {loyalty && (
          <div className="mt-4 pt-3 border-t border-neutral-100">
            <p className="text-sm font-medium text-neutral-500 mb-1">Loyalty Customer (optional)</p>
            <div className="flex gap-2">
              <input
                placeholder="Customer phone"
                value={loyaltyPhone}
                onChange={(e) => {
                  setLoyaltyPhone(e.target.value);
                  setLoyaltyLookup({ status: "idle" });
                }}
                className="flex-1 rounded-lg border border-neutral-300 px-3 py-2 text-sm"
              />
              <button
                onClick={lookupCustomer}
                disabled={isLookingUp || !loyaltyPhone.trim()}
                className="px-3 py-2 rounded-lg bg-neutral-100 text-neutral-700 text-xs font-medium disabled:opacity-40"
              >
                {isLookingUp ? "..." : "Look up"}
              </button>
            </div>
            {loyaltyLookup.status === "found" && (
              <div className="mt-2 text-xs text-neutral-600">
                <p>
                  {loyaltyLookup.fullName} — {loyaltyLookup.pointsBalance.toFixed(2)} points available
                </p>
                <input
                  type="number"
                  min="0"
                  max={loyaltyLookup.pointsBalance}
                  step="1"
                  placeholder={`Redeem points (min ${loyalty.minRedeemPoints})`}
                  value={redeemPointsInput}
                  onChange={(e) => setRedeemPointsInput(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
                />
              </div>
            )}
            {loyaltyLookup.status === "not_found" && (
              <div className="mt-2">
                <p className="text-xs text-neutral-400 mb-1">No customer found — add their name to enroll them:</p>
                <input
                  placeholder="Customer name"
                  value={loyaltyNewName}
                  onChange={(e) => setLoyaltyNewName(e.target.value)}
                  className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
                />
              </div>
            )}
          </div>
        )}

        <div className="mt-4 space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-neutral-500">Subtotal</span>
            <span>₱{subtotal.toFixed(2)}</span>
          </div>
          {discountAmount > 0 && (
            <div className="flex justify-between text-red-600">
              <span>Discount</span>
              <span>−₱{discountAmount.toFixed(2)}</span>
            </div>
          )}
          {loyaltyDiscount > 0 && (
            <div className="flex justify-between text-red-600">
              <span>Points redeemed ({redeemPoints})</span>
              <span>−₱{loyaltyDiscount.toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between font-semibold text-base">
            <span>Total</span>
            <span>₱{total.toFixed(2)}</span>
          </div>
        </div>

        {error && <p className="text-red-600 text-sm mt-2">{error}</p>}

        <button
          onClick={submit}
          disabled={isPending || cart.length === 0}
          className="mt-4 w-full rounded-xl bg-amber-600 text-white font-semibold py-4 disabled:opacity-40"
        >
          {isPending ? "Placing order..." : "Place Order"}
        </button>
      </div>

      {variantPicker && (
        <VariantModal
          item={variantPicker}
          onClose={() => setVariantPicker(null)}
          onPick={(variantId, variantName, priceDelta) => {
            addToCart(variantPicker, variantId, variantName, priceDelta);
            setVariantPicker(null);
          }}
        />
      )}
    </div>
  );
}

function VariantModal({
  item,
  onClose,
  onPick,
}: {
  item: MenuItem;
  onClose: () => void;
  onPick: (variantId: string | null, variantName: string | null, priceDelta: number) => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-xl p-5 w-full max-w-sm">
        <h3 className="font-semibold text-neutral-800 mb-3">{item.name}</h3>
        <div className="space-y-2">
          <button
            onClick={() => onPick(null, null, 0)}
            className="w-full text-left px-4 py-3 rounded-xl border-2 border-neutral-200 hover:border-amber-300"
          >
            Regular — ₱{item.price.toFixed(2)}
          </button>
          {item.menu_item_variants.map((v) => (
            <button
              key={v.id}
              onClick={() => onPick(v.id, v.name, v.price_delta)}
              className="w-full text-left px-4 py-3 rounded-xl border-2 border-neutral-200 hover:border-amber-300"
            >
              {v.name} — ₱{(item.price + v.price_delta).toFixed(2)}
            </button>
          ))}
        </div>
        <button onClick={onClose} className="mt-4 w-full text-sm text-neutral-500 py-2">
          Cancel
        </button>
      </div>
    </div>
  );
}
