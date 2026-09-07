"use server";

import { requireModule } from "@/lib/auth/rbac";
import { getEffectiveStoreId } from "@/lib/auth/store-scope";
import { getKitchenOrders } from "./data";
import type { OrderRow } from "@/lib/domain-types";
import * as orderActions from "@/lib/orders/actions";
import type { OrderItemStatus, OrderStatus } from "@/lib/domain-types";

// Thin polling endpoint the client component calls on an interval — the
// spec allows polling for MVP ("Real-time (polling is fine for MVP)").
export async function pollKitchenOrders(): Promise<OrderRow[]> {
  const session = await requireModule("kds");
  const storeId = await getEffectiveStoreId(session);
  return getKitchenOrders(storeId);
}

// A "use server" file may only export async functions directly, so these
// wrap (rather than re-export) the shared order actions.
export async function updateOrderItemStatus(orderItemId: string, status: OrderItemStatus) {
  return orderActions.updateOrderItemStatus(orderItemId, status);
}

export async function advanceOrderStatus(orderId: string, nextStatus: OrderStatus) {
  return orderActions.advanceOrderStatus(orderId, nextStatus);
}
