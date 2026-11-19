import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { 
  Category, 
  MenuItem, 
  RestaurantTable, 
  Order, 
  OrderItem, 
  Expense, 
  User, 
  RestaurantSetting,
  OrderStatus,
  PaymentStatus,
  OrderType
} from '@/types/database';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = Boolean(
  supabaseUrl && 
  supabaseAnonKey && 
  !supabaseUrl.includes('your-project') &&
  supabaseUrl.startsWith('http')
);

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

// Initial Mock Seed Data
export const initialCategories: Category[] = [
  { id: 1, name: 'Makanan Utama', icon: 'Utensils' },
  { id: 2, name: 'Minuman Segar', icon: 'Coffee' },
  { id: 3, name: 'Camilan & Snack', icon: 'Pizza' },
  { id: 4, name: 'Kopi & Dessert', icon: 'Cake' },
];

export const initialMenus: MenuItem[] = [
  {
    id: 1,
    category_id: 1,
    name: 'Nasi Goreng Spesial',
    description: 'Nasi goreng bumbu rempah pilihan dengan suwiran ayam, sosis, bakso, dan telur mata sapi.',
    price: 28000,
    image: 'https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=500&auto=format&fit=crop&q=80',
    is_available: true,
    category_name: 'Makanan Utama'
  },
  {
    id: 2,
    category_id: 1,
    name: 'Ayam Bakar Madu',
    description: 'Ayam bakar lembut berlumur madu dan rempah gurih, disajikan dengan lalapan dan sambal terasi.',
    price: 32000,
    image: 'https://images.unsplash.com/photo-1598515214211-89d3c73ae83b?w=500&auto=format&fit=crop&q=80',
    is_available: true,
    category_name: 'Makanan Utama'
  },
  {
    id: 3,
    category_id: 1,
    name: 'Mie Goreng Seafood',
    description: 'Mie kenyal ditumis bumbu istimewa dengan topping udang segar, cumi, dan sayuran renyah.',
    price: 30000,
    image: 'https://images.unsplash.com/photo-1585032226651-759b368d7246?w=500&auto=format&fit=crop&q=80',
    is_available: true,
    category_name: 'Makanan Utama'
  },
  {
    id: 4,
    category_id: 1,
    name: 'Soto Ayam Lamongan',
    description: 'Soto ayam kuah kuning gurih segar dengan koya renyah, bihun, irisan telur, dan kol.',
    price: 25000,
    image: 'https://images.unsplash.com/photo-1572656631137-7935297eff55?w=500&auto=format&fit=crop&q=80',
    is_available: true,
    category_name: 'Makanan Utama'
  },
  {
    id: 5,
    category_id: 2,
    name: 'Es Teh Manis Jumbo',
    description: 'Teh melati wangi khas diseduh segar dengan es batu melimpah pelepas dahaga.',
    price: 7000,
    image: 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=500&auto=format&fit=crop&q=80',
    is_available: true,
    category_name: 'Minuman Segar'
  },
  {
    id: 6,
    category_id: 2,
    name: 'Es Jeruk Peras Segar',
    description: 'Jeruk asli diperas langsung murni dengan gula tebu dan es batu dingin.',
    price: 12000,
    image: 'https://images.unsplash.com/photo-1613478223719-2ab802602423?w=500&auto=format&fit=crop&q=80',
    is_available: true,
    category_name: 'Minuman Segar'
  },
  {
    id: 7,
    category_id: 3,
    name: 'Kentang Goreng Keju',
    description: 'French fries renyah keemasan ditaburi bumbu keju gurih spesial.',
    price: 18000,
    image: 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=500&auto=format&fit=crop&q=80',
    is_available: true,
    category_name: 'Camilan & Snack'
  },
  {
    id: 8,
    category_id: 4,
    name: 'Kopi Susu Gula Aren',
    description: 'Espresso pekat berpadu dengan susu creamy dan legitnya gula aren organik.',
    price: 18000,
    image: 'https://images.unsplash.com/photo-1517701550927-30cf4ba1dba5?w=500&auto=format&fit=crop&q=80',
    is_available: true,
    category_name: 'Kopi & Dessert'
  }
];

export const initialTables: RestaurantTable[] = Array.from({ length: 10 }, (_, i) => ({
  id: i + 1,
  table_number: i + 1,
  table_code: `TABLE-${String(i + 1).padStart(2, '0')}`,
  qr_token: `QR-TBL-${String(i + 1).padStart(2, '0')}-KLIR`,
  description: `Meja ${i + 1} Area Resto`
}));

