import { DEFAULT_STORE_ID } from "@/lib/constants";
import { listClockStaff } from "./actions";
import { ClockClient } from "./ClockClient";

export const dynamic = "force-dynamic";

// Public, no login — each branch bookmarks its own /clock?store=<id> on its
// tablet. No query param falls back to the original branch.
export default async function ClockPage({
  searchParams,
}: {
  searchParams: Promise<{ store?: string }>;
}) {
  const { store } = await searchParams;
  const storeId = store || DEFAULT_STORE_ID;
  const staff = await listClockStaff(storeId);
  return <ClockClient staff={staff} />;
}
