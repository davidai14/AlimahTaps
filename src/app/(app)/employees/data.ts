import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { DEFAULT_STORE_ID } from "@/lib/constants";
import type { AttendanceRow, EmployeeRow, ShiftRow } from "@/lib/domain-types";

export async function getEmployees(): Promise<EmployeeRow[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("employees")
    .select("id, full_name, role, contact_number, email, hire_date, pay_type, pay_rate, is_active")
    .eq("store_id", DEFAULT_STORE_ID)
    .order("full_name");

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getShiftsForRange(startDate: string, endDate: string): Promise<ShiftRow[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("shifts")
    .select("id, employee_id, shift_date, start_time, end_time, notes")
    .eq("store_id", DEFAULT_STORE_ID)
    .gte("shift_date", startDate)
    .lte("shift_date", endDate)
    .order("shift_date");

  if (error) throw new Error(error.message);
  return data ?? [];
}

// startDate/endDate are date-only (YYYY-MM-DD); attendance.clock_in is a
// timestamptz, so the range is widened to whole-day boundaries.
export async function getAttendanceForRange(
  startDate: string,
  endDate: string
): Promise<AttendanceRow[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("attendance")
    .select("id, employee_id, shift_id, clock_in, clock_out, is_manual_override, notes")
    .eq("store_id", DEFAULT_STORE_ID)
    .gte("clock_in", `${startDate}T00:00:00`)
    .lte("clock_in", `${endDate}T23:59:59`)
    .order("clock_in");

  if (error) throw new Error(error.message);
  return data ?? [];
}
