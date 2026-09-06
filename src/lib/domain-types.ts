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
