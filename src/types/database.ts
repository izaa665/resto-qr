export type OrderType = 'dine_in' | 'takeaway';

export type OrderStatus = 'pending' | 'processing' | 'ready' | 'completed' | 'cancelled';

export type PaymentStatus = 'unpaid' | 'waiting_confirmation' | 'paid' | 'failed' | 'refunded';

export type UserRole = 'admin' | 'kasir' | 'dapur';

export interface User {
  id: number;
  name: string;
  role: UserRole;
  email: string;
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
  payment_method: 'Tunai' | 'QRIS' | 'Transfer Bank' | string;
  payment_status: PaymentStatus;
  order_status: OrderStatus;
  notes?: string;
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
}