export const initialExpenses: Expense[] = [
  { id: 1, category: 'Bahan Baku Makanan', description: 'Pembelian beras 50kg, minyak goreng & telur', amount: 850000, expense_date: '2026-11-16' },
  { id: 2, category: 'Bahan Baku Makanan', description: 'Ayam potong 15kg & daging sapi 5kg', amount: 1200000, expense_date: '2026-11-17' },
  { id: 3, category: 'Operasional & Gas', description: 'Pembelian gas LPG 12kg (2 tabung)', amount: 420000, expense_date: '2026-11-17' },
  { id: 4, category: 'Bahan Minuman', description: 'Kopi robusta 3kg, sirup & susu kental manis', amount: 350000, expense_date: '2026-11-18' }
];

export const initialOrders: Order[] = [
  {
    id: 1,
    order_number: 'ORD-20261118-001',
    order_type: 'dine_in',
    table_number: 3,
    customer_name: 'Budi Santoso',
    total_amount: 51000,
    payment_method: 'QRIS',
    payment_status: 'paid',
    order_status: 'completed',
    notes: 'Sambal dipisah ya',
    created_at: new Date(Date.now() - 3600000 * 2).toISOString(),
    items: [
      { menu_id: 2, menu_name: 'Ayam Bakar Madu', price: 32000, qty: 1, subtotal: 32000, item_notes: 'Pedas manis' },
      { menu_id: 8, menu_name: 'Kopi Susu Gula Aren', price: 18000, qty: 1, subtotal: 18000, item_notes: 'Less sugar' }
    ]
  },
  {
    id: 2,
    order_number: 'ORD-20261118-002',
    order_type: 'dine_in',
    table_number: 5,
    customer_name: 'Ani',
    total_amount: 63000,
    payment_method: 'Tunai',
    payment_status: 'unpaid',
    order_status: 'processing',
    notes: 'Es sedikit saja',
    created_at: new Date(Date.now() - 600000).toISOString(),
    items: [
      { menu_id: 1, menu_name: 'Nasi Goreng Spesial', price: 28000, qty: 2, subtotal: 56000, item_notes: 'Telur matang' },
      { menu_id: 5, menu_name: 'Es Teh Manis Jumbo', price: 7000, qty: 1, subtotal: 7000, item_notes: '' }
    ]
  }
];

export const initialUsers: User[] = [
  { id: 1, name: 'Budi (Admin Owner)', username: 'admin', pin: '1234', email: 'owner@resto.com', role: 'admin', is_active: true },
  { id: 2, name: 'Rina (Kasir Shift Pagi)', username: 'rina', pin: '1111', email: 'rina@resto.com', role: 'kasir', is_active: true },
  { id: 3, name: 'Doni (Kasir Shift Sore)', username: 'doni', pin: '2222', email: 'doni@resto.com', role: 'kasir', is_active: true },
  { id: 4, name: 'Chef Joko (Dapur)', username: 'joko', pin: '3333', email: 'dapur@resto.com', role: 'dapur', is_active: true }
];

export const initialSetting: RestaurantSetting = {
  id: 1,
  name: 'Rasa Nusantara Resto & POS',
  address: 'Jl. Kuliner Lezat No. 88, Jakarta',
  phone: '0812-3456-7890',
  wifi_password: 'nusantara88',
  tax_percent: 0
};

// Storage Keys
const STORAGE_KEYS = {
  ORDERS: 'klir_resto_orders',
  MENUS: 'klir_resto_menus',
  EXPENSES: 'klir_resto_expenses',
  TABLES: 'klir_resto_tables',
  SETTING: 'klir_resto_setting',
  USERS: 'klir_resto_users'
};

function getLocalData<T>(key: string, defaultData: T): T {
  if (typeof window === 'undefined') return defaultData;
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : defaultData;
  } catch {
    return defaultData;
  }
}

function setLocalData<T>(key: string, data: T): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(data));
    window.dispatchEvent(new Event('storage'));
  } catch (e) {
    console.error('Storage error:', e);
  }
}

// ==========================================
// DATA ACCESS LAYER
// ==========================================

export async function fetchCategories(): Promise<Category[]> {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase.from('categories').select('*').order('id', { ascending: true });
    if (!error && data && data.length > 0) return data;
  }
  return initialCategories;
}

export async function fetchMenus(): Promise<MenuItem[]> {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase
      .from('menus')
      .select('*, categories(name)')
      .order('id', { ascending: true });
    if (!error && data && data.length > 0) {
      return data.map((m: any) => ({
        ...m,
        category_name: m.categories?.name || 'Menu'
      }));
    }
  }
  return getLocalData<MenuItem[]>(STORAGE_KEYS.MENUS, initialMenus);
}

export async function fetchTables(): Promise<RestaurantTable[]> {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase.from('restaurant_tables').select('*').order('table_number', { ascending: true });
    if (!error && data && data.length > 0) return data;
  }
  return getLocalData<RestaurantTable[]>(STORAGE_KEYS.TABLES, initialTables);
}

