"use server";

import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireModule } from "@/lib/auth/rbac";
import { DEFAULT_STORE_ID } from "@/lib/constants";
import type { StaffRole } from "@/lib/auth/session";
import { getShiftsForRange } from "./data";

export async function getShiftsForRangeAction(startDate: string, endDate: string) {
  await requireModule("employees");
  return getShiftsForRange(startDate, endDate);
}

type PayTypeInput = "daily" | "hourly" | "monthly";

export type NewEmployeeInput = {
  fullName: string;
  role: StaffRole;
  contactNumber: string | null;
  email: string | null;
  hireDate: string | null;
  payType: PayTypeInput;
  payRate: number;
  pin: string | null; // required for cashier/kitchen/server/encoder
};

const PIN_ROLES: StaffRole[] = ["cashier", "kitchen", "server", "encoder"];
const AUTH_ROLES: StaffRole[] = ["owner", "manager"];

export async function createEmployee(
  input: NewEmployeeInput
): Promise<{ error?: string; temporaryPassword?: string }> {
  await requireModule("employees");

  if (!input.fullName.trim()) return { error: "Name is required." };

  const admin = createAdminClient();
  let authUserId: string | null = null;
  let temporaryPassword: string | undefined;

  if (AUTH_ROLES.includes(input.role)) {
    if (!input.email?.trim()) return { error: "Email is required for owner/manager accounts." };
    temporaryPassword = randomBytes(9).toString("base64url");
    const { data: authUser, error: authError } = await admin.auth.admin.createUser({
      email: input.email,
      password: temporaryPassword,
      email_confirm: true,
    });
    if (authError || !authUser.user) {
      return { error: authError?.message ?? "Could not create login for this role." };
    }
    authUserId = authUser.user.id;
  }

  let pinHash: string | null = null;
  if (PIN_ROLES.includes(input.role)) {
    if (!input.pin || !/^\d{4,6}$/.test(input.pin)) {
      return { error: "A 4-6 digit PIN is required for this role." };
    }
    pinHash = await bcrypt.hash(input.pin, 10);
  }

  const { error } = await admin.from("employees").insert({
    store_id: DEFAULT_STORE_ID,
    full_name: input.fullName,
    role: input.role,
    contact_number: input.contactNumber,
    email: input.email,
    hire_date: input.hireDate,
    pay_type: input.payType,
    pay_rate: input.payRate,
    pin_hash: pinHash,
    auth_user_id: authUserId,
    is_active: true,
  });

  if (error) return { error: error.message };

  revalidatePath("/employees");
  return { temporaryPassword };
}

export async function updateEmployee(
  employeeId: string,
  patch: {
    fullName?: string;
    contactNumber?: string | null;
    hireDate?: string | null;
    payType?: PayTypeInput;
    payRate?: number;
    isActive?: boolean;
    newPin?: string | null;
  }
): Promise<{ error?: string }> {
  await requireModule("employees");
  const admin = createAdminClient();

  const update: Record<string, unknown> = {};
  if (patch.fullName !== undefined) update.full_name = patch.fullName;
  if (patch.contactNumber !== undefined) update.contact_number = patch.contactNumber;
  if (patch.hireDate !== undefined) update.hire_date = patch.hireDate;
  if (patch.payType !== undefined) update.pay_type = patch.payType;
  if (patch.payRate !== undefined) update.pay_rate = patch.payRate;
  if (patch.isActive !== undefined) update.is_active = patch.isActive;
  if (patch.newPin) {
    if (!/^\d{4,6}$/.test(patch.newPin)) return { error: "PIN must be 4-6 digits." };
    update.pin_hash = await bcrypt.hash(patch.newPin, 10);
  }

  const { error } = await admin.from("employees").update(update).eq("id", employeeId);
  if (error) return { error: error.message };

  revalidatePath("/employees");
  return {};
}

export async function createShift(input: {
  employeeId: string;
  shiftDate: string;
  startTime: string;
  endTime: string;
}): Promise<{ error?: string }> {
  await requireModule("employees");
  const admin = createAdminClient();

  const { error } = await admin.from("shifts").insert({
    store_id: DEFAULT_STORE_ID,
    employee_id: input.employeeId,
    shift_date: input.shiftDate,
    start_time: input.startTime,
    end_time: input.endTime,
  });
  if (error) return { error: error.message };

  revalidatePath("/employees");
  return {};
}

export async function deleteShift(shiftId: string): Promise<{ error?: string }> {
  await requireModule("employees");
  const admin = createAdminClient();
  const { error } = await admin.from("shifts").delete().eq("id", shiftId);
  if (error) return { error: error.message };

  revalidatePath("/employees");
  return {};
}
