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
  Coffee,
  Heart,
  Share2,
  PhoneCall
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
  const initialTableParam = parseInt(searchParams.get('meja') || '1', 10);

  const [tableNumber, setTableNumber] = useState<number>(initialTableParam > 0 ? initialTableParam : 1);
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

  // Real-time synchronization
  const checkActiveOrder = async () => {
    try {
      const savedOrderId = localStorage.getItem('resto_active_order_id');
      if (savedOrderId) {
        const all = await fetchOrders();
        const found = all.find(o => String(o.id) === savedOrderId);
        if (found && found.order_status !== 'completed' && found.order_status !== 'cancelled') {
          setActiveOrder(found);
        } else if (found && (found.order_status === 'completed' || found.order_status === 'cancelled')) {
          setActiveOrder(null);
          localStorage.removeItem('resto_active_order_id');
        }
      }
    } catch (e) {}
  };

  const loadData = async () => {
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
  };

  useEffect(() => {
    loadData();
    checkActiveOrder();

    if (isSupabaseConfigured && supabase) {
      const channel = supabase
        .channel('customer-menu-live')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'menus' }, () => loadData())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'categories' }, () => loadData())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'restaurant_settings' }, () => loadData())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
          loadData();
          checkActiveOrder();
        })
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    } else {
      const interval = setInterval(() => {
        loadData();
        checkActiveOrder();
      }, 3000);
      return () => clearInterval(interval);
    }
  }, []);

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

        // Redirect immediately to the dedicated tracking page
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
    <div className="bg-[#F8F9FA] min-h-screen text-gray-900 font-sans antialiased selection:bg-orange-500 selection:text-white pb-32">
      
      {/* Top Navbar */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-gray-100 px-4 sm:px-8 py-3.5 shadow-xs">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
          
          {/* Brand Identity */}
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-orange-500 text-white flex items-center justify-center font-black shadow-xs">
              <UtensilsCrossed className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-sm sm:text-base font-extrabold tracking-tight text-gray-900 truncate">
                {setting?.name || 'Kans Resto'}
              </h1>
              <p className="text-[10px] text-gray-400 font-medium hidden sm:block">Menu Digital & Pesan Mandiri</p>
            </div>
          </div>

          {/* Quick Action Badges */}
          <div className="flex items-center space-x-2">
            {/* Active order badge if exists */}
            {activeOrder && (
              <Link
                href={`/status?id=${activeOrder.id}&meja=${tableNumber}`}
                className="hidden sm:flex items-center space-x-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-orange-50 text-orange-700 border border-orange-200 animate-pulse"
              >
                <Clock className="w-3.5 h-3.5 text-orange-600" />
                <span>Lihat Status Pesanan</span>
              </Link>
            )}

            {/* Waiter Call Button */}
            <button
              onClick={() => setIsCallWaiterOpen(true)}
              className="flex items-center space-x-1.5 bg-gray-50 hover:bg-orange-50 text-gray-700 hover:text-orange-600 border border-gray-200 px-3 py-1.5 rounded-full text-xs font-bold transition active:scale-95 shadow-2xs"
            >
              <Bell className="w-3.5 h-3.5 text-orange-500" />
              <span>Panggil</span>
            </button>

            {/* Table Number Pill */}
            <button
              onClick={() => setIsTableModalOpen(true)}
              className="flex items-center space-x-1.5 bg-black hover:bg-gray-800 text-white px-3.5 py-1.5 rounded-full text-xs font-black transition active:scale-95 shadow-xs"
            >
              <MapPin className="w-3.5 h-3.5 text-orange-400" />
              <span>Meja {tableNumber}</span>
            </button>
          </div>

        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-8 pt-5 space-y-6">

        {/* Header Banner */}
        <div className="bg-gradient-to-r from-orange-500 to-amber-500 text-white p-5 sm:p-6 rounded-3xl shadow-xs">
          <div className="space-y-1.5 max-w-2xl">
            <span className="text-white/80 text-[11px] font-bold uppercase tracking-wider block">
              Pemesanan Meja {tableNumber}
            </span>

            <h2 className="text-xl sm:text-2xl font-black tracking-tight leading-tight">
              Pilih Menu Makanan & Minuman
            </h2>

            <p className="text-xs sm:text-sm text-orange-100 font-medium">
              Pesanan akan otomatis dikirim ke dapur dan disajikan langsung ke meja Anda.
            </p>

            {setting?.wifi_password && (
              <div className="pt-2">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(setting.wifi_password || '');
                    setWifiCopied(true);
                    setTimeout(() => setWifiCopied(false), 2000);
                  }}
                  className="inline-flex items-center space-x-2 bg-white/20 hover:bg-white/30 text-white px-3.5 py-1.5 rounded-full text-xs font-semibold transition"
                >
                  <Wifi className="w-3.5 h-3.5" />
                  <span>Wi-Fi: <strong className="font-mono">{setting.wifi_password}</strong></span>
                  <span className="text-[10px] text-orange-200 font-bold">{wifiCopied ? '✓ Tersalin' : '(Salin)'}</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Search & Categories Bar */}
        <div className="space-y-3">
          {/* Search Box */}
          <div className="relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Cari makanan, minuman segar, atau cemilan favorit..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white border border-gray-200 rounded-full pl-11 pr-4 py-3 text-xs sm:text-sm text-gray-900 placeholder-gray-400 focus:outline-hidden focus:border-black shadow-xs transition"
            />
          </div>

          {/* Categories Pills */}
          <div className="flex items-center space-x-2 overflow-x-auto no-scrollbar py-1">
            <button
              onClick={() => setActiveCategory('all')}
              className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition ${
                activeCategory === 'all'
                  ? 'bg-black text-white shadow-xs'
                  : 'bg-white text-gray-600 hover:text-gray-900 border border-gray-200'
              }`}
            >
              Semua Menu
            </button>

            {categories.map(cat => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition ${
                  activeCategory === cat.id
                    ? 'bg-black text-white shadow-xs'
                    : 'bg-white text-gray-600 hover:text-gray-900 border border-gray-200'
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>

        {/* Responsive Food Menu Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5">
          {filteredMenus.map((item) => {
            const inCart = cart.find(c => c.menu_id === item.id);

            return (
              <div
                key={item.id}
                className="bg-white rounded-3xl p-3.5 border border-gray-100 shadow-[0_2px_12px_rgba(0,0,0,0.02)] flex flex-col justify-between hover:shadow-md transition group h-[310px]"
              >
                <div>
                  {/* Photo Container - Fixed Uniform Proportions */}
                  <div className="w-full h-36 relative rounded-2xl overflow-hidden bg-gray-100 mb-3 shrink-0">
                    <img 
                      src={item.image} 
                      alt={item.name} 
                      onError={(e) => { 
                        (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500&auto=format&fit=crop&q=80'; 
                      }}
                      className="w-full h-full object-cover object-center group-hover:scale-105 transition duration-300"
                    />
                  </div>

                  {/* Title & Description */}
                  <h3 className="font-bold text-sm text-gray-900 leading-snug line-clamp-1">
                    {item.name}
                  </h3>
                  <p className="text-xs text-gray-400 mt-1 line-clamp-2 leading-relaxed">
                    {item.description || 'Pilihan menu lezat disajikan hangat dan higienis.'}
                  </p>
                </div>

                {/* Price & Action */}
                <div className="pt-3 mt-3 border-t border-gray-50 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-gray-400 font-medium block">Harga</span>
                    <span className="text-sm sm:text-base font-extrabold text-gray-900 font-mono">
                      {formatRupiah(item.price)}
                    </span>
                  </div>

                  {inCart ? (
                    <div className="flex items-center space-x-2 bg-gray-100 rounded-full p-1 border border-gray-200">
                      <button
                        onClick={() => updateItemQty(item.id, -1)}
                        className="w-6 h-6 bg-white rounded-full flex items-center justify-center text-xs font-bold text-gray-700 shadow-2xs active:scale-90 transition"
                      >
                        -
                      </button>
                      <span className="w-5 text-center font-bold text-xs font-mono text-gray-900">
                        {inCart.qty}
                      </span>
                      <button
                        onClick={() => updateItemQty(item.id, 1)}
                        className="w-6 h-6 bg-black text-white rounded-full flex items-center justify-center text-xs font-bold shadow-2xs active:scale-90 transition"
                      >
                        +
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => addToCart(item)}
                      className="bg-black hover:bg-gray-800 text-white font-bold px-3.5 py-1.5 rounded-full text-xs flex items-center gap-1 transition active:scale-95 shadow-2xs"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Tambah</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {filteredMenus.length === 0 && (
          <div className="text-center py-24 bg-white rounded-3xl border border-gray-100 text-gray-400">
            <UtensilsCrossed className="w-10 h-10 mx-auto mb-2 opacity-30 text-orange-500" />
            <p className="font-bold text-sm text-gray-700">Menu Tidak Ditemukan</p>
            <p className="text-xs text-gray-400 mt-0.5">Coba gunakan kata kunci lain atau pilih kategori Semua Menu.</p>
          </div>
        )}

      </main>

      {/* Floating Bottom Cart Bar (Appears when items are in cart) */}
      {cart.length > 0 && (
        <div className="fixed bottom-4 inset-x-4 sm:inset-x-auto sm:right-6 sm:w-96 z-40 animate-in slide-in-from-bottom duration-200">
          <div 
            onClick={() => setIsCartOpen(true)}
            className="bg-black text-white p-4 rounded-3xl shadow-xl flex items-center justify-between cursor-pointer hover:bg-gray-900 transition active:scale-98 border border-white/10"
          >
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-2xl bg-orange-500 flex items-center justify-center text-white font-black text-sm shrink-0">
                {totalCartQty}
              </div>
              <div>
                <p className="text-[11px] text-gray-300 font-medium">{totalCartQty} Menu Terpilih</p>
                <p className="font-black text-sm sm:text-base font-mono">{formatRupiah(totalCartPrice)}</p>
              </div>
            </div>

            <button className="bg-white text-black font-extrabold px-4 py-2 rounded-2xl text-xs flex items-center gap-1">
              <span>Lihat Pesanan</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Slide-over / Modal Cart Drawer */}
      {isCartOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in slide-in-from-bottom sm:zoom-in-95 duration-200">
            
            {/* Drawer Header */}
            <div className="p-5 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h3 className="font-extrabold text-base text-gray-900">Rincian Pesanan Meja {tableNumber}</h3>
                <p className="text-xs text-gray-400">Periksa kembali item sebelum dikirim ke dapur</p>
              </div>
              <button 
                onClick={() => setIsCartOpen(false)}
                className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Cart Items List */}
            <div className="p-5 overflow-y-auto grow space-y-3.5">
              {cart.map(item => (
                <div key={item.menu_id} className="p-3 bg-[#F8F9FA] rounded-2xl border border-gray-100 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-xs sm:text-sm text-gray-900">{item.menu_name}</h4>
                      <p className="text-xs font-bold text-emerald-600 font-mono mt-0.5">
                        {formatRupiah(item.price)}
                      </p>
                    </div>

                    <div className="flex items-center space-x-2 bg-white rounded-full p-1 border border-gray-200">
                      <button
                        onClick={() => updateItemQty(item.menu_id, -1)}
                        className="w-5 h-5 bg-gray-100 rounded-full flex items-center justify-center text-xs font-bold text-gray-700"
                      >
                        -
                      </button>
                      <span className="w-5 text-center font-bold text-xs font-mono text-gray-900">
                        {item.qty}
                      </span>
                      <button
                        onClick={() => updateItemQty(item.menu_id, 1)}
                        className="w-5 h-5 bg-black text-white rounded-full flex items-center justify-center text-xs font-bold"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  {/* Item note input */}
                  <input
                    type="text"
                    placeholder="Catatan khusus (misal: pedas, tanpa es)..."
                    value={item.item_notes || ''}
                    onChange={(e) => updateItemNote(item.menu_id, e.target.value)}
                    className="w-full bg-white border border-gray-200 rounded-xl px-3 py-1.5 text-[11px] text-gray-800 placeholder-gray-400 focus:outline-hidden focus:border-black"
                  />
                </div>
              ))}

              {/* Order Info Inputs */}
              <div className="pt-2 space-y-3 text-xs">
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Nama Pemesan</label>
                  <input
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Nama Anda..."
                    className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-2.5 font-bold text-gray-900 focus:bg-white focus:outline-hidden focus:border-black"
                  />
                </div>

                <div>
                  <label className="block font-bold text-gray-700 mb-1">Metode Pembayaran</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('QRIS')}
                      className={`p-3 rounded-2xl border text-left font-bold transition ${
                        paymentMethod === 'QRIS'
                          ? 'border-orange-500 bg-orange-50 text-orange-950 ring-1 ring-orange-500'
                          : 'border-gray-200 bg-white text-gray-700'
                      }`}
                    >
                      <p className="text-xs">QRIS Digital</p>
                      <p className="text-[10px] text-gray-500 font-normal mt-0.5">BCA, GoPay, OVO, ShopeePay</p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setPaymentMethod('Tunai')}
                      className={`p-3 rounded-2xl border text-left font-bold transition ${
                        paymentMethod === 'Tunai'
                          ? 'border-orange-500 bg-orange-50 text-orange-950 ring-1 ring-orange-500'
                          : 'border-gray-200 bg-white text-gray-700'
                      }`}
                    >
                      <p className="text-xs">Bayar di Kasir</p>
                      <p className="text-[10px] text-gray-500 font-normal mt-0.5">Tunai atau Kartu Debit</p>
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-gray-700 mb-1">Catatan Tambahan untuk Dapur (Opsional)</label>
                  <textarea
                    rows={2}
                    value={orderNotes}
                    onChange={(e) => setOrderNotes(e.target.value)}
                    placeholder="Contoh: Tolong disajikan bersamaan..."
                    className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-2 text-xs text-gray-900 focus:bg-white focus:outline-hidden focus:border-black resize-none"
                  />
                </div>
              </div>

              {/* Price Breakdown */}
              <div className="pt-3 border-t border-gray-100 space-y-1.5 text-xs text-gray-500">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span className="font-bold text-gray-800 font-mono">{formatRupiah(subtotalCartPrice)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Pajak Resto ({taxPercent}%)</span>
                  <span className="font-bold text-gray-800 font-mono">{formatRupiah(taxAmount)}</span>
                </div>
                <div className="flex justify-between items-baseline pt-2 border-t border-gray-100 text-sm">
                  <span className="font-extrabold text-gray-900">Total Pembayaran</span>
                  <span className="font-black text-lg text-emerald-600 font-mono">
                    {formatRupiah(totalCartPrice)}
                  </span>
                </div>
              </div>
            </div>

            {/* Drawer Footer CTA */}
            <div className="p-5 border-t border-gray-100 bg-gray-50">
              <button
                disabled={isSubmitting || cart.length === 0}
                onClick={handleSubmitOrder}
                className="w-full bg-black hover:bg-gray-900 disabled:opacity-50 text-white font-extrabold py-4 rounded-2xl text-xs uppercase tracking-wider transition shadow-lg active:scale-98 flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <span>Mengirim Pesanan...</span>
                ) : (
                  <>
                    <span>Kirim Pesanan ke Dapur & Kasir</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Change Table Modal */}
      {isTableModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-gray-100">
              <h3 className="font-extrabold text-sm text-gray-900">Pilih Nomor Meja Anda</h3>
              <button onClick={() => setIsTableModalOpen(false)} className="text-gray-400 hover:text-gray-900">
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <p className="text-xs text-gray-500">
              Nomor meja biasanya tertera di standing akrilik barcode di atas meja Anda.
            </p>

            <div className="grid grid-cols-4 gap-2">
              {tables.map(t => (
                <button
                  key={t.table_number}
                  onClick={() => {
                    setTableNumber(t.table_number);
                    setIsTableModalOpen(false);
                  }}
                  className={`py-3 rounded-2xl font-black text-xs transition ${
                    tableNumber === t.table_number
                      ? 'bg-black text-white shadow-xs'
                      : 'bg-gray-50 hover:bg-gray-100 text-gray-700 border border-gray-200'
                  }`}
                >
                  {t.table_number}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Call Waiter Modal */}
      {isCallWaiterOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-gray-100">
              <div className="flex items-center space-x-2">
                <Bell className="w-4 h-4 text-orange-500" />
                <h3 className="font-extrabold text-sm text-gray-900">Panggil Pelayan ke Meja {tableNumber}</h3>
              </div>
              <button onClick={() => setIsCallWaiterOpen(false)} className="text-gray-400 hover:text-gray-900">
                <X className="w-4 h-4" />
              </button>
            </div>

            {callSuccessNotice ? (
              <div className="py-6 text-center text-xs font-bold text-emerald-600 bg-emerald-50 rounded-2xl border border-emerald-200 animate-in zoom-in-95">
                ✓ {callSuccessNotice}
              </div>
            ) : (
              <div className="space-y-2 text-xs">
                <p className="text-gray-500 text-[11px]">Pilih bantuan yang Anda butuhkan:</p>
                {[
                  'Minta Sendok / Garpu / Tisu',
                  'Minta Tambah Air Minum',
                  'Minta Tolong Bersihkan Meja',
                  'Minta Bon Tagihan (Billing)',
                  'Bantuan Lainnya'
                ].map(callText => (
                  <button
                    key={callText}
                    disabled={isSendingCall}
                    onClick={() => handleSendWaiterCall(callText)}
                    className="w-full text-left p-3 rounded-2xl bg-gray-50 hover:bg-orange-50 hover:text-orange-950 border border-gray-100 font-bold transition active:scale-98"
                  >
                    {callText}
                  </button>
                ))}
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
    <Suspense fallback={<div className="p-8 text-center text-xs text-gray-400">Memuat Menu...</div>}>
      <CustomerOrderContent />
    </Suspense>
  );
}
