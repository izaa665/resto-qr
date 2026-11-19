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
  QrCode,
  ShieldCheck,
  CheckCircle2,
  Copy,
  RefreshCw,
  AlertTriangle,
  Timer
} from 'lucide-react';
import QRCode from 'qrcode';
import { Category, MenuItem, OrderItem, RestaurantTable, Order } from '@/types/database';
import { 
  fetchCategories, 
  fetchMenus, 
  fetchTables, 
  createOrder, 
  fetchOrders, 
  updateOrderStatus,
  supabase,
  isSupabaseConfigured
} from '@/lib/supabase';
import { formatRupiah } from '@/lib/utils';

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
  const [paymentMethod, setPaymentMethod] = useState<'Tunai' | 'QRIS' | 'Transfer Bank'>('QRIS');
  const [orderNotes, setOrderNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Active Tracking Order & Dynamic Timed QRIS Modal
  const [activeOrder, setActiveOrder] = useState<Order | null>(null);
  const [isQrisModalOpen, setIsQrisModalOpen] = useState(false);
  const [qrisDataUrl, setQrisDataUrl] = useState<string>('');
  const [qrisTimeLeft, setQrisTimeLeft] = useState<number>(300); // 300 detik = 5 menit
  const [isQrisExpired, setIsQrisExpired] = useState<boolean>(false);
  const [qrisVersion, setQrisVersion] = useState<number>(1);

  // QRIS Countdown Timer
  useEffect(() => {
    if (!isQrisModalOpen || isQrisExpired) return;

    const interval = setInterval(() => {
      setQrisTimeLeft(prev => {
        if (prev <= 1) {
          setIsQrisExpired(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isQrisModalOpen, isQrisExpired]);

  const handleRegenerateQris = () => {
    setQrisTimeLeft(300);
    setIsQrisExpired(false);
    setQrisVersion(prev => prev + 1);
  };

  const handleOpenQrisModal = () => {
    if (isQrisExpired || qrisTimeLeft <= 0) {
      handleRegenerateQris();
    }
    setIsQrisModalOpen(true);
  };

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

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

  // Restore active order from localStorage on mount
  useEffect(() => {
    try {
      const savedOrderId = localStorage.getItem('resto_active_order_id');
      if (savedOrderId) {
        fetchOrders().then(all => {
          const found = all.find(o => String(o.id) === savedOrderId);
          if (found && found.order_status !== 'completed' && found.order_status !== 'cancelled') {
            setActiveOrder(found);
          } else {
            localStorage.removeItem('resto_active_order_id');
          }
        });
      }
    } catch (e) {}
  }, []);

  // Supabase Realtime & Polling for activeOrder
  useEffect(() => {
    if (!activeOrder) return;

    if (isSupabaseConfigured && supabase) {
      const channel = supabase
        .channel(`order-track-${activeOrder.id}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'orders',
            filter: `id=eq.${activeOrder.id}`
          },
          (payload: any) => {
            if (payload.new) {
              setActiveOrder(prev => (prev ? { ...prev, ...payload.new } : payload.new));
            }
          }
        )
        .subscribe();

      const pollInterval = setInterval(async () => {
        const all = await fetchOrders();
        const updated = all.find(o => o.id === activeOrder.id || o.order_number === activeOrder.order_number);
        if (updated) {
          setActiveOrder(updated);
        }
      }, 4000);

      return () => {
        supabase.removeChannel(channel);
        clearInterval(pollInterval);
      };
    } else {
      const interval = setInterval(async () => {
        const all = await fetchOrders();
        const updated = all.find(o => o.id === activeOrder.id || o.order_number === activeOrder.order_number);
        if (updated) {
          setActiveOrder(updated);
        }
      }, 2500);
      return () => clearInterval(interval);
    }
  }, [activeOrder?.id]);

  // Generate QRIS Data URL when activeOrder or QRIS opens (dynamic per version)
  useEffect(() => {
    if (!activeOrder) return;
    const dynamicSalt = `${Date.now().toString().slice(-4)}${qrisVersion}`;
    const qrisPayload = `00020101021226670014ID.GO.QRIS.WWW01189360052300000000000215ID1020261118001520458125303360540${activeOrder.total_amount}5802ID5913RASA NUSANTARA6007JAKARTA62070703A016304${activeOrder.order_number}-${dynamicSalt}`;
    
    QRCode.toDataURL(qrisPayload, {
      width: 280,
      margin: 1,
      color: {
        dark: '#0a0a0a',
        light: '#ffffff',
      },
    }).then(url => {
      setQrisDataUrl(url);
    }).catch(err => console.error(err));
  }, [activeOrder, qrisVersion]);

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
        try {
          localStorage.setItem('resto_active_order_id', String(result.order.id));
        } catch (e) {}
        setCart([]);
        setIsCartOpen(false);

        // Jika metode pembayaran QRIS, langsung jalankan timer 5 menit dan buka modal
        if (paymentMethod === 'QRIS') {
          handleRegenerateQris();
          setIsQrisModalOpen(true);
        }
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

  const handleConfirmQrisPaid = async () => {
    if (!activeOrder) return;
    await updateOrderStatus(activeOrder.id, { 
      payment_status: 'waiting_confirmation', 
      changed_by: 'Pelanggan QRIS' 
    });
    setActiveOrder(prev => prev ? { ...prev, payment_status: 'waiting_confirmation' } : null);
    setIsQrisModalOpen(false);
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
              <div className="text-right">
                {activeOrder.payment_status === 'paid' ? (
                  <span className="text-[11px] font-semibold px-2.5 py-1 rounded-md border bg-emerald-50 text-emerald-700 border-emerald-200 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Lunas ({activeOrder.payment_method || 'Kasir'})</span>
                  </span>
                ) : activeOrder.payment_status === 'waiting_confirmation' ? (
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md border bg-blue-50 text-blue-700 border-blue-200 flex items-center gap-1.5 animate-pulse">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-600"></span>
                    <span>Menunggu Verifikasi Kasir</span>
                  </span>
                ) : (
                  <button
                    onClick={handleOpenQrisModal}
                    className="text-[11px] font-bold px-3 py-1.5 rounded-lg bg-neutral-950 text-white flex items-center gap-1.5 hover:bg-neutral-800 transition shadow-sm"
                  >
                    <QrCode className="w-3.5 h-3.5 text-amber-400" />
                    <span>Bayar QRIS ({isQrisExpired ? 'Expired' : formatTimer(qrisTimeLeft)})</span>
                  </button>
                )}
              </div>
            </div>

            {/* Stepper Status */}
            <div className="grid grid-cols-3 gap-2 pt-3">
              <div className={`p-2 rounded-lg text-center border text-[11px] ${
                activeOrder.order_status === 'pending'
                  ? 'bg-neutral-900 text-white border-neutral-900 font-semibold shadow-xs'
                  : 'bg-neutral-50 text-neutral-500 border-neutral-200'
              }`}>
                1. Diterima
              </div>
              <div className={`p-2 rounded-lg text-center border text-[11px] ${
                activeOrder.order_status === 'processing'
                  ? 'bg-blue-600 text-white border-blue-600 font-semibold shadow-xs'
                  : 'bg-neutral-50 text-neutral-500 border-neutral-200'
              }`}>
                2. Dimasak
              </div>
              <div className={`p-2 rounded-lg text-center border text-[11px] ${
                activeOrder.order_status === 'ready' || activeOrder.order_status === 'completed'
                  ? 'bg-emerald-600 text-white border-emerald-600 font-semibold shadow-xs'
                  : 'bg-neutral-50 text-neutral-500 border-neutral-200'
              }`}>
                3. Siap Saji
              </div>
            </div>

            {/* If Order is completed */}
            {activeOrder.order_status === 'completed' && (
              <div className="mt-3 pt-3 border-t border-neutral-100 flex items-center justify-between">
                <span className="text-xs text-emerald-700 font-semibold">✓ Pesanan Anda telah selesai disajikan.</span>
                <button
                  onClick={() => {
                    setActiveOrder(null);
                    try { localStorage.removeItem('resto_active_order_id'); } catch (e) {}
                  }}
                  className="text-[11px] font-bold bg-neutral-950 hover:bg-neutral-800 text-white px-3 py-1.5 rounded-lg transition"
                >
                  Pesan Lagi
                </button>
              </div>
            )}
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

        {/* Restaurant Footer Info */}
        <div className="mt-10 text-center text-[11px] text-neutral-400 border-t border-neutral-200 pt-6 pb-2">
          <p className="font-semibold text-neutral-600">Rasa Nusantara Resto & Dining</p>
          <p className="mt-0.5">Pesanan Anda akan disajikan langsung ke Meja {tableNumber}</p>
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
                    onClick={() => setPaymentMethod('QRIS')}
                    className={`py-2 px-3 rounded-lg border text-left transition ${
                      paymentMethod === 'QRIS'
                        ? 'border-neutral-900 bg-neutral-900 text-white font-semibold'
                        : 'border-neutral-200 bg-white text-neutral-700'
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <QrCode className="w-3.5 h-3.5" />
                      <span>QRIS Instan</span>
                    </div>
                    <span className="text-[10px] opacity-75 block mt-0.5">Langsung Scan QR</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod('Tunai')}
                    className={`py-2 px-3 rounded-lg border text-left transition ${
                      paymentMethod === 'Tunai'
                        ? 'border-neutral-900 bg-neutral-900 text-white font-semibold'
                        : 'border-neutral-200 bg-white text-neutral-700'
                    }`}
                  >
                    <span>Bayar di Kasir</span>
                    <span className="text-[10px] opacity-75 block mt-0.5">Selesai Makan</span>
                  </button>
                </div>
                {paymentMethod === 'QRIS' && (
                  <p className="text-[11px] text-amber-800 bg-amber-50 p-2.5 rounded-xl border border-amber-200 mt-2 font-medium">
                    ⚡ Kode QRIS Dinamis berwaktu (5 menit) akan otomatis muncul di layar setelah Anda membuat pesanan.
                  </p>
                )}
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
                {isSubmitting 
                  ? 'Membuat Pesanan...' 
                  : paymentMethod === 'QRIS' 
                  ? 'Buat Pesanan & Bayar QRIS (5 Menit)' 
                  : 'Kirim Pesanan ke Dapur'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* POP-UP MODAL QRIS PEMBAYARAN BERWAKTU (DYNAMIC TIMED QRIS) */}
      {isQrisModalOpen && activeOrder && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full shadow-2xl overflow-hidden border border-neutral-200 flex flex-col">
            
            {/* Header QRIS Resmi */}
            <div className="p-4 bg-neutral-950 text-white flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 bg-red-600 rounded-lg flex items-center justify-center font-bold text-xs text-white tracking-tighter shadow-sm">
                  QRIS
                </div>
                <div>
                  <h3 className="font-bold text-xs uppercase tracking-wider text-white">Pembayaran QRIS</h3>
                  <p className="text-[10px] text-neutral-400">Standar Pembayaran Nasional (NMID: ID1020261118001)</p>
                </div>
              </div>
              <button 
                onClick={() => setIsQrisModalOpen(false)} 
                className="text-neutral-400 hover:text-white p-1 rounded-lg hover:bg-neutral-800 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Countdown Timer Header Bar */}
            <div className={`px-4 py-2.5 border-b text-xs flex items-center justify-between transition ${
              isQrisExpired 
                ? 'bg-rose-50 border-rose-200 text-rose-700' 
                : qrisTimeLeft <= 60 
                ? 'bg-amber-50 border-amber-200 text-amber-800' 
                : 'bg-neutral-50 border-neutral-200 text-neutral-700'
            }`}>
              <div className="flex items-center gap-1.5 font-semibold">
                <Clock className={`w-3.5 h-3.5 ${isQrisExpired ? 'text-rose-600 animate-pulse' : 'text-amber-500'}`} />
                <span>{isQrisExpired ? 'QRIS Kedaluwarsa' : 'Selesaikan Pembayaran:'}</span>
              </div>
              <span className={`font-mono text-sm font-black px-2 py-0.5 rounded-md ${
                isQrisExpired 
                  ? 'bg-rose-200/60 text-rose-800' 
                  : qrisTimeLeft <= 60
                  ? 'bg-amber-200/80 text-amber-900 animate-pulse'
                  : 'bg-neutral-200 text-neutral-900'
              }`}>
                {isQrisExpired ? '00:00' : formatTimer(qrisTimeLeft)}
              </span>
            </div>

            {/* Visual Progress Bar Timer */}
            {!isQrisExpired && (
              <div className="w-full bg-neutral-100 h-1">
                <div 
                  className={`h-1 transition-all duration-1000 ${
                    qrisTimeLeft <= 60 ? 'bg-rose-500' : 'bg-amber-500'
                  }`}
                  style={{ width: `${Math.max(0, Math.min(100, (qrisTimeLeft / 300) * 100))}%` }}
                />
              </div>
            )}

            {/* Body QRIS Card */}
            <div className="p-5 flex flex-col items-center text-center space-y-3 bg-neutral-50/50">
              
              {/* QR Image Container with Expired Overlay */}
              <div className="relative bg-white p-3 rounded-2xl border border-neutral-200 shadow-sm inline-block overflow-hidden">
                {qrisDataUrl ? (
                  <img 
                    src={qrisDataUrl} 
                    alt="QRIS Code Dinamis" 
                    className={`w-48 h-48 mx-auto transition ${isQrisExpired ? 'filter blur-[3px] opacity-40' : ''}`} 
                  />
                ) : (
                  <div className="w-48 h-48 flex items-center justify-center text-xs text-neutral-400">
                    Memuat QRIS...
                  </div>
                )}

                {/* Expired Overlay when Timer hits 0 */}
                {isQrisExpired && (
                  <div className="absolute inset-0 bg-neutral-950/70 backdrop-blur-xs flex flex-col items-center justify-center p-3 text-white text-center space-y-2">
                    <AlertTriangle className="w-8 h-8 text-rose-400 mx-auto" />
                    <p className="font-bold text-xs">QRIS KEDALUWARSA</p>
                    <p className="text-[10px] text-neutral-300 leading-tight">Waktu pembayaran 5 menit telah habis demi keamanan.</p>
                    <button
                      onClick={handleRegenerateQris}
                      className="mt-1 bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold px-3 py-1.5 rounded-lg text-xs flex items-center gap-1.5 shadow-md transition"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Buat QRIS Baru</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Total Tagihan Box */}
              <div className="w-full bg-white p-3.5 rounded-2xl border border-neutral-200 space-y-1 shadow-xs">
                <span className="text-[10px] uppercase font-semibold text-neutral-400 tracking-wider">Total Tagihan Yang Harus Dibayar</span>
                <p className="text-xl font-black text-neutral-950">{formatRupiah(activeOrder.total_amount)}</p>
                <div className="flex justify-between items-center text-[10px] text-neutral-500 pt-1 border-t border-neutral-100 mt-1">
                  <span>No. Order: <strong>{activeOrder.order_number}</strong></span>
                  <span>Meja: <strong>{activeOrder.table_number || 'Takeaway'}</strong></span>
                </div>
              </div>

              {/* Supported Apps Badges */}
              <div className="w-full text-left bg-neutral-100 p-2.5 rounded-xl border border-neutral-200 text-[10px] text-neutral-600 space-y-1">
                <p className="font-semibold text-neutral-800 flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Dukungan Aplikasi Pembayaran:</span>
                </p>
                <p className="text-neutral-500 leading-relaxed text-[10px]">
                  BCA Mobile, Livin by Mandiri, GoPay, OVO, DANA, ShopeePay, BRImo, BNI Mobile, LinkAja.
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="p-3 bg-white border-t border-neutral-200 flex gap-2">
              {isQrisExpired ? (
                <button
                  onClick={handleRegenerateQris}
                  className="grow bg-neutral-950 hover:bg-neutral-900 text-white font-semibold py-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5 transition"
                >
                  <RefreshCw className="w-4 h-4 text-amber-400" />
                  <span>Perbarui QRIS (Kode Baru)</span>
                </button>
              ) : (
                <button
                  onClick={handleConfirmQrisPaid}
                  className="grow bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5 transition shadow-sm"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Saya Sudah Membayar</span>
                </button>
              )}
              <button
                onClick={() => setIsQrisModalOpen(false)}
                className="px-4 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-semibold py-2.5 rounded-xl text-xs transition"
              >
                Tutup
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
