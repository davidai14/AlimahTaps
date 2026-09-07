"use server";

import bcrypt from "bcryptjs";
import { createAdminClient } from "@/lib/supabase/admin";

export type ClockStaff = { id: string; fullName: string; role: string };

export async function listClockStaff(storeId: string): Promise<ClockStaff[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("employees")
    .select("id, full_name, role")
    .eq("store_id", storeId)
    .eq("is_active", true)
    .not("pin_hash", "is", null)
    .order("full_name");

  if (error) throw new Error(error.message);
  return (data ?? []).map((e) => ({ id: e.id, fullName: e.full_name, role: e.role }));
}

export type ClockResult = {
  error?: string;
  action?: "in" | "out";
  timestamp?: string;
  workedMinutes?: number;
};

// Toggles: no open attendance row for today -> clock in. Open row -> clock out.
export async function clockInOrOut(employeeId: string, pin: string): Promise<ClockResult> {
  if (!/^\d{4,6}$/.test(pin)) return { error: "Enter your 4-6 digit PIN." };

  const admin = createAdminClient();
  const { data: employee, error } = await admin
    .from("employees")
    .select("id, store_id, pin_hash, is_active")
    .eq("id", employeeId)
    .single();

  if (error || !employee || !employee.is_active || !employee.pin_hash) {
    return { error: "Staff account not found." };
  }

  const ok = await bcrypt.compare(pin, employee.pin_hash);
  if (!ok) return { error: "Incorrect PIN." };

  const { data: openRecord } = await admin
    .from("attendance")
    .select("id, clock_in")
    .eq("employee_id", employeeId)
    .is("clock_out", null)
    .order("clock_in", { ascending: false })
    .limit(1)
    .maybeSingle();

  const now = new Date();

  if (openRecord) {
    await admin.from("attendance").update({ clock_out: now.toISOString() }).eq("id", openRecord.id);
    const workedMinutes = Math.round(
      (now.getTime() - new Date(openRecord.clock_in).getTime()) / 60000
    );
    return { action: "out", timestamp: now.toISOString(), workedMinutes };
  }

  const today = now.toISOString().slice(0, 10);
  const { data: shift } = await admin
    .from("shifts")
    .select("id")
    .eq("employee_id", employeeId)
    .eq("shift_date", today)
    .maybeSingle();

  await admin.from("attendance").insert({
    store_id: employee.store_id,
    employee_id: employeeId,
    shift_id: shift?.id ?? null,
    clock_in: now.toISOString(),
  });

  return { action: "in", timestamp: now.toISOString() };
}
