import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

const VALID_STATUSES = ["pending", "preparing", "ready", "served", "completed", "paid"];

export type DashboardData = {
  grossSales: number;
  netSales: number;
  totalCommission: number;
  totalDiscounts: number;
  orderCount: number;
  byChannel: { channel: string; count: number; amount: number }[];
  byPaymentMethod: { method: string; amount: number }[];
  itemSales: { menuItemId: string; name: string; quantity: number; revenue: number }[];
  cogsTotal: number;
  inventoryValuation: number;
  lowStockItems: { id: string; name: string; unit: string; currentStock: number; reorderPoint: number }[];
  laborCostEstimate: number;
  laborCostAssumptions: string;
  supplierSpend: { supplierId: string; name: string; amount: number }[];
};

export async function getDashboardData(
  storeId: string,
  startDate: string,
  endDate: string
): Promise<DashboardData> {
  const admin = createAdminClient();

  const [ordersRes, cogsRes, inventoryRes, poRes, shiftsRes, employeesRes] = await Promise.all([
    admin
      .from("orders")
      .select(
        "id, channel, status, discount_amount, platform_commission, total_amount, payments(method, amount), order_items(menu_item_id, quantity, unit_price, menu_items(name))"
      )
      .eq("store_id", storeId)
      .gte("created_at", startDate)
      .lte("created_at", endDate),
    admin
      .from("inventory_transactions")
      .select("quantity_change, unit_cost")
      .eq("store_id", storeId)
      .eq("type", "sale_deduction")
      .gte("created_at", startDate)
      .lte("created_at", endDate),
    admin
      .from("inventory_items")
      .select("id, name, unit, current_stock, weighted_avg_cost, reorder_point")
      .eq("store_id", storeId),
    admin
      .from("purchase_orders")
      .select("supplier_id, total_cost, status, order_date, suppliers(name)")
      .eq("store_id", storeId)
      .neq("status", "cancelled")
      .gte("order_date", startDate.slice(0, 10))
      .lte("order_date", endDate.slice(0, 10)),
    admin
      .from("shifts")
      .select("employee_id, shift_date, start_time, end_time")
      .eq("store_id", storeId)
      .gte("shift_date", startDate.slice(0, 10))
      .lte("shift_date", endDate.slice(0, 10)),
    admin
      .from("employees")
      .select("id, pay_type, pay_rate")
      .eq("store_id", storeId),
  ]);

  if (ordersRes.error) throw new Error(ordersRes.error.message);
  const orders = (ordersRes.data ?? []).filter((o) => VALID_STATUSES.includes(o.status));

  const grossSales = orders.reduce((s, o) => s + o.total_amount, 0);
  const totalCommission = orders.reduce((s, o) => s + o.platform_commission, 0);
  const totalDiscounts = orders.reduce((s, o) => s + o.discount_amount, 0);

  const byChannelMap = new Map<string, { count: number; amount: number }>();
  for (const o of orders) {
    const cur = byChannelMap.get(o.channel) ?? { count: 0, amount: 0 };
    byChannelMap.set(o.channel, { count: cur.count + 1, amount: cur.amount + o.total_amount });
  }

  const byMethodMap = new Map<string, number>();
  for (const o of orders) {
    for (const p of o.payments as { method: string; amount: number }[]) {
      byMethodMap.set(p.method, (byMethodMap.get(p.method) ?? 0) + p.amount);
    }
  }

  const itemSalesMap = new Map<string, { name: string; quantity: number; revenue: number }>();
  for (const o of orders) {
    for (const oi of o.order_items as unknown as {
      menu_item_id: string;
      quantity: number;
      unit_price: number;
      menu_items: { name: string } | null;
    }[]) {
      const cur = itemSalesMap.get(oi.menu_item_id) ?? {
        name: oi.menu_items?.name ?? "Unknown",
        quantity: 0,
        revenue: 0,
      };
      cur.quantity += oi.quantity;
      cur.revenue += oi.quantity * oi.unit_price;
      itemSalesMap.set(oi.menu_item_id, cur);
    }
  }

  if (cogsRes.error) throw new Error(cogsRes.error.message);
  const cogsTotal = (cogsRes.data ?? []).reduce((s, t) => s + -t.quantity_change * t.unit_cost, 0);

  if (inventoryRes.error) throw new Error(inventoryRes.error.message);
  const inventoryItems = inventoryRes.data ?? [];
  const inventoryValuation = inventoryItems.reduce((s, i) => s + i.current_stock * i.weighted_avg_cost, 0);
  const lowStockItems = inventoryItems
    .filter((i) => i.current_stock <= i.reorder_point)
    .map((i) => ({
      id: i.id,
      name: i.name,
      unit: i.unit,
      currentStock: i.current_stock,
      reorderPoint: i.reorder_point,
    }));

  if (poRes.error) throw new Error(poRes.error.message);
  const supplierSpendMap = new Map<string, { name: string; amount: number }>();
  for (const po of poRes.data ?? []) {
    const name = (po.suppliers as unknown as { name: string } | null)?.name ?? "Unknown";
    const cur = supplierSpendMap.get(po.supplier_id) ?? { name, amount: 0 };
    cur.amount += po.total_cost;
    supplierSpendMap.set(po.supplier_id, cur);
  }

  if (shiftsRes.error) throw new Error(shiftsRes.error.message);
  if (employeesRes.error) throw new Error(employeesRes.error.message);
  const payById = new Map(employeesRes.data!.map((e) => [e.id, e]));
  const MONTHLY_WORKING_DAYS = 26; // PH small-business convention for prorating a monthly salary

  let laborCostEstimate = 0;
  for (const shift of shiftsRes.data ?? []) {
    const emp = payById.get(shift.employee_id);
    if (!emp) continue;
    if (emp.pay_type === "daily") {
      laborCostEstimate += emp.pay_rate;
    } else if (emp.pay_type === "hourly") {
      const [sh, sm] = shift.start_time.split(":").map(Number);
      const [eh, em] = shift.end_time.split(":").map(Number);
      const hours = Math.max(0, eh + em / 60 - (sh + sm / 60));
      laborCostEstimate += emp.pay_rate * hours;
    } else {
      laborCostEstimate += emp.pay_rate / MONTHLY_WORKING_DAYS;
    }
  }

  return {
    grossSales,
    netSales: grossSales - totalCommission,
    totalCommission,
    totalDiscounts,
    orderCount: orders.length,
    byChannel: [...byChannelMap.entries()].map(([channel, v]) => ({ channel, ...v })),
    byPaymentMethod: [...byMethodMap.entries()].map(([method, amount]) => ({ method, amount })),
    itemSales: [...itemSalesMap.entries()]
      .map(([menuItemId, v]) => ({ menuItemId, ...v }))
      .sort((a, b) => b.quantity - a.quantity),
    cogsTotal,
    inventoryValuation,
    lowStockItems,
    laborCostEstimate,
    laborCostAssumptions: `Estimated from scheduled shifts × pay rate (daily = 1 day's pay per shift, hourly = shift hours × rate, monthly = salary ÷ ${MONTHLY_WORKING_DAYS} working days per scheduled day). Not actual attendance — Phase 2 adds PIN clock-in/out for real hours worked.`,
    supplierSpend: [...supplierSpendMap.entries()].map(([supplierId, v]) => ({ supplierId, ...v })),
  };
}
