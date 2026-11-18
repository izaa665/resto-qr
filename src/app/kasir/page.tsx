'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
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
  X
} from 'lucide-react';
import { Order, MenuItem, RestaurantTable, OrderItem, PaymentStatus, OrderStatus } from '@/types/database';
import { 
  fetchOrders, 
  updateOrderStatus, 
  fetchMenus, 
  fetchTables, 
  createOrder, 
  isSupabaseConfigured, 
  supabase 
} from '@/lib/supabase';
import { formatRupiah, playCashierChime } from '@/lib/utils';

export default function CashierPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [menus, setMenus] = useState<MenuItem[]>([]);
  const [tables, setTables] = useState<RestaurantTable[]>([]);
  const [filter, setFilter] = useState<'active' | 'unpaid' | 'paid' | 'all'>('active');
  const [selectedOrderForReceipt, setSelectedOrderForReceipt] = useState<Order | null>(null);
  const [currentTime, setCurrentTime] = useState('');
  const [previousPendingCount, setPreviousPendingCount] = useState<number>(0);

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

  // Digital Clock
  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString('id-ID', { hour12: false }));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const loadAll = async () => {
    const [ord, mn, tbl] = await Promise.all([
      fetchOrders(),
      fetchMenus(),
      fetchTables()
    ]);
    setOrders(ord);
    setMenus(mn);
    setTables(tbl);

    const pendingCount = ord.filter(o => o.order_status === 'pending').length;
    if (pendingCount > previousPendingCount && previousPendingCount >= 0) {
      playCashierChime();
    }
    setPreviousPendingCount(pendingCount);
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
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    } else {
      const interval = setInterval(loadAll, 3500);
      return () => clearInterval(interval);
    }
  }, [previousPendingCount]);

  const handleUpdateStatus = async (
    orderId: number,
    updates: { order_status?: OrderStatus; payment_status?: PaymentStatus }
  ) => {
    await updateOrderStatus(orderId, { ...updates, changed_by: 'Kasir' });
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

  const filteredOrders = orders.filter(o => {
    if (filter === 'active') return o.order_status !== 'completed' && o.order_status !== 'cancelled';
    if (filter === 'unpaid') return o.payment_status === 'unpaid';
    if (filter === 'paid') return o.payment_status === 'paid';
    return true;
  });

  const unpaidCount = orders.filter(o => o.payment_status === 'unpaid').length;
  const activeOrdersCount = orders.filter(o => o.order_status !== 'completed' && o.order_status !== 'cancelled').length;
  const totalSalesToday = orders.filter(o => o.payment_status === 'paid').reduce((s, o) => s + o.total_amount, 0);

  return (
    <div className="bg-neutral-100 min-h-screen text-neutral-900 font-sans selection:bg-neutral-900 selection:text-white">
      
      {/* POS Top Header */}
      <header className="bg-white border-b border-neutral-200 sticky top-0 z-30 px-4 sm:px-6 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Link href="/" className="w-8 h-8 rounded-lg bg-neutral-100 hover:bg-neutral-200 flex items-center justify-center text-neutral-600 transition">
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="font-bold text-sm tracking-tight text-neutral-950 uppercase">
                  Point of Sale (POS)
                </h1>
                <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                  Kasir 1
                </span>
              </div>
              <p className="text-[11px] text-neutral-500">Rasa Nusantara Dining</p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => setIsPosModalOpen(true)}
              className="bg-neutral-950 hover:bg-neutral-900 text-white px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Input Pesanan Baru</span>
            </button>

            <Link
              href="/dapur"
              className="bg-neutral-100 hover:bg-neutral-200 text-neutral-800 px-3 py-1.5 rounded-lg text-xs font-semibold transition"
            >
              Layar Dapur
            </Link>

            <Link
              href="/admin"
              className="bg-neutral-100 hover:bg-neutral-200 text-neutral-800 px-3 py-1.5 rounded-lg text-xs font-semibold transition"
            >
              Backoffice
            </Link>

            <div className="text-right pl-3 border-l border-neutral-200 hidden sm:block">
              <span className="font-mono text-xs font-bold text-neutral-800">{currentTime || '--:--:--'}</span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-4">

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
          <div className="flex items-center space-x-1">
            <button
              onClick={() => setFilter('active')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                filter === 'active' ? 'bg-neutral-950 text-white' : 'text-neutral-600 hover:bg-neutral-100'
              }`}
            >
              Pesanan Aktif ({activeOrdersCount})
            </button>
            <button
              onClick={() => setFilter('unpaid')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                filter === 'unpaid' ? 'bg-neutral-950 text-white' : 'text-neutral-600 hover:bg-neutral-100'
              }`}
            >
              Belum Bayar ({unpaidCount})
            </button>
            <button
              onClick={() => setFilter('paid')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                filter === 'paid' ? 'bg-neutral-950 text-white' : 'text-neutral-600 hover:bg-neutral-100'
              }`}
            >
              Sudah Lunas
            </button>
            <button
              onClick={() => setFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                filter === 'all' ? 'bg-neutral-950 text-white' : 'text-neutral-600 hover:bg-neutral-100'
              }`}
            >
              Semua
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

        {/* Orders Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {filteredOrders.map(order => {
            const isUnpaid = order.payment_status === 'unpaid';
            const isCompleted = order.order_status === 'completed';

            return (
              <div
                key={order.id}
                className="bg-white rounded-xl border border-neutral-200 p-4 flex flex-col justify-between hover:border-neutral-300 transition"
              >
                <div>
                  <div className="flex items-start justify-between pb-2.5 border-b border-neutral-100">
                    <div>
                      <div className="flex items-center space-x-1.5">
                        <span className="font-bold text-xs uppercase text-neutral-950">
                          {order.order_type === 'takeaway' ? 'Takeaway' : `Meja ${order.table_number}`}
                        </span>
                        <span className="text-xs font-mono text-neutral-400">#{order.order_number.slice(-3)}</span>
                      </div>
                      <p className="text-xs text-neutral-500 mt-0.5">{order.customer_name}</p>
                    </div>

                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${
                      order.payment_status === 'paid'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-amber-50 text-amber-700 border-amber-200'
                    }`}>
                      {order.payment_status === 'paid' ? 'LUNAS' : 'BELUM BAYAR'}
                    </span>
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
                  </div>
                </div>

                <div className="pt-2.5 border-t border-neutral-100">
                  <div className="flex justify-between items-baseline mb-3 text-xs">
                    <span className="text-neutral-500 font-medium">Tagihan</span>
                    <span className="text-sm font-bold text-neutral-950">{formatRupiah(order.total_amount)}</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    {isUnpaid ? (
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
                      <button
                        disabled={isCompleted}
                        onClick={() => handleUpdateStatus(order.id, { order_status: 'completed' })}
                        className="bg-neutral-100 hover:bg-neutral-200 text-neutral-800 disabled:opacity-50 font-semibold py-2 rounded-lg text-xs transition"
                      >
                        {isCompleted ? 'Selesai' : 'Tutup Tagihan'}
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

            <div className="bg-neutral-50 p-3 rounded-xl border border-neutral-200 mb-3 space-y-2.5 text-xs">
              <div className="flex justify-between font-bold text-sm">
                <span>Total Tagihan:</span>
                <span className="text-neutral-950">{formatRupiah(orderToPay.total_amount)}</span>
              </div>

              <div>
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
                    {[orderToPay.total_amount, 50000, 100000].map(amt => (
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
                    <span className={cashGiven >= orderToPay.total_amount ? 'text-emerald-700' : 'text-neutral-500'}>
                      {formatRupiah(Math.max(0, cashGiven - orderToPay.total_amount))}
                    </span>
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <button
                onClick={async () => {
                  await handleUpdateStatus(orderToPay.id, { payment_status: 'paid' });
                  setSelectedOrderForReceipt({ ...orderToPay, payment_status: 'paid', payment_method: settlementMethod });
                  setOrderToPay(null);
                }}
                className="grow bg-neutral-950 hover:bg-neutral-900 text-white font-semibold py-2 rounded-lg text-xs transition"
              >
                Konfirmasi & Cetak Struk
              </button>
              <button onClick={() => setOrderToPay(null)} className="px-3.5 bg-neutral-100 text-neutral-700 font-semibold py-2 rounded-lg text-xs">
                Batal
              </button>
            </div>
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
                  <h2 className="font-bold text-xs uppercase tracking-wider">RASA NUSANTARA</h2>
                  <p className="text-[10px] text-neutral-500 mt-0.5">Jl. Kuliner No. 88, Jakarta</p>
                </div>

                <div className="py-2 border-b border-dashed border-neutral-300 space-y-0.5 text-[10px]">
                  <div className="flex justify-between">
                    <span>No: {selectedOrderForReceipt.order_number}</span>
                    <span>{new Date(selectedOrderForReceipt.created_at).toLocaleDateString('id-ID')}</span>
                  </div>
                  <div className="flex justify-between font-bold">
                    <span>{selectedOrderForReceipt.order_type === 'takeaway' ? 'TAKEAWAY' : `MEJA ${selectedOrderForReceipt.table_number}`}</span>
                    <span>Kasir 1</span>
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
                  <div className="flex justify-between font-bold text-xs">
                    <span>TOTAL:</span>
                    <span>{formatRupiah(selectedOrderForReceipt.total_amount)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Metode: {selectedOrderForReceipt.payment_method}</span>
                    <span className="font-bold">LUNAS</span>
                  </div>
                </div>

                <div className="text-center pt-2 text-[9px] text-neutral-500 space-y-0.5">
                  <p>Terima kasih atas kunjungan Anda</p>
                  <p>WiFi: nusantara88</p>
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

    </div>
  );
}
