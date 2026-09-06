"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireModule } from "@/lib/auth/rbac";
import { DEFAULT_STORE_ID } from "@/lib/constants";
import { getPayslipsForPeriod } from "./data";

export async function createPayrollPeriod(
  startDate: string,
  endDate: string
): Promise<{ error?: string; periodId?: string }> {
  const session = await requireModule("payroll");
  if (!startDate || !endDate || endDate < startDate) {
    return { error: "Enter a valid date range." };
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("payroll_periods")
    .insert({ store_id: DEFAULT_STORE_ID, start_date: startDate, end_date: endDate, created_by: session.employeeId })
    .select("id")
    .single();

  if (error || !data) return { error: error?.message ?? "Could not create payroll period." };

  revalidatePath("/payroll");
  return { periodId: data.id };
}

// Computes each active employee's regular pay for the period from attendance
// (spec 4.6: "gross pay = rate × time worked"), then inserts/updates their
// payslip. Safe to re-run while the period is open — it only touches
// regular_hours/regular_pay and recomputed totals, never overtime or
// deductions the manager already entered.
export async function generatePayslipsForPeriod(periodId: string): Promise<{ error?: string }> {
  await requireModule("payroll");
  const admin = createAdminClient();

  const { data: period, error: periodError } = await admin
    .from("payroll_periods")
    .select("id, start_date, end_date, status")
    .eq("id", periodId)
    .single();
  if (periodError || !period) return { error: "Payroll period not found." };
  if (period.status === "finalized") return { error: "This payroll period is finalized and locked." };

  const { data: employees, error: empError } = await admin
    .from("employees")
    .select("id, pay_type, pay_rate")
    .eq("store_id", DEFAULT_STORE_ID)
    .eq("is_active", true);
  if (empError) return { error: empError.message };

  const { data: attendance, error: attError } = await admin
    .from("attendance")
    .select("employee_id, clock_in, clock_out")
    .eq("store_id", DEFAULT_STORE_ID)
    .gte("clock_in", `${period.start_date}T00:00:00`)
    .lte("clock_in", `${period.end_date}T23:59:59`);
  if (attError) return { error: attError.message };

  for (const emp of employees ?? []) {
    const records = (attendance ?? []).filter((a) => a.employee_id === emp.id);

    let regularHours = 0;
    let regularPay = 0;

    if (emp.pay_type === "hourly") {
      for (const r of records) {
        if (r.clock_out) {
          regularHours += (new Date(r.clock_out).getTime() - new Date(r.clock_in).getTime()) / 3600000;
        }
      }
      regularPay = regularHours * emp.pay_rate;
    } else if (emp.pay_type === "daily") {
      const daysWorked = new Set(records.map((r) => r.clock_in.slice(0, 10))).size;
      regularHours = records.reduce(
        (s, r) => s + (r.clock_out ? (new Date(r.clock_out).getTime() - new Date(r.clock_in).getTime()) / 3600000 : 0),
        0
      );
      regularPay = daysWorked * emp.pay_rate;
    } else {
      // monthly: fixed salary for the period, not derived from attendance —
      // assumes the payroll period represents one full month.
      regularPay = emp.pay_rate;
    }

    regularHours = Math.round(regularHours * 100) / 100;
    regularPay = Math.round(regularPay * 100) / 100;

    const { data: existing } = await admin
      .from("payslips")
      .select("id, overtime_pay, total_deductions")
      .eq("payroll_period_id", periodId)
      .eq("employee_id", emp.id)
      .maybeSingle();

    if (existing) {
      const grossPay = regularPay + existing.overtime_pay;
      await admin
        .from("payslips")
        .update({
          regular_hours: regularHours,
          regular_pay: regularPay,
          gross_pay: grossPay,
          net_pay: grossPay - existing.total_deductions,
        })
        .eq("id", existing.id);
    } else {
      await admin.from("payslips").insert({
        payroll_period_id: periodId,
        employee_id: emp.id,
        store_id: DEFAULT_STORE_ID,
        regular_hours: regularHours,
        regular_pay: regularPay,
        gross_pay: regularPay,
        net_pay: regularPay,
      });
    }
  }

  revalidatePath("/payroll");
  return {};
}

async function recomputePayslipTotals(payslipId: string) {
  const admin = createAdminClient();
  const { data: payslip } = await admin
    .from("payslips")
    .select("regular_pay, overtime_pay")
    .eq("id", payslipId)
    .single();
  if (!payslip) return;

  const { data: deductions } = await admin.from("payslip_deductions").select("amount").eq("payslip_id", payslipId);
  const totalDeductions = (deductions ?? []).reduce((s, d) => s + d.amount, 0);
  const grossPay = payslip.regular_pay + payslip.overtime_pay;

  await admin
    .from("payslips")
    .update({
      total_deductions: Math.round(totalDeductions * 100) / 100,
      gross_pay: Math.round(grossPay * 100) / 100,
      net_pay: Math.round((grossPay - totalDeductions) * 100) / 100,
    })
    .eq("id", payslipId);
}

// Overtime pay is a manually entered amount — no automatic multiplier
// (owner instruction). Hours are still tracked for the payslip record.
export async function updatePayslipOvertime(
  payslipId: string,
  overtimeHours: number,
  overtimePay: number,
  notes: string | null
): Promise<{ error?: string }> {
  await requireModule("payroll");
  const admin = createAdminClient();

  const { error } = await admin
    .from("payslips")
    .update({ overtime_hours: overtimeHours, overtime_pay: overtimePay, notes })
    .eq("id", payslipId);
  if (error) return { error: error.message };

  await recomputePayslipTotals(payslipId);
  revalidatePath("/payroll");
  return {};
}

export async function addPayslipDeduction(
  payslipId: string,
  label: string,
  amount: number
): Promise<{ error?: string }> {
  const session = await requireModule("payroll");
  if (!label.trim()) return { error: "Deduction label is required." };

  const admin = createAdminClient();
  const { error } = await admin.from("payslip_deductions").insert({ payslip_id: payslipId, label, amount });
  if (error) return { error: error.message };

  await recomputePayslipTotals(payslipId);

  const { data: payslip } = await admin.from("payslips").select("employee_id").eq("id", payslipId).single();
  await admin.from("audit_log").insert({
    store_id: DEFAULT_STORE_ID,
    action_type: "payroll_edit",
    entity_type: "payslip",
    entity_id: payslipId,
    performed_by: session.employeeId,
    details: { employee_id: payslip?.employee_id, label, amount, action: "deduction_added" },
  });

  revalidatePath("/payroll");
  return {};
}

export async function removePayslipDeduction(deductionId: string, payslipId: string): Promise<{ error?: string }> {
  await requireModule("payroll");
  const admin = createAdminClient();

  const { error } = await admin.from("payslip_deductions").delete().eq("id", deductionId);
  if (error) return { error: error.message };

  await recomputePayslipTotals(payslipId);
  revalidatePath("/payroll");
  return {};
}

export async function finalizePayrollPeriod(periodId: string): Promise<{ error?: string }> {
  const session = await requireModule("payroll");
  const admin = createAdminClient();

  const { error } = await admin.from("payroll_periods").update({ status: "finalized" }).eq("id", periodId);
  if (error) return { error: error.message };

  await admin.from("audit_log").insert({
    store_id: DEFAULT_STORE_ID,
    action_type: "payroll_edit",
    entity_type: "payroll_period",
    entity_id: periodId,
    performed_by: session.employeeId,
    details: { action: "finalized" },
  });

  revalidatePath("/payroll");
  return {};
}

export async function getPayslipsForPeriodAction(periodId: string) {
  await requireModule("payroll");
  return getPayslipsForPeriod(periodId);
}
