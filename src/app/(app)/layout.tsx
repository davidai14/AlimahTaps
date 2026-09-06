import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { canAccess, type Module } from "@/lib/auth/rbac";
import { logout } from "@/lib/auth/actions";

const NAV: { href: string; label: string; module: Module }[] = [
  { href: "/dashboard", label: "Dashboard", module: "dashboard" },
  { href: "/pos", label: "POS", module: "pos" },
  { href: "/kds", label: "Kitchen", module: "kds" },
  { href: "/inventory", label: "Inventory", module: "inventory" },
  { href: "/purchase-orders", label: "Purchase Orders", module: "purchase_orders" },
  { href: "/reservations", label: "Reservations", module: "reservations" },
  { href: "/employees", label: "Employees", module: "employees" },
  { href: "/payroll", label: "Payroll", module: "payroll" },
];

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");

  const visibleNav = NAV.filter((item) => canAccess(session.role, item.module));

  return (
    <div className="min-h-screen flex flex-col bg-neutral-50">
      <header className="bg-white border-b border-neutral-200 px-4 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-6 overflow-x-auto">
          <span className="text-lg font-bold text-amber-700 shrink-0">Alimah</span>
          <nav className="flex gap-1">
            {visibleNav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="px-3 py-2 rounded-lg text-sm font-medium text-neutral-600 hover:bg-amber-50 hover:text-amber-800 whitespace-nowrap"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-sm text-neutral-500 hidden sm:inline">
            {session.fullName} · <span className="capitalize">{session.role}</span>
          </span>
          <form action={logout}>
            <button className="text-sm font-medium text-neutral-500 hover:text-red-600 px-3 py-2 rounded-lg hover:bg-red-50">
              Log Out
            </button>
          </form>
        </div>
      </header>
      <main className="flex-1 p-4">{children}</main>
    </div>
  );
}
