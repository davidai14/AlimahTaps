import "server-only";
import { cookies } from "next/headers";
import type { SessionPayload } from "@/lib/auth/session";

const ACTIVE_STORE_COOKIE = "alimah_active_store";

// Every other role is permanently scoped to their own employees.store_id —
// a cashier at Branch A can never see Branch B's data, full stop. Only the
// owner role oversees the whole business, so only the owner may switch
// which branch they're currently operating in; the switch is a cookie, but
// it is only ever honored when the *session's* role is owner (checked
// server-side here), so a non-owner setting this cookie themselves has no
// effect — they always fall through to their own store.
export async function getEffectiveStoreId(session: SessionPayload): Promise<string> {
  if (session.role !== "owner") return session.storeId;
  const cookieStore = await cookies();
  return cookieStore.get(ACTIVE_STORE_COOKIE)?.value || session.storeId;
}

export async function setActiveStore(storeId: string) {
  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_STORE_COOKIE, storeId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
}
