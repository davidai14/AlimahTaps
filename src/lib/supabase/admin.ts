import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// Service-role client used by every server action for reads and writes
// (see supabase/migrations/00000000000002_rls.sql for why: PIN-based staff
// never hold a Supabase Auth session, so RBAC is enforced in our own
// session/role checks, not RLS). Never import this from client code.
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
