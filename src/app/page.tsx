'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
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
  Bell, 
  Wifi, 
  ChevronRight, 
  Sparkles,
  UtensilsCrossed,
  Flame,
  Coffee
} from 'lucide-react';
import { Category, MenuItem, OrderItem, RestaurantTable, Order, RestaurantSetting } from '@/types/database';
import { 
  fetchCategories, 
  fetchMenus, 
  fetchTables, 
  createOrder, 
  fetchOrders, 
  fetchSetting, 
  createWaiterCall,
  supabase, 
  isSupabaseConfigured 
} from '@/lib/supabase';
import { formatRupiah } from '@/lib/utils';

function CustomerOrderContent() {
  const router = useRouter();
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
  const [setting, setSetting] = useState<RestaurantSetting | null>(null);

  // Call Waiter Modal
  const [isCallWaiterOpen, setIsCallWaiterOpen] = useState(false);
  const [isSendingCall, setIsSendingCall] = useState(false);
  const [callSuccessNotice, setCallSuccessNotice] = useState('');
  
  // Form Info
  const [customerName, setCustomerName] = useState('Tamu Meja');
  const [paymentMethod, setPaymentMethod] = useState<'Tunai' | 'QRIS' | 'Transfer Bank'>('QRIS');
  const [orderNotes, setOrderNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Active Tracking Order
  const [activeOrder, setActiveOrder] = useState<Order | null>(null);
  const [wifiCopied, setWifiCopied] = useState(false);

  useEffect(() => {
    async function loadData() {
      const [cats, mns, tbls, st] = await Promise.all([
        fetchCategories(),
        fetchMenus(),
        fetchTables(),
        fetchSetting()
      ]);
      setCategories(cats);
      setMenus(mns);
      setTables(tbls);
      setSetting(st);
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

  // Realtime active order status listener
  useEffect(() => {
    if (!activeOrder) return;

    if (isSupabaseConfigured && supabase) {
      const channel = supabase
        .channel(`order-track-home-${activeOrder.id}`)
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

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [activeOrder?.id]);

  const handleSendWaiterCall = async (callType: string) => {
    setIsSendingCall(true);
    await createWaiterCall(tableNumber, callType, customerName);
    setIsSendingCall(false);
    setCallSuccessNotice(`Pelayan telah diberitahu untuk Meja ${tableNumber}!`);
    setTimeout(() => {
      setCallSuccessNotice('');
      setIsCallWaiterOpen(false);
    }, 2000);
  };

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

  const subtotalCartPrice = cart.reduce((sum, item) => sum + item.subtotal, 0);
  const totalCartQty = cart.reduce((sum, item) => sum + item.qty, 0);
  const taxPercent = setting?.tax_percent || 10;
  const taxAmount = Math.round(subtotalCartPrice * (taxPercent / 100));
  const servicePercent = setting?.service_percent || 0;
  const serviceAmount = Math.round(subtotalCartPrice * (servicePercent / 100));
  const totalCartPrice = subtotalCartPrice + taxAmount + serviceAmount;

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
        tax_amount: taxAmount,
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

        // Masuk langsung ke halaman status pesanan baru!
        router.push(`/status?id=${result.order.id}&meja=${tableNumber}`);
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
    <div className="bg-[#FAF8F5] min-h-screen text-[#1A1816] pb-28 selection:bg-stone-900 selection:text-amber-300">
      
      {/* Top Navbar */}
      <header className="sticky top-0 z-30 glass-panel border-b border-stone-200/80 px-4 py-3 shadow-warm-sm">
        <div className="max-w-md mx-auto flex items-center justify-between">
          
          {/* Brand Identity */}
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-stone-900 text-amber-400 flex items-center justify-center font-black text-sm shadow-warm-sm">
              <UtensilsCrossed className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[9px] uppercase font-bold tracking-widest text-amber-700 block">
                Artisan Kitchen & Brews
              </span>
              <h1 className="text-sm font-black tracking-tight text-stone-950 truncate max-w-[140px]">
                {setting?.name || 'Rasa Nusantara'}
              </h1>
            </div>
          </div>

          {/* Quick Action Badges */}
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setIsCallWaiterOpen(true)}
              className="flex items-center space-x-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-900 border border-amber-500/30 px-2.5 py-1.5 rounded-full text-xs font-bold transition shadow-2xs active:scale-95"
              title="Panggil pelayan ke meja"
            >
              <Bell className="w-3.5 h-3.5 text-amber-600" />
              <span>Panggil</span>
            </button>

            {/* Table Badge */}
            <button
              onClick={() => setIsTableModalOpen(true)}
              className="flex items-center space-x-1.5 bg-stone-900 text-amber-300 hover:bg-stone-800 px-3 py-1.5 rounded-full text-xs font-black transition shadow-warm-sm active:scale-95 ring-2 ring-stone-900/10"
            >
              <MapPin className="w-3.5 h-3.5 text-amber-400" />
              <span>Meja {tableNumber}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-md mx-auto px-4 pt-4 space-y-4">

        {/* Ambient Greeting & Wi-Fi Banner */}
        <div className="bg-gradient-to-br from-stone-900 to-stone-800 text-white p-4 sm:p-5 rounded-2xl shadow-warm-md relative overflow-hidden">
          <div className="absolute right-0 top-0 translate-x-4 -translate-y-4 w-32 h-32 rounded-full bg-amber-500/10 blur-2xl"></div>
          
          <div className="relative z-10 space-y-2">
            <div className="flex items-center space-x-1.5 text-amber-400 text-[11px] font-bold uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Pemesanan Digital Meja {tableNumber}</span>
            </div>
            
            <h2 className="text-base sm:text-lg font-black tracking-tight text-white leading-snug">
              Cita Rasa Otentik, Disajikan Langsung ke Meja Anda.
            </h2>
            
            <p className="text-xs text-stone-300 leading-relaxed">
              Pilih menu favorit Anda di bawah. Pesanan akan otomatis terkirim dan disiapkan segar oleh koki dapur.
            </p>

            {setting?.wifi_password && (
              <div className="pt-1">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(setting.wifi_password || '');
                    setWifiCopied(true);
                    setTimeout(() => setWifiCopied(false), 2000);
                  }}
                  className="inline-flex items-center space-x-2 bg-stone-800/80 border border-stone-700/80 hover:bg-stone-700 text-stone-200 px-3 py-1.5 rounded-full text-[11px] font-medium transition"
                >
                  <Wifi className="w-3.5 h-3.5 text-amber-400" />
                  <span>Wi-Fi: <strong className="text-white font-mono">{setting.wifi_password}</strong></span>
                  <span className="text-[10px] text-amber-400 font-bold ml-1">{wifiCopied ? '✓ Tersalin' : '(Salin)'}</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Search Input */}
        <div className="relative">
          <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Cari menu, kopi, atau camilan lezat..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white border border-stone-200/90 rounded-2xl pl-10 pr-4 py-3 text-xs text-stone-900 placeholder:text-stone-400 focus:outline-hidden focus:border-stone-900 focus:ring-1 focus:ring-stone-900 shadow-warm-sm transition"
          />
        </div>

        {/* Category Navigation Pills */}
        <div className="flex space-x-2 overflow-x-auto no-scrollbar pb-1 -mx-4 px-4">
          <button
            onClick={() => setActiveCategory('all')}
            className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition shadow-2xs ${
              activeCategory === 'all'
                ? 'bg-stone-900 text-white shadow-warm-sm ring-2 ring-stone-900/10'
                : 'bg-white text-stone-600 hover:bg-stone-100 border border-stone-200/80'
            }`}
          >
            Semua Menu
          </button>
          {categories.map(cat => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition shadow-2xs ${
                activeCategory === cat.id
                  ? 'bg-stone-900 text-white shadow-warm-sm ring-2 ring-stone-900/10'
                  : 'bg-white text-stone-600 hover:bg-stone-100 border border-stone-200/80'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>

        {/* Menu Items Grid */}
        <div className="space-y-3 pt-1">
          {filteredMenus.map(menu => {
            const inCart = cart.find(c => c.menu_id === menu.id);
            return (
              <div
                key={menu.id}
                className="bg-white rounded-2xl p-3.5 border border-stone-200/80 shadow-warm-sm hover:shadow-warm-md flex gap-3.5 items-center justify-between transition-all"
              >
                {/* Photo & Description */}
                <div className="flex items-center space-x-3.5 grow min-w-0">
                  <div className="relative w-20 h-20 rounded-xl overflow-hidden shrink-0 bg-stone-100 shadow-inner">
                    <img
                      src={menu.image}
                      alt={menu.name}
                      className="w-full h-full object-cover transition duration-300 hover:scale-105"
                      loading="lazy"
                    />
                    {menu.price > 25000 && (
                      <span className="absolute top-1 left-1 bg-stone-900/85 backdrop-blur-xs text-amber-300 text-[9px] font-bold px-1.5 py-0.5 rounded-md flex items-center gap-0.5">
                        <Flame className="w-2.5 h-2.5 text-amber-400" />
                        Chef's Pick
                      </span>
                    )}
                  </div>

                  <div className="min-w-0 grow pr-1">
                    <h3 className="font-bold text-xs sm:text-sm text-stone-900 tracking-tight leading-tight">
                      {menu.name}
                    </h3>
                    <p className="text-[11px] text-stone-500 line-clamp-2 mt-1 leading-relaxed">
                      {menu.description}
                    </p>
                    <p className="text-xs sm:text-sm font-black text-amber-800 font-mono mt-1.5">
                      {formatRupiah(menu.price)}
                    </p>
                  </div>
                </div>

                {/* Stepper / Add Button */}
                <div className="shrink-0 pl-1">
                  {inCart ? (
                    <div className="flex items-center space-x-2 bg-stone-900 text-white rounded-full p-1 shadow-warm-sm">
                      <button
                        onClick={() => updateItemQty(menu.id, -1)}
                        className="w-6 h-6 rounded-full bg-stone-800 hover:bg-stone-700 text-white flex items-center justify-center font-bold text-xs transition active:scale-90"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="w-4 text-center text-xs font-black text-amber-300 font-mono">
                        {inCart.qty}
                      </span>
                      <button
                        onClick={() => updateItemQty(menu.id, 1)}
                        className="w-6 h-6 rounded-full bg-stone-800 hover:bg-stone-700 text-white flex items-center justify-center font-bold text-xs transition active:scale-90"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => addToCart(menu)}
                      className="bg-stone-900 hover:bg-stone-800 text-white text-xs font-bold px-3.5 py-2 rounded-full flex items-center space-x-1.5 transition shadow-warm-sm active:scale-95"
                    >
                      <Plus className="w-3.5 h-3.5 text-amber-400" />
                      <span>Pesan</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer Brand Info */}
        <div className="mt-8 text-center text-[11px] text-stone-500 border-t border-stone-200/80 pt-6 pb-2 space-y-1">
          <p className="font-bold text-stone-800">{setting?.name || 'Rasa Nusantara Resto & Cafe'}</p>
          <p className="text-stone-500 text-[10px]">{setting?.address || 'Jl. Kuliner Lezat No. 88, Jakarta'}</p>
          <p className="text-[10px] text-stone-400 mt-1">Pesanan Anda dimasak langsung dan disajikan ke Meja {tableNumber}</p>
        </div>

      </main>

      {/* Floating Active Order Status Bar */}
      {activeOrder && activeOrder.order_status !== 'completed' && activeOrder.order_status !== 'cancelled' && (
        <div className="fixed bottom-20 left-4 right-4 z-40 max-w-md mx-auto animate-in slide-in-from-bottom-3">
          <Link
            href={`/status?id=${activeOrder.id}&meja=${activeOrder.table_number || tableNumber}`}
            className="bg-stone-950/95 backdrop-blur-md text-white p-3.5 rounded-2xl shadow-warm-xl flex items-center justify-between border border-stone-800 hover:bg-stone-900 transition group"
          >
            <div className="flex items-center space-x-3 overflow-hidden">
              <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0">
                <Clock className="w-4 h-4 animate-spin-slow" />
              </div>
              <div className="overflow-hidden text-xs">
                <p className="font-bold text-white truncate flex items-center gap-1.5">
                  <span>Meja {activeOrder.table_number || tableNumber}</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  <span className="text-[11px] text-emerald-400 font-bold">
                    {activeOrder.order_status === 'pending' ? 'Pesanan Diterima' : activeOrder.order_status === 'processing' ? 'Sedang Dimasak' : 'Siap Saji'}
                  </span>
                </p>
                <p className="text-[10px] text-stone-400 truncate">
                  #{activeOrder.order_number} • Sentuh untuk lihat status & bayar QRIS
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-1 text-amber-400 text-xs font-bold shrink-0 pl-2">
              <span>Buka</span>
              <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition" />
            </div>
          </Link>
        </div>
      )}

      {/* Floating Bottom Cart Bar */}
      {totalCartQty > 0 && (
        <div className="fixed bottom-4 inset-x-0 max-w-md mx-auto px-4 z-40 animate-in slide-in-from-bottom-2">
          <button
            onClick={() => setIsCartOpen(true)}
            className="w-full bg-stone-950 text-white p-3.5 rounded-2xl shadow-warm-xl flex items-center justify-between hover:bg-stone-900 transition active:scale-98 border border-stone-800"
          >
            <div className="flex items-center space-x-3">
              <span className="w-7 h-7 rounded-xl bg-amber-500 text-stone-950 text-xs font-black flex items-center justify-center font-mono">
                {totalCartQty}
              </span>
              <span className="text-xs font-bold tracking-tight">Lihat Keranjang Pesanan</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-xs font-black text-amber-300 font-mono">{formatRupiah(totalCartPrice)}</span>
              <ArrowRight className="w-4 h-4 text-amber-400" />
            </div>
          </button>
        </div>
      )}

      {/* Cart Drawer Bottom Sheet */}
      {isCartOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end justify-center animate-in fade-in">
          <div className="w-full max-w-md bg-white rounded-t-3xl max-h-[88vh] flex flex-col shadow-2xl animate-in slide-in-from-bottom-4 border-t border-stone-200">
            
            {/* Sheet Handle & Header */}
            <div className="pt-2 pb-1 flex justify-center">
              <div className="w-10 h-1 rounded-full bg-stone-300"></div>
            </div>

            <div className="px-5 py-3 border-b border-stone-100 flex items-center justify-between">
              <div>
                <h3 className="font-black text-stone-950 text-sm">Pesanan Meja {tableNumber}</h3>
                <p className="text-[11px] text-stone-500">{totalCartQty} hidangan dipilih</p>
              </div>
              <button
                onClick={() => setIsCartOpen(false)}
                className="w-8 h-8 rounded-full bg-stone-100 flex items-center justify-center text-stone-500 hover:text-stone-900 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Cart Items List */}
            <div className="p-5 overflow-y-auto grow space-y-4">
              {cart.map(item => (
                <div key={item.menu_id} className="border-b border-stone-100 pb-3 last:border-b-0 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-stone-900">{item.menu_name}</h4>
                      <p className="text-[11px] text-amber-800 font-mono font-semibold">{formatRupiah(item.price)}</p>
                    </div>
                    <div className="flex items-center space-x-2 bg-stone-100 rounded-full p-1 border border-stone-200">
                      <button onClick={() => updateItemQty(item.menu_id, -1)} className="w-5 h-5 bg-white rounded-full flex items-center justify-center text-xs font-bold text-stone-700 shadow-2xs">
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="w-4 text-center text-xs font-black font-mono text-stone-900">{item.qty}</span>
                      <button onClick={() => updateItemQty(item.menu_id, 1)} className="w-5 h-5 bg-white rounded-full flex items-center justify-center text-xs font-bold text-stone-700 shadow-2xs">
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                  <input
                    type="text"
                    placeholder="Catatan porsi (misal: pedas sedang, es dipisah...)"
                    value={item.item_notes || ''}
                    onChange={e => updateItemNote(item.menu_id, e.target.value)}
                    className="w-full bg-stone-50 border border-stone-200/90 rounded-xl px-3 py-1.5 text-xs text-stone-800 placeholder:text-stone-400 focus:outline-hidden focus:border-stone-900"
                  />
                </div>
              ))}

              {/* Guest Information */}
              <div className="bg-stone-50 p-3.5 rounded-2xl border border-stone-200/80 space-y-2.5 text-xs">
                <div>
                  <label className="block text-[11px] font-bold text-stone-700 mb-1">Nama Pemesan</label>
                  <input
                    type="text"
                    value={customerName}
                    onChange={e => setCustomerName(e.target.value)}
                    className="w-full bg-white border border-stone-200 rounded-xl px-3 py-2 text-xs font-bold text-stone-900 focus:outline-hidden focus:border-stone-900"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-stone-700 mb-1">Catatan Tambahan untuk Koki</label>
                  <input
                    type="text"
                    placeholder="Contoh: Sambal dipisah, minta sendok ekstra"
                    value={orderNotes}
                    onChange={e => setOrderNotes(e.target.value)}
                    className="w-full bg-white border border-stone-200 rounded-xl px-3 py-2 text-xs text-stone-900 focus:outline-hidden focus:border-stone-900"
                  />
                </div>
              </div>

              {/* Payment Method Selector */}
              <div>
                <label className="block text-[11px] font-bold text-stone-700 mb-1.5">Metode Pembayaran</label>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('QRIS')}
                    className={`py-2.5 px-3 rounded-2xl border text-left transition ${
                      paymentMethod === 'QRIS'
                        ? 'border-stone-900 bg-stone-900 text-white font-bold shadow-warm-sm'
                        : 'border-stone-200 bg-white text-stone-700 hover:border-stone-300'
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <QrCode className="w-4 h-4 text-amber-400" />
                      <span>QRIS Instan</span>
                    </div>
                    <span className="text-[10px] opacity-80 block mt-0.5">Scan QR langsung dari HP</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod('Tunai')}
                    className={`py-2.5 px-3 rounded-2xl border text-left transition ${
                      paymentMethod === 'Tunai'
                        ? 'border-stone-900 bg-stone-900 text-white font-bold shadow-warm-sm'
                        : 'border-stone-200 bg-white text-stone-700 hover:border-stone-300'
                    }`}
                  >
                    <span>Bayar di Kasir</span>
                    <span className="text-[10px] opacity-80 block mt-0.5">Pelunasan di kasir resto</span>
                  </button>
                </div>
              </div>

              {/* Price Breakdown */}
              <div className="pt-3 border-t border-stone-200 space-y-1.5 text-xs">
                <div className="flex justify-between items-baseline text-stone-600">
                  <span>Subtotal Menu</span>
                  <span className="font-mono font-semibold text-stone-900">{formatRupiah(subtotalCartPrice)}</span>
                </div>
                {taxPercent > 0 && (
                  <div className="flex justify-between items-baseline text-stone-600">
                    <span>Pajak Restoran (PB1 {taxPercent}%)</span>
                    <span className="font-mono font-semibold text-stone-900">{formatRupiah(taxAmount)}</span>
                  </div>
                )}
                {serviceAmount > 0 && (
                  <div className="flex justify-between items-baseline text-stone-600">
                    <span>Service Charge ({servicePercent}%)</span>
                    <span className="font-mono font-semibold text-stone-900">{formatRupiah(serviceAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between items-baseline text-sm font-black text-stone-950 pt-2 border-t border-stone-200">
                  <span>Total Tagihan</span>
                  <span className="font-mono text-base text-amber-900">{formatRupiah(totalCartPrice)}</span>
                </div>
              </div>

            </div>

            {/* Bottom Submit Button */}
            <div className="p-4 border-t border-stone-100 bg-stone-50">
              <button
                disabled={isSubmitting || cart.length === 0}
                onClick={handleSubmitOrder}
                className="w-full bg-stone-950 hover:bg-stone-900 text-white font-black py-3.5 rounded-2xl text-xs uppercase tracking-wider transition shadow-warm-lg disabled:opacity-50 flex items-center justify-center space-x-2 active:scale-98"
              >
                <span>{isSubmitting ? 'Mengirim ke Dapur...' : 'Kirim Pesanan ke Dapur'}</span>
                <ArrowRight className="w-4 h-4 text-amber-400" />
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Select Table Modal */}
      {isTableModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-xs w-full p-5 shadow-2xl border border-stone-200 space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-stone-100">
              <h3 className="font-black text-sm text-stone-950">Pilih Nomor Meja Anda</h3>
              <button onClick={() => setIsTableModalOpen(false)} className="text-stone-400 hover:text-stone-900">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-stone-500">
              Pilih nomor meja tempat Anda duduk saat ini:
            </p>
            <div className="grid grid-cols-5 gap-2">
              {tables.map(tbl => (
                <button
                  key={tbl.table_number}
                  onClick={() => {
                    setTableNumber(tbl.table_number);
                    setIsTableModalOpen(false);
                  }}
                  className={`py-3 rounded-2xl text-xs font-bold border transition ${
                    tableNumber === tbl.table_number
                      ? 'bg-stone-900 text-amber-300 border-stone-900 shadow-warm-sm'
                      : 'bg-white text-stone-700 border-stone-200 hover:border-stone-400'
                  }`}
                >
                  M-{tbl.table_number}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Waiter Call Modal */}
      {isCallWaiterOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white rounded-3xl p-5 shadow-2xl border border-stone-200 space-y-3.5">
            <div className="flex items-center justify-between pb-2 border-b border-stone-100">
              <div className="flex items-center space-x-2">
                <div className="w-7 h-7 rounded-lg bg-amber-500/10 text-amber-600 flex items-center justify-center font-bold">
                  <Bell className="w-4 h-4" />
                </div>
                <h3 className="font-black text-xs uppercase tracking-tight text-stone-950">
                  Panggil Pelayan • Meja {tableNumber}
                </h3>
              </div>
              <button onClick={() => setIsCallWaiterOpen(false)} className="text-stone-400 hover:text-stone-900">
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-stone-500 leading-relaxed">
              Pilih bantuan yang Anda butuhkan, pelayan kami akan segera menghampiri Meja {tableNumber}:
            </p>

            <div className="space-y-1.5 text-xs">
              {[
                { id: 'Bantuan Pelayan ke Meja', label: '🛎️ Butuh Bantuan Pelayan ke Meja' },
                { id: 'Minta Bill / Pembayaran', label: '🧾 Minta Bill / Pelunasan ke Kasir' },
                { id: 'Alat Makan & Tisu', label: '🍴 Tambahan Sendok, Garpu & Tisu' },
                { id: 'Refill Air / Minum', label: '🥛 Minta Air Minum / Refill' }
              ].map(opt => (
                <button
                  key={opt.id}
                  type="button"
                  disabled={isSendingCall}
                  onClick={() => handleSendWaiterCall(opt.id)}
                  className="w-full p-3 rounded-2xl border border-stone-200 bg-stone-50 hover:bg-stone-100 hover:border-stone-300 text-left font-bold text-stone-800 transition flex items-center justify-between disabled:opacity-50"
                >
                  <span>{opt.label}</span>
                  <ChevronRight className="w-3.5 h-3.5 text-stone-400" />
                </button>
              ))}
            </div>

            {callSuccessNotice && (
              <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-center text-xs text-emerald-800 font-bold flex items-center justify-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>{callSuccessNotice}</span>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}

export default function CustomerOrderPage() {
  return (
    <Suspense fallback={<div className="p-8 text-xs font-bold text-stone-400">Memuat menu...</div>}>
      <CustomerOrderContent />
    </Suspense>
  );
}
