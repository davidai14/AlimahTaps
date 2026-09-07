// The original/primary branch (matches the store row supabase/seed/seed.sql
// creates). Every authenticated page resolves its actual store from the
// session (see lib/auth/store-scope.ts) — this constant is only used as the
// fallback for the two public, unauthenticated pages (/clock, /reserve)
// when they're opened without a ?store=<id> query param, so old bookmarked
// links keep working once a second branch exists.
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
