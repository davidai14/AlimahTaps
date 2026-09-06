"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";
import { createSession, destroySession } from "@/lib/auth/session";
import { defaultModuleFor } from "@/lib/auth/rbac";

export type StaffTile = { id: string; fullName: string; role: string };

// Staff who log in via PIN (everyone except owner/manager, who use
// email+password below). Shown as tappable name tiles on the login screen.
export async function listPinStaff(): Promise<StaffTile[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("employees")
    .select("id, full_name, role")
    .eq("is_active", true)
    .in("role", ["cashier", "kitchen", "server", "encoder"])
    .order("full_name");

  if (error) throw new Error(error.message);
  return (data ?? []).map((e) => ({ id: e.id, fullName: e.full_name, role: e.role }));
}

export async function pinLogin(employeeId: string, pin: string): Promise<{ error?: string }> {
  if (!/^\d{4,6}$/.test(pin)) return { error: "Enter your 4-6 digit PIN." };

  const admin = createAdminClient();
  const { data: employee, error } = await admin
    .from("employees")
    .select("id, store_id, full_name, role, pin_hash, is_active")
    .eq("id", employeeId)
    .single();

  if (error || !employee || !employee.is_active || !employee.pin_hash) {
    return { error: "Staff account not found." };
  }

  const ok = await bcrypt.compare(pin, employee.pin_hash);
  if (!ok) return { error: "Incorrect PIN." };

  await createSession({
    employeeId: employee.id,
    storeId: employee.store_id,
    fullName: employee.full_name,
    role: employee.role,
    method: "pin",
  });

  redirect(`/${defaultModuleFor(employee.role)}`);
}

export async function ownerManagerLogin(
  email: string,
  password: string
): Promise<{ error?: string }> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error || !data.user) {
    return { error: "Incorrect email or password." };
  }

  const admin = createAdminClient();
  const { data: employee, error: empError } = await admin
    .from("employees")
    .select("id, store_id, full_name, role, is_active")
    .eq("auth_user_id", data.user.id)
    .single();

  if (empError || !employee || !employee.is_active) {
    await supabase.auth.signOut();
    return { error: "This account is not linked to an active employee." };
  }

  if (employee.role !== "owner" && employee.role !== "manager") {
    await supabase.auth.signOut();
    return { error: "This login is for owner/manager accounts only." };
  }

  await createSession({
    employeeId: employee.id,
    storeId: employee.store_id,
    fullName: employee.full_name,
    role: employee.role,
    method: "password",
  });

  redirect(`/${defaultModuleFor(employee.role)}`);
}

export async function logout() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  await destroySession();
  redirect("/login");
}
