import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { PayrollPeriodRow, PayslipRow } from "@/lib/domain-types";

export async function getPayrollPeriods(storeId: string): Promise<PayrollPeriodRow[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("payroll_periods")
    .select("id, start_date, end_date, status, created_at")
    .eq("store_id", storeId)
    .order("start_date", { ascending: false });

  if (error) throw new Error(error.message);
  return data ?? [];
}

// payslips has two FKs to employees (employee_id and generated_by), so the
// embed must be disambiguated with !employee_id — a plain employees(...)
// embed is rejected by PostgREST as an ambiguous relationship.
const PAYSLIP_SELECT = `
  id, payroll_period_id, employee_id, regular_hours, regular_pay, overtime_hours,
  overtime_pay, gross_pay, total_deductions, net_pay, notes, generated_at,
  employees!employee_id(full_name, role, pay_type, pay_rate),
  payslip_deductions(id, label, amount)
`;

export async function getPayslipsForPeriod(periodId: string): Promise<PayslipRow[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("payslips")
    .select(PAYSLIP_SELECT)
    .eq("payroll_period_id", periodId);

  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as PayslipRow[];
}
