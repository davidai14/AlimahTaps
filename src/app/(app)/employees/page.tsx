import { requireModule, PAY_RATE_VISIBLE_ROLES } from "@/lib/auth/rbac";
import { getEmployees } from "./data";
import { EmployeesClient } from "./EmployeesClient";

export default async function EmployeesPage() {
  const session = await requireModule("employees");
  const employees = await getEmployees();

  return (
    <EmployeesClient
      employees={employees}
      canSeePayRate={PAY_RATE_VISIBLE_ROLES.includes(session.role)}
    />
  );
}
