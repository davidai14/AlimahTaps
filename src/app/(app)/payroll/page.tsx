import { requireModule } from "@/lib/auth/rbac";
import { getEffectiveStoreId } from "@/lib/auth/store-scope";
import { getPayrollPeriods } from "./data";
import { PayrollClient } from "./PayrollClient";

export default async function PayrollPage() {
  const session = await requireModule("payroll");
  const storeId = await getEffectiveStoreId(session);
  const periods = await getPayrollPeriods(storeId);
  return <PayrollClient periods={periods} />;
}
