"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireModule, requireSession, canAccess, PAYMENT_AND_VOID_ROLES } from "@/lib/auth/rbac";
import { getEffectiveStoreId } from "@/lib/auth/store-scope";
import type {
  DiscountType,
  OrderChannel,
  OrderItemStatus,
  OrderStatus,
  PaymentMethod,
} from "@/lib/domain-types";

export type NewOrderItemInput = {
  menuItemId: string;
  variantId: string | null;
  quantity: number;
  unitPrice: number;
  notes: string | null;
};

export type NewOrderInput = {
  channel: OrderChannel;
  tableId: string | null;
  customerName: string | null;
  customerContact: string | null;
  externalReference: string | null;
  platformCommission: number;
  discountType: DiscountType;
  discountIdNumber: string | null;
  promoDiscountAmount: number; // only used when discountType === 'promo'
  items: NewOrderItemInput[];
  // Loyalty (optional): link an existing customer by phone, or create one on
  // the fly if a name is also given and no match exists. Points redemption
  // only applies when a customer resolves and the store's program is on.
  loyaltyCustomerPhone: string | null;
  loyaltyCustomerName: string | null;
  redeemPoints: number;
};

const SENIOR_PWD_DISCOUNT_RATE = 0.2;

export async function createOrder(
  input: NewOrderInput
): Promise<{ orderId?: string; error?: string }> {
  const session = await requireModule("pos");
  const storeId = await getEffectiveStoreId(session);
  const admin = createAdminClient();

  if (input.items.length === 0) return { error: "Add at least one item." };
  if (input.channel === "dine_in" && !input.tableId) {
    return { error: "Choose a table for a dine-in order." };
  }
  if (
    (input.discountType === "senior" || input.discountType === "pwd") &&
    !input.discountIdNumber?.trim()
  ) {
    return { error: "SC/PWD ID number is required for this discount." };
  }

  const subtotal = input.items.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0);

  let discountAmount = 0;
  if (input.discountType === "senior" || input.discountType === "pwd") {
    discountAmount = Math.round(subtotal * SENIOR_PWD_DISCOUNT_RATE * 100) / 100;
  } else if (input.discountType === "promo") {
    discountAmount = Math.min(Math.max(input.promoDiscountAmount, 0), subtotal);
  }

  // Resolve/create the loyalty customer first, since a redemption reduces
  // the total this same insert needs to record.
  let customerId: string | null = null;
  if (input.loyaltyCustomerPhone?.trim()) {
    const { data: existing } = await admin
      .from("customers")
      .select("id")
      .eq("store_id", storeId)
      .eq("contact_number", input.loyaltyCustomerPhone.trim())
      .maybeSingle();

    if (existing) {
      customerId = existing.id;
    } else if (input.loyaltyCustomerName?.trim()) {
      const { data: created, error: custError } = await admin
        .from("customers")
        .insert({ store_id: storeId, full_name: input.loyaltyCustomerName, contact_number: input.loyaltyCustomerPhone })
        .select("id")
        .single();
      if (custError) return { error: `Could not save customer: ${custError.message}` };
      customerId = created.id;
    } else {
      return { error: "No customer found with that number — enter their name to add them." };
    }
  }

  let loyaltyDiscountAmount = 0;
  const afterStaffDiscount = Math.round((subtotal - discountAmount) * 100) / 100;
  if (input.redeemPoints > 0) {
    if (!customerId) return { error: "Link a customer before redeeming points." };
    const { data: pesoValue, error: redeemError } = await admin.rpc("redeem_loyalty_points", {
      p_customer_id: customerId,
      p_points: input.redeemPoints,
      p_order_id: null,
      p_employee_id: session.employeeId,
    });
    if (redeemError) return { error: redeemError.message };
    loyaltyDiscountAmount = Math.min(pesoValue as number, afterStaffDiscount);
  }

  const totalAmount = Math.round((afterStaffDiscount - loyaltyDiscountAmount) * 100) / 100;

  const { data: order, error } = await admin
    .from("orders")
    .insert({
      store_id: storeId,
      channel: input.channel,
      external_reference: input.externalReference || null,
      table_id: input.tableId,
      customer_name: input.customerName,
      customer_contact: input.customerContact,
      customer_id: customerId,
      status: "pending" as OrderStatus,
      subtotal,
      discount_type: input.discountType,
      discount_id_number: input.discountIdNumber,
      discount_amount: discountAmount,
      loyalty_points_redeemed: input.redeemPoints > 0 ? input.redeemPoints : 0,
      loyalty_discount_amount: loyaltyDiscountAmount,
      platform_commission: input.platformCommission || 0,
      tax_amount: 0,
      total_amount: totalAmount,
      created_by: session.employeeId,
    })
    .select("id")
    .single();

  if (error || !order) return { error: error?.message ?? "Could not create order." };

  const { error: itemsError } = await admin.from("order_items").insert(
    input.items.map((i) => ({
      order_id: order.id,
      menu_item_id: i.menuItemId,
      variant_id: i.variantId,
      quantity: i.quantity,
      unit_price: i.unitPrice,
      notes: i.notes,
      status: "pending",
    }))
  );
  if (itemsError) return { error: itemsError.message };

  if (input.channel === "dine_in" && input.tableId) {
    await admin.from("restaurant_tables").update({ status: "occupied" }).eq("id", input.tableId);
  }

  if (input.discountType !== "none") {
    await admin.from("audit_log").insert({
      store_id: storeId,
      action_type: "discount_applied",
      entity_type: "order",
      entity_id: order.id,
      performed_by: session.employeeId,
      details: {
        discount_type: input.discountType,
        id_number: input.discountIdNumber,
        amount: discountAmount,
      },
    });
  }

  revalidatePath("/pos");
  revalidatePath("/kds");
  return { orderId: order.id };
}

