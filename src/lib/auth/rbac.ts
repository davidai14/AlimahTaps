import "server-only";
import { redirect } from "next/navigation";
import { getSession, type SessionPayload, type StaffRole } from "@/lib/auth/session";

export type Module =
  | "pos"
  | "kds"
  | "inventory"
  | "purchase_orders"
  | "employees"
  | "dashboard";

// Spec 4.6 / 5: cashiers can't see payroll or other employees' pay, kitchen
// only sees KDS, managers see scheduling/attendance/inventory (plus the
// modules they need to run the floor day to day), owner sees everything.
const MODULE_ACCESS: Record<Module, StaffRole[]> = {
  pos: ["owner", "manager", "cashier", "server", "encoder"],
  kds: ["owner", "manager", "kitchen"],
  inventory: ["owner", "manager"],
  purchase_orders: ["owner", "manager"],
  employees: ["owner", "manager"],
  dashboard: ["owner", "manager"],
};

// Only these roles may finalize payment or void an order in the POS.
export const PAYMENT_AND_VOID_ROLES: StaffRole[] = ["owner", "manager", "cashier"];

// Employee pay rate: the "employees" module itself is already owner/manager
// only, and spec 4.6's "cashiers can't see ... other employees' pay" is
// specifically about cashier/kitchen/server/encoder — who never reach this
// module at all. So both roles that can open it may see pay rate.
export const PAY_RATE_VISIBLE_ROLES: StaffRole[] = ["owner", "manager"];

export function canAccess(role: StaffRole, module: Module): boolean {
  return MODULE_ACCESS[module].includes(role);
}

export async function requireSession(): Promise<SessionPayload> {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}

export async function requireModule(module: Module): Promise<SessionPayload> {
  const session = await requireSession();
  if (!canAccess(session.role, module)) redirect("/unauthorized");
  return session;
}

export function defaultModuleFor(role: StaffRole): Module {
  if (role === "kitchen") return "kds";
  if (role === "owner" || role === "manager") return "dashboard";
  return "pos";
}
