import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Only used to verify owner/manager email+password credentials via Supabase
// Auth inside the login server action. All other data reads/writes go
// through the admin client (see lib/supabase/admin.ts).
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component with no response to write to;
            // safe to ignore when middleware refreshes the session instead.
          }
        },
      },
    }
  );
}
