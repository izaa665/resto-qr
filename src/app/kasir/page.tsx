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
  Receipt
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
  const [viewMode, setViewMode] = useState<'cards' | 'tables'>('tables');
  const [dirtyTables, setDirtyTables] = useState<number[]>([]);
  const [selectedOrderForReceipt, setSelectedOrderForReceipt] = useState<Order | null>(null);
  const [orderToTransfer, setOrderToTransfer] = useState<Order | null>(null);
  const [isShiftReportOpen, setIsShiftReportOpen] = useState<boolean>(false);
  const [discountPercent, setDiscountPercent] = useState<number>(0);
  const [currentTime, setCurrentTime] = useState('');
  const [previousPendingCount, setPreviousPendingCount] = useState<number>(0);
  const [previousCallCount, setPreviousCallCount] = useState<number>(0);

  // Load dirty tables from localStorage
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

  const handleCloseOrder = async (order: Order) => {
    await handleUpdateStatus(order.id, { order_status: 'completed' });
    if (order.table_number) {
      markTableDirty(order.table_number);
    }
  };

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

  // New POS Order Modal states
  const [isPosModalOpen, setIsPosModalOpen] = useState(false);
  const [posOrderType, setPosOrderType] = useState<'dine_in' | 'takeaway'>('dine_in');
  const [posTableNumber, setPosTableNumber] = useState<number>(1);
  const [posCustomerName, setPosCustomerName] = useState('Pelanggan Kasir');
  const [posCart, setPosCart] = useState<OrderItem[]>([]);
  const [posSearch, setPosSearch] = useState('');

  // Payment Settlement Modal states
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
        dark: '#1c1917',
        light: '#ffffff',
      },
    }).then(url => {
      setCashierQrisDataUrl(url);
    }).catch(console.error);
  }, [orderToPay, settlementMethod, cashierQrisVersion]);

  // Clock
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
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
        .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => loadAll())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'waiter_calls' }, () => loadAll())
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
      customer_name: posCustomerName.trim() || 'Pelanggan Kasir',
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

  // Cashier Login Screen (Obsidian Terminal Kiosk)
  if (isAuthLoaded && !activeCashier) {
    const cashierUsers = users.filter(u => u.is_active !== false && (u.role === 'kasir' || u.role === 'admin'));
    const selectedUserObj = users.find(u => u.id === selectedUserId);

    return (
      <div className="bg-[#121110] min-h-screen text-[#EDE8E3] font-sans flex flex-col justify-center items-center p-4 selection:bg-amber-500 selection:text-stone-950">
        <div className="max-w-md w-full bg-[#1A1816] border border-[#2D2A26] rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
          <div className="text-center space-y-2">
            <div className="w-14 h-14 bg-stone-900 border border-stone-800 rounded-2xl mx-auto flex items-center justify-center text-amber-400 mb-2 shadow-inner">
              <Lock className="w-7 h-7" />
            </div>
            <h1 className="text-lg font-black tracking-tight text-white uppercase">Terminal Kasir POS</h1>
            <p className="text-xs text-stone-400">Pilih staf kasir yang bertugas dan masukkan PIN 4 digit untuk membuka shift.</p>
          </div>

          {/* Cashier Account Selection */}
          <div className="space-y-2">
            <label className="text-[11px] font-bold text-stone-400 uppercase tracking-wider block">Pilih Akun Kasir</label>
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
                        ? 'border-amber-500 bg-amber-500/10 text-white ring-1 ring-amber-500/50 shadow-warm-sm' 
                        : 'border-[#2D2A26] bg-[#141312] text-stone-300 hover:border-stone-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-black ${
                        isSelected ? 'bg-amber-500 text-stone-950' : 'bg-stone-800 text-stone-300'
                      }`}>
                        {user.name.charAt(0)}
                      </div>
                      {isSelected && <Check className="w-4 h-4 text-amber-400" />}
                    </div>
                    <div>
                      <p className="text-xs font-bold truncate text-white">{user.name}</p>
                      <p className="text-[10px] text-stone-400 uppercase font-mono">{user.role}</p>
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
                <label className="text-[11px] font-bold text-stone-400 uppercase tracking-wider">PIN Masuk</label>
                {selectedUserObj && (
                  <span className="text-[10px] text-stone-400">
                    Kasir: <strong className="text-amber-300">{selectedUserObj.name}</strong>
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
                className="w-full bg-[#141312] border border-[#2D2A26] rounded-2xl px-4 py-3.5 text-center tracking-[0.5em] text-xl font-black text-white focus:outline-hidden focus:border-amber-500 transition font-mono"
              />
            </div>

            {/* Quick Numpad */}
            <div className="grid grid-cols-3 gap-2">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
                <button
                  key={num}
                  type="button"
                  onClick={() => setCashierPin(prev => (prev.length < 6 ? prev + num : prev))}
                  className="py-3 bg-[#141312] hover:bg-stone-800 border border-[#2D2A26] rounded-2xl text-base font-bold text-stone-200 transition active:scale-95 shadow-2xs"
                >
                  {num}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setCashierPin('')}
                className="py-3 bg-[#141312] hover:bg-stone-800 border border-[#2D2A26] rounded-2xl text-xs font-bold text-stone-400 transition"
              >
                C
              </button>
              <button
                type="button"
                onClick={() => setCashierPin(prev => (prev.length < 6 ? prev + '0' : prev))}
                className="py-3 bg-[#141312] hover:bg-stone-800 border border-[#2D2A26] rounded-2xl text-base font-bold text-stone-200 transition active:scale-95 shadow-2xs"
              >
                0
              </button>
              <button
                type="button"
                onClick={() => setCashierPin(prev => prev.slice(0, -1))}
                className="py-3 bg-[#141312] hover:bg-stone-800 border border-[#2D2A26] rounded-2xl text-xs font-bold text-stone-400 transition"
              >
                ⌫
              </button>
            </div>

            {loginError && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-2xl text-center text-xs text-rose-400 font-bold">
                {loginError}
              </div>
            )}

            <button
              type="submit"
              className="w-full bg-amber-500 hover:bg-amber-400 text-stone-950 font-black py-3.5 rounded-2xl text-xs uppercase tracking-wider transition shadow-warm-lg active:scale-98"
            >
              Buka Shift Kasir
            </button>
          </form>

          <div className="pt-2 border-t border-[#2D2A26] text-center">
            <p className="text-[11px] text-stone-500">
              Akun & PIN staf kasir dikelola secara terpusat oleh Admin.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#141312] min-h-screen text-[#EDE8E3] font-sans selection:bg-amber-500 selection:text-stone-950 pb-16">
      
      {/* POS Top Header Bar */}
      <header className="bg-[#1A1816] border-b border-[#2D2A26] sticky top-0 z-30 px-4 sm:px-6 py-3.5 shadow-warm-md">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 font-black">
              <UtensilsCrossed className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="font-black text-sm tracking-tight text-white uppercase">
                  Point of Sale (POS)
                </h1>
                <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  {activeCashier?.name || 'Kasir Bertugas'}
                </span>
              </div>
              <p className="text-[10px] text-stone-400 font-medium">Shift Terminal Aktif • Realtime Sync</p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => setIsShiftReportOpen(true)}
              className="bg-[#141312] hover:bg-stone-800 text-stone-200 border border-[#2D2A26] px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition active:scale-95"
              title="Laporan Rekap Shift Kasir"
            >
              <FileText className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden sm:inline">Laporan Shift</span>
            </button>

            <button
              onClick={() => setIsPosModalOpen(true)}
              className="bg-amber-500 hover:bg-amber-400 text-stone-950 px-3.5 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 transition shadow-warm-sm active:scale-95"
            >
              <Plus className="w-4 h-4 text-stone-950" />
              <span>Input Pesanan Baru</span>
            </button>

            <button
              onClick={handleCashierLogout}
              className="bg-[#141312] hover:bg-rose-500/20 hover:text-rose-400 text-stone-400 border border-[#2D2A26] px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition"
              title="Tutup shift dan keluar"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Tutup Shift</span>
            </button>

            <div className="text-right pl-3 border-l border-[#2D2A26] hidden sm:block">
              <span className="font-mono text-xs font-bold text-amber-400">{currentTime || '--:--:--'}</span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-4 space-y-4">

        {/* Live Waiter Calls Alert Bar */}
        {waiterCalls.length > 0 && (
          <div className="bg-gradient-to-r from-amber-500 to-amber-600 text-stone-950 p-3.5 rounded-2xl text-xs font-black flex items-center justify-between shadow-warm-md animate-pulse">
            <div className="flex items-center space-x-3">
              <span className="w-2.5 h-2.5 rounded-full bg-stone-950 animate-ping"></span>
              <Bell className="w-4 h-4 text-stone-950" />
              <span>
                Panggilan Meja {waiterCalls[0].table_number}: "{waiterCalls[0].call_type}" ({waiterCalls[0].customer_name || 'Tamu'})
                {waiterCalls.length > 1 && ` (+${waiterCalls.length - 1} panggilan lain)`}
              </span>
            </div>
            <button
              onClick={() => handleResolveCall(waiterCalls[0].id)}
              className="bg-stone-950 hover:bg-stone-900 text-white px-3.5 py-1.5 rounded-xl text-xs font-bold transition shadow-warm-sm active:scale-95"
            >
              ✓ Selesai / Tangani
            </button>
          </div>
        )}

        {/* Tactical Metrics Bar */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-[#1A1816] rounded-2xl p-4 border border-[#2D2A26] shadow-warm-sm">
            <span className="text-[10px] uppercase tracking-wider text-stone-400 font-bold block">Pesanan Aktif</span>
            <p className="text-2xl font-black text-white mt-1 font-mono">{activeOrdersCount}</p>
          </div>
          <div className="bg-[#1A1816] rounded-2xl p-4 border border-[#2D2A26] shadow-warm-sm">
            <span className="text-[10px] uppercase tracking-wider text-stone-400 font-bold block">Belum Bayar (Open Bills)</span>
            <p className="text-2xl font-black text-amber-400 mt-1 font-mono">{unpaidCount}</p>
          </div>
          <div className="bg-[#1A1816] rounded-2xl p-4 border border-[#2D2A26] shadow-warm-sm">
            <span className="text-[10px] uppercase tracking-wider text-stone-400 font-bold block">Total Omzet Kasir Shift Ini</span>
            <p className="text-2xl font-black text-emerald-400 mt-1 font-mono">{formatRupiah(totalSalesToday)}</p>
          </div>
        </div>

        {/* View Mode & Filter Controls */}
        <div className="bg-[#1A1816] rounded-2xl p-3 border border-[#2D2A26] flex items-center justify-between">
          <div className="flex items-center space-x-1.5 overflow-x-auto no-scrollbar">
            <button
              onClick={() => setFilter('active')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition ${
                filter === 'active' 
                  ? 'bg-amber-500 text-stone-950 shadow-warm-sm' 
                  : 'bg-[#141312] text-stone-400 hover:text-white border border-[#2D2A26]'
              }`}
            >
              Aktif ({activeOrdersCount})
            </button>

            <button
              onClick={() => setFilter('waiting_qris')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition ${
                filter === 'waiting_qris' 
                  ? 'bg-blue-600 text-white shadow-warm-sm' 
                  : 'bg-[#141312] text-stone-400 hover:text-white border border-[#2D2A26]'
              }`}
            >
              Verifikasi QRIS ({waitingQrisOrders.length})
            </button>

            <button
              onClick={() => setFilter('unpaid')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition ${
                filter === 'unpaid' 
                  ? 'bg-amber-600 text-white shadow-warm-sm' 
                  : 'bg-[#141312] text-stone-400 hover:text-white border border-[#2D2A26]'
              }`}
            >
              Belum Bayar ({unpaidCount})
            </button>

            <button
              onClick={() => setFilter('paid')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition ${
                filter === 'paid' 
                  ? 'bg-emerald-600 text-white shadow-warm-sm' 
                  : 'bg-[#141312] text-stone-400 hover:text-white border border-[#2D2A26]'
              }`}
            >
              Lunas
            </button>

            <button
              onClick={() => setFilter('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition ${
                filter === 'all' 
                  ? 'bg-stone-800 text-white shadow-warm-sm' 
                  : 'bg-[#141312] text-stone-400 hover:text-white border border-[#2D2A26]'
              }`}
            >
              Semua
            </button>
          </div>

          <div className="flex items-center space-x-2 shrink-0 ml-2">
            <div className="flex items-center bg-[#141312] p-1 rounded-xl border border-[#2D2A26] text-xs">
              <button
                onClick={() => setViewMode('tables')}
                className={`px-3 py-1.5 rounded-lg font-bold transition ${
                  viewMode === 'tables' ? 'bg-[#1A1816] text-amber-400 shadow-2xs' : 'text-stone-400 hover:text-white'
                }`}
              >
                Denah Meja
              </button>
              <button
                onClick={() => setViewMode('cards')}
                className={`px-3 py-1.5 rounded-lg font-bold transition ${
                  viewMode === 'cards' ? 'bg-[#1A1816] text-amber-400 shadow-2xs' : 'text-stone-400 hover:text-white'
                }`}
              >
                Daftar Kartu
              </button>
            </div>

            <button
              onClick={loadAll}
              className="text-stone-400 hover:text-white p-2 bg-[#141312] rounded-xl border border-[#2D2A26] transition active:scale-95"
              title="Refresh"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* VIEW MODE: DENAH MEJA (TACTICAL FLOOR PLAN) */}
        {viewMode === 'tables' ? (
          <div>
            {/* Status Legend */}
            <div className="flex flex-wrap items-center gap-2 mb-3 text-[11px] font-bold text-stone-400">
              <span className="flex items-center gap-1.5 px-3 py-1 bg-[#1A1816] border border-[#2D2A26] rounded-xl">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                <span>Kosong & Siap</span>
              </span>
              <span className="flex items-center gap-1.5 px-3 py-1 bg-[#1A1816] border border-[#2D2A26] rounded-xl">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                <span>Terisi (Belum Bayar)</span>
              </span>
              <span className="flex items-center gap-1.5 px-3 py-1 bg-[#1A1816] border border-[#2D2A26] rounded-xl">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
                <span>Lunas / Sedang Makan</span>
              </span>
              <span className="flex items-center gap-1.5 px-3 py-1 bg-[#1A1816] border border-[#2D2A26] rounded-xl">
                <span className="w-2.5 h-2.5 rounded-full bg-orange-500"></span>
                <span>Perlu Dibersihkan ({dirtyTables.length})</span>
              </span>
              {waiterCalls.length > 0 && (
                <span className="flex items-center gap-1.5 px-3 py-1 bg-amber-500 text-stone-950 rounded-xl font-black animate-pulse">
                  <Bell className="w-3.5 h-3.5" />
                  <span>Panggilan Meja ({waiterCalls.length})</span>
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3.5">
              {tables.map(table => {
                const activeOrder = orders.find(
                  o => o.table_number === table.table_number && o.order_status !== 'completed' && o.order_status !== 'cancelled'
                );
                const tableCalls = waiterCalls.filter(c => c.table_number === table.table_number);
                const hasCall = tableCalls.length > 0;
                const isDirty = !activeOrder && dirtyTables.includes(table.table_number);
                const isOccupied = Boolean(activeOrder);
                const isPaid = activeOrder?.payment_status === 'paid';
                const isWaitingQris = activeOrder?.payment_status === 'waiting_confirmation';

                return (
                  <div
                    key={table.table_number}
                    className={`rounded-3xl border p-4 flex flex-col justify-between transition min-h-[195px] shadow-warm-sm relative overflow-hidden ${
                      hasCall
                        ? 'bg-[#2A2318] border-amber-500 ring-2 ring-amber-500/50 animate-pulse'
                        : isDirty
                        ? 'bg-[#261E16] border-orange-500/70'
                        : !isOccupied
                        ? 'bg-[#1A1816] border-[#2D2A26] hover:border-stone-700'
                        : isPaid
                        ? 'bg-[#161D26] border-blue-500/50'
                        : isWaitingQris
                        ? 'bg-[#2A241A] border-amber-500 ring-1 ring-amber-500/50'
                        : 'bg-[#231E18] border-amber-600/50'
                    }`}
                  >
                    <div>
                      {/* Card Header */}
                      <div className="flex items-center justify-between pb-2 border-b border-[#2D2A26]">
                        <span className="font-black text-sm text-white tracking-tight">MEJA {table.table_number}</span>
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                          hasCall
                            ? 'bg-amber-400 text-stone-950 animate-bounce'
                            : isDirty
                            ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                            : !isOccupied
                            ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                            : isPaid
                            ? 'bg-blue-500/15 text-blue-400 border border-blue-500/30'
                            : isWaitingQris
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse'
                            : 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                        }`}>
                          {hasCall 
                            ? '🛎️ PANGGILAN' 
                            : isDirty 
                            ? '🧹 DIBERSIHKAN' 
                            : !isOccupied 
                            ? 'KOSONG' 
                            : isPaid 
                            ? 'LUNAS' 
                            : isWaitingQris 
                            ? 'VERIFIKASI' 
                            : 'TERISI'}
                        </span>
                      </div>

                      {/* Active Calls */}
                      {hasCall && (
                        <div className="py-2 space-y-1">
                          {tableCalls.map(c => (
                            <div key={c.id} className="text-[11px] font-black text-amber-200 flex items-center justify-between bg-amber-500/20 p-2 rounded-xl border border-amber-500/40">
                              <span className="truncate">{c.call_type}</span>
                              <button
                                onClick={() => handleResolveCall(c.id)}
                                className="text-[10px] bg-amber-400 hover:bg-amber-300 text-stone-950 font-bold px-2 py-0.5 rounded-lg shrink-0 ml-1.5"
                              >
                                Beres
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Main Tile Body */}
                      {isOccupied && activeOrder ? (
                        <div className="py-2.5 space-y-1 text-xs">
                          <p className="font-bold text-white truncate">{activeOrder.customer_name}</p>
                          <p className="text-[11px] text-stone-400 font-mono">#{activeOrder.order_number.slice(-4)}</p>
                          <p className="text-sm font-black text-amber-400 font-mono mt-1">{formatRupiah(activeOrder.total_amount)}</p>
                        </div>
                      ) : isDirty ? (
                        <div className="py-4 text-center text-xs text-orange-300 space-y-1">
                          <p className="font-black flex items-center justify-center gap-1 text-orange-400">
                            <Sparkles className="w-3.5 h-3.5" />
                            <span>Piring Kotor</span>
                          </p>
                          <p className="text-[10px] text-stone-400">Tamu sudah selesai. Bersihkan meja.</p>
                        </div>
                      ) : (
                        <div className="py-6 text-center text-xs text-stone-500 font-medium">
                          Meja bersih & siap
                        </div>
                      )}
                    </div>

                    {/* Card Actions Footer */}
                    <div className="pt-2 border-t border-[#2D2A26]">
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
                              className="grow bg-emerald-600 hover:bg-emerald-500 text-white font-black py-2 rounded-xl text-xs transition shadow-2xs active:scale-95"
                            >
                              Terima QRIS
                            </button>
                          ) : activeOrder.payment_status === 'unpaid' ? (
                            <button
                              onClick={() => {
                                setOrderToPay(activeOrder);
                                setCashGiven(activeOrder.total_amount);
                              }}
                              className="grow bg-amber-500 hover:bg-amber-400 text-stone-950 font-black py-2 rounded-xl text-xs transition shadow-2xs active:scale-95"
                            >
                              Bayar
                            </button>
                          ) : (
                            <button
                              onClick={() => handleCloseOrder(activeOrder)}
                              className="grow bg-stone-800 hover:bg-stone-700 text-white font-bold py-2 rounded-xl text-xs transition active:scale-95"
                            >
                              Tutup Meja
                            </button>
                          )}
                          <button
                            onClick={() => setSelectedOrderForReceipt(activeOrder)}
                            className="px-2.5 bg-[#141312] hover:bg-stone-800 text-stone-300 rounded-xl text-xs flex items-center justify-center transition border border-[#2D2A26]"
                            title="Cetak Struk"
                          >
                            <Printer className="w-4 h-4" />
                          </button>
                        </div>
                      ) : isDirty ? (
                        <button
                          onClick={() => markTableClean(table.table_number)}
                          className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black py-2 rounded-xl text-xs flex items-center justify-center gap-1.5 transition shadow-warm-sm active:scale-95"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>Tandai Bersih</span>
                        </button>
                      ) : (
                        <button
                          onClick={() => {
                            setPosTableNumber(table.table_number);
                            setPosOrderType('dine_in');
                            setIsPosModalOpen(true);
                          }}
                          className="w-full bg-[#141312] hover:bg-stone-800 text-stone-300 font-bold py-2 rounded-xl text-xs transition border border-[#2D2A26] active:scale-95"
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
                  className={`bg-[#1A1816] rounded-3xl border p-5 flex flex-col justify-between transition shadow-warm-sm ${
                    isWaitingConfirmation 
                      ? 'border-blue-500 ring-1 ring-blue-500/50' 
                      : isUnpaid
                      ? 'border-[#2D2A26] hover:border-amber-500/50'
                      : 'border-[#2D2A26]'
                  }`}
                >
                  <div>
                    <div className="flex justify-between items-start pb-3 border-b border-[#2D2A26]">
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="font-black text-sm text-white tracking-tight">
                            {order.order_type === 'takeaway' ? 'TAKEAWAY' : `MEJA ${order.table_number || '-'}`}
                          </span>
                          <span className="text-[11px] font-mono text-stone-400">#{order.order_number.slice(-4)}</span>
                        </div>
                        <p className="text-xs font-bold text-stone-300 mt-0.5">{order.customer_name}</p>
                      </div>

                      <div className="text-right">
                        {isPaid ? (
                          <span className="text-[10px] font-black px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                            LUNAS
                          </span>
                        ) : isWaitingConfirmation ? (
                          <span className="text-[10px] font-black px-2.5 py-1 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/40 animate-pulse">
                            VERIFIKASI QRIS
                          </span>
                        ) : (
                          <span className="text-[10px] font-black px-2.5 py-1 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30">
                            BELUM BAYAR
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Item List */}
                    <div className="py-3 space-y-1.5 text-xs">
                      {(order.items || []).map((item, idx) => (
                        <div key={idx} className="flex justify-between items-baseline">
                          <div className="truncate pr-2">
                            <span className="font-black text-amber-400 font-mono">{item.qty}x</span>
                            <span className="ml-1.5 text-stone-200">{item.menu_name}</span>
                            {item.item_notes && (
                              <span className="text-[10px] text-stone-400 italic block ml-5">
                                {item.item_notes}
                              </span>
                            )}
                          </div>
                          <span className="font-mono text-stone-400 shrink-0">{formatRupiah(item.subtotal)}</span>
                        </div>
                      ))}
                      {order.notes && (
                        <p className="text-[11px] text-stone-400 italic pt-1.5 border-t border-[#2D2A26]">
                          Catatan: {order.notes}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="pt-3 border-t border-[#2D2A26] space-y-2.5">
                    <div className="flex justify-between items-baseline text-xs">
                      <span className="text-stone-400 font-medium">Total Tagihan</span>
                      <span className="text-base font-black text-amber-400 font-mono">{formatRupiah(order.total_amount)}</span>
                    </div>

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
                          className="bg-emerald-600 hover:bg-emerald-500 text-white font-black py-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5 transition shadow-2xs active:scale-95"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Terima QRIS</span>
                        </button>
                      ) : isUnpaid ? (
                        <button
                          onClick={() => {
                            setOrderToPay(order);
                            setCashGiven(order.total_amount);
                          }}
                          className="bg-amber-500 hover:bg-amber-400 text-stone-950 font-black py-2.5 rounded-xl text-xs transition active:scale-95 shadow-warm-sm"
                        >
                          Bayar (Settle)
                        </button>
                      ) : (
                        <button
                          disabled={isCompleted}
                          onClick={() => handleCloseOrder(order)}
                          className={`font-black py-2.5 rounded-xl text-xs transition ${
                            isCompleted
                              ? 'bg-stone-900 text-stone-500 cursor-default'
                              : 'bg-stone-800 hover:bg-stone-700 text-white active:scale-95'
                          }`}
                        >
                          {isCompleted ? '✓ Selesai' : 'Tutup Tagihan'}
                        </button>
                      )}

                      <button
                        onClick={() => setSelectedOrderForReceipt(order)}
                        className="border border-[#2D2A26] bg-[#141312] hover:bg-stone-800 text-stone-200 font-bold py-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5 transition active:scale-95"
                      >
                        <Printer className="w-4 h-4" />
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
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-[#1A1816] rounded-3xl max-w-4xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh] border border-[#2D2A26]">
            <div className="px-6 py-4 border-b border-[#2D2A26] flex items-center justify-between">
              <div>
                <h3 className="font-black text-sm text-white uppercase tracking-tight">Order Masuk Kasir (POS Direct)</h3>
                <p className="text-[11px] text-stone-400">Pilih menu dan tentukan jenis pesanan</p>
              </div>
              <button onClick={() => setIsPosModalOpen(false)} className="text-stone-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto grow grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Menu Column */}
              <div className="space-y-3">
                <input
                  type="text"
                  placeholder="Cari menu makanan atau minuman..."
                  value={posSearch}
                  onChange={e => setPosSearch(e.target.value)}
                  className="w-full bg-[#141312] border border-[#2D2A26] rounded-2xl px-4 py-2.5 text-xs text-white placeholder:text-stone-500 focus:outline-hidden focus:border-amber-500"
                />

                <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
                  {menus
                    .filter(m => m.is_available && m.name.toLowerCase().includes(posSearch.toLowerCase()))
                    .map(menu => (
                      <div
                        key={menu.id}
                        onClick={() => addPosItem(menu)}
                        className="p-3 bg-[#141312] hover:bg-stone-800 rounded-2xl border border-[#2D2A26] cursor-pointer flex items-center justify-between transition active:scale-98"
                      >
                        <div className="truncate pr-2">
                          <p className="font-bold text-xs text-white truncate">{menu.name}</p>
                          <p className="text-[11px] text-amber-400 font-mono">{formatRupiah(menu.price)}</p>
                        </div>
                        <Plus className="w-4 h-4 text-stone-400 shrink-0" />
                      </div>
                    ))}
                </div>
              </div>

              {/* Order Ticket Column */}
              <div className="bg-[#141312] rounded-3xl p-5 border border-[#2D2A26] flex flex-col justify-between">
                <div className="space-y-3.5">
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <button
                      type="button"
                      onClick={() => setPosOrderType('dine_in')}
                      className={`py-2 rounded-xl border font-bold transition ${
                        posOrderType === 'dine_in' ? 'bg-amber-500 text-stone-950 border-amber-500' : 'bg-[#1A1816] text-stone-300 border-[#2D2A26]'
                      }`}
                    >
                      Dine-in (Meja)
                    </button>
                    <button
                      type="button"
                      onClick={() => setPosOrderType('takeaway')}
                      className={`py-2 rounded-xl border font-bold transition ${
                        posOrderType === 'takeaway' ? 'bg-amber-500 text-stone-950 border-amber-500' : 'bg-[#1A1816] text-stone-300 border-[#2D2A26]'
                      }`}
                    >
                      Bawa Pulang (Takeaway)
                    </button>
                  </div>

                  {posOrderType === 'dine_in' && (
                    <div>
                      <label className="block text-[11px] font-bold text-stone-400 mb-1">Nomor Meja</label>
                      <select
                        value={posTableNumber}
                        onChange={e => setPosTableNumber(parseInt(e.target.value, 10))}
                        className="w-full bg-[#1A1816] border border-[#2D2A26] rounded-xl px-3 py-2 text-xs text-white font-bold"
                      >
                        {tables.map(t => (
                          <option key={t.table_number} value={t.table_number}>Meja {t.table_number}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div>
                    <label className="block text-[11px] font-bold text-stone-400 mb-1">Nama Pelanggan</label>
                    <input
                      type="text"
                      value={posCustomerName}
                      onChange={e => setPosCustomerName(e.target.value)}
                      className="w-full bg-[#1A1816] border border-[#2D2A26] rounded-xl px-3 py-2 text-xs text-white"
                    />
                  </div>

                  {/* Cart Items in POS */}
                  <div className="space-y-2 border-t border-[#2D2A26] pt-3 max-h-48 overflow-y-auto">
                    {posCart.map(item => (
                      <div key={item.menu_id} className="flex items-center justify-between text-xs">
                        <div className="truncate pr-2">
                          <p className="font-bold text-white truncate">{item.menu_name}</p>
                          <p className="text-[10px] text-stone-400 font-mono">{formatRupiah(item.price)}</p>
                        </div>
                        <div className="flex items-center space-x-1.5 bg-[#1A1816] rounded-full p-1 border border-[#2D2A26]">
                          <button onClick={() => updatePosQty(item.menu_id, -1)} className="w-5 h-5 bg-stone-800 rounded-full flex items-center justify-center text-xs font-bold">
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="w-4 text-center font-bold text-amber-400 font-mono">{item.qty}</span>
                          <button onClick={() => updatePosQty(item.menu_id, 1)} className="w-5 h-5 bg-stone-800 rounded-full flex items-center justify-center text-xs font-bold">
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-4 border-t border-[#2D2A26] space-y-2">
                  <div className="flex justify-between items-baseline text-xs">
                    <span className="text-stone-400 font-medium">Subtotal</span>
                    <span className="text-base font-black text-amber-400 font-mono">
                      {formatRupiah(posCart.reduce((s, i) => s + i.subtotal, 0))}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      disabled={posCart.length === 0}
                      onClick={() => handleCreatePosOrder(false)}
                      className="bg-stone-800 hover:bg-stone-700 text-white font-bold py-2.5 rounded-xl text-xs transition disabled:opacity-50"
                    >
                      Buka Tagihan
                    </button>
                    <button
                      type="button"
                      disabled={posCart.length === 0}
                      onClick={() => handleCreatePosOrder(true)}
                      className="bg-amber-500 hover:bg-amber-400 text-stone-950 font-black py-2.5 rounded-xl text-xs transition shadow-warm-sm disabled:opacity-50"
                    >
                      Bayar Langsung
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
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-[#1A1816] rounded-3xl max-w-md w-full p-6 shadow-2xl border border-[#2D2A26] space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#2D2A26]">
              <div>
                <h3 className="font-black text-sm text-white uppercase tracking-tight">Pelunasan Tagihan</h3>
                <p className="text-[11px] text-stone-400 font-mono">#{orderToPay.order_number} • {orderToPay.customer_name}</p>
              </div>
              <button onClick={() => setOrderToPay(null)} className="text-stone-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Total tagihan */}
            <div className="text-center py-2 bg-[#141312] rounded-2xl border border-[#2D2A26]">
              <span className="text-[10px] text-stone-400 uppercase font-bold tracking-wider">Total Pembayaran</span>
              <p className="text-2xl font-black text-amber-400 font-mono mt-0.5">
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
                    settlementMethod === m ? 'bg-amber-500 text-stone-950 border-amber-500 shadow-warm-sm' : 'bg-[#141312] text-stone-300 border-[#2D2A26]'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>

            {/* Cash given calculation */}
            {settlementMethod === 'Tunai' && (
              <div className="space-y-2 text-xs">
                <label className="block text-[11px] font-bold text-stone-400">Uang Diterima dari Tamu</label>
                <input
                  type="number"
                  value={cashGiven}
                  onChange={e => setCashGiven(parseInt(e.target.value, 10) || 0)}
                  className="w-full bg-[#141312] border border-[#2D2A26] rounded-xl px-3 py-2 text-base font-black text-white font-mono"
                />
                <div className="flex justify-between items-baseline pt-1">
                  <span className="text-stone-400 font-bold">Uang Kembalian:</span>
                  <span className="text-base font-black text-emerald-400 font-mono">
                    {formatRupiah(Math.max(0, cashGiven - orderToPay.total_amount))}
                  </span>
                </div>
              </div>
            )}

            {/* QRIS display in cashier */}
            {settlementMethod === 'QRIS' && (
              <div className="text-center space-y-2">
                <div className="w-48 h-48 mx-auto bg-white p-2 rounded-2xl border border-stone-300">
                  {cashierQrisDataUrl ? (
                    <img src={cashierQrisDataUrl} alt="QRIS" className="w-full h-full object-contain" />
                  ) : (
                    <div className="text-xs text-stone-500 pt-16">Menyiapkan QR...</div>
                  )}
                </div>
                <p className="text-[11px] text-stone-400">Tunjukkan QRIS ke tamu atau minta scan dari layar ini.</p>
              </div>
            )}

            <button
              onClick={async () => {
                await handleUpdateStatus(orderToPay.id, {
                  payment_status: 'paid',
                  payment_method: settlementMethod,
                  cashier_name: activeCashier ? activeCashier.name : 'Kasir'
                });
                setOrderToPay(null);
                loadAll();
              }}
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black py-3 rounded-2xl text-xs uppercase tracking-wider transition shadow-warm-md active:scale-98"
            >
              ✓ Konfirmasi Lunas & Tutup Pembayaran
            </button>
          </div>
        </div>
      )}

      {/* SHIFT Z-REPORT MODAL */}
      {isShiftReportOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-[#1A1816] rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-[#2D2A26] space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#2D2A26]">
              <div className="flex items-center space-x-2">
                <FileText className="w-4 h-4 text-amber-400" />
                <h3 className="font-black text-sm text-white uppercase tracking-tight">Laporan Tutup Shift (Z-Report)</h3>
              </div>
              <button onClick={() => setIsShiftReportOpen(false)} className="text-stone-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-[#141312] p-4 rounded-2xl border border-[#2D2A26] space-y-2 text-xs">
              <div className="flex justify-between text-stone-400">
                <span>Staf Kasir:</span>
                <span className="font-bold text-white">{activeCashier?.name}</span>
              </div>
              <div className="flex justify-between text-stone-400">
                <span>Total Transaksi:</span>
                <span className="font-bold text-white">{orders.filter(o => o.payment_status === 'paid').length} Nota</span>
              </div>
              <div className="flex justify-between text-stone-400 pt-2 border-t border-[#2D2A26]">
                <span>Total Omzet Lunas:</span>
                <span className="font-black text-amber-400 font-mono text-sm">{formatRupiah(totalSalesToday)}</span>
              </div>
            </div>

            <button
              onClick={() => window.print()}
              className="w-full bg-amber-500 hover:bg-amber-400 text-stone-950 font-black py-3 rounded-2xl text-xs uppercase tracking-wider transition shadow-warm-sm flex items-center justify-center gap-2"
            >
              <Printer className="w-4 h-4" />
              <span>Cetak Rekap Kasir</span>
            </button>
          </div>
        </div>
      )}

      {/* Thermal Receipt Print Hidden Element */}
      {selectedOrderForReceipt && (
        <div id="thermalReceipt" className="hidden print:block text-black p-4 text-xs font-mono">
          <div className="text-center pb-2 border-b border-black">
            <h2 className="font-bold text-sm uppercase">{setting?.name || 'RASA NUSANTARA'}</h2>
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
