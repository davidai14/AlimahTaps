import { requireModule } from "@/lib/auth/rbac";
import { getEffectiveStoreId } from "@/lib/auth/store-scope";
import { getStores } from "./data";
import { StoresClient } from "./StoresClient";

export default async function StoresPage() {
  const session = await requireModule("stores");
  const [stores, activeStoreId] = await Promise.all([getStores(), getEffectiveStoreId(session)]);

  return <StoresClient stores={stores} activeStoreId={activeStoreId} />;
}