const STATUS_SEQUENCE: OrderStatus[] = [
  "pending",
  "preparing",
  "ready",
  "served",
  "completed",
  "paid",
];

async function requireFloorAccess() {
  const session = await requireSession();
  if (!canAccess(session.role, "pos") && !canAccess(session.role, "kds")) {
    throw new Error("Not authorized.");
  }
  return session;
}

// Used by both POS (cashier/server progressing an order) and KDS (kitchen
// marking prep/ready) — either floor role may move an order forward, but
// only PAYMENT_AND_VOID_ROLES may mark it paid.
export async function advanceOrderStatus(
  orderId: string,
  nextStatus: OrderStatus
): Promise<{ error?: string }> {
  const session = await requireFloorAccess();
  const admin = createAdminClient();

  const { data: order, error } = await admin
    .from("orders")
    .select("id, status, table_id, channel, customer_id")
    .eq("id", orderId)
    .single();
  if (error || !order) return { error: "Order not found." };

  const currentIdx = STATUS_SEQUENCE.indexOf(order.status as OrderStatus);
  const nextIdx = STATUS_SEQUENCE.indexOf(nextStatus);
  if (currentIdx === -1 || nextIdx === -1 || nextIdx < currentIdx) {
    return { error: "Invalid status change." };
  }

  if (nextStatus === "paid" && !PAYMENT_AND_VOID_ROLES.includes(session.role)) {
    return { error: "Only cashiers, managers, or the owner can mark an order paid." };
  }

  await admin.from("orders").update({ status: nextStatus, updated_at: new Date().toISOString() }).eq("id", orderId);

  if (nextStatus === "completed") {
    const { error: deductError } = await admin.rpc("complete_order_inventory_deduction", {
      p_order_id: orderId,
      p_employee_id: session.employeeId,
    });
    if (deductError) return { error: `Order updated, but inventory deduction failed: ${deductError.message}` };

    if (order.customer_id) {
      await admin.rpc("earn_loyalty_points_for_order", {
        p_order_id: orderId,
        p_customer_id: order.customer_id,
        p_employee_id: session.employeeId,
      });
    }
  }

  if (nextStatus === "paid" && order.channel === "dine_in" && order.table_id) {
    await admin.from("restaurant_tables").update({ status: "available" }).eq("id", order.table_id);
  }

  revalidatePath("/pos");
  revalidatePath("/kds");
  return {};
}

// KDS: mark a single line item in_progress/ready without moving the whole
// order yet (the order itself advances once every line is ready).
export async function updateOrderItemStatus(
  orderItemId: string,
  status: OrderItemStatus
): Promise<{ error?: string }> {
  await requireFloorAccess();
  const admin = createAdminClient();

  const { error } = await admin.from("order_items").update({ status }).eq("id", orderItemId);
  if (error) return { error: error.message };

  revalidatePath("/kds");
  revalidatePath("/pos");
  return {};
}

export async function voidOrder(orderId: string, reason: string): Promise<{ error?: string }> {
  const session = await requireModule("pos");
  const storeId = await getEffectiveStoreId(session);
  if (!PAYMENT_AND_VOID_ROLES.includes(session.role)) {
    return { error: "Only cashiers, managers, or the owner can void an order." };
  }
  if (!reason.trim()) return { error: "A void reason is required." };

  const admin = createAdminClient();
  const { data: order } = await admin
    .from("orders")
    .select("table_id, channel")
    .eq("id", orderId)
    .single();

  await admin
    .from("orders")
    .update({
      status: "voided",
      void_reason: reason,
      voided_by: session.employeeId,
      voided_at: new Date().toISOString(),
    })
    .eq("id", orderId);

  if (order?.channel === "dine_in" && order.table_id) {
    await admin.from("restaurant_tables").update({ status: "available" }).eq("id", order.table_id);
  }

  await admin.from("audit_log").insert({
    store_id: storeId,
    action_type: "order_void",
    entity_type: "order",
    entity_id: orderId,
    performed_by: session.employeeId,
    details: { reason },
  });

  revalidatePath("/pos");
  revalidatePath("/kds");
  return {};
}

