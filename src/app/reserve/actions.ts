"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { DEFAULT_STORE_ID } from "@/lib/constants";

export type NewReservationInput = {
  customerName: string;
  contactNumber: string;
  partySize: number;
  reservationDate: string;
  reservationTime: string;
  notes: string | null;
  downPaymentAmount: number | null;
  paymentReference: string | null;
  paymentScreenshotUrl: string | null;
};

export async function submitReservation(
  input: NewReservationInput
): Promise<{ error?: string; reservationId?: string }> {
  if (!input.customerName.trim()) return { error: "Name is required." };
  if (!input.contactNumber.trim()) return { error: "Contact number is required." };
  if (!input.reservationDate || !input.reservationTime) {
    return { error: "Choose a date and time." };
  }
  if (input.partySize < 1) return { error: "Party size must be at least 1." };

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("reservations")
    .insert({
      store_id: DEFAULT_STORE_ID,
      customer_name: input.customerName,
      contact_number: input.contactNumber,
      party_size: input.partySize,
      reservation_date: input.reservationDate,
      reservation_time: input.reservationTime,
      notes: input.notes,
      down_payment_amount: input.downPaymentAmount,
      payment_reference: input.paymentReference,
      payment_screenshot_url: input.paymentScreenshotUrl,
      status: "pending",
    })
    .select("id")
    .single();

  if (error || !data) return { error: error?.message ?? "Could not submit reservation." };
  return { reservationId: data.id };
}

// Public upload, same bucket as POS payment screenshots — a customer
// uploading their GCash/bank transfer proof for a reservation down payment
// (spec 4.5).
export async function uploadReservationScreenshot(
  formData: FormData
): Promise<{ url?: string; error?: string }> {
  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) return { error: "No file provided." };
  if (!file.type.startsWith("image/")) return { error: "Please upload an image file." };
  if (file.size > 10 * 1024 * 1024) return { error: "Image is too large (max 10MB)." };

  const admin = createAdminClient();
  const path = `${DEFAULT_STORE_ID}/reservations/${Date.now()}-${file.name}`;
  const { error } = await admin.storage
    .from("payment-screenshots")
    .upload(path, await file.arrayBuffer(), { contentType: file.type });

  if (error) return { error: error.message };

  const { data } = admin.storage.from("payment-screenshots").getPublicUrl(path);
  return { url: data.publicUrl };
}
