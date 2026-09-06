import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { defaultModuleFor } from "@/lib/auth/rbac";

export default async function Home() {
  const session = await getSession();
  if (!session) redirect("/login");
  redirect(`/${defaultModuleFor(session.role)}`);
}
