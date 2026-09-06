export type OrderChannel =
  | "dine_in"
  | "phone"
  | "landline"
  | "facebook"
  | "grabfood"
  | "foodpanda"
  | "online";

export type OrderStatus =
  | "pending"
  | "preparing"
  | "ready"
  | "served"
  | "completed"
  | "paid"
  | "cancelled"
  | "voided";

export type OrderItemStatus = "pending" | "in_progress" | "ready" | "served";
export type DiscountType = "none" | "senior" | "pwd" | "promo";
export type PaymentMethod = "cash" | "gcash" | "bank_transfer";
export type PoStatus = "draft" | "sent" | "partially_received" | "received" | "cancelled";
export type TableStatus = "available" | "occupied" | "reserved";

export type MenuVariant = {
  id: string;
  name: string;
  price_delta: number;
};

export type MenuItem = {
  id: string;
  category_id: string | null;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  is_active: boolean;
  menu_item_variants: MenuVariant[];
};

export type MenuCategory = {
  id: string;
  name: string;
  sort_order: number;
};

export type RestaurantTable = {
  id: string;
  table_number: string;
  capacity: number;
  status: TableStatus;
};

export type OrderItemRow = {
  id: string;
  menu_item_id: string;
  variant_id: string | null;
  quantity: number;
  unit_price: number;
  notes: string | null;
  status: OrderItemStatus;
  menu_items?: { name: string } | null;
  menu_item_variants?: { name: string } | null;
};

export type PaymentRow = {
  id: string;
  method: PaymentMethod;
  amount: number;
  reference_number: string | null;
  screenshot_url: string | null;
  verified_by: string | null;
  verified_at: string | null;
  created_at: string;
};

export type OrderRow = {
  id: string;
  channel: OrderChannel;
  external_reference: string | null;
  table_id: string | null;
  customer_name: string | null;
  customer_contact: string | null;
  status: OrderStatus;
  subtotal: number;
  discount_type: DiscountType;
  discount_id_number: string | null;
  discount_amount: number;
  platform_commission: number;
  tax_amount: number;
  total_amount: number;
  void_reason: string | null;
  created_at: string;
  updated_at: string;
  order_items: OrderItemRow[];
  payments: PaymentRow[];
  restaurant_tables?: { table_number: string } | null;
};

export type InventoryItemRow = {
  id: string;
  name: string;
  unit: string;
  current_stock: number;
  weighted_avg_cost: number;
  reorder_point: number;
  updated_at: string;
};

export type SupplierRow = {
  id: string;
  name: string;
  contact_person: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
};

export type PurchaseOrderItemRow = {
  id: string;
  inventory_item_id: string;
  quantity_ordered: number;
  quantity_received: number;
  unit_cost: number;
  inventory_items?: { name: string; unit: string } | null;
};

export type PurchaseOrderRow = {
  id: string;
  supplier_id: string;
  status: PoStatus;
  order_date: string;
  expected_date: string | null;
  notes: string | null;
  total_cost: number;
  created_at: string;
  suppliers?: { name: string } | null;
  purchase_order_items: PurchaseOrderItemRow[];
};

export type EmployeeRow = {
  id: string;
  full_name: string;
  role: string;
  contact_number: string | null;
  email: string | null;
  hire_date: string | null;
  pay_type: "daily" | "hourly" | "monthly";
  pay_rate: number;
  is_active: boolean;
};

export type ShiftRow = {
  id: string;
  employee_id: string;
  shift_date: string;
  start_time: string;
  end_time: string;
  notes: string | null;
};

export type AttendanceRow = {
  id: string;
  employee_id: string;
  shift_id: string | null;
  clock_in: string | null;
  clock_out: string | null;
  is_manual_override: boolean;
  notes: string | null;
};

export type PayrollPeriodStatus = "open" | "finalized";

export type PayrollPeriodRow = {
  id: string;
  start_date: string;
  end_date: string;
  status: PayrollPeriodStatus;
  created_at: string;
};

export type PayslipDeductionRow = {
  id: string;
  label: string;
  amount: number;
};

export type PayslipRow = {
  id: string;
  payroll_period_id: string;
  employee_id: string;
  regular_hours: number;
  regular_pay: number;
  overtime_hours: number;
  overtime_pay: number;
  gross_pay: number;
  total_deductions: number;
  net_pay: number;
  notes: string | null;
  generated_at: string;
  payslip_deductions: PayslipDeductionRow[];
  employees?: { full_name: string; role: string; pay_type: string; pay_rate: number } | null;
};

export type ReservationStatus =
  | "pending"
  | "confirmed"
  | "seated"
  | "completed"
  | "no_show"
  | "cancelled";

export type ReservationRow = {
  id: string;
  customer_name: string;
  contact_number: string;
  party_size: number;
  reservation_date: string;
  reservation_time: string;
  status: ReservationStatus;
  table_id: string | null;
  down_payment_amount: number | null;
  payment_reference: string | null;
  payment_screenshot_url: string | null;
  verified_by: string | null;
  verified_at: string | null;
  notified_at: string | null;
  notes: string | null;
  created_at: string;
  restaurant_tables?: { table_number: string } | null;
};

export type WaitlistStatus = "waiting" | "seated" | "cancelled" | "no_show";

export type WaitlistRow = {
  id: string;
  customer_name: string;
  contact_number: string | null;
  party_size: number;
  status: WaitlistStatus;
  queue_position: number | null;
  estimated_wait_minutes: number | null;
  created_at: string;
};
