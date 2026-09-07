import { requireModule } from "@/lib/auth/rbac";
import { getEffectiveStoreId } from "@/lib/auth/store-scope";
import { getLoyaltySettings, getCustomers } from "./data";
import { LoyaltyClient } from "./LoyaltyClient";

export default async function LoyaltyPage() {
  const session = await requireModule("loyalty");
  const storeId = await getEffectiveStoreId(session);
  const [settings, customers] = await Promise.all([getLoyaltySettings(storeId), getCustomers(storeId)]);

  return <LoyaltyClient settings={settings} customers={customers} isOwner={session.role === "owner"} />;
}
