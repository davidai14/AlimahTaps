import { createBrowserClient } from "@supabase/ssr";

// Only used for owner/manager Supabase Auth email+password sign-in; all data
// reads/writes go through server actions with the admin client (see
// supabase/migrations/00000000000002_rls.sql for why).
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
