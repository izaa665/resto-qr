'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import QRCode from 'qrcode';
import { 
  Printer, 
  RefreshCw, 
  Clock, 
  Check, 
  ArrowLeft,
  Plus,
  ShoppingBag,
  CreditCard,
  Banknote,
  Minus,
  Search,
  X,
  QrCode,
  ShieldCheck,
  UserCheck,
  LogOut,
  Lock,
  KeyRound,
  Shield,
  User as UserIcon,
  AlertTriangle,
  CheckCircle2,
  Bell,
  LayoutGrid,
  FileText,
  ArrowRightLeft,
  Percent,
  Wifi,
  Sparkles,
  UtensilsCrossed,
  Receipt,
  Trash2,
  Info,
  ChevronDown,
  ArrowUpRight,
  Flame,
  Coffee,
  Smartphone,
  SlidersHorizontal
} from 'lucide-react';
import { 
  Order, 
  MenuItem, 
  RestaurantTable, 
  OrderItem, 
  PaymentStatus, 
  OrderStatus, 
  User, 
  WaiterCall, 
  RestaurantSetting 
} from '@/types/database';
import { 
  fetchOrders, 
  updateOrderStatus, 
  fetchMenus, 
  fetchTables, 
  createOrder, 
  fetchUsers, 
  fetchWaiterCalls, 
  resolveWaiterCall, 
  updateOrderTable, 
  updateOrderDiscount, 
  fetchSetting, 
  isSupabaseConfigured, 
  supabase 
} from '@/lib/supabase';
import { formatRupiah, playCashierChime } from '@/lib/utils';

