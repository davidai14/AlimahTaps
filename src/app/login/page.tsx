import { listPinStaff } from "@/lib/auth/actions";
import { LoginClient } from "./LoginClient";

// The staff PIN list can change any time (new hires, deactivations) and
// depends on Supabase being reachable — never statically prerender this.
export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const staff = await listPinStaff();
  return <LoginClient staff={staff} />;
}
