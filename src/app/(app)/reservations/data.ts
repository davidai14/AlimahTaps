import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { DEFAULT_STORE_ID } from "@/lib/constants";
import type { ReservationRow, RestaurantTable, WaitlistRow } from "@/lib/domain-types";

const RESERVATION_SELECT = `
  id, customer_name, contact_number, party_size, reservation_date, reservation_time,
  status, table_id, down_payment_amount, payment_reference, payment_screenshot_url,
  verified_by, verified_at, notified_at, notes, created_at,
  restaurant_tables(table_number)
`;

export async function getReservations(): Promise<ReservationRow[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("reservations")
    .select(RESERVATION_SELECT)
    .eq("store_id", DEFAULT_STORE_ID)
    .order("reservation_date", { ascending: true })
    .order("reservation_time", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as ReservationRow[];
}

export async function getWaitlist(): Promise<WaitlistRow[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("waitlist")
    .select("id, customer_name, contact_number, party_size, status, queue_position, estimated_wait_minutes, created_at")
    .eq("store_id", DEFAULT_STORE_ID)
    .eq("status", "waiting")
    .order("queue_position", { ascending: true });

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getReservationTables(): Promise<RestaurantTable[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("restaurant_tables")
    .select("id, table_number, capacity, status")
    .eq("store_id", DEFAULT_STORE_ID)
    .order("table_number");

  if (error) throw new Error(error.message);
  return data ?? [];
}