export default function CashierPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [menus, setMenus] = useState<MenuItem[]>([]);
  const [tables, setTables] = useState<RestaurantTable[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [waiterCalls, setWaiterCalls] = useState<WaiterCall[]>([]);
  const [setting, setSetting] = useState<RestaurantSetting | null>(null);

  // Cashier Auth
  const [activeCashier, setActiveCashier] = useState<User | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [cashierPin, setCashierPin] = useState<string>('');
  const [loginError, setLoginError] = useState<string>('');
  const [isAuthLoaded, setIsAuthLoaded] = useState<boolean>(false);

  // Active Main Tab: 'pos' (Menu catalog + Right Order Panel) | 'qr_orders' (Live incoming orders from QR scan) | 'tables' (Floor plan)
  const [activeMainTab, setActiveMainTab] = useState<'pos' | 'qr_orders' | 'tables'>('pos');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Right Order Panel Cart State (Current Order)
  const [cartItems, setCartItems] = useState<OrderItem[]>([]);
  const [customerName, setCustomerName] = useState<string>('Pelanggan Kasir');
  const [selectedTableNumber, setSelectedTableNumber] = useState<number>(1);
  const [personCount, setPersonCount] = useState<number>(2);
  const [orderType, setOrderType] = useState<'dine_in' | 'takeaway'>('dine_in');
  const [loadedOrderId, setLoadedOrderId] = useState<number | null>(null);

  // Table management states
  const [dirtyTables, setDirtyTables] = useState<number[]>([]);
  const [selectedOrderForReceipt, setSelectedOrderForReceipt] = useState<Order | null>(null);
  const [isShiftReportOpen, setIsShiftReportOpen] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState('');
  const [previousPendingCount, setPreviousPendingCount] = useState<number>(0);
  const [previousCallCount, setPreviousCallCount] = useState<number>(0);

  // Settlement Modal states
  const [orderToPay, setOrderToPay] = useState<Order | null>(null);
  const [cashGiven, setCashGiven] = useState<number>(0);
  const [settlementMethod, setSettlementMethod] = useState<'Tunai' | 'QRIS' | 'Kartu Debit'>('Tunai');
  const [cashierQrisDataUrl, setCashierQrisDataUrl] = useState<string>('');
  const [cashierQrisTimeLeft, setCashierQrisTimeLeft] = useState<number>(300);
  const [isCashierQrisExpired, setIsCashierQrisExpired] = useState<boolean>(false);
  const [cashierQrisVersion, setCashierQrisVersion] = useState<number>(1);

  // Clock
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Dirty tables load
  useEffect(() => {
    try {
      const saved = localStorage.getItem('klir_dirty_tables');
      if (saved) setDirtyTables(JSON.parse(saved));
    } catch (e) {}
  }, []);

  const markTableClean = (tableNum: number) => {
    setDirtyTables(prev => {
      const updated = prev.filter(t => t !== tableNum);
      try { localStorage.setItem('klir_dirty_tables', JSON.stringify(updated)); } catch (e) {}
      return updated;
    });
  };

  const markTableDirty = (tableNum: number) => {
    setDirtyTables(prev => {
      if (prev.includes(tableNum)) return prev;
      const updated = [...prev, tableNum];
      try { localStorage.setItem('klir_dirty_tables', JSON.stringify(updated)); } catch (e) {}
      return updated;
    });
  };

  // Auth verification
  useEffect(() => {
    try {
      const saved = localStorage.getItem('klir_active_kasir');
      if (saved) setActiveCashier(JSON.parse(saved));
    } catch (e) {}
    setIsAuthLoaded(true);
  }, []);

  const handleCashierLogin = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setLoginError('');
    const user = users.find(u => u.id === selectedUserId);
    if (!user) {
      setLoginError('Pilih akun kasir terlebih dahulu.');
      return;
    }
    if (user.pin && user.pin !== cashierPin) {
      setLoginError('PIN kasir tidak sesuai. Silakan coba lagi.');
      return;
    }
    setActiveCashier(user);
    localStorage.setItem('klir_active_kasir', JSON.stringify(user));
    setCashierPin('');
  };

  const handleCashierLogout = () => {
    if (confirm(`Tutup sesi shift ${activeCashier?.name || 'Kasir'} dan ganti akun?`)) {
      setActiveCashier(null);
      localStorage.removeItem('klir_active_kasir');
    }
  };

  const loadAll = async () => {
    const [ord, mn, tbl, usr, calls, st] = await Promise.all([
      fetchOrders(),
      fetchMenus(),
      fetchTables(),
      fetchUsers(),
      fetchWaiterCalls(),
      fetchSetting()
    ]);
    setOrders(ord);
    setMenus(mn);
    setTables(tbl);
    setUsers(usr);
    setWaiterCalls(calls);
    setSetting(st);

    if (!selectedUserId && usr.length > 0) {
      const defaultUser = usr.find(u => u.role === 'kasir') || usr[0];
      if (defaultUser) setSelectedUserId(defaultUser.id);
    }

    const pendingCount = ord.filter(o => o.order_status === 'pending').length;
    if ((pendingCount > previousPendingCount && previousPendingCount >= 0) || (calls.length > previousCallCount && previousCallCount >= 0)) {
      playCashierChime();
    }
    setPreviousPendingCount(pendingCount);
    setPreviousCallCount(calls.length);
  };

  const handleResolveCall = async (callId: number) => {
    await resolveWaiterCall(callId);
    setWaiterCalls(prev => prev.filter(c => c.id !== callId));
  };

  useEffect(() => {
    loadAll();

    if (isSupabaseConfigured && supabase) {
      const channel = supabase
        .channel('cashier-pos-live')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => loadAll())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'waiter_calls' }, () => loadAll())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'menus' }, () => loadAll())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'restaurant_tables' }, () => loadAll())
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    } else {
      const interval = setInterval(loadAll, 3000);
      return () => clearInterval(interval);
    }
  }, [previousPendingCount, previousCallCount]);

  const handleUpdateStatus = async (
    orderId: number,
    updates: { order_status?: OrderStatus; payment_status?: PaymentStatus; payment_method?: string; cashier_name?: string }
  ) => {
    await updateOrderStatus(orderId, { ...updates, changed_by: activeCashier ? activeCashier.name : 'Kasir' });
    loadAll();
  };

  // QRIS settlement generation
  useEffect(() => {
    if (!orderToPay || settlementMethod !== 'QRIS') return;
    const salt = `${Date.now().toString().slice(-4)}${cashierQrisVersion}`;
    const qrisPayload = `00020101021226670014ID.GO.QRIS.WWW01189360052300000000000215ID1020261118001520458125303360540${orderToPay.total_amount}5802ID5913KANS RESTO6007JAKARTA62070703A016304${orderToPay.order_number}-${salt}`;
    QRCode.toDataURL(qrisPayload, {
      width: 260,
      margin: 1,
      color: {
        dark: '#1c1917',
        light: '#ffffff',
      },
    }).then(url => {
      setCashierQrisDataUrl(url);
    }).catch(console.error);
  }, [orderToPay, settlementMethod, cashierQrisVersion]);

  // Cart operations
  const addToCart = (menu: MenuItem) => {
    setCartItems(prev => {
      const existing = prev.find(i => i.menu_id === menu.id);
      if (existing) {
        return prev.map(i => i.menu_id === menu.id ? { ...i, qty: i.qty + 1, subtotal: (i.qty + 1) * i.price } : i);
      }
      return [...prev, {
        menu_id: menu.id,
        menu_name: menu.name,
        price: menu.price,
        qty: 1,
        subtotal: menu.price,
        item_notes: ''
      }];
    });
  };

  const updateCartQty = (menuId: number, delta: number) => {
    setCartItems(prev => prev.map(i => {
      if (i.menu_id === menuId) {
        const newQty = i.qty + delta;
        return { ...i, qty: newQty, subtotal: newQty * i.price };
      }
      return i;
    }).filter(i => i.qty > 0));
  };

  const removeCartItem = (menuId: number) => {
    setCartItems(prev => prev.filter(i => i.menu_id !== menuId));
  };

  const clearCart = () => {
    setCartItems([]);
    setLoadedOrderId(null);
    setCustomerName('Pelanggan Kasir');
  };

  // Calculations for current order
  const cartSubtotal = cartItems.reduce((s, i) => s + i.subtotal, 0);
  const discountAmount = cartSubtotal > 200000 ? Math.round(cartSubtotal * 0.1) : 0;
  const taxAmount = Math.round((cartSubtotal - discountAmount) * 0.1);
  const cartGrandTotal = cartSubtotal - discountAmount + taxAmount;

  // Submit Order directly from POS
  const handleCheckoutCurrentOrder = async (payDirectly: boolean) => {
    if (cartItems.length === 0) return;

    if (loadedOrderId) {
      // Existing loaded QR order being settled
      const existing = orders.find(o => o.id === loadedOrderId);
      if (existing) {
        setOrderToPay(existing);
        setCashGiven(existing.total_amount);
        return;
      }
    }

    const res = await createOrder({
      order_type: orderType,
      table_number: orderType === 'takeaway' ? null : selectedTableNumber,
      customer_name: customerName.trim() || 'Pelanggan Kasir',
      cashier_name: activeCashier ? activeCashier.name : 'Kasir',
      total_amount: cartGrandTotal,
      payment_method: 'Tunai',
      payment_status: payDirectly ? 'paid' : 'unpaid',
      order_status: 'pending',
      items: cartItems
    });

    if (res.success && res.order) {
      if (payDirectly) {
        setOrderToPay(res.order);
        setCashGiven(res.order.total_amount);
      } else {
        alert('Pesanan berhasil dicatat dan dikirim ke Layar Dapur!');
        clearCart();
      }
      loadAll();
    }
  };

  // Load a QR order directly into POS for quick payment settlement
  const handleLoadQrOrderToPos = (order: Order) => {
    setLoadedOrderId(order.id);
    setCustomerName(order.customer_name);
    if (order.table_number) {
      setSelectedTableNumber(order.table_number);
      setOrderType('dine_in');
    } else {
      setOrderType('takeaway');
    }
    setCartItems(order.items || []);
    setActiveMainTab('pos');
  };

  // Filter incoming QR orders
  const activeQrOrders = orders.filter(o => o.order_status !== 'completed' && o.order_status !== 'cancelled');
  const unpaidQrOrders = activeQrOrders.filter(o => o.payment_status === 'unpaid' || o.payment_status === 'waiting_confirmation');

  // Categories
  const categoriesList = ['Semua', 'Makanan Utama', 'Minuman Segar', 'Camilan & Snack', 'Kopi & Penutup'];

  // Categorize or filter items
  const filteredMenuItems = menus.filter(m => {
    if (!m.is_available) return false;
    if (searchQuery.trim() && !m.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    if (selectedCategory === 'Semua') return true;
    if (selectedCategory === 'Minuman Segar') {
      const n = m.name.toLowerCase();
      return n.includes('es ') || n.includes('jus') || n.includes('teh') || n.includes('air') || n.includes('lemon') || n.includes('jeruk');
    }
    if (selectedCategory === 'Kopi & Penutup') {
      const n = m.name.toLowerCase();
      return n.includes('kopi') || n.includes('latte') || n.includes('cake') || n.includes('puding') || n.includes('roti');
    }
    if (selectedCategory === 'Camilan & Snack') {
      const n = m.name.toLowerCase();
      return n.includes('kentang') || n.includes('tahu') || n.includes('tempe') || n.includes('pisang') || n.includes('camilan');
    }
    if (selectedCategory === 'Makanan Utama') {
      const n = m.name.toLowerCase();
      return n.includes('nasi') || n.includes('ayam') || n.includes('mie') || n.includes('soto') || n.includes('bebek') || n.includes('ikan');
    }
    return true;
  });

  // Top recommendations from actual menus
  const recommendedItems = menus.slice(0, 4);

  // Cashier Login Screen (Clean Light Kiosk)
  if (isAuthLoaded && !activeCashier) {
    const cashierUsers = users.filter(u => u.is_active !== false && (u.role === 'kasir' || u.role === 'admin'));
    const selectedUserObj = users.find(u => u.id === selectedUserId);

    return (
      <div className="bg-[#F5F6F8] min-h-screen text-gray-900 font-sans flex flex-col justify-center items-center p-4 selection:bg-orange-500 selection:text-white antialiased">
        <div className="max-w-md w-full bg-white border border-gray-100 rounded-3xl p-6 sm:p-8 shadow-xl space-y-6">
          <div className="text-center space-y-2">
            <div className="w-14 h-14 bg-orange-50 border border-orange-100 rounded-2xl mx-auto flex items-center justify-center text-orange-600 mb-2">
              <UtensilsCrossed className="w-7 h-7" />
            </div>
            <h1 className="text-lg font-black tracking-tight text-gray-900 uppercase">Kans Resto • POS Kiosk</h1>
            <p className="text-xs text-gray-500">Pilih akun kasir dan masukkan PIN 4 digit untuk membuka shift kasir.</p>
          </div>

          <div className="space-y-2">
            <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block">Pilih Akun Kasir</label>
            <div className="grid grid-cols-2 gap-2.5">
              {cashierUsers.map(user => {
                const isSelected = selectedUserId === user.id;
                return (
                  <button
                    key={user.id}
                    type="button"
                    onClick={() => {
                      setSelectedUserId(user.id);
                      setCashierPin('');
                      setLoginError('');
                    }}
                    className={`p-3.5 rounded-2xl border text-left transition flex flex-col justify-between ${
                      isSelected 
                        ? 'border-orange-500 bg-orange-50/50 text-gray-900 ring-2 ring-orange-500/20 shadow-sm' 
                        : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-black ${
                        isSelected ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-700'
                      }`}>
                        {user.name.charAt(0)}
                      </div>
                      {isSelected && <Check className="w-4 h-4 text-orange-600" />}
                    </div>
                    <div>
                      <p className="text-xs font-bold truncate text-gray-900">{user.name}</p>
                      <p className="text-[10px] text-gray-400 uppercase font-mono">{user.role}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <form onSubmit={handleCashierLogin} className="space-y-4">
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">PIN Masuk</label>
                {selectedUserObj && (
                  <span className="text-[10px] text-gray-500">
                    Kasir: <strong className="text-orange-600">{selectedUserObj.name}</strong>
                  </span>
                )}
              </div>
              <input
                type="password"
                maxLength={6}
                value={cashierPin}
                onChange={e => {
                  setCashierPin(e.target.value);
                  setLoginError('');
                }}
                placeholder="••••"
                className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3.5 text-center tracking-[0.6em] text-xl font-black text-gray-900 focus:outline-hidden focus:border-orange-500 focus:bg-white transition"
              />
            </div>

            <div className="grid grid-cols-3 gap-2">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
                <button
                  key={num}
                  type="button"
                  onClick={() => setCashierPin(prev => (prev.length < 6 ? prev + num : prev))}
                  className="py-3 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-2xl text-base font-bold text-gray-800 transition active:scale-95 shadow-2xs"
                >
                  {num}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setCashierPin('')}
                className="py-3 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-2xl text-xs font-bold text-gray-400 transition"
              >
                C
              </button>
              <button
                type="button"
                onClick={() => setCashierPin(prev => (prev.length < 6 ? prev + '0' : prev))}
                className="py-3 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-2xl text-base font-bold text-gray-800 transition active:scale-95 shadow-2xs"
              >
                0
              </button>
              <button
                type="button"
                onClick={() => setCashierPin(prev => prev.slice(0, -1))}
                className="py-3 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-2xl text-xs font-bold text-gray-400 transition"
              >
                ⌫
              </button>
            </div>

            {loginError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-center text-xs text-rose-600 font-bold">
                {loginError}
              </div>
            )}

            <button
              type="submit"
              className="w-full bg-black hover:bg-gray-900 text-white font-black py-3.5 rounded-2xl text-xs uppercase tracking-wider transition shadow-md active:scale-98"
            >
              Buka Shift Kasir
            </button>
          </form>

          <div className="pt-2 border-t border-gray-100 flex items-center justify-between text-xs text-gray-400">
            <Link href="/admin" className="hover:text-orange-600 transition">
              ← Dashboard Admin
            </Link>
            <Link href="/" className="hover:text-orange-600 transition">
              Menu Tamu →
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#F5F6F8] min-h-screen text-gray-900 font-sans antialiased selection:bg-orange-500 selection:text-white flex flex-col">
      
      {/* Top Header matching Kans Resto UI */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-30 px-5 sm:px-8 py-3.5 shadow-xs">
        <div className="max-w-[1550px] mx-auto flex items-center justify-between gap-4">
          
          {/* Logo & Brand */}
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-full bg-orange-500 flex items-center justify-center text-white font-bold text-xs shadow-xs">
              KR
            </div>
            <div>
              <h1 className="font-extrabold text-base tracking-tight text-gray-900">
                {setting?.name || 'Kans Resto'}
              </h1>
            </div>

            {/* Shift Badge */}
            <span className="hidden md:inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-gray-100 text-gray-700 border border-gray-200">
              {activeCashier?.name || 'Kasir 1'}
            </span>
          </div>

          {/* Navigation Mode Tabs: [Menu POS] vs [Pesanan Scan QR Masuk] vs [Denah Meja] */}
          <div className="hidden sm:flex items-center bg-gray-100 p-1 rounded-2xl border border-gray-200 text-xs font-bold">
            <button
              onClick={() => setActiveMainTab('pos')}
              className={`px-3.5 py-1.5 rounded-xl transition flex items-center gap-1.5 ${
                activeMainTab === 'pos' 
                  ? 'bg-black text-white shadow-xs font-extrabold' 
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <UtensilsCrossed className="w-3.5 h-3.5" />
              <span>Menu Kasir</span>
            </button>

            {/* PROMINENT FEATURE: PESANAN SCAN QR MASUK */}
            <button
              onClick={() => setActiveMainTab('qr_orders')}
              className={`px-3.5 py-1.5 rounded-xl transition flex items-center gap-1.5 relative ${
                activeMainTab === 'qr_orders' 
                  ? 'bg-orange-500 text-white shadow-xs font-extrabold' 
                  : 'text-gray-700 hover:text-orange-600'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>Pesanan Scan QR</span>
              {activeQrOrders.length > 0 && (
                <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-red-500 text-white font-black">
                  {activeQrOrders.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveMainTab('tables')}
              className={`px-3.5 py-1.5 rounded-xl transition flex items-center gap-1.5 ${
                activeMainTab === 'tables' 
                  ? 'bg-black text-white shadow-xs font-extrabold' 
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Peta Meja</span>
            </button>
          </div>

          {/* Right Header: Search Bar & Actions */}
          <div className="flex items-center space-x-3">
            {/* Pill Search Input */}
            <div className="relative w-44 sm:w-64">
              <input
                type="text"
                placeholder="Cari menu makanan atau minuman..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full bg-[#F5F6F8] border border-gray-200 rounded-full pl-4 pr-9 py-2 text-xs text-gray-800 placeholder-gray-400 focus:bg-white focus:outline-hidden focus:border-orange-500 transition"
              />
              <Search className="w-3.5 h-3.5 text-gray-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
            </div>

            {/* Shift report */}
            <button
              onClick={() => setIsShiftReportOpen(true)}
              className="w-9 h-9 rounded-full bg-gray-50 hover:bg-gray-100 border border-gray-200 flex items-center justify-center text-gray-700 transition"
              title="Laporan Shift Kasir"
            >
              <FileText className="w-4 h-4 text-orange-500" />
            </button>

            {/* Logout */}
            <button
              onClick={handleCashierLogout}
              className="w-9 h-9 rounded-full bg-gray-50 hover:bg-rose-50 text-gray-500 hover:text-rose-600 border border-gray-200 flex items-center justify-center transition"
              title="Tutup Shift"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Live Waiter Calls Banner */}
      {waiterCalls.length > 0 && (
        <div className="bg-gradient-to-r from-orange-500 to-amber-500 text-white px-5 py-2.5 text-xs font-bold flex items-center justify-between shadow-xs">
          <div className="max-w-[1550px] mx-auto w-full flex items-center justify-between">
            <div className="flex items-center space-x-2.5">
              <Bell className="w-4 h-4" />
              <span>
                Panggilan Meja {waiterCalls[0].table_number}: "{waiterCalls[0].call_type}" ({waiterCalls[0].customer_name || 'Tamu'})
                {waiterCalls.length > 1 && ` (+${waiterCalls.length - 1} panggilan meja lainnya)`}
              </span>
            </div>
            <button
              onClick={() => handleResolveCall(waiterCalls[0].id)}
              className="bg-black hover:bg-gray-900 text-white px-3 py-1 rounded-xl text-xs font-black transition"
            >
              ✓ Selesai
            </button>
          </div>
        </div>
      )}

      {/* Main POS Layout */}
      <main className="max-w-[1550px] mx-auto p-4 sm:p-6 grow w-full">

        {/* =========================================================================
            TAB 1: POS MENU CATALOG + RIGHT ORDER PANEL (MATCHING KANS RESTO DESIGN)
            ========================================================================= */}
        {activeMainTab === 'pos' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            
            {/* Left 8 Cols: Menus Catalog */}
            <div className="lg:col-span-8 space-y-6">

              {/* Notice if an order from QR is currently loaded into POS */}
              {loadedOrderId && (
                <div className="p-3.5 bg-orange-50 border border-orange-200 rounded-2xl flex items-center justify-between text-xs">
                  <div className="flex items-center space-x-2 text-orange-900 font-bold">
                    <Smartphone className="w-4 h-4 text-orange-600" />
                    <span>
                      Memproses Pesanan Meja {selectedTableNumber} ({customerName}) dari Scan QR
                    </span>
                  </div>
                  <button
                    onClick={clearCart}
                    className="text-gray-500 hover:text-gray-900 font-bold px-2 py-1 rounded-lg hover:bg-orange-100 transition"
                  >
                    Batal & Buat Baru
                  </button>
                </div>
              )}

              {/* 1. Menu Rekomendasi Kasir */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <h2 className="font-extrabold text-base text-gray-900">
                      Menu Rekomendasi Kasir
                    </h2>
                    <span className="bg-orange-100 text-orange-700 text-[10px] font-bold px-2 py-0.5 rounded-full">
                      Pilihan Favorit
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
                  {recommendedItems.map((item) => {
                    const inCart = cartItems.find(c => c.menu_id === item.id);

                    return (
                      <div 
                        key={`rec-${item.id}`}
                        className="bg-white rounded-3xl p-3 border border-gray-100 shadow-[0_2px_12px_rgba(0,0,0,0.02)] flex flex-col justify-between hover:shadow-md transition group h-[240px]"
                      >
                        <div>
                          {/* Photo with Fixed Uniform Size */}
                          <div className="w-full h-32 relative rounded-2xl overflow-hidden bg-gray-100 mb-2.5 shrink-0">
                            <img 
                              src={item.image} 
                              alt={item.name} 
                              onError={(e) => { 
                                (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500&auto=format&fit=crop&q=80'; 
                              }}
                              className="w-full h-full object-cover object-center group-hover:scale-105 transition duration-300"
                            />
                          </div>

                          <h3 className="font-bold text-xs text-gray-900 truncate leading-snug">
                            {item.name}
                          </h3>
                          <p className="text-xs font-black text-gray-900 mt-1">
                            {formatRupiah(item.price)}
                          </p>
                        </div>

                        {/* Order button or Stepper */}
                        <div className="pt-2 border-t border-gray-50 shrink-0">
                          {inCart ? (
                            <div className="flex items-center justify-between bg-gray-100 rounded-full p-1">
                              <button 
                                onClick={() => updateCartQty(item.id, -1)}
                                className="w-5 h-5 bg-white rounded-full flex items-center justify-center text-xs font-bold text-gray-700 shadow-2xs hover:bg-gray-50"
                              >
                                -
                              </button>
                              <span className="text-xs font-black text-gray-900">{inCart.qty}</span>
                              <button 
                                onClick={() => updateCartQty(item.id, 1)}
                                className="w-5 h-5 bg-black text-white rounded-full flex items-center justify-center text-xs font-bold shadow-2xs hover:bg-gray-800"
                              >
                                +
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => addToCart(item)}
                              className="w-full bg-black hover:bg-gray-800 text-white font-bold py-1.5 rounded-full text-[11px] transition active:scale-95 shadow-2xs"
                            >
                              + Tambah
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 2. Explore Our Best Menu */}
              <div className="space-y-3.5">
                <div className="flex items-center justify-between">
                  <h2 className="font-extrabold text-base text-gray-900">
                    Katalog Menu Restoran
                  </h2>
                  <button 
                    onClick={() => setSelectedCategory('Semua')}
                    className="text-xs font-semibold text-gray-400 hover:text-black transition"
                  >
                    Semua Kategori
                  </button>
                </div>

                {/* Category Pills Bar */}
                <div className="flex items-center space-x-2 overflow-x-auto no-scrollbar pb-1">
                  {categoriesList.map(cat => (
                    <button
                      key={cat}
                      onClick={() => setSelectedCategory(cat)}
                      className={`px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition ${
                        selectedCategory === cat
                          ? 'bg-black text-white shadow-xs'
                          : 'bg-white text-gray-600 hover:text-gray-900 border border-gray-200'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                  <button className="px-3.5 py-1.5 rounded-full text-xs font-bold bg-white text-gray-600 border border-gray-200 flex items-center gap-1.5 shrink-0">
                    <SlidersHorizontal className="w-3 h-3 text-gray-500" />
                    <span>Filter</span>
                  </button>
                </div>

                {/* 4-Column Food Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
                  {filteredMenuItems.map((item) => {
                    const inCart = cartItems.find(c => c.menu_id === item.id);

                    return (
                      <div
                        key={item.id}
                        className="bg-white rounded-3xl p-3 border border-gray-100 shadow-[0_2px_12px_rgba(0,0,0,0.02)] flex flex-col justify-between hover:shadow-md transition group h-[240px]"
                      >
                        <div>
                          {/* Image with Fixed Uniform Size */}
                          <div className="w-full h-32 relative rounded-2xl overflow-hidden bg-gray-100 mb-2.5 shrink-0">
                            <img 
                              src={item.image} 
                              alt={item.name} 
                              onError={(e) => { 
                                (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500&auto=format&fit=crop&q=80'; 
                              }}
                              className="w-full h-full object-cover object-center group-hover:scale-105 transition duration-300"
                            />
                          </div>

                          <h3 className="font-bold text-xs text-gray-900 truncate leading-snug">
                            {item.name}
                          </h3>
                          <p className="text-xs font-black text-gray-900 mt-1">
                            {formatRupiah(item.price)}
                          </p>
                        </div>

                        {/* Order button or Stepper */}
                        <div className="pt-2 border-t border-gray-50 shrink-0">
                          {inCart ? (
                            <div className="flex items-center justify-between bg-gray-100 rounded-full p-1">
                              <button 
                                onClick={() => updateCartQty(item.id, -1)}
                                className="w-5 h-5 bg-white rounded-full flex items-center justify-center text-xs font-bold text-gray-700 shadow-2xs hover:bg-gray-50"
                              >
                                -
                              </button>
                              <span className="text-xs font-black text-gray-900">{inCart.qty}</span>
                              <button 
                                onClick={() => updateCartQty(item.id, 1)}
                                className="w-5 h-5 bg-black text-white rounded-full flex items-center justify-center text-xs font-bold shadow-2xs hover:bg-gray-800"
                              >
                                +
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => addToCart(item)}
                              className="w-full bg-black hover:bg-gray-800 text-white font-bold py-1.5 rounded-full text-[11px] transition active:scale-95 shadow-2xs"
                            >
                              + Tambah
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

            </div>

            {/* Right 4 Cols: Customer Information & Current Order (Kans Resto Style) */}
            <div className="lg:col-span-4 bg-white rounded-3xl p-5 border border-gray-100 shadow-[0_4px_20px_rgba(0,0,0,0.03)] space-y-5 sticky top-20">
              
              {/* Customer Information Box */}
              <div className="space-y-3 pb-3 border-b border-gray-100">
                <div className="flex items-center justify-between">
                  <h3 className="font-extrabold text-sm text-gray-900">Informasi Meja & Tamu</h3>
                  <Info className="w-3.5 h-3.5 text-gray-400" />
                </div>

                <div className="space-y-2 text-xs">
                  <div>
                    <label className="text-[10px] text-gray-400 block mb-0.5 font-medium">Nama Pelanggan</label>
                    <input
                      type="text"
                      value={customerName}
                      onChange={e => setCustomerName(e.target.value)}
                      placeholder="Contoh: Meja 5 / Tamu..."
                      className="w-full bg-[#F5F6F8] border border-gray-200 rounded-xl px-3 py-2 font-bold text-gray-900 focus:bg-white focus:outline-hidden focus:border-black transition"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-gray-400 block mb-0.5 font-medium">Tipe Pesanan</label>
                      <select
                        value={orderType}
                        onChange={e => setOrderType(e.target.value as any)}
                        className="w-full bg-[#F5F6F8] border border-gray-200 rounded-xl px-2.5 py-2 font-bold text-gray-900 text-xs"
                      >
                        <option value="dine_in">Dine In (Makan di Tempat)</option>
                        <option value="takeaway">Takeaway (Bungkus)</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[10px] text-gray-400 block mb-0.5 font-medium">Nomor Meja</label>
                      <select
                        disabled={orderType === 'takeaway'}
                        value={selectedTableNumber}
                        onChange={e => setSelectedTableNumber(parseInt(e.target.value, 10))}
                        className="w-full bg-[#F5F6F8] border border-gray-200 rounded-xl px-2.5 py-2 font-bold text-gray-900 text-xs disabled:opacity-50"
                      >
                        {tables.map(t => (
                          <option key={t.table_number} value={t.table_number}>Meja {t.table_number}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {orderType === 'dine_in' && (
                    <div className="p-2.5 bg-gray-50 rounded-xl border border-gray-100 flex items-center justify-between text-xs">
                      <span className="font-bold text-gray-800">Kapasitas Tamu ({personCount} Orang)</span>
                      <div className="flex items-center space-x-2">
                        <button 
                          onClick={() => setPersonCount(prev => Math.max(1, prev - 1))}
                          className="w-5 h-5 rounded-full bg-white border border-gray-200 flex items-center justify-center font-bold"
                        >
                          -
                        </button>
                        <span className="font-bold font-mono text-gray-900">{personCount}</span>
                        <button 
                          onClick={() => setPersonCount(prev => prev + 1)}
                          className="w-5 h-5 rounded-full bg-black text-white flex items-center justify-center font-bold"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Current Order List */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-extrabold text-sm text-gray-900">Daftar Pesanan Saat Ini</h3>
                  {cartItems.length > 0 && (
                    <button 
                      onClick={clearCart}
                      className="text-[11px] text-rose-500 font-bold hover:underline"
                    >
                      Kosongkan
                    </button>
                  )}
                </div>

                <div className="space-y-2.5 max-h-[35vh] overflow-y-auto pr-1">
                  {cartItems.length === 0 ? (
                    <div className="py-8 text-center text-gray-400 text-xs">
                      <ShoppingBag className="w-8 h-8 mx-auto mb-1.5 opacity-30" />
                      <p className="font-bold">Keranjang Pesanan Kosong</p>
                      <p className="text-[11px] text-gray-400">Pilih menu dari katalog atau muat pesanan scan QR.</p>
                    </div>
                  ) : (
                    cartItems.map(item => {
                      const foundMenu = menus.find(m => m.id === item.menu_id);
                      return (
                        <div 
                          key={item.menu_id}
                          className="p-2.5 bg-[#F8F9FA] rounded-2xl border border-gray-100 flex items-center justify-between gap-2.5"
                        >
                          <div className="w-12 h-12 rounded-xl overflow-hidden bg-gray-100 shrink-0">
                            <img 
                              src={foundMenu?.image || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=100&auto=format&fit=crop&q=80'} 
                              alt={item.menu_name}
                              className="w-full h-full object-cover object-center" 
                            />
                          </div>
                          <div className="grow min-w-0">
                            <h4 className="font-bold text-xs text-gray-900 truncate">{item.menu_name}</h4>
                            <p className="text-[11px] font-bold text-emerald-600 font-mono mt-0.5">
                              {formatRupiah(item.price)} <span className="text-[10px] text-gray-400">x{item.qty}</span>
                            </p>
                          </div>
                          <div className="flex items-center space-x-1.5 shrink-0">
                            <div className="flex items-center bg-white rounded-full p-0.5 border border-gray-200">
                              <button 
                                onClick={() => updateCartQty(item.menu_id, -1)}
                                className="w-5 h-5 bg-gray-100 rounded-full flex items-center justify-center text-xs font-bold text-gray-700"
                              >
                                -
                              </button>
                              <span className="w-4 text-center font-bold text-xs text-gray-900">{item.qty}</span>
                              <button 
                                onClick={() => updateCartQty(item.menu_id, 1)}
                                className="w-5 h-5 bg-black text-white rounded-full flex items-center justify-center text-xs font-bold"
                              >
                                +
                              </button>
                            </div>
                            <button
                              onClick={() => removeCartItem(item.menu_id)}
                              className="text-gray-300 hover:text-rose-500 p-1 transition"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Payment Summary */}
              <div className="space-y-2 pt-3 border-t border-gray-100 text-xs">
                <h4 className="font-extrabold text-xs text-gray-900">Rincian Pembayaran</h4>
                
                <div className="space-y-1.5 text-gray-500">
                  <div className="flex justify-between">
                    <span>Subtotal</span>
                    <span className="font-bold font-mono text-gray-800">{formatRupiah(cartSubtotal)}</span>
                  </div>
                  {discountAmount > 0 && (
                    <div className="flex justify-between text-rose-500">
                      <span>Potongan Diskon (10%)</span>
                      <span className="font-bold font-mono">-{formatRupiah(discountAmount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span>Pajak Resto (PB1 10%)</span>
                    <span className="font-bold font-mono text-gray-800">{formatRupiah(taxAmount)}</span>
                  </div>
                  <div className="flex justify-between items-baseline pt-2 border-t border-gray-100">
                    <span className="font-extrabold text-sm text-gray-900">Total Tagihan</span>
                    <span className="font-black text-lg text-emerald-600 font-mono">
                      {formatRupiah(cartGrandTotal)}
                    </span>
                  </div>
                </div>

                {/* Big Black Order Now Button */}
                <div className="pt-2">
                  <button
                    disabled={cartItems.length === 0}
                    onClick={() => handleCheckoutCurrentOrder(true)}
                    className="w-full bg-black hover:bg-gray-900 disabled:opacity-40 text-white font-extrabold py-3.5 rounded-2xl text-xs uppercase tracking-wider transition shadow-md active:scale-98"
                  >
                    {loadedOrderId ? 'Bayar & Selesaikan Pesanan' : 'Proses & Bayar Sekarang'}
                  </button>
                </div>
              </div>

            </div>

          </div>
        )}

        {/* =========================================================================
            TAB 2: PESANAN SCAN QR MASUK (LIVE INCOMING ORDERS FROM CUSTOMER QR SCAN)
            ========================================================================= */}
        {activeMainTab === 'qr_orders' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-5 rounded-3xl border border-gray-100 shadow-[0_2px_12px_rgba(0,0,0,0.02)]">
              <div>
                <div className="flex items-center space-x-2">
                  <Smartphone className="w-5 h-5 text-orange-500" />
                  <h2 className="font-extrabold text-base text-gray-900">Pesanan Masuk dari Scan QR Meja</h2>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-orange-50 text-orange-600 border border-orange-200">
                    {activeQrOrders.length} Pesanan Aktif
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-0.5">
                  Pesanan yang dikirim langsung oleh tamu restoran dari meja mereka melalui barcode scan.
                </p>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={loadAll}
                  className="bg-gray-50 hover:bg-gray-100 text-gray-700 font-bold px-3 py-2 rounded-xl text-xs flex items-center gap-1.5 border border-gray-200 transition"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Refresh</span>
                </button>
              </div>
            </div>

            {/* QR Orders Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {activeQrOrders.map(order => {
                const isUnpaid = order.payment_status === 'unpaid';
                const isWaitingConfirmation = order.payment_status === 'waiting_confirmation';
                const isPaid = order.payment_status === 'paid';
                const elapsedMin = Math.floor((Date.now() - new Date(order.created_at).getTime()) / 60000);

                return (
                  <div
                    key={order.id}
                    className={`bg-white rounded-3xl p-5 border flex flex-col justify-between shadow-xs transition hover:shadow-md ${
                      isWaitingConfirmation 
                        ? 'border-blue-300 ring-2 ring-blue-500/20' 
                        : isUnpaid 
                        ? 'border-orange-200' 
                        : 'border-gray-100'
                    }`}
                  >
                    <div>
                      {/* Order Card Top */}
                      <div className="flex items-start justify-between pb-3 border-b border-gray-100">
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="font-black text-sm text-gray-900">
                              {order.order_type === 'takeaway' ? 'TAKEAWAY' : `MEJA ${String(order.table_number || '').padStart(2, '0')}`}
                            </span>
                            <span className="text-[10px] font-mono font-bold text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
                              #{order.order_number.slice(-4)}
                            </span>
                          </div>
                          <p className="text-xs font-bold text-gray-700 mt-0.5">{order.customer_name}</p>
                        </div>

                        <div className="text-right">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            isPaid 
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                              : isWaitingConfirmation
                              ? 'bg-blue-50 text-blue-700 border border-blue-200'
                              : 'bg-amber-50 text-amber-800 border border-amber-200'
                          }`}>
                            {isPaid ? 'Lunas' : isWaitingConfirmation ? 'Verifikasi QRIS' : 'Belum Bayar'}
                          </span>
                          <p className="text-[10px] text-gray-400 font-mono mt-1">{elapsedMin}m lalu</p>
                        </div>
                      </div>

                      {/* Items List */}
                      <div className="py-3 space-y-1.5 text-xs">
                        {(order.items || []).map((it, idx) => (
                          <div key={idx} className="flex justify-between items-baseline">
                            <div className="truncate pr-2">
                              <span className="font-bold text-orange-600 font-mono">{it.qty}x</span>
                              <span className="ml-1.5 text-gray-800 font-semibold">{it.menu_name}</span>
                              {it.item_notes && (
                                <span className="text-[10px] text-amber-700 block italic ml-4">
                                  ⚡ {it.item_notes}
                                </span>
                              )}
                            </div>
                            <span className="font-mono text-gray-500 shrink-0">{formatRupiah(it.subtotal)}</span>
                          </div>
                        ))}

                        {order.notes && (
                          <div className="p-2 bg-gray-50 rounded-xl text-[11px] text-gray-600 border border-gray-100 mt-2">
                            <span className="font-bold text-gray-500 block text-[9px] uppercase">Catatan Meja:</span>
                            <span>{order.notes}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Bottom Actions */}
                    <div className="pt-3 border-t border-gray-100 space-y-2">
                      <div className="flex justify-between items-baseline">
                        <span className="text-xs text-gray-400 font-medium">Total Tagihan:</span>
                        <span className="font-extrabold text-base text-gray-900 font-mono">
                          {formatRupiah(order.total_amount)}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        {/* 1-Click Action to load directly into POS */}
                        <button
                          onClick={() => handleLoadQrOrderToPos(order)}
                          className="bg-black hover:bg-gray-800 text-white font-bold py-2 rounded-xl text-xs flex items-center justify-center gap-1.5 transition active:scale-95"
                          title="Muat ke Kasir untuk pembayaran"
                        >
                          <ShoppingBag className="w-3.5 h-3.5" />
                          <span>Muat ke Kasir</span>
                        </button>

                        {isUnpaid ? (
                          <button
                            onClick={() => {
                              setOrderToPay(order);
                              setCashGiven(order.total_amount);
                            }}
                            className="bg-orange-500 hover:bg-orange-600 text-white font-black py-2 rounded-xl text-xs transition active:scale-95 shadow-2xs"
                          >
                            Bayar (Settle)
                          </button>
                        ) : isWaitingConfirmation ? (
                          <button
                            onClick={async () => {
                              await handleUpdateStatus(order.id, {
                                payment_status: 'paid',
                                payment_method: 'QRIS',
                                cashier_name: activeCashier ? activeCashier.name : 'Kasir'
                              });
                            }}
                            className="bg-emerald-600 hover:bg-emerald-500 text-white font-black py-2 rounded-xl text-xs transition active:scale-95"
                          >
                            Terima QRIS
                          </button>
                        ) : (
                          <button
                            onClick={() => setSelectedOrderForReceipt(order)}
                            className="bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold py-2 rounded-xl text-xs flex items-center justify-center gap-1 transition"
                          >
                            <Printer className="w-3.5 h-3.5" />
                            <span>Struk</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {activeQrOrders.length === 0 && (
              <div className="text-center py-24 bg-white rounded-3xl border border-gray-100 text-gray-400">
                <Smartphone className="w-10 h-10 mx-auto mb-2 opacity-30 text-orange-500" />
                <p className="font-bold text-sm text-gray-700">Belum Ada Pesanan Masuk dari Scan QR</p>
                <p className="text-xs text-gray-400 mt-0.5">Pesanan baru dari tamu meja akan otomatis muncul di sini secara real-time.</p>
              </div>
            )}
          </div>
        )}

        {/* =========================================================================
            TAB 3: PETA MEJA (TACTICAL FLOOR PLAN)
            ========================================================================= */}
        {activeMainTab === 'tables' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-5 rounded-3xl border border-gray-100 shadow-[0_2px_12px_rgba(0,0,0,0.02)]">
              <div>
                <h2 className="font-extrabold text-base text-gray-900">Denah & Status Meja Restoran</h2>
                <p className="text-xs text-gray-500 mt-0.5">Pantau meja yang sedang terisi, menunggu pelunasan, atau piring kotor yang perlu dibersihkan.</p>
              </div>

              {/* Status Legend */}
              <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
                <span className="flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full border border-emerald-200">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  <span>Kosong</span>
                </span>
                <span className="flex items-center gap-1.5 px-3 py-1 bg-amber-50 text-amber-800 rounded-full border border-amber-200">
                  <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                  <span>Terisi</span>
                </span>
                <span className="flex items-center gap-1.5 px-3 py-1 bg-orange-50 text-orange-800 rounded-full border border-orange-200">
                  <span className="w-2 h-2 rounded-full bg-orange-500"></span>
                  <span>Perlu Dibersihkan ({dirtyTables.length})</span>
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
              {tables.map(table => {
                const activeOrder = orders.find(
                  o => o.table_number === table.table_number && o.order_status !== 'completed' && o.order_status !== 'cancelled'
                );
                const tableCalls = waiterCalls.filter(c => c.table_number === table.table_number);
                const hasCall = tableCalls.length > 0;
                const isDirty = !activeOrder && dirtyTables.includes(table.table_number);
                const isOccupied = Boolean(activeOrder);

                return (
                  <div
                    key={table.table_number}
                    className={`rounded-3xl border p-4 flex flex-col justify-between transition min-h-[180px] shadow-xs ${
                      hasCall 
                        ? 'bg-orange-50 border-orange-400 ring-2 ring-orange-400/40'
                        : isDirty
                        ? 'bg-orange-50/60 border-orange-300'
                        : isOccupied
                        ? 'bg-amber-50/60 border-amber-200'
                        : 'bg-white border-gray-100 hover:border-gray-300'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between pb-2 border-b border-gray-100">
                        <span className="font-extrabold text-sm text-gray-900">MEJA {table.table_number}</span>
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                          hasCall 
                            ? 'bg-orange-500 text-white' 
                            : isDirty
                            ? 'bg-orange-100 text-orange-800'
                            : isOccupied
                            ? 'bg-amber-100 text-amber-900'
                            : 'bg-emerald-50 text-emerald-700'
                        }`}>
                          {hasCall ? 'PANGGILAN' : isDirty ? 'BERSIHKAN' : isOccupied ? 'TERISI' : 'KOSONG'}
                        </span>
                      </div>

                      {hasCall && (
                        <div className="py-2">
                          <p className="text-[11px] font-bold text-orange-700">🛎️ {tableCalls[0].call_type}</p>
                          <button
                            onClick={() => handleResolveCall(tableCalls[0].id)}
                            className="mt-1 text-[10px] bg-orange-600 text-white font-bold px-2 py-0.5 rounded-md"
                          >
                            Tangani
                          </button>
                        </div>
                      )}

                      {isOccupied && activeOrder ? (
                        <div className="py-2.5 text-xs space-y-0.5">
                          <p className="font-bold text-gray-900 truncate">{activeOrder.customer_name}</p>
                          <p className="text-[10px] text-gray-400 font-mono">#{activeOrder.order_number.slice(-4)}</p>
                          <p className="text-xs font-black text-emerald-600 font-mono mt-1">
                            {formatRupiah(activeOrder.total_amount)}
                          </p>
                        </div>
                      ) : isDirty ? (
                        <div className="py-4 text-center text-xs text-orange-800 space-y-1">
                          <p className="font-bold">Perlu Dibersihkan</p>
                          <p className="text-[10px] text-gray-500">Tamu telah selesai.</p>
                        </div>
                      ) : (
                        <div className="py-6 text-center text-xs text-gray-400">
                          Meja siap pakai
                        </div>
                      )}
                    </div>

                    <div className="pt-2 border-t border-gray-100">
                      {isOccupied && activeOrder ? (
                        <button
                          onClick={() => handleLoadQrOrderToPos(activeOrder)}
                          className="w-full bg-black hover:bg-gray-800 text-white font-bold py-1.5 rounded-xl text-xs transition"
                        >
                          Lihat Pesanan
                        </button>
                      ) : isDirty ? (
                        <button
                          onClick={() => markTableClean(table.table_number)}
                          className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-1.5 rounded-xl text-xs flex items-center justify-center transition"
                        >
                          <span>Tandai Bersih</span>
                        </button>
                      ) : (
                        <button
                          onClick={() => {
                            setSelectedTableNumber(table.table_number);
                            setOrderType('dine_in');
                            setActiveMainTab('pos');
                          }}
                          className="w-full bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold py-1.5 rounded-xl text-xs transition"
                        >
                          + Buka Meja
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

      </main>

      {/* =========================================================================
          PAYMENT SETTLEMENT MODAL (CASH / QRIS / DEBIT)
          ========================================================================= */}
      {orderToPay && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-gray-100 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div>
                <h3 className="font-extrabold text-sm text-gray-900">Pelunasan Pembayaran</h3>
                <p className="text-[11px] text-gray-400 font-mono">#{orderToPay.order_number} • {orderToPay.customer_name}</p>
              </div>
              <button onClick={() => setOrderToPay(null)} className="text-gray-400 hover:text-gray-900">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Total tagihan */}
            <div className="text-center py-3 bg-gray-50 rounded-2xl border border-gray-100">
              <span className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Total yang Harus Dibayar</span>
              <p className="text-2xl font-black text-gray-900 font-mono mt-0.5">
                {formatRupiah(orderToPay.total_amount)}
              </p>
            </div>

            {/* Method selection */}
            <div className="grid grid-cols-3 gap-2 text-xs">
              {(['Tunai', 'QRIS', 'Kartu Debit'] as const).map(m => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setSettlementMethod(m)}
                  className={`py-2 rounded-xl border font-bold transition ${
                    settlementMethod === m ? 'bg-black text-white border-black shadow-xs' : 'bg-gray-50 text-gray-700 border-gray-200'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>

            {/* Cash given calculation */}
            {settlementMethod === 'Tunai' && (
              <div className="space-y-2 text-xs">
                <label className="block text-[11px] font-bold text-gray-500">Nominal Uang Tunai Diterima</label>
                <input
                  type="number"
                  value={cashGiven}
                  onChange={e => setCashGiven(parseInt(e.target.value, 10) || 0)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-base font-black text-gray-900 font-mono"
                />
                <div className="flex justify-between items-baseline pt-1">
                  <span className="text-gray-400 font-bold">Uang Kembalian:</span>
                  <span className="text-base font-black text-emerald-600 font-mono">
                    {formatRupiah(Math.max(0, cashGiven - orderToPay.total_amount))}
                  </span>
                </div>
              </div>
            )}

            {/* QRIS display */}
            {settlementMethod === 'QRIS' && (
              <div className="text-center space-y-2">
                <div className="w-48 h-48 mx-auto bg-white p-2 rounded-2xl border border-gray-200 shadow-xs">
                  {cashierQrisDataUrl ? (
                    <img src={cashierQrisDataUrl} alt="QRIS" className="w-full h-full object-contain" />
                  ) : (
                    <div className="text-xs text-gray-400 pt-16">Menyiapkan QRIS...</div>
                  )}
                </div>
                <p className="text-[11px] text-gray-400">Tunjukkan barcode ke tamu untuk discan melalui e-wallet.</p>
              </div>
            )}

            <button
              onClick={async () => {
                await handleUpdateStatus(orderToPay.id, {
                  payment_status: 'paid',
                  payment_method: settlementMethod,
                  cashier_name: activeCashier ? activeCashier.name : 'Kasir'
                });
                if (orderToPay.table_number) {
                  markTableDirty(orderToPay.table_number);
                }
                setSelectedOrderForReceipt(orderToPay);
                setOrderToPay(null);
                clearCart();
                loadAll();
              }}
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black py-3 rounded-2xl text-xs uppercase tracking-wider transition shadow-md active:scale-98"
            >
              ✓ Konfirmasi Lunas & Cetak Struk
            </button>
          </div>
        </div>
      )}

      {/* SHIFT REPORT MODAL */}
      {isShiftReportOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-gray-100 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center space-x-2">
                <FileText className="w-4 h-4 text-orange-500" />
                <h3 className="font-extrabold text-sm text-gray-900">Laporan Shift Kasir (Z-Report)</h3>
              </div>
              <button onClick={() => setIsShiftReportOpen(false)} className="text-gray-400 hover:text-gray-900">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 space-y-2 text-xs">
              <div className="flex justify-between text-gray-500">
                <span>Staf Kasir:</span>
                <span className="font-bold text-gray-900">{activeCashier?.name}</span>
              </div>
              <div className="flex justify-between text-gray-500">
                <span>Total Transaksi Lunas:</span>
                <span className="font-bold text-gray-900">{orders.filter(o => o.payment_status === 'paid').length} Nota</span>
              </div>
              <div className="flex justify-between text-gray-500 pt-2 border-t border-gray-200">
                <span>Total Omzet Shift Ini:</span>
                <span className="font-black text-emerald-600 font-mono text-sm">
                  {formatRupiah(orders.filter(o => o.payment_status === 'paid').reduce((s, o) => s + o.total_amount, 0))}
                </span>
              </div>
            </div>

            <button
              onClick={() => window.print()}
              className="w-full bg-black hover:bg-gray-900 text-white font-bold py-3 rounded-2xl text-xs uppercase tracking-wider transition shadow-xs flex items-center justify-center gap-2"
            >
              <Printer className="w-4 h-4" />
              <span>Cetak Rekap Shift</span>
            </button>
          </div>
        </div>
      )}

      {/* Hidden Thermal Receipt Print Element */}
      {selectedOrderForReceipt && (
        <div id="thermalReceipt" className="hidden print:block text-black p-4 text-xs font-mono">
          <div className="text-center pb-2 border-b border-black">
            <h2 className="font-bold text-sm uppercase">{setting?.name || 'KANS RESTO'}</h2>
            <p className="text-[10px]">{setting?.address || 'Jl. Kuliner No. 88, Jakarta'}</p>
            <p className="text-[10px]">Telp: {setting?.phone || '-'}</p>
          </div>
          <div className="py-2 space-y-1 text-[11px] border-b border-black">
            <p>No: {selectedOrderForReceipt.order_number}</p>
            <p>Meja: {selectedOrderForReceipt.order_type === 'takeaway' ? 'TAKEAWAY' : selectedOrderForReceipt.table_number}</p>
            <p>Kasir: {selectedOrderForReceipt.cashier_name || activeCashier?.name || 'Kasir'}</p>
            <p>Tgl: {new Date(selectedOrderForReceipt.created_at).toLocaleString('id-ID')}</p>
          </div>
          <div className="py-2 space-y-1 text-[11px] border-b border-black">
            {(selectedOrderForReceipt.items || []).map((it, i) => (
              <div key={i} className="flex justify-between">
                <span>{it.qty}x {it.menu_name}</span>
                <span>{formatRupiah(it.subtotal)}</span>
              </div>
            ))}
          </div>
          <div className="py-2 space-y-1 text-[11px] border-b border-black">
            <div className="flex justify-between font-bold">
              <span>TOTAL</span>
              <span>{formatRupiah(selectedOrderForReceipt.total_amount)}</span>
            </div>
            <div className="flex justify-between text-[10px]">
              <span>Metode: {selectedOrderForReceipt.payment_method || 'Tunai'}</span>
              <span>STATUS: LUNAS</span>
            </div>
          </div>
          <div className="text-center pt-3 text-[10px]">
            <p>{setting?.receipt_footer || 'Terima kasih atas kunjungan Anda!'}</p>
          </div>
        </div>
      )}

    </div>
  );
}