export async function fetchOrders(): Promise<Order[]> {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase
      .from('orders')
      .select('*, order_items(*)')
      .order('id', { ascending: false });
    if (!error && data) {
      return data.map((o: any) => ({
        ...o,
        items: o.order_items || []
      }));
    }
  }
  return getLocalData<Order[]>(STORAGE_KEYS.ORDERS, initialOrders);
}

export async function createOrder(orderData: {
  order_type: OrderType;
  table_number?: number | null;
  customer_name: string;
  cashier_name?: string;
  total_amount: number;
  payment_method: string;
  payment_status?: PaymentStatus;
  order_status?: OrderStatus;
  notes?: string;
  items: OrderItem[];
}): Promise<{ success: boolean; order?: Order; error?: string }> {
  const orderNumber = `ORD-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${String(Math.floor(Math.random() * 900) + 100)}`;
  const orderType = orderData.order_type || 'dine_in';
  const payStatus = orderData.payment_status || 'unpaid';
  const ordStatus = orderData.order_status || 'pending';

  if (isSupabaseConfigured && supabase) {
    const { data: order, error: orderErr } = await supabase
      .from('orders')
      .insert({
        order_number: orderNumber,
        order_type: orderType,
        table_number: orderType === 'takeaway' ? null : orderData.table_number,
        customer_name: orderData.customer_name,
        cashier_name: orderData.cashier_name || '',
        total_amount: orderData.total_amount,
        payment_method: orderData.payment_method,
        payment_status: payStatus,
        order_status: ordStatus,
        notes: orderData.notes || ''
      })
      .select()
      .single();

    if (orderErr) return { success: false, error: orderErr.message };

    const itemsToInsert = orderData.items.map(item => ({
      order_id: order.id,
      menu_id: item.menu_id,
      menu_name: item.menu_name,
      price: item.price,
      qty: item.qty,
      subtotal: item.subtotal,
      item_notes: item.item_notes || ''
    }));

    await supabase.from('order_items').insert(itemsToInsert);

    // Insert log status awal
    await supabase.from('order_status_logs').insert({
      order_id: order.id,
      status_from: null,
      status_to: ordStatus,
      changed_by: orderData.cashier_name || (orderType === 'takeaway' ? 'Kasir POS' : 'Pelanggan Meja')
    });

    return { success: true, order: { ...order, items: orderData.items } };
  }

  // Fallback Local Storage
  const currentOrders = getLocalData<Order[]>(STORAGE_KEYS.ORDERS, initialOrders);
  const newOrder: Order = {
    id: Date.now(),
    order_number: orderNumber,
    order_type: orderType,
    table_number: orderType === 'takeaway' ? null : orderData.table_number,
    customer_name: orderData.customer_name,
    cashier_name: orderData.cashier_name || '',
    total_amount: orderData.total_amount,
    payment_method: orderData.payment_method,
    payment_status: payStatus,
    order_status: ordStatus,
    notes: orderData.notes,
    created_at: new Date().toISOString(),
    items: orderData.items
  };

  setLocalData(STORAGE_KEYS.ORDERS, [newOrder, ...currentOrders]);
  return { success: true, order: newOrder };
}

export async function updateOrderStatus(
  orderId: number, 
  updates: { 
    order_status?: OrderStatus; 
    payment_status?: PaymentStatus; 
    payment_method?: string;
    cashier_name?: string;
    changed_by?: string;
  }
): Promise<boolean> {
  const { changed_by, ...dbUpdates } = updates;

  if (isSupabaseConfigured && supabase) {
    const { error } = await supabase.from('orders').update(dbUpdates).eq('id', orderId);
    if (updates.order_status) {
      await supabase.from('order_status_logs').insert({
        order_id: orderId,
        status_to: updates.order_status,
        changed_by: changed_by || 'Staf'
      });
    }
    return !error;
  }

  const currentOrders = getLocalData<Order[]>(STORAGE_KEYS.ORDERS, initialOrders);
  const updated = currentOrders.map(o => (o.id === orderId ? { ...o, ...dbUpdates } : o));
  setLocalData(STORAGE_KEYS.ORDERS, updated);
  return true;
}

export async function fetchExpenses(): Promise<Expense[]> {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase.from('expenses').select('*').order('expense_date', { ascending: false });
    if (!error && data) return data;
  }
  return getLocalData<Expense[]>(STORAGE_KEYS.EXPENSES, initialExpenses);
}

