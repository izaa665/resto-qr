'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { 
  Search, 
  Plus, 
  Minus, 
  ShoppingBag, 
  ArrowRight, 
  X, 
  Check, 
  Clock, 
  MapPin, 
  CreditCard, 
  Banknote, 
  QrCode,
  FileText
} from 'lucide-react';
import { Category, MenuItem, OrderItem, RestaurantTable, Order } from '@/types/database';
import { fetchCategories, fetchMenus, fetchTables, createOrder, fetchOrders } from '@/lib/supabase';
import { formatRupiah } from '@/lib/utils';
import Link from 'next/link';

function CustomerOrderContent() {
  const searchParams = useSearchParams();
  const initialTableParam = parseInt(searchParams.get('meja') || '5', 10);

  const [tableNumber, setTableNumber] = useState<number>(initialTableParam > 0 ? initialTableParam : 5);
  const [categories, setCategories] = useState<Category[]>([]);
  const [menus, setMenus] = useState<MenuItem[]>([]);
  const [tables, setTables] = useState<RestaurantTable[]>([]);
  const [activeCategory, setActiveCategory] = useState<number | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Cart
  const [cart, setCart] = useState<OrderItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isTableModalOpen, setIsTableModalOpen] = useState(false);
  
  // Form Info
  const [customerName, setCustomerName] = useState('Ani');
  const [paymentMethod, setPaymentMethod] = useState<'Tunai' | 'QRIS' | 'Transfer Bank'>('Tunai');
  const [orderNotes, setOrderNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Active Tracking Order
  const [activeOrder, setActiveOrder] = useState<Order | null>(null);

  useEffect(() => {
    async function loadData() {
      const [cats, mns, tbls] = await Promise.all([
        fetchCategories(),
        fetchMenus(),
        fetchTables()
      ]);
      setCategories(cats);
      setMenus(mns);
      setTables(tbls);
    }
    loadData();
  }, []);

  // Poll order status if active
  useEffect(() => {
    if (!activeOrder) return;
    const interval = setInterval(async () => {
      const all = await fetchOrders();
      const updated = all.find(o => o.id === activeOrder.id || o.order_number === activeOrder.order_number);
      if (updated) {
        setActiveOrder(updated);
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [activeOrder]);

  const totalCartQty = cart.reduce((sum, item) => sum + item.qty, 0);
  const totalCartPrice = cart.reduce((sum, item) => sum + item.subtotal, 0);

  const addToCart = (menu: MenuItem) => {
    setCart(prev => {
      const existing = prev.find(item => item.menu_id === menu.id);
      if (existing) {
        return prev.map(item =>
          item.menu_id === menu.id
            ? { ...item, qty: item.qty + 1, subtotal: (item.qty + 1) * item.price }
            : item
        );
      }
      return [
        ...prev,
        {
          menu_id: menu.id,
          menu_name: menu.name,
          price: menu.price,
          qty: 1,
          subtotal: menu.price,
          item_notes: '',
          image: menu.image
        }
      ];
    });
  };

  const updateItemQty = (menuId: number, delta: number) => {
    setCart(prev =>
      prev
        .map(item => {
          if (item.menu_id === menuId) {
            const newQty = item.qty + delta;
            return { ...item, qty: newQty, subtotal: newQty * item.price };
          }
          return item;
        })
        .filter(item => item.qty > 0)
    );
  };

  const updateItemNote = (menuId: number, note: string) => {
    setCart(prev =>
      prev.map(item => (item.menu_id === menuId ? { ...item, item_notes: note } : item))
    );
  };

  const handleSubmitOrder = async () => {
    if (!customerName.trim()) {
      alert('Silakan isi nama pemesan');
      return;
    }
    if (cart.length === 0) return;

    setIsSubmitting(true);
    try {
      const result = await createOrder({
        order_type: 'dine_in',
        table_number: tableNumber,
        customer_name: customerName.trim(),
        total_amount: totalCartPrice,
        payment_method: paymentMethod,
        payment_status: 'unpaid',
        order_status: 'pending',
        notes: orderNotes,
        items: cart
      });

      if (result.success && result.order) {
        setActiveOrder(result.order);
        setCart([]);
        setIsCartOpen(false);
      } else {
        alert(result.error || 'Gagal mengirim pesanan');
      }
    } catch (e) {
      console.error(e);
      alert('Terjadi kesalahan jaringan');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredMenus = menus.filter(m => {
    if (!m.is_available) return false;
    const matchCat = activeCategory === 'all' || m.category_id === activeCategory;
    const matchSearch =
      m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.description?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchCat && matchSearch;
  });

  return (
    <div className="bg-neutral-50 min-h-screen text-neutral-900 pb-28 selection:bg-neutral-900 selection:text-white">
      
      {/* Top Header */}
      <header className="sticky top-0 z-30 bg-white border-b border-neutral-200 px-4 py-3">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <div>
            <span className="text-[10px] uppercase font-bold tracking-widest text-neutral-400 block">
              Dine-In Order
            </span>
            <h1 className="text-base font-bold tracking-tight text-neutral-950">
              Rasa Nusantara
            </h1>
          </div>

          <button
            onClick={() => setIsTableModalOpen(true)}
            className="flex items-center space-x-1.5 bg-neutral-100 hover:bg-neutral-200 border border-neutral-200 text-neutral-900 px-3 py-1.5 rounded-lg text-xs font-semibold transition"
          >
            <MapPin className="w-3.5 h-3.5 text-neutral-500" />
            <span>Meja {tableNumber}</span>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-md mx-auto px-4 pt-4">

        {/* Active Order Tracker */}
        {activeOrder && (
          <div className="bg-white rounded-xl border border-neutral-200 p-4 mb-4 shadow-sm">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
              <div>
                <p className="text-[11px] uppercase tracking-wider font-semibold text-neutral-400">Status Pesanan</p>
                <p className="font-mono text-xs font-bold text-neutral-900 mt-0.5">{activeOrder.order_number}</p>
              </div>
              <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-md border ${
                activeOrder.payment_status === 'paid'
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-amber-50 text-amber-700 border-amber-200'
              }`}>
                {activeOrder.payment_status === 'paid' ? 'Lunas' : 'Bayar ke Kasir'}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 pt-3">
              <div className={`p-2 rounded-lg text-center border text-[11px] ${
                activeOrder.order_status === 'pending'
                  ? 'bg-neutral-900 text-white border-neutral-900 font-semibold'
                  : 'bg-neutral-50 text-neutral-500 border-neutral-200'
              }`}>
                Diterima
              </div>
              <div className={`p-2 rounded-lg text-center border text-[11px] ${
                activeOrder.order_status === 'processing'
                  ? 'bg-neutral-900 text-white border-neutral-900 font-semibold'
                  : 'bg-neutral-50 text-neutral-500 border-neutral-200'
              }`}>
                Dimasak
              </div>
              <div className={`p-2 rounded-lg text-center border text-[11px] ${
                activeOrder.order_status === 'ready' || activeOrder.order_status === 'completed'
                  ? 'bg-emerald-700 text-white border-emerald-700 font-semibold'
                  : 'bg-neutral-50 text-neutral-500 border-neutral-200'
              }`}>
                Siap Saji
              </div>
            </div>
          </div>
        )}

        {/* Search */}
        <div className="relative mb-3">
          <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Cari menu makanan atau minuman..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white border border-neutral-200 rounded-xl pl-9 pr-4 py-2.5 text-xs text-neutral-900 placeholder:text-neutral-400 focus:outline-hidden focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900 transition"
          />
        </div>

        {/* Category Pills */}
        <div className="flex space-x-1.5 overflow-x-auto no-scrollbar pb-3 mb-3 -mx-4 px-4">
          <button
            onClick={() => setActiveCategory('all')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition border ${
              activeCategory === 'all'
                ? 'bg-neutral-950 text-white border-neutral-950'
                : 'bg-white text-neutral-600 border-neutral-200 hover:border-neutral-300'
            }`}
          >
            Semua
          </button>
          {categories.map(cat => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition border ${
                activeCategory === cat.id
                  ? 'bg-neutral-950 text-white border-neutral-950'
                  : 'bg-white text-neutral-600 border-neutral-200 hover:border-neutral-300'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>

        {/* Menu Items */}
        <div className="space-y-2.5">
          {filteredMenus.map(menu => {
            const inCart = cart.find(c => c.menu_id === menu.id);
            return (
              <div
                key={menu.id}
                className="bg-white rounded-xl p-3 border border-neutral-200 flex gap-3 items-center justify-between transition hover:border-neutral-300"
              >
                <div className="flex items-center space-x-3 grow min-w-0">
                  <img
                    src={menu.image}
                    alt={menu.name}
                    className="w-16 h-16 rounded-lg object-cover shrink-0 bg-neutral-100"
                  />
                  <div className="min-w-0 grow pr-2">
                    <h3 className="font-semibold text-xs text-neutral-950 truncate">{menu.name}</h3>
                    <p className="text-[11px] text-neutral-500 line-clamp-1 mt-0.5">{menu.description}</p>
                    <p className="text-xs font-bold text-neutral-900 mt-1">{formatRupiah(menu.price)}</p>
                  </div>
                </div>

                <div className="shrink-0">
                  {inCart ? (
                    <div className="flex items-center space-x-1.5 bg-neutral-100 rounded-lg p-1 border border-neutral-200">
                      <button
                        onClick={() => updateItemQty(menu.id, -1)}
                        className="w-6 h-6 rounded bg-white text-neutral-700 flex items-center justify-center font-bold text-xs hover:bg-neutral-200"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="w-4 text-center text-xs font-bold text-neutral-900">
                        {inCart.qty}
                      </span>
                      <button
                        onClick={() => updateItemQty(menu.id, 1)}
                        className="w-6 h-6 rounded bg-white text-neutral-700 flex items-center justify-center font-bold text-xs hover:bg-neutral-200"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => addToCart(menu)}
                      className="bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center space-x-1 transition"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Tambah</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer Navigation */}
        <div className="mt-8 text-center text-xs text-neutral-400 space-x-3 border-t border-neutral-200 pt-4">
          <Link href="/kasir" className="hover:text-neutral-900 font-medium">
            Kasir POS
          </Link>
          <span>•</span>
          <Link href="/dapur" className="hover:text-neutral-900 font-medium">
            Layar Dapur
          </Link>
          <span>•</span>
          <Link href="/admin" className="hover:text-neutral-900 font-medium">
            Admin
          </Link>
        </div>

      </main>

      {/* Floating Bottom Cart Bar */}
      {totalCartQty > 0 && (
        <div className="fixed bottom-3 inset-x-0 max-w-md mx-auto px-4 z-40">
          <button
            onClick={() => setIsCartOpen(true)}
            className="w-full bg-neutral-950 text-white p-3.5 rounded-xl shadow-lg flex items-center justify-between hover:bg-neutral-900 transition"
          >
            <div className="flex items-center space-x-2.5">
              <span className="w-6 h-6 rounded-md bg-neutral-800 text-xs font-bold flex items-center justify-center">
                {totalCartQty}
              </span>
              <span className="text-xs font-semibold">Lihat Pesanan</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-xs font-bold">{formatRupiah(totalCartPrice)}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </div>
          </button>
        </div>
      )}

      {/* Cart Drawer */}
      {isCartOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-end justify-center">
          <div className="w-full max-w-md bg-white rounded-t-2xl max-h-[85vh] flex flex-col shadow-xl">
            <div className="px-4 py-3.5 border-b border-neutral-200 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-neutral-950 text-sm">Pesanan Meja {tableNumber}</h3>
                <p className="text-[11px] text-neutral-500">{totalCartQty} item dipilih</p>
              </div>
              <button
                onClick={() => setIsCartOpen(false)}
                className="w-7 h-7 rounded-full bg-neutral-100 flex items-center justify-center text-neutral-500 hover:text-neutral-900"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto grow space-y-3">
              {cart.map(item => (
                <div key={item.menu_id} className="border-b border-neutral-100 pb-3 last:border-b-0 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-semibold text-neutral-900">{item.menu_name}</h4>
                      <p className="text-[11px] text-neutral-500">{formatRupiah(item.price)}</p>
                    </div>
                    <div className="flex items-center space-x-2 bg-neutral-100 rounded-lg p-1 border border-neutral-200">
                      <button onClick={() => updateItemQty(item.menu_id, -1)} className="w-5 h-5 bg-white rounded flex items-center justify-center text-xs">
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="w-4 text-center text-xs font-bold">{item.qty}</span>
                      <button onClick={() => updateItemQty(item.menu_id, 1)} className="w-5 h-5 bg-white rounded flex items-center justify-center text-xs">
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                  <input
                    type="text"
                    placeholder="Catatan (misal: pedas sedang, es dipisah...)"
                    value={item.item_notes || ''}
                    onChange={e => updateItemNote(item.menu_id, e.target.value)}
                    className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-2.5 py-1 text-xs text-neutral-800 placeholder:text-neutral-400 focus:outline-hidden focus:border-neutral-900"
                  />
                </div>
              ))}

              <div className="bg-neutral-50 p-3 rounded-xl border border-neutral-200 space-y-2.5 text-xs">
                <div>
                  <label className="block text-[11px] font-semibold text-neutral-600 mb-1">Nama Pemesan</label>
                  <input
                    type="text"
                    value={customerName}
                    onChange={e => setCustomerName(e.target.value)}
                    className="w-full bg-white border border-neutral-200 rounded-lg px-3 py-1.5 text-xs font-semibold text-neutral-900 focus:outline-hidden focus:border-neutral-900"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-neutral-600 mb-1">Catatan Tambahan untuk Dapur</label>
                  <input
                    type="text"
                    placeholder="Contoh: Sambal dipisah, tisu lebih"
                    value={orderNotes}
                    onChange={e => setOrderNotes(e.target.value)}
                    className="w-full bg-white border border-neutral-200 rounded-lg px-3 py-1.5 text-xs text-neutral-900 focus:outline-hidden focus:border-neutral-900"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-neutral-600 mb-1.5">Metode Pembayaran</label>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('Tunai')}
                    className={`py-2 px-3 rounded-lg border text-left transition ${
                      paymentMethod === 'Tunai'
                        ? 'border-neutral-900 bg-neutral-900 text-white font-semibold'
                        : 'border-neutral-200 bg-white text-neutral-700'
                    }`}
                  >
                    Bayar di Kasir
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('QRIS')}
                    className={`py-2 px-3 rounded-lg border text-left transition ${
                      paymentMethod === 'QRIS'
                        ? 'border-neutral-900 bg-neutral-900 text-white font-semibold'
                        : 'border-neutral-200 bg-white text-neutral-700'
                    }`}
                  >
                    QRIS
                  </button>
                </div>
              </div>

              <div className="pt-2 border-t border-neutral-200 flex justify-between items-baseline text-xs">
                <span className="font-semibold text-neutral-600">Total Pembayaran</span>
                <span className="text-sm font-bold text-neutral-950">{formatRupiah(totalCartPrice)}</span>
              </div>
            </div>

            <div className="p-4 border-t border-neutral-200 bg-white">
              <button
                disabled={isSubmitting}
                onClick={handleSubmitOrder}
                className="w-full bg-neutral-950 hover:bg-neutral-900 text-white py-3 rounded-xl text-xs font-semibold transition disabled:opacity-50"
              >
                {isSubmitting ? 'Mengirim Pesanan...' : 'Kirim Pesanan ke Dapur'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Table Selector Modal */}
      {isTableModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white rounded-2xl p-4 shadow-lg border border-neutral-200">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-bold text-xs uppercase tracking-wider text-neutral-900">Pilih Nomor Meja</h3>
              <button onClick={() => setIsTableModalOpen(false)} className="text-neutral-400 hover:text-neutral-900">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-5 gap-2">
              {tables.map(tbl => (
                <button
                  key={tbl.table_number}
                  onClick={() => {
                    setTableNumber(tbl.table_number);
                    setIsTableModalOpen(false);
                  }}
                  className={`py-2.5 rounded-lg border text-xs font-semibold transition ${
                    tableNumber === tbl.table_number
                      ? 'border-neutral-950 bg-neutral-950 text-white'
                      : 'border-neutral-200 bg-white text-neutral-700 hover:border-neutral-300'
                  }`}
                >
                  {tbl.table_number}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default function CustomerOrderPage() {
  return (
    <Suspense fallback={<div className="p-8 text-xs font-semibold text-neutral-400">Memuat menu...</div>}>
      <CustomerOrderContent />
    </Suspense>
  );
}
