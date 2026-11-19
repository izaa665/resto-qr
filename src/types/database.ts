export type OrderType = 'dine_in' | 'takeaway';

export type OrderStatus = 'pending' | 'processing' | 'ready' | 'completed' | 'cancelled';

export type PaymentStatus = 'unpaid' | 'waiting_confirmation' | 'paid' | 'failed' | 'refunded';

export type UserRole = 'admin' | 'kasir' | 'dapur';

export interface User {
  id: number;
  name: string;
  username: string;
  pin?: string;
  role: UserRole;
  email?: string;
  is_active?: boolean;
}

export interface Category {
  id: number;
  name: string;
  icon: string;
}

export interface MenuItem {
  id: number;
  category_id: number;
  name: string;
  description: string;
  price: number;
  image: string;
  is_available: boolean;
  category_name?: string;
  is_drink?: boolean;
}

export interface RestaurantTable {
  id: number;
  table_number: number;
  table_code: string;
  description: string;
  qr_token?: string;
}

export interface OrderItem {
  id?: number;
  order_id?: number;
  menu_id: number;
  menu_name: string;
  price: number;
  qty: number;
  subtotal: number;
  item_notes?: string;
  image?: string;
}

export interface Order {
  id: number;
  order_number: string;
  order_type: OrderType;
  table_number?: number | null;
  customer_name: string;
  total_amount: number;
  discount_amount?: number;
  tax_amount?: number;
  payment_method: 'Tunai' | 'QRIS' | 'Transfer Bank' | string;
  payment_status: PaymentStatus;
  order_status: OrderStatus;
  notes?: string;
  cashier_name?: string;
  created_at: string;
  items?: OrderItem[];
}

export interface Expense {
  id: number;
  category: string;
  description: string;
  amount: number;
  expense_date: string;
  created_at?: string;
}

export interface RestaurantSetting {
  id: number;
  name: string;
  address: string;
  phone: string;
  wifi_password: string;
  tax_percent: number;
  service_percent?: number;
  receipt_footer?: string;
}

export interface WaiterCall {
  id: number;
  table_number: number;
  customer_name?: string;
  call_type: string;
  status: 'pending' | 'resolved';
  created_at: string;
}