export async function createExpense(exp: Omit<Expense, 'id'>): Promise<boolean> {
  if (isSupabaseConfigured && supabase) {
    const { error } = await supabase.from('expenses').insert(exp);
    return !error;
  }

  const current = getLocalData<Expense[]>(STORAGE_KEYS.EXPENSES, initialExpenses);
  const newExp: Expense = { ...exp, id: Date.now() };
  setLocalData(STORAGE_KEYS.EXPENSES, [newExp, ...current]);
  return true;
}

export async function deleteExpense(id: number): Promise<boolean> {
  if (isSupabaseConfigured && supabase) {
    const { error } = await supabase.from('expenses').delete().eq('id', id);
    return !error;
  }

  const current = getLocalData<Expense[]>(STORAGE_KEYS.EXPENSES, initialExpenses);
  setLocalData(STORAGE_KEYS.EXPENSES, current.filter(e => e.id !== id));
  return true;
}

export async function toggleMenuAvailability(id: number, is_available: boolean): Promise<boolean> {
  if (isSupabaseConfigured && supabase) {
    const { error } = await supabase.from('menus').update({ is_available }).eq('id', id);
    return !error;
  }

  const current = getLocalData<MenuItem[]>(STORAGE_KEYS.MENUS, initialMenus);
  setLocalData(STORAGE_KEYS.MENUS, current.map(m => m.id === id ? { ...m, is_available } : m));
  return true;
}

export async function createMenuItem(menu: Omit<MenuItem, 'id'>): Promise<boolean> {
  if (isSupabaseConfigured && supabase) {
    const { error } = await supabase.from('menus').insert(menu);
    return !error;
  }

  const current = getLocalData<MenuItem[]>(STORAGE_KEYS.MENUS, initialMenus);
  const newMenu: MenuItem = { ...menu, id: Date.now() };
  setLocalData(STORAGE_KEYS.MENUS, [...current, newMenu]);
  return true;
}

export async function fetchUsers(): Promise<User[]> {
  if (isSupabaseConfigured && supabase) {
    const { data } = await supabase.from('users').select('*').order('id', { ascending: true });
    if (data && data.length > 0) return data;
  }
  return getLocalData<User[]>(STORAGE_KEYS.USERS, initialUsers);
}

export async function createUser(user: Omit<User, 'id'>): Promise<User> {
  const newUser: User = {
    ...user,
    id: Date.now(),
    is_active: user.is_active !== undefined ? user.is_active : true
  };

  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase.from('users').insert([newUser]).select();
    if (!error && data && data[0]) return data[0];
  }

  const current = getLocalData<User[]>(STORAGE_KEYS.USERS, initialUsers);
  setLocalData(STORAGE_KEYS.USERS, [...current, newUser]);
  return newUser;
}

export async function updateUser(id: number, updates: Partial<User>): Promise<boolean> {
  if (isSupabaseConfigured && supabase) {
    const { error } = await supabase.from('users').update(updates).eq('id', id);
    if (!error) return true;
  }

  const current = getLocalData<User[]>(STORAGE_KEYS.USERS, initialUsers);
  const updated = current.map(u => u.id === id ? { ...u, ...updates } : u);
  setLocalData(STORAGE_KEYS.USERS, updated);
  return true;
}

export async function deleteUser(id: number): Promise<boolean> {
  if (isSupabaseConfigured && supabase) {
    const { error } = await supabase.from('users').delete().eq('id', id);
    if (!error) return true;
  }

  const current = getLocalData<User[]>(STORAGE_KEYS.USERS, initialUsers);
  const updated = current.filter(u => u.id !== id);
  setLocalData(STORAGE_KEYS.USERS, updated);
  return true;
}

export async function deleteMenuItem(id: number): Promise<boolean> {
  if (isSupabaseConfigured && supabase) {
    const { error } = await supabase.from('menus').delete().eq('id', id);
    if (!error) return true;
  }

  const current = getLocalData<MenuItem[]>(STORAGE_KEYS.MENUS, initialMenus);
  setLocalData(STORAGE_KEYS.MENUS, current.filter(m => m.id !== id));
  return true;
}

export async function fetchSetting(): Promise<RestaurantSetting> {
  if (isSupabaseConfigured && supabase) {
    const { data } = await supabase.from('restaurant_settings').select('*').limit(1).single();
    if (data) return data;
  }
  return getLocalData<RestaurantSetting>(STORAGE_KEYS.SETTING, initialSetting);
}

export async function updateSetting(updates: Partial<RestaurantSetting>): Promise<boolean> {
  if (isSupabaseConfigured && supabase) {
    const { error } = await supabase.from('restaurant_settings').update(updates).eq('id', 1);
    if (!error) return true;
  }

  const current = getLocalData<RestaurantSetting>(STORAGE_KEYS.SETTING, initialSetting);
  const updated = { ...current, ...updates };
  setLocalData(STORAGE_KEYS.SETTING, updated);
  return true;
}
