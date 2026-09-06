// Single-store MVP (spec Section 3): every query is scoped to this store id,
// which must match the `stores` row created by supabase/seed/seed.sql.
export const DEFAULT_STORE_ID = process.env.NEXT_PUBLIC_DEFAULT_STORE_ID!;

export const CHANNEL_LABEL: Record<string, string> = {
  dine_in: "Dine-in",
  phone: "Phone Call",
  landline: "Landline",
  facebook: "Facebook Messenger",
  grabfood: "GrabFood",
  foodpanda: "FoodPanda",
  online: "Online (GCash/Bank)",
};

export const PLATFORM_CHANNELS = ["grabfood", "foodpanda"] as const;

export const PAYMENT_METHOD_LABEL: Record<string, string> = {
  cash: "Cash",
  gcash: "GCash",
  bank_transfer: "Bank Transfer",
};

export const ORDER_STATUS_LABEL: Record<string, string> = {
  pending: "Pending",
  preparing: "Preparing",
  ready: "Ready",
  served: "Served",
  completed: "Completed",
  paid: "Paid",
  cancelled: "Cancelled",
  voided: "Voided",
};
