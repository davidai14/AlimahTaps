import { requireModule } from "@/lib/auth/rbac";
import { getPayrollPeriods } from "./data";
import { PayrollClient } from "./PayrollClient";

export default async function PayrollPage() {
  await requireModule("payroll");
  const periods = await getPayrollPeriods();
  return <PayrollClient periods={periods} />;
}
