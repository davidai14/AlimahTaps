"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireModule } from "@/lib/auth/rbac";
import { DEFAULT_STORE_ID } from "@/lib/constants";
import type { ReservationStatus, WaitlistStatus } from "@/lib/domain-types";

export async function verifyReservationPayment(reservationId: string): Promise<{ error?: string }> {
  const session = await requireModule("reservations");
  const admin = createAdminClient();

  const { error } = await admin
    .from("reservations")
    .update({ verified_by: session.employeeId, verified_at: new Date().toISOString() })
    .eq("id", reservationId);
  if (error) return { error: error.message };

  revalidatePath("/reservations");
  return {};
}

export async function updateReservationStatus(
  reservationId: string,
  status: ReservationStatus,
  tableId: string | null
): Promise<{ error?: string }> {
  await requireModule("reservations");
  const admin = createAdminClient();

  const update: Record<string, unknown> = { status };
  if (tableId !== undefined) update.table_id = tableId;

  const { error } = await admin.from("reservations").update(update).eq("id", reservationId);
  if (error) return { error: error.message };

  if (status === "seated" && tableId) {
    await admin.from("restaurant_tables").update({ status: "occupied" }).eq("id", tableId);
  }

  revalidatePath("/reservations");
  return {};
}

// No SMS/Messenger automation (owner instruction) — staff call/message the
// customer themselves and just log that it happened.
export async function markReservationNotified(reservationId: string): Promise<{ error?: string }> {
  await requireModule("reservations");
  const admin = createAdminClient();

  const { error } = await admin
    .from("reservations")
    .update({ notified_at: new Date().toISOString() })
    .eq("id", reservationId);
  if (error) return { error: error.message };

  revalidatePath("/reservations");
  return {};
}

export async function addWaitlistEntry(input: {
  customerName: string;
  contactNumber: string | null;
  partySize: number;
  estimatedWaitMinutes: number | null;
}): Promise<{ error?: string }> {
  await requireModule("reservations");
  if (!input.customerName.trim()) return { error: "Name is required." };

  const admin = createAdminClient();
  const { data: existing } = await admin
    .from("waitlist")
    .select("queue_position")
    .eq("store_id", DEFAULT_STORE_ID)
    .eq("status", "waiting")
    .order("queue_position", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextPosition = (existing?.queue_position ?? 0) + 1;

  const { error } = await admin.from("waitlist").insert({
    store_id: DEFAULT_STORE_ID,
    customer_name: input.customerName,
    contact_number: input.contactNumber,
    party_size: input.partySize,
    queue_position: nextPosition,
    estimated_wait_minutes: input.estimatedWaitMinutes,
    status: "waiting",
  });
  if (error) return { error: error.message };

  revalidatePath("/reservations");
  return {};
}

export async function updateWaitlistStatus(
  waitlistId: string,
  status: WaitlistStatus
): Promise<{ error?: string }> {
  await requireModule("reservations");
  const admin = createAdminClient();

  const { error } = await admin.from("waitlist").update({ status }).eq("id", waitlistId);
  if (error) return { error: error.message };

  revalidatePath("/reservations");
  return {};
}