export async function recordPayment(
  orderId: string,
  method: PaymentMethod,
  amount: number,
  referenceNumber: string | null,
  screenshotUrl: string | null
): Promise<{ error?: string }> {
  const session = await requireModule("pos");
  if (!PAYMENT_AND_VOID_ROLES.includes(session.role)) {
    return { error: "Only cashiers, managers, or the owner can record payments." };
  }
  if (amount <= 0) return { error: "Payment amount must be greater than zero." };

  const admin = createAdminClient();
  const { data: order } = await admin
    .from("orders")
    .select("id, total_amount, status, table_id, channel, customer_id, payments(amount)")
    .eq("id", orderId)
    .single();
  if (!order) return { error: "Order not found." };

  const needsVerification = method !== "cash";
  const { error } = await admin.from("payments").insert({
    order_id: orderId,
    method,
    amount,
    reference_number: referenceNumber,
    screenshot_url: screenshotUrl,
    verified_by: needsVerification ? null : session.employeeId,
    verified_at: needsVerification ? null : new Date().toISOString(),
  });
  if (error) return { error: error.message };

  const alreadyPaid = (order.payments as { amount: number }[]).reduce((s, p) => s + p.amount, 0);
  const totalPaid = alreadyPaid + amount;

  if (totalPaid >= order.total_amount && order.status !== "paid") {
    await admin.from("orders").update({ status: "paid" }).eq("id", orderId);
    if (order.channel === "dine_in" && order.table_id) {
      await admin.from("restaurant_tables").update({ status: "available" }).eq("id", order.table_id);
    }
    // Idempotent (see migration 00000000000003_functions.sql) — safe even if
    // the order already went through the "completed" status transition.
    await admin.rpc("complete_order_inventory_deduction", {
      p_order_id: orderId,
      p_employee_id: session.employeeId,
    });
    if (order.customer_id) {
      await admin.rpc("earn_loyalty_points_for_order", {
        p_order_id: orderId,
        p_customer_id: order.customer_id,
        p_employee_id: session.employeeId,
      });
    }
  }

  revalidatePath("/pos");
  return {};
}

// Narrow lookup for the POS "link customer" step — reachable by every POS
// role (cashier/server/encoder), unlike the full /loyalty directory which is
// owner/manager only. Returns just enough to link an order and show a
// points balance, not the full customer record.
export async function findCustomerByPhone(
  phone: string
): Promise<{ id: string; fullName: string; pointsBalance: number } | null> {
  const session = await requireModule("pos");
  const storeId = await getEffectiveStoreId(session);
  if (!phone.trim()) return null;

  const admin = createAdminClient();
  const { data } = await admin
    .from("customers")
    .select("id, full_name, loyalty_points_balance")
    .eq("store_id", storeId)
    .eq("contact_number", phone.trim())
    .maybeSingle();

  if (!data) return null;
  return { id: data.id, fullName: data.full_name, pointsBalance: data.loyalty_points_balance };
}

export async function verifyPayment(paymentId: string): Promise<{ error?: string }> {
  const session = await requireModule("pos");
  if (!PAYMENT_AND_VOID_ROLES.includes(session.role)) {
    return { error: "Only cashiers, managers, or the owner can verify payments." };
  }
  const admin = createAdminClient();
  await admin
    .from("payments")
    .update({ verified_by: session.employeeId, verified_at: new Date().toISOString() })
    .eq("id", paymentId);

  revalidatePath("/pos");
  return {};
}

export async function uploadPaymentScreenshot(
  formData: FormData
): Promise<{ url?: string; error?: string }> {
  const session = await requireModule("pos");
  const storeId = await getEffectiveStoreId(session);
  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) return { error: "No file provided." };

  const admin = createAdminClient();
  const path = `${storeId}/${Date.now()}-${file.name}`;
  const { error } = await admin.storage
    .from("payment-screenshots")
    .upload(path, await file.arrayBuffer(), { contentType: file.type });

  if (error) return { error: error.message };

  const { data } = admin.storage.from("payment-screenshots").getPublicUrl(path);
  return { url: data.publicUrl };
}
