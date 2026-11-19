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
  Wifi
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

  const [activeCashier, setActiveCashier] = useState<User | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [cashierPin, setCashierPin] = useState<string>('');
  const [loginError, setLoginError] = useState<string>('');
  const [isAuthLoaded, setIsAuthLoaded] = useState<boolean>(false);

  const [filter, setFilter] = useState<'active' | 'unpaid' | 'paid' | 'all' | 'waiting_qris'>('active');
  const [viewMode, setViewMode] = useState<'cards' | 'tables'>('cards');
  const [selectedOrderForReceipt, setSelectedOrderForReceipt] = useState<Order | null>(null);
  const [orderToTransfer, setOrderToTransfer] = useState<Order | null>(null);
  const [isShiftReportOpen, setIsShiftReportOpen] = useState<boolean>(false);
  const [discountPercent, setDiscountPercent] = useState<number>(0);
  const [currentTime, setCurrentTime] = useState('');
  const [previousPendingCount, setPreviousPendingCount] = useState<number>(0);
  const [previousCallCount, setPreviousCallCount] = useState<number>(0);

  // Check saved cashier shift
  useEffect(() => {
    try {
      const saved = localStorage.getItem('klir_active_kasir');
      if (saved) {
        setActiveCashier(JSON.parse(saved));
      }
    } catch (e) {
      console.error(e);
    }
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
    if (confirm(`Tutup sesi shift ${activeCashier?.name || 'Kasir'} dan ganti pengguna?`)) {
      setActiveCashier(null);
      localStorage.removeItem('klir_active_kasir');
    }
  };

  // New POS Order Modal
  const [isPosModalOpen, setIsPosModalOpen] = useState(false);
  const [posOrderType, setPosOrderType] = useState<'dine_in' | 'takeaway'>('dine_in');
  const [posTableNumber, setPosTableNumber] = useState<number>(1);
  const [posCustomerName, setPosCustomerName] = useState('Pelanggan Kasir');
  const [posCart, setPosCart] = useState<OrderItem[]>([]);
  const [posCategory, setPosCategory] = useState<string>('all');
  const [posSearch, setPosSearch] = useState('');

  // Payment Settlement Modal
  const [orderToPay, setOrderToPay] = useState<Order | null>(null);
  const [cashGiven, setCashGiven] = useState<number>(0);
  const [settlementMethod, setSettlementMethod] = useState<'Tunai' | 'QRIS' | 'Kartu Debit'>('Tunai');
  const [cashierQrisDataUrl, setCashierQrisDataUrl] = useState<string>('');
  const [cashierQrisTimeLeft, setCashierQrisTimeLeft] = useState<number>(300);
  const [isCashierQrisExpired, setIsCashierQrisExpired] = useState<boolean>(false);
  const [cashierQrisVersion, setCashierQrisVersion] = useState<number>(1);

  // Cashier Timed QRIS Countdown
  useEffect(() => {
    if (!orderToPay || settlementMethod !== 'QRIS' || isCashierQrisExpired) return;

    const interval = setInterval(() => {
      setCashierQrisTimeLeft(prev => {
        if (prev <= 1) {
          setIsCashierQrisExpired(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [orderToPay, settlementMethod, isCashierQrisExpired]);

  const handleRegenerateCashierQris = () => {
    setCashierQrisTimeLeft(300);
    setIsCashierQrisExpired(false);
    setCashierQrisVersion(prev => prev + 1);
  };

  // Generate QRIS when Cashier opens QRIS Settlement
  useEffect(() => {
    if (!orderToPay || settlementMethod !== 'QRIS') return;
    const salt = `${Date.now().toString().slice(-4)}${cashierQrisVersion}`;
    const qrisPayload = `00020101021226670014ID.GO.QRIS.WWW01189360052300000000000215ID1020261118001520458125303360540${orderToPay.total_amount}5802ID5913RASA NUSANTARA6007JAKARTA62070703A016304${orderToPay.order_number}-${salt}`;
    QRCode.toDataURL(qrisPayload, {
      width: 260,
      margin: 1,
      color: {
        dark: '#0a0a0a',
        light: '#ffffff',
      },
    }).then(url => {
      setCashierQrisDataUrl(url);
    }).catch(err => console.error(err));
  }, [orderToPay, settlementMethod, cashierQrisVersion]);

  // Digital Clock
  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString('id-ID', { hour12: false }));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

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

  const handleTransferTable = async (newTableNumber: number) => {
    if (!orderToTransfer) return;
    await updateOrderTable(orderToTransfer.id, newTableNumber);
    setOrderToTransfer(null);
    loadAll();
  };

  useEffect(() => {
    loadAll();

    if (isSupabaseConfigured && supabase) {
      const channel = supabase
        .channel('cashier-pos')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'orders' },
          () => loadAll()
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'waiter_calls' },
          () => loadAll()
        )
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

  const addPosItem = (menu: MenuItem) => {
    setPosCart(prev => {
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

  const updatePosQty = (menuId: number, delta: number) => {
    setPosCart(prev => prev.map(i => {
      if (i.menu_id === menuId) {
        const newQty = i.qty + delta;
        return { ...i, qty: newQty, subtotal: newQty * i.price };
      }
      return i;
    }).filter(i => i.qty > 0));
  };

  const handleCreatePosOrder = async (payDirectly: boolean) => {
    if (posCart.length === 0) return;
    const total = posCart.reduce((s, i) => s + i.subtotal, 0);

    const res = await createOrder({
      order_type: posOrderType,
      table_number: posOrderType === 'takeaway' ? null : posTableNumber,
      customer_name: posCustomerName.trim() || 'Pelanggan POS',
      cashier_name: activeCashier ? activeCashier.name : 'Kasir',
      total_amount: total,
      payment_method: 'Tunai',
      payment_status: payDirectly ? 'paid' : 'unpaid',
      order_status: 'pending',
      items: posCart
    });

    if (res.success) {
      setPosCart([]);
      setIsPosModalOpen(false);
      loadAll();
      if (payDirectly && res.order) {
        setSelectedOrderForReceipt(res.order);
      }
    }
  };

  const isPendingPayment = (o: Order) => o.payment_status === 'unpaid' || o.payment_status === 'waiting_confirmation';
  const waitingQrisOrders = orders.filter(o => o.payment_status === 'waiting_confirmation' && o.order_status !== 'cancelled');
  const unpaidCount = orders.filter(o => isPendingPayment(o) && o.order_status !== 'cancelled').length;
  const activeOrdersCount = orders.filter(o => o.order_status !== 'completed' && o.order_status !== 'cancelled').length;
  const totalSalesToday = orders.filter(o => o.payment_status === 'paid').reduce((s, o) => s + o.total_amount, 0);

  const filteredOrders = orders.filter(o => {
    if (filter === 'active') return o.order_status !== 'completed' && o.order_status !== 'cancelled';
    if (filter === 'waiting_qris') return o.payment_status === 'waiting_confirmation';
    if (filter === 'unpaid') return isPendingPayment(o);
    if (filter === 'paid') return o.payment_status === 'paid';
    return true;
  });

  // Cashier Login Screen if not logged in
  if (isAuthLoaded && !activeCashier) {
    const cashierUsers = users.filter(u => u.is_active !== false && (u.role === 'kasir' || u.role === 'admin'));
    const selectedUserObj = users.find(u => u.id === selectedUserId);

    return (
      <div className="bg-neutral-900 min-h-screen text-neutral-100 font-sans flex flex-col justify-center items-center p-4">
        <div className="max-w-md w-full bg-neutral-950 border border-neutral-800 rounded-3xl p-6 shadow-2xl space-y-6">
          <div className="text-center space-y-1.5">
            <div className="w-12 h-12 bg-neutral-800 border border-neutral-700 rounded-2xl mx-auto flex items-center justify-center text-amber-400 mb-2">
              <Lock className="w-6 h-6" />
            </div>
            <h1 className="text-lg font-bold tracking-tight text-white uppercase">Terminal Kasir POS</h1>
            <p className="text-xs text-neutral-400">Pilih staf kasir yang bertugas dan masukkan PIN 4 digit untuk membuka shift.</p>
          </div>

          {/* Cashier Account Selection */}
          <div className="space-y-2">
            <label className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider block">Pilih Akun Kasir</label>
            <div className="grid grid-cols-2 gap-2">
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
                    className={`p-3 rounded-xl border text-left transition flex flex-col justify-between ${
                      isSelected 
                        ? 'border-amber-500 bg-amber-500/10 text-white ring-1 ring-amber-500' 
                        : 'border-neutral-800 bg-neutral-900/60 text-neutral-300 hover:border-neutral-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="w-7 h-7 rounded-lg bg-neutral-800 flex items-center justify-center text-xs font-bold text-neutral-200">
                        {user.name.charAt(0)}
                      </div>
                      {isSelected && <Check className="w-4 h-4 text-amber-400" />}
                    </div>
                    <div>
                      <p className="text-xs font-bold truncate">{user.name}</p>
                      <p className="text-[10px] text-neutral-400 uppercase">{user.role}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* PIN Input & Form */}
          <form onSubmit={handleCashierLogin} className="space-y-4">
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <label className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">PIN Masuk</label>
                {selectedUserObj && (
                  <span className="text-[10px] text-neutral-500">
                    Kasir: <strong className="text-neutral-300">{selectedUserObj.name}</strong>
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
                placeholder="Masukkan 4-digit PIN..."
                className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-4 py-3 text-center tracking-[0.5em] text-lg font-bold text-white focus:outline-none focus:border-amber-500 transition"
              />
            </div>

            {/* Quick Numpad for Touchscreen / Fast Access */}
            <div className="grid grid-cols-3 gap-2">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
                <button
                  key={num}
                  type="button"
                  onClick={() => setCashierPin(prev => (prev.length < 6 ? prev + num : prev))}
                  className="py-2.5 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 rounded-xl text-sm font-bold text-neutral-200 transition"
                >
                  {num}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setCashierPin('')}
                className="py-2.5 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 rounded-xl text-xs font-bold text-neutral-400 transition"
              >
                C
              </button>
              <button
                type="button"
                onClick={() => setCashierPin(prev => (prev.length < 6 ? prev + '0' : prev))}
                className="py-2.5 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 rounded-xl text-sm font-bold text-neutral-200 transition"
              >
                0
              </button>
              <button
                type="button"
                onClick={() => setCashierPin(prev => prev.slice(0, -1))}
                className="py-2.5 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 rounded-xl text-xs font-bold text-neutral-400 transition"
              >
                ⌫
              </button>
            </div>

            {loginError && (
              <div className="p-2.5 bg-rose-500/10 border border-rose-500/30 rounded-xl text-center text-xs text-rose-400">
                {loginError}
              </div>
            )}

            <button
              type="submit"
              className="w-full bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold py-3 rounded-xl text-xs uppercase tracking-wider transition shadow-lg shadow-amber-500/20"
            >
              Buka Shift Kasir
            </button>
          </form>

          <div className="pt-2 border-t border-neutral-800 text-center">
            <p className="text-[11px] text-neutral-500">
              Akun & PIN staf kasir dikelola secara terpusat oleh Admin.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-neutral-100 min-h-screen text-neutral-900 font-sans selection:bg-neutral-900 selection:text-white">
      
      {/* POS Top Header */}
      <header className="bg-white border-b border-neutral-200 sticky top-0 z-30 px-4 sm:px-6 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="font-bold text-sm tracking-tight text-neutral-950 uppercase">
                  Point of Sale (POS)
                </h1>
                <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  Kasir: {activeCashier?.name || 'Kasir Bertugas'}
                </span>
              </div>
              <p className="text-[11px] text-neutral-500">Shift Pelayanan Aktif</p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => setIsShiftReportOpen(true)}
              className="bg-neutral-100 hover:bg-neutral-200 text-neutral-800 border border-neutral-200 px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition"
              title="Laporan Rekap Penjualan Shift Kasir"
            >
              <FileText className="w-3.5 h-3.5 text-neutral-600" />
              <span className="hidden sm:inline">Laporan Shift</span>
            </button>

            <button
              onClick={() => setIsPosModalOpen(true)}
              className="bg-neutral-950 hover:bg-neutral-900 text-white px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Input Pesanan Baru</span>
            </button>

            <button
              onClick={handleCashierLogout}
              className="bg-neutral-100 hover:bg-rose-50 hover:text-rose-600 text-neutral-700 border border-neutral-200 px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition"
              title="Tutup shift dan ganti staf kasir"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Tutup Shift</span>
            </button>

            <div className="text-right pl-3 border-l border-neutral-200 hidden sm:block">
              <span className="font-mono text-xs font-bold text-neutral-800">{currentTime || '--:--:--'}</span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-4">

        {/* Live Waiter Calls Alert Bar */}
        {waiterCalls.length > 0 && (
          <div className="bg-amber-500 text-neutral-950 p-3 rounded-xl mb-4 text-xs font-bold flex items-center justify-between shadow-md">
            <div className="flex items-center space-x-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-neutral-950 animate-ping"></span>
              <Bell className="w-4 h-4 text-neutral-950" />
              <span>
                Panggilan Meja {waiterCalls[0].table_number}: "{waiterCalls[0].call_type}" ({waiterCalls[0].customer_name || 'Tamu'})
                {waiterCalls.length > 1 && ` (+${waiterCalls.length - 1} panggilan lain)`}
              </span>
            </div>
            <button
              onClick={() => handleResolveCall(waiterCalls[0].id)}
              className="bg-neutral-950 hover:bg-neutral-900 text-white px-3 py-1 rounded-lg text-xs font-bold transition shadow-xs"
            >
              ✓ Selesai / Tangani
            </button>
          </div>
        )}

        {/* Metrics Row */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="bg-white rounded-xl p-3.5 border border-neutral-200">
            <span className="text-[11px] uppercase tracking-wider text-neutral-400 font-semibold">Pesanan Aktif</span>
            <p className="text-xl font-bold text-neutral-950 mt-0.5">{activeOrdersCount}</p>
          </div>
          <div className="bg-white rounded-xl p-3.5 border border-neutral-200">
            <span className="text-[11px] uppercase tracking-wider text-neutral-400 font-semibold">Belum Dibayar (Open Bills)</span>
            <p className="text-xl font-bold text-amber-600 mt-0.5">{unpaidCount}</p>
          </div>
          <div className="bg-white rounded-xl p-3.5 border border-neutral-200">
            <span className="text-[11px] uppercase tracking-wider text-neutral-400 font-semibold">Total Penjualan Masuk</span>
            <p className="text-xl font-bold text-neutral-950 mt-0.5">{formatRupiah(totalSalesToday)}</p>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="bg-white rounded-xl p-2.5 border border-neutral-200 mb-4 flex items-center justify-between">
          <div className="flex items-center space-x-1 overflow-x-auto no-scrollbar">
            <button
              onClick={() => setFilter('active')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
                filter === 'active' ? 'bg-neutral-950 text-white' : 'text-neutral-600 hover:bg-neutral-100'
              }`}
            >
              Pesanan Aktif ({activeOrdersCount})
            </button>

            {waitingQrisOrders.length > 0 && (
              <button
                onClick={() => setFilter('waiting_qris')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition flex items-center gap-1.5 ${
                  filter === 'waiting_qris' ? 'bg-blue-600 text-white' : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-ping"></span>
                <span>Verifikasi QRIS ({waitingQrisOrders.length})</span>
              </button>
            )}

            <button
              onClick={() => setFilter('unpaid')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
                filter === 'unpaid' ? 'bg-neutral-950 text-white' : 'text-neutral-600 hover:bg-neutral-100'
              }`}
            >
              Belum Bayar ({unpaidCount})
            </button>
            <button
              onClick={() => setFilter('paid')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
                filter === 'paid' ? 'bg-neutral-950 text-white' : 'text-neutral-600 hover:bg-neutral-100'
              }`}
            >
              Sudah Lunas
            </button>
            <button
              onClick={() => setFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
                filter === 'all' ? 'bg-neutral-950 text-white' : 'text-neutral-600 hover:bg-neutral-100'
              }`}
            >
              Semua
            </button>
          </div>

          <div className="flex items-center space-x-2 shrink-0 ml-2">
            <div className="flex items-center bg-neutral-100 p-0.5 rounded-lg border border-neutral-200 text-xs">
              <button
                onClick={() => setViewMode('cards')}
                className={`px-2.5 py-1 rounded-md font-semibold transition ${
                  viewMode === 'cards' ? 'bg-white text-neutral-950 shadow-xs' : 'text-neutral-500 hover:text-neutral-900'
                }`}
              >
                Daftar Kartu
              </button>
              <button
                onClick={() => setViewMode('tables')}
                className={`px-2.5 py-1 rounded-md font-semibold transition ${
                  viewMode === 'tables' ? 'bg-white text-neutral-950 shadow-xs' : 'text-neutral-500 hover:text-neutral-900'
                }`}
              >
                Denah Meja
              </button>
            </div>

            <button
              onClick={loadAll}
              className="text-neutral-500 hover:text-neutral-900 p-1.5 transition"
              title="Refresh"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* VIEW MODE: DENAH MEJA (FLOOR PLAN) */}
        {viewMode === 'tables' ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3.5">
            {tables.map(table => {
              const activeOrder = orders.find(
                o => o.table_number === table.table_number && o.order_status !== 'completed' && o.order_status !== 'cancelled'
              );
              const isOccupied = Boolean(activeOrder);
              const isPaid = activeOrder?.payment_status === 'paid';
              const isWaitingQris = activeOrder?.payment_status === 'waiting_confirmation';

              return (
                <div
                  key={table.table_number}
                  className={`rounded-2xl border p-4 flex flex-col justify-between transition min-h-[175px] ${
                    !isOccupied
                      ? 'bg-white border-neutral-200 hover:border-neutral-300'
                      : isPaid
                      ? 'bg-blue-50/50 border-blue-200'
                      : isWaitingQris
                      ? 'bg-amber-50/80 border-amber-300 ring-1 ring-amber-300'
                      : 'bg-amber-50/40 border-amber-200'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between pb-2 border-b border-neutral-100">
                      <span className="font-bold text-sm text-neutral-950">MEJA {table.table_number}</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        !isOccupied
                          ? 'bg-emerald-100 text-emerald-800'
                          : isPaid
                          ? 'bg-blue-100 text-blue-800'
                          : isWaitingQris
                          ? 'bg-amber-200 text-amber-900 animate-pulse'
                          : 'bg-amber-100 text-amber-800'
                      }`}>
                        {!isOccupied ? 'KOSONG' : isPaid ? 'LUNAS' : isWaitingQris ? 'VERIFIKASI QRIS' : 'TERISI'}
                      </span>
                    </div>

                    {isOccupied && activeOrder ? (
                      <div className="py-2.5 space-y-1 text-xs">
                        <p className="font-semibold text-neutral-900 truncate">{activeOrder.customer_name}</p>
                        <p className="text-[11px] text-neutral-500 font-mono">#{activeOrder.order_number.slice(-3)}</p>
                        <p className="text-xs font-bold text-neutral-950 mt-1">{formatRupiah(activeOrder.total_amount)}</p>
                      </div>
                    ) : (
                      <div className="py-6 text-center text-xs text-neutral-400">
                        Siap ditempati
                      </div>
                    )}
                  </div>

                  <div className="pt-2 border-t border-neutral-100">
                    {isOccupied && activeOrder ? (
                      <div className="flex gap-1.5">
                        {activeOrder.payment_status === 'waiting_confirmation' ? (
                          <button
                            onClick={async () => {
                              await handleUpdateStatus(activeOrder.id, {
                                payment_status: 'paid',
                                payment_method: 'QRIS',
                                cashier_name: activeCashier ? activeCashier.name : 'Kasir'
                              });
                            }}
                            className="grow bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-1.5 rounded-lg text-xs"
                          >
                            Terima QRIS
                          </button>
                        ) : activeOrder.payment_status === 'unpaid' ? (
                          <button
                            onClick={() => {
                              setOrderToPay(activeOrder);
                              setCashGiven(activeOrder.total_amount);
                            }}
                            className="grow bg-neutral-950 hover:bg-neutral-900 text-white font-semibold py-1.5 rounded-lg text-xs"
                          >
                            Bayar
                          </button>
                        ) : (
                          <button
                            onClick={() => handleUpdateStatus(activeOrder.id, { order_status: 'completed' })}
                            className="grow bg-neutral-900 hover:bg-neutral-800 text-white font-semibold py-1.5 rounded-lg text-xs"
                          >
                            Tutup Meja
                          </button>
                        )}
                        <button
                          onClick={() => setSelectedOrderForReceipt(activeOrder)}
                          className="px-2.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-lg text-xs flex items-center justify-center transition"
                          title="Cetak Struk"
                        >
                          <Printer className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          setPosTableNumber(table.table_number);
                          setPosOrderType('dine_in');
                          setIsPosModalOpen(true);
                        }}
                        className="w-full bg-neutral-100 hover:bg-neutral-200 text-neutral-800 font-semibold py-1.5 rounded-lg text-xs transition"
                      >
                        + Buka Meja
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* VIEW MODE: DAFTAR KARTU PESANAN */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {filteredOrders.map(order => {
            const isCompleted = order.order_status === 'completed';
            const isPaid = order.payment_status === 'paid';
            const isWaitingConfirmation = order.payment_status === 'waiting_confirmation';
            const isUnpaid = order.payment_status === 'unpaid';

            return (
              <div
                key={order.id}
                className={`bg-white rounded-xl border p-4 flex flex-col justify-between transition ${
                  isWaitingConfirmation 
                    ? 'border-blue-300 ring-1 ring-blue-300 shadow-xs' 
                    : 'border-neutral-200 hover:border-neutral-300'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between pb-2.5 border-b border-neutral-100">
                    <div>
                      <div className="flex items-center space-x-1.5 flex-wrap gap-y-1">
                        <span className="font-bold text-xs uppercase text-neutral-950">
                          {order.order_type === 'takeaway' ? 'Takeaway' : `Meja ${order.table_number}`}
                        </span>
                        {order.order_type !== 'takeaway' && order.order_status !== 'completed' && (
                          <button
                            onClick={() => setOrderToTransfer(order)}
                            className="text-[10px] bg-neutral-100 hover:bg-neutral-200 border border-neutral-200 text-neutral-700 px-1.5 py-0.5 rounded flex items-center gap-0.5 transition"
                            title="Pindahkan pesanan ke nomor meja lain"
                          >
                            <ArrowRightLeft className="w-2.5 h-2.5" />
                            <span>Pindah</span>
                          </button>
                        )}
                        <span className="text-xs font-mono text-neutral-400">#{order.order_number.slice(-3)}</span>

                        {/* Kitchen / Order Status Indicator */}
                        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                          order.order_status === 'pending'
                            ? 'bg-amber-50 text-amber-800 border border-amber-200'
                            : order.order_status === 'processing'
                            ? 'bg-blue-50 text-blue-800 border border-blue-200'
                            : order.order_status === 'ready'
                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 font-semibold'
                            : 'bg-neutral-100 text-neutral-600'
                        }`}>
                          {order.order_status === 'pending' && 'Antre Dapur'}
                          {order.order_status === 'processing' && 'Dimasak'}
                          {order.order_status === 'ready' && 'Siap Saji'}
                          {order.order_status === 'completed' && 'Selesai'}
                          {order.order_status === 'cancelled' && 'Batal'}
                        </span>
                      </div>
                      <p className="text-xs text-neutral-500 mt-0.5">{order.customer_name}</p>
                    </div>

                    {/* Payment Badge */}
                    <div>
                      {isPaid ? (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded border bg-emerald-50 text-emerald-700 border-emerald-200 flex items-center gap-1">
                          <Check className="w-3 h-3" />
                          <span>LUNAS ({order.payment_method || 'Kasir'})</span>
                        </span>
                      ) : isWaitingConfirmation ? (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded border bg-blue-50 text-blue-700 border-blue-300 flex items-center gap-1.5 animate-pulse">
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-600"></span>
                          <span>VERIFIKASI QRIS</span>
                        </span>
                      ) : (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded border bg-amber-50 text-amber-700 border-amber-200">
                          BELUM BAYAR
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Item List */}
                  <div className="py-2.5 space-y-1 text-xs">
                    {(order.items || []).map((item, idx) => (
                      <div key={idx} className="flex justify-between items-baseline">
                        <div className="truncate pr-2">
                          <span className="font-semibold text-neutral-900">{item.qty}x</span>
                          <span className="ml-1 text-neutral-700">{item.menu_name}</span>
                          {item.item_notes && (
                            <span className="text-[10px] text-neutral-400 italic block ml-4">
                              {item.item_notes}
                            </span>
                          )}
                        </div>
                        <span className="font-medium text-neutral-500 shrink-0">{formatRupiah(item.subtotal)}</span>
                      </div>
                    ))}
                    {order.notes && (
                      <p className="text-[10px] text-neutral-500 italic pt-1 border-t border-neutral-100">
                        Catatan: {order.notes}
                      </p>
                    )}
                  </div>
                </div>

                <div className="pt-2.5 border-t border-neutral-100 space-y-2">
                  <div className="flex justify-between items-baseline text-xs">
                    <span className="text-neutral-500 font-medium">Tagihan</span>
                    <span className="text-sm font-bold text-neutral-950">{formatRupiah(order.total_amount)}</span>
                  </div>

                  {/* Actions Grid */}
                  <div className="grid grid-cols-2 gap-2">
                    {isWaitingConfirmation ? (
                      <button
                        onClick={async () => {
                          await handleUpdateStatus(order.id, {
                            payment_status: 'paid',
                            payment_method: 'QRIS',
                            cashier_name: activeCashier ? activeCashier.name : 'Kasir'
                          });
                        }}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 rounded-lg text-xs flex items-center justify-center gap-1.5 transition shadow-xs"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Terima QRIS</span>
                      </button>
                    ) : isUnpaid ? (
                      <button
                        onClick={() => {
                          setOrderToPay(order);
                          setCashGiven(order.total_amount);
                        }}
                        className="bg-neutral-950 hover:bg-neutral-900 text-white font-semibold py-2 rounded-lg text-xs transition"
                      >
                        Bayar (Settle)
                      </button>
                    ) : (
                      /* Sudah LUNAS */
                      <button
                        disabled={isCompleted}
                        onClick={() => handleUpdateStatus(order.id, { order_status: 'completed' })}
                        className={`font-semibold py-2 rounded-lg text-xs transition ${
                          isCompleted
                            ? 'bg-neutral-100 text-neutral-400 cursor-default'
                            : 'bg-neutral-900 hover:bg-neutral-800 text-white'
                        }`}
                      >
                        {isCompleted ? '✓ Selesai' : 'Tutup Tagihan'}
                      </button>
                    )}

                    <button
                      onClick={() => setSelectedOrderForReceipt(order)}
                      className="border border-neutral-200 hover:bg-neutral-50 text-neutral-700 font-semibold py-2 rounded-lg text-xs flex items-center justify-center gap-1.5 transition"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span>Struk</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        )}

      </main>

      {/* POS New Order Split Modal */}
      {isPosModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-4xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-5 py-3.5 border-b border-neutral-200 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm text-neutral-950 uppercase tracking-tight">Order Masuk Kasir (POS Direct)</h3>
                <p className="text-[11px] text-neutral-500">Pilih menu dan tentukan jenis pesanan</p>
              </div>
              <button onClick={() => setIsPosModalOpen(false)} className="text-neutral-400 hover:text-neutral-900">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto grow grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Menu Column */}
              <div className="space-y-3">
                <input
                  type="text"
                  placeholder="Cari menu..."
                  value={posSearch}
                  onChange={e => setPosSearch(e.target.value)}
                  className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-2 text-xs focus:outline-hidden focus:border-neutral-900"
                />

                <div className="space-y-1.5 max-h-[50vh] overflow-y-auto pr-1">
                  {menus
                    .filter(m => m.is_available && m.name.toLowerCase().includes(posSearch.toLowerCase()))
                    .map(menu => (
                      <div
                        key={menu.id}
                        onClick={() => addPosItem(menu)}
                        className="p-2 bg-neutral-50 hover:bg-neutral-100 rounded-lg border border-neutral-200 cursor-pointer flex items-center justify-between transition"
                      >
                        <div className="truncate pr-2">
                          <p className="font-semibold text-xs text-neutral-950 truncate">{menu.name}</p>
                          <p className="text-[11px] text-neutral-500">{formatRupiah(menu.price)}</p>
                        </div>
                        <Plus className="w-4 h-4 text-neutral-600 shrink-0" />
                      </div>
                    ))}
                </div>
              </div>

              {/* Order Ticket Column */}
              <div className="bg-neutral-50 rounded-xl p-4 border border-neutral-200 flex flex-col justify-between">
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <button
                      type="button"
                      onClick={() => setPosOrderType('dine_in')}
                      className={`py-1.5 rounded-lg border font-semibold transition ${
                        posOrderType === 'dine_in' ? 'bg-neutral-950 text-white border-neutral-950' : 'bg-white text-neutral-700 border-neutral-200'
                      }`}
                    >
                      Dine-in
                    </button>
                    <button
                      type="button"
                      onClick={() => setPosOrderType('takeaway')}
                      className={`py-1.5 rounded-lg border font-semibold transition ${
                        posOrderType === 'takeaway' ? 'bg-neutral-950 text-white border-neutral-950' : 'bg-white text-neutral-700 border-neutral-200'
                      }`}
                    >
                      Takeaway
                    </button>
                  </div>

                  {posOrderType === 'dine_in' && (
                    <div>
                      <label className="block text-[11px] font-semibold text-neutral-600 mb-1">Nomor Meja</label>
                      <select
                        value={posTableNumber}
                        onChange={e => setPosTableNumber(parseInt(e.target.value))}
                        className="w-full bg-white border border-neutral-200 rounded-lg px-2.5 py-1.5 text-xs font-semibold"
                      >
                        {tables.map(t => (
                          <option key={t.table_number} value={t.table_number}>Meja {t.table_number}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div>
                    <label className="block text-[11px] font-semibold text-neutral-600 mb-1">Nama Pemesan</label>
                    <input
                      type="text"
                      value={posCustomerName}
                      onChange={e => setPosCustomerName(e.target.value)}
                      className="w-full bg-white border border-neutral-200 rounded-lg px-2.5 py-1.5 text-xs font-semibold"
                    />
                  </div>

                  {/* Cart Items */}
                  <div className="bg-white rounded-lg p-2.5 border border-neutral-200 max-h-44 overflow-y-auto space-y-1.5 text-xs">
                    {posCart.map(item => (
                      <div key={item.menu_id} className="flex items-center justify-between">
                        <span className="truncate pr-2 text-neutral-800">{item.menu_name}</span>
                        <div className="flex items-center space-x-1.5 shrink-0">
                          <button onClick={() => updatePosQty(item.menu_id, -1)} className="w-5 h-5 bg-neutral-100 rounded text-neutral-700">-</button>
                          <span className="font-bold w-4 text-center">{item.qty}</span>
                          <button onClick={() => updatePosQty(item.menu_id, 1)} className="w-5 h-5 bg-neutral-100 rounded text-neutral-700">+</button>
                          <span className="font-semibold text-neutral-900 ml-2">{formatRupiah(item.subtotal)}</span>
                        </div>
                      </div>
                    ))}
                    {posCart.length === 0 && <p className="text-center text-[11px] text-neutral-400 py-3">Pilih menu di sebelah kiri</p>}
                  </div>
                </div>

                <div className="pt-3 border-t border-neutral-200">
                  <div className="flex justify-between items-baseline mb-3 text-xs">
                    <span className="font-semibold text-neutral-600">Total</span>
                    <span className="text-sm font-bold text-neutral-950">
                      {formatRupiah(posCart.reduce((s, i) => s + i.subtotal, 0))}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => handleCreatePosOrder(false)}
                      className="bg-neutral-200 hover:bg-neutral-300 text-neutral-800 font-semibold py-2 rounded-lg text-xs transition"
                    >
                      Kirim ke Dapur (Bayar Nanti)
                    </button>
                    <button
                      onClick={() => handleCreatePosOrder(true)}
                      className="bg-neutral-950 hover:bg-neutral-900 text-white font-semibold py-2 rounded-lg text-xs transition"
                    >
                      Bayar Sekarang & Cetak
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Payment Settlement Modal */}
      {orderToPay && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full shadow-xl p-5 border border-neutral-200">
            <h3 className="font-bold text-sm text-neutral-950 mb-1">Pelunasan Tagihan</h3>
            <p className="text-xs text-neutral-500 mb-3">
              {orderToPay.order_type === 'takeaway' ? 'Takeaway' : `Meja ${orderToPay.table_number}`} • {orderToPay.customer_name}
            </p>

            {/* Calculation with discount */}
            {(() => {
              const discAmt = Math.round((orderToPay.total_amount * discountPercent) / 100);
              const finalAmount = Math.max(0, orderToPay.total_amount - discAmt);

              return (
                <>
                  <div className="bg-neutral-50 p-3 rounded-xl border border-neutral-200 mb-3 space-y-2 text-xs">
                    <div className="flex justify-between font-bold text-xs text-neutral-600">
                      <span>Tagihan Asli:</span>
                      <span>{formatRupiah(orderToPay.total_amount)}</span>
                    </div>

                    {/* Diskon Selector */}
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <label className="text-[11px] font-semibold text-neutral-600 flex items-center gap-1">
                          <Percent className="w-3 h-3 text-neutral-500" />
                          <span>Diskon / Promo</span>
                        </label>
                        {discAmt > 0 && (
                          <span className="text-[11px] font-semibold text-emerald-700">
                            - {formatRupiah(discAmt)}
                          </span>
                        )}
                      </div>
                      <div className="grid grid-cols-5 gap-1">
                        {[0, 5, 10, 15, 20].map(pct => (
                          <button
                            key={pct}
                            type="button"
                            onClick={() => {
                              setDiscountPercent(pct);
                              if (settlementMethod === 'Tunai') {
                                const newFinal = Math.max(0, orderToPay.total_amount - Math.round((orderToPay.total_amount * pct) / 100));
                                setCashGiven(newFinal);
                              }
                            }}
                            className={`py-1 rounded-lg border text-[11px] font-semibold transition ${
                              discountPercent === pct
                                ? 'bg-neutral-950 text-white border-neutral-950'
                                : 'bg-white text-neutral-700 border-neutral-200 hover:bg-neutral-100'
                            }`}
                          >
                            {pct === 0 ? '0%' : `${pct}%`}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="pt-2 border-t border-neutral-200 flex justify-between font-bold text-sm">
                      <span>Total Harus Dibayar:</span>
                      <span className="text-neutral-950">{formatRupiah(finalAmount)}</span>
                    </div>

                    <div className="pt-2 border-t border-neutral-200">
                      <label className="block text-[11px] font-semibold text-neutral-600 mb-1">Metode Pelunasan</label>
                      <div className="grid grid-cols-3 gap-1.5">
                        {(['Tunai', 'QRIS', 'Kartu Debit'] as const).map(m => (
                          <button
                            key={m}
                            type="button"
                            onClick={() => setSettlementMethod(m)}
                            className={`py-1.5 rounded-lg border text-xs font-semibold transition ${
                              settlementMethod === m ? 'bg-neutral-950 text-white border-neutral-950' : 'bg-white text-neutral-700 border-neutral-200'
                            }`}
                          >
                            {m}
                          </button>
                        ))}
                      </div>
                    </div>

                    {settlementMethod === 'Tunai' && (
                      <div>
                        <label className="block text-[11px] font-semibold text-neutral-600 mb-1">Uang Diterima</label>
                        <input
                          type="number"
                          value={cashGiven || ''}
                          onChange={e => setCashGiven(parseInt(e.target.value) || 0)}
                          className="w-full bg-white border border-neutral-200 rounded-lg px-2.5 py-1.5 text-xs font-bold"
                        />
                        {/* Quick cash pills */}
                        <div className="flex gap-1.5 mt-1.5">
                          {[finalAmount, 50000, 100000].map(amt => (
                            <button
                              key={amt}
                              type="button"
                              onClick={() => setCashGiven(amt)}
                              className="px-2 py-0.5 rounded bg-neutral-200 hover:bg-neutral-300 text-[10px] font-semibold text-neutral-700"
                            >
                              {formatRupiah(amt)}
                            </button>
                          ))}
                        </div>

                        <div className="flex justify-between font-bold text-xs pt-2 mt-2 border-t border-neutral-200">
                          <span>Kembalian:</span>
                          <span className={cashGiven >= finalAmount ? 'text-emerald-700' : 'text-neutral-500'}>
                            {formatRupiah(Math.max(0, cashGiven - finalAmount))}
                          </span>
                        </div>
                      </div>
                    )}

                    {settlementMethod === 'QRIS' && (
                      <div className="text-center p-3 bg-white rounded-xl border border-neutral-200 space-y-2">
                        <div className="flex items-center justify-between pb-2 border-b border-neutral-100">
                          <span className="font-bold text-xs text-neutral-900 tracking-wider">QRIS STANDAR NASIONAL</span>
                          <span className="text-[10px] font-mono text-neutral-500">NMID: ID1020261118001</span>
                        </div>

                        {/* Countdown Timer Kasir */}
                        <div className={`p-2 rounded-lg flex items-center justify-between text-xs ${
                          isCashierQrisExpired 
                            ? 'bg-rose-50 text-rose-700 border border-rose-200' 
                            : 'bg-amber-50 text-amber-900 border border-amber-200'
                        }`}>
                          <div className="flex items-center gap-1.5 font-semibold text-[11px]">
                            <Clock className="w-3.5 h-3.5 text-amber-500" />
                            <span>{isCashierQrisExpired ? 'QRIS Kedaluwarsa' : 'Batas Waktu Scan:'}</span>
                          </div>
                          <span className="font-mono font-bold text-xs">
                            {isCashierQrisExpired 
                              ? '00:00' 
                              : `${String(Math.floor(cashierQrisTimeLeft / 60)).padStart(2, '0')}:${String(cashierQrisTimeLeft % 60).padStart(2, '0')}`}
                          </span>
                        </div>

                        {/* QR Image with Expired Overlay */}
                        <div className="relative p-2 bg-neutral-50 rounded-lg border border-neutral-200 inline-block overflow-hidden">
                          {cashierQrisDataUrl ? (
                            <img 
                              src={cashierQrisDataUrl} 
                              alt="QRIS Standar Pembayaran" 
                              className={`w-44 h-44 mx-auto ${isCashierQrisExpired ? 'filter blur-[3px] opacity-40' : ''}`} 
                            />
                          ) : (
                            <div className="w-44 h-44 flex items-center justify-center text-xs text-neutral-400">
                              Membuat QRIS...
                            </div>
                          )}

                          {isCashierQrisExpired && (
                            <div className="absolute inset-0 bg-neutral-950/70 backdrop-blur-xs flex flex-col items-center justify-center p-2 text-white text-center space-y-1.5">
                              <AlertTriangle className="w-6 h-6 text-rose-400 mx-auto" />
                              <p className="font-bold text-[11px]">KEDALUWARSA</p>
                              <button
                                type="button"
                                onClick={handleRegenerateCashierQris}
                                className="bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold px-2.5 py-1 rounded text-[10px] flex items-center gap-1"
                              >
                                <RefreshCw className="w-3 h-3" />
                                <span>Generate Baru</span>
                              </button>
                            </div>
                          )}
                        </div>

                        <p className="text-[11px] font-medium text-neutral-600">
                          Arahkan layar tablet/monitor ke pelanggan untuk scan
                        </p>
                        <p className="text-[10px] text-neutral-400">
                          BCA Mobile, Livin by Mandiri, GoPay, OVO, ShopeePay, DANA, BRImo, LinkAja
                        </p>
                      </div>
                    )}

                    {settlementMethod === 'Kartu Debit' && (
                      <div className="p-3 bg-neutral-100 rounded-xl text-neutral-700 text-xs space-y-1">
                        <p className="font-semibold text-neutral-900">Pembayaran Mesin EDC / Debit</p>
                        <p className="text-[11px] text-neutral-600">Gesek atau tap kartu pelanggan pada mesin EDC kasir sebesar:</p>
                        <p className="text-base font-black text-neutral-950 font-mono">{formatRupiah(finalAmount)}</p>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={async () => {
                        await handleUpdateStatus(orderToPay.id, { 
                          payment_status: 'paid',
                          payment_method: settlementMethod,
                          cashier_name: activeCashier ? activeCashier.name : 'Kasir'
                        });
                        if (discAmt > 0) {
                          await updateOrderDiscount(orderToPay.id, discAmt, finalAmount);
                        }
                        setSelectedOrderForReceipt({ 
                          ...orderToPay, 
                          total_amount: finalAmount,
                          discount_amount: discAmt,
                          payment_status: 'paid', 
                          payment_method: settlementMethod,
                          cashier_name: activeCashier ? activeCashier.name : 'Kasir'
                        });
                        setOrderToPay(null);
                        setDiscountPercent(0);
                      }}
                      className="grow bg-neutral-950 hover:bg-neutral-900 text-white font-semibold py-2 rounded-lg text-xs transition"
                    >
                      Konfirmasi & Cetak Struk
                    </button>
                    <button 
                      onClick={() => {
                        setOrderToPay(null);
                        setDiscountPercent(0);
                      }} 
                      className="px-3.5 bg-neutral-100 text-neutral-700 font-semibold py-2 rounded-lg text-xs"
                    >
                      Batal
                    </button>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* Pop-up Cetak Struk Kasir Thermal */}
      {selectedOrderForReceipt && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-4 py-3 border-b border-neutral-200 flex items-center justify-between">
              <span className="font-bold text-xs uppercase tracking-tight text-neutral-900">Pratinjau Struk Kasir</span>
              <button onClick={() => setSelectedOrderForReceipt(null)} className="text-neutral-400 hover:text-neutral-900">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto grow bg-neutral-50 flex justify-center">
              <div id="thermalReceipt" className="w-[260px] bg-white p-3.5 shadow-sm border border-neutral-200 text-neutral-950 font-mono text-[11px] leading-tight">
                <div className="text-center pb-2 border-b border-dashed border-neutral-300">
                  <h2 className="font-bold text-xs uppercase tracking-wider">{setting?.name || 'RASA NUSANTARA'}</h2>
                  <p className="text-[10px] text-neutral-500 mt-0.5">{setting?.address || 'Jl. Kuliner No. 88, Jakarta'}</p>
                  {setting?.phone && <p className="text-[9px] text-neutral-400">Telp: {setting.phone}</p>}
                </div>

                <div className="py-2 border-b border-dashed border-neutral-300 space-y-0.5 text-[10px]">
                  <div className="flex justify-between">
                    <span>No: {selectedOrderForReceipt.order_number}</span>
                    <span>{new Date(selectedOrderForReceipt.created_at).toLocaleDateString('id-ID')}</span>
                  </div>
                  <div className="flex justify-between font-bold">
                    <span>{selectedOrderForReceipt.order_type === 'takeaway' ? 'TAKEAWAY' : `MEJA ${selectedOrderForReceipt.table_number}`}</span>
                    <span>Kasir: {selectedOrderForReceipt.cashier_name || activeCashier?.name || 'Kasir'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Pelanggan: {selectedOrderForReceipt.customer_name}</span>
                  </div>
                </div>

                <div className="py-2 border-b border-dashed border-neutral-300 space-y-1 text-[10px]">
                  {(selectedOrderForReceipt.items || []).map((item, idx) => (
                    <div key={idx} className="flex justify-between items-start">
                      <div>
                        <span>{item.qty}x {item.menu_name}</span>
                        {item.item_notes && <div className="text-[9px] text-neutral-500">({item.item_notes})</div>}
                      </div>
                      <span>{formatRupiah(item.subtotal)}</span>
                    </div>
                  ))}
                </div>

                <div className="py-2 border-b border-dashed border-neutral-300 space-y-1 text-[10px]">
                  {selectedOrderForReceipt.discount_amount && selectedOrderForReceipt.discount_amount > 0 ? (
                    <>
                      <div className="flex justify-between text-neutral-500">
                        <span>Subtotal:</span>
                        <span>{formatRupiah(selectedOrderForReceipt.total_amount + selectedOrderForReceipt.discount_amount)}</span>
                      </div>
                      <div className="flex justify-between text-emerald-700">
                        <span>Diskon Promo:</span>
                        <span>- {formatRupiah(selectedOrderForReceipt.discount_amount)}</span>
                      </div>
                    </>
                  ) : null}

                  {selectedOrderForReceipt.tax_amount && selectedOrderForReceipt.tax_amount > 0 ? (
                    <div className="flex justify-between text-neutral-500">
                      <span>PB1 (Pajak 10%):</span>
                      <span>{formatRupiah(selectedOrderForReceipt.tax_amount)}</span>
                    </div>
                  ) : null}

                  <div className="flex justify-between font-bold text-xs pt-1 border-t border-dotted border-neutral-200">
                    <span>TOTAL:</span>
                    <span>{formatRupiah(selectedOrderForReceipt.total_amount)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Metode: {selectedOrderForReceipt.payment_method}</span>
                    <span className="font-bold">LUNAS</span>
                  </div>
                </div>

                <div className="text-center pt-2 text-[9px] text-neutral-500 space-y-0.5">
                  <p>{setting?.receipt_footer || 'Terima kasih atas kunjungan Anda'}</p>
                  {setting?.wifi_password && <p>WiFi: {setting.wifi_password}</p>}
                </div>
              </div>
            </div>

            <div className="p-3 bg-white border-t border-neutral-200 flex gap-2">
              <button
                onClick={() => window.print()}
                className="grow bg-neutral-950 hover:bg-neutral-900 text-white font-semibold py-2 rounded-lg text-xs flex items-center justify-center gap-1.5 transition"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Cetak Struk</span>
              </button>
              <button onClick={() => setSelectedOrderForReceipt(null)} className="px-3.5 bg-neutral-100 text-neutral-700 font-semibold py-2 rounded-lg text-xs">
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Pindah Meja (Transfer Table) */}
      {orderToTransfer && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-4 border border-neutral-200 shadow-xl space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-neutral-100">
              <div className="flex items-center space-x-2">
                <ArrowRightLeft className="w-4 h-4 text-neutral-900" />
                <h3 className="font-bold text-xs uppercase tracking-tight text-neutral-950">
                  Pindahkan Meja {orderToTransfer.table_number}
                </h3>
              </div>
              <button onClick={() => setOrderToTransfer(null)} className="text-neutral-400 hover:text-neutral-900">
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-neutral-500">
              Pilih meja baru untuk <strong>#{orderToTransfer.order_number.slice(-3)} ({orderToTransfer.customer_name})</strong>:
            </p>

            <div className="grid grid-cols-5 gap-2">
              {tables.map(tbl => {
                const isCurrent = tbl.table_number === orderToTransfer.table_number;
                return (
                  <button
                    key={tbl.table_number}
                    disabled={isCurrent}
                    onClick={() => handleTransferTable(tbl.table_number)}
                    className={`py-2.5 rounded-xl border text-xs font-bold transition ${
                      isCurrent
                        ? 'bg-neutral-100 text-neutral-400 border-neutral-200 cursor-not-allowed'
                        : 'bg-white hover:bg-neutral-950 hover:text-white border-neutral-200 text-neutral-800'
                    }`}
                  >
                    {tbl.table_number}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Modal Laporan Shift Kasir (Z-Report) */}
      {isShiftReportOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 border border-neutral-200 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-neutral-100">
              <div className="flex items-center space-x-2">
                <FileText className="w-4 h-4 text-neutral-900" />
                <h3 className="font-bold text-xs uppercase tracking-tight text-neutral-950">Laporan Tutup Shift Kasir (Z-Report)</h3>
              </div>
              <button onClick={() => setIsShiftReportOpen(false)} className="text-neutral-400 hover:text-neutral-900">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-neutral-50 p-3.5 rounded-xl border border-neutral-200 space-y-2 text-xs">
              <div className="flex justify-between text-neutral-600">
                <span>Staf Kasir:</span>
                <span className="font-bold text-neutral-950">{activeCashier?.name || 'Kasir'}</span>
              </div>
              <div className="flex justify-between text-neutral-600">
                <span>Waktu Rekap:</span>
                <span className="font-mono text-neutral-950">{currentTime}</span>
              </div>
              <div className="pt-2 border-t border-neutral-200 space-y-1">
                <div className="flex justify-between text-neutral-600">
                  <span>Penjualan Tunai:</span>
                  <span className="font-semibold text-neutral-900">
                    {formatRupiah(orders.filter(o => o.payment_status === 'paid' && o.payment_method === 'Tunai').reduce((s, o) => s + o.total_amount, 0))}
                  </span>
                </div>
                <div className="flex justify-between text-neutral-600">
                  <span>Penjualan QRIS:</span>
                  <span className="font-semibold text-neutral-900">
                    {formatRupiah(orders.filter(o => o.payment_status === 'paid' && o.payment_method === 'QRIS').reduce((s, o) => s + o.total_amount, 0))}
                  </span>
                </div>
                <div className="flex justify-between text-neutral-600">
                  <span>Penjualan Debit / EDC:</span>
                  <span className="font-semibold text-neutral-900">
                    {formatRupiah(orders.filter(o => o.payment_status === 'paid' && o.payment_method === 'Kartu Debit').reduce((s, o) => s + o.total_amount, 0))}
                  </span>
                </div>
              </div>
              <div className="pt-2 border-t border-neutral-200 flex justify-between font-bold text-sm">
                <span>Total Omset Shift:</span>
                <span className="text-emerald-700">{formatRupiah(totalSalesToday)}</span>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => window.print()}
                className="grow bg-neutral-950 hover:bg-neutral-900 text-white font-semibold py-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5 transition"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Cetak Rekap Shift (Thermal)</span>
              </button>
              <button
                onClick={() => setIsShiftReportOpen(false)}
                className="px-3.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-semibold py-2.5 rounded-xl text-xs"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
