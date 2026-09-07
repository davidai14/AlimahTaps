import { DEFAULT_STORE_ID } from "@/lib/constants";
import { ReserveClient } from "./ReserveClient";

export const dynamic = "force-dynamic";

// Public, no login — each branch shares its own /reserve?store=<id> link.
// No query param falls back to the original branch.
export default async function ReservePage({
  searchParams,
}: {
  searchParams: Promise<{ store?: string }>;
}) {
  const { store } = await searchParams;
  const storeId = store || DEFAULT_STORE_ID;
  return <ReserveClient storeId={storeId} />;
}
