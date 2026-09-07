import { requireModule, PAY_RATE_VISIBLE_ROLES } from "@/lib/auth/rbac";
import { getEffectiveStoreId } from "@/lib/auth/store-scope";
import { getEmployees } from "./data";
import { EmployeesClient } from "./EmployeesClient";

export default async function EmployeesPage() {
  const session = await requireModule("employees");
  const storeId = await getEffectiveStoreId(session);
  const employees = await getEmployees(storeId);

  return (
    <EmployeesClient
      employees={employees}
      canSeePayRate={PAY_RATE_VISIBLE_ROLES.includes(session.role)}
    />
  );
}
