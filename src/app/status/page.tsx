'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import QRCode from 'qrcode';
import { 
  ArrowLeft, 
  QrCode, 
  Clock, 
  CheckCircle2, 
  AlertTriangle, 
  MapPin, 
  Bell, 
  Wifi, 
  ArrowLeftRight, 
  X, 
  ChevronRight, 
  RefreshCw, 
  Copy, 
  Check, 
  Utensils,
  Receipt,
  Sparkles,
  Flame,
  ChefHat
} from 'lucide-react';
import { Order, RestaurantTable, RestaurantSetting } from '@/types/database';
import { 
  fetchOrders, 
  updateOrderStatus, 
  updateOrderTable, 
  createWaiterCall, 
  fetchTables, 
  fetchSetting,
  supabase, 
  isSupabaseConfigured 
} from '@/lib/supabase';
import { formatRupiah } from '@/lib/utils';

function StatusContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryOrderId = searchParams.get('id');
  const queryTable = searchParams.get('meja');

  const [order, setOrder] = useState<Order | null>(null);
  const [tables, setTables] = useState<RestaurantTable[]>([]);
  const [setting, setSetting] = useState<RestaurantSetting | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // QRIS states
  const [isQrisModalOpen, setIsQrisModalOpen] = useState(false);
  const [qrisDataUrl, setQrisDataUrl] = useState('');
  const [qrisTimeLeft, setQrisTimeLeft] = useState(300);
  const [isQrisExpired, setIsQrisExpired] = useState(false);
  const [qrisVersion, setQrisVersion] = useState(1);

  // Table Transfer states
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [isTransferring, setIsTransferring] = useState(false);
  const [transferNotice, setTransferNotice] = useState('');
  const [showScanMismatch, setShowScanMismatch] = useState(false);

  // Waiter Call Modal
  const [isCallWaiterOpen, setIsCallWaiterOpen] = useState(false);
  const [isSendingCall, setIsSendingCall] = useState(false);
  const [callSuccessNotice, setCallSuccessNotice] = useState('');
  const [wifiCopied, setWifiCopied] = useState(false);

  // Load initial order
  useEffect(() => {
    async function loadInitial() {
      setIsLoading(true);
      const [tbls, st] = await Promise.all([
        fetchTables(),
        fetchSetting()
      ]);
      setTables(tbls);
      setSetting(st);

      let targetId = queryOrderId;
      if (!targetId) {
        try {
          targetId = localStorage.getItem('resto_active_order_id');
        } catch (e) {}
      }

      if (targetId) {
        const allOrders = await fetchOrders();
        const found = allOrders.find(o => String(o.id) === targetId || o.order_number === targetId);
        if (found) {
          setOrder(found);
          try {
            localStorage.setItem('resto_active_order_id', String(found.id));
          } catch (e) {}
        }
      }
      setIsLoading(false);
    }
    loadInitial();
  }, [queryOrderId]);

  // Scan mismatch detection
  useEffect(() => {
    if (order && order.table_number && queryTable) {
      const scannedTableNum = parseInt(queryTable, 10);
      if (scannedTableNum > 0 && scannedTableNum !== order.table_number) {
        setShowScanMismatch(true);
      }
    }
  }, [order?.table_number, queryTable]);

  // Realtime Supabase listener
  useEffect(() => {
    if (!order) return;

    if (isSupabaseConfigured && supabase) {
      const channel = supabase
        .channel(`order-status-page-${order.id}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'orders',
            filter: `id=eq.${order.id}`
          },
          (payload: any) => {
            if (payload.new) {
              setOrder(prev => (prev ? { ...prev, ...payload.new } : payload.new));
            }
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    } else {
      const interval = setInterval(async () => {
        const all = await fetchOrders();
        const updated = all.find(o => o.id === order.id);
        if (updated) setOrder(updated);
      }, 3000);
      return () => clearInterval(interval);
    }
  }, [order?.id]);

  // QRIS Countdown
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

  // Generate QRIS Data URL
  useEffect(() => {
    if (!order) return;
    const dynamicSalt = `${Date.now().toString().slice(-4)}${qrisVersion}`;
    const qrisPayload = `00020101021226670014ID.GO.QRIS.WWW01189360052300000000000215ID1020261118001520458125303360540${order.total_amount}5802ID5913RASA NUSANTARA6007JAKARTA62070703A016304${order.order_number}-${dynamicSalt}`;
    QRCode.toDataURL(qrisPayload, {
      width: 280,
      margin: 1,
      color: { dark: '#1c1917', light: '#ffffff' }
    }).then(setQrisDataUrl).catch(console.error);
  }, [order?.id, order?.total_amount, qrisVersion]);

  const handleRegenerateQris = () => {
    setQrisTimeLeft(300);
    setIsQrisExpired(false);
    setQrisVersion(prev => prev + 1);
  };

  const handleTransferTable = async (newTableNum: number) => {
    if (!order) return;
    const oldTable = order.table_number;
    setIsTransferring(true);
    await updateOrderTable(order.id, newTableNum);
    await createWaiterCall(newTableNum, `Pindah Meja (dari Meja ${oldTable})`, order.customer_name);
    setOrder(prev => (prev ? { ...prev, table_number: newTableNum } : null));
    setIsTransferring(false);
    setIsTransferModalOpen(false);
    setShowScanMismatch(false);
    setTransferNotice(`Berhasil pindah ke Meja ${newTableNum}! Dapur dan kasir telah diberitahu.`);
    setTimeout(() => setTransferNotice(''), 4000);
  };

  const handleSendWaiterCall = async (callType: string) => {
    if (!order) return;
    setIsSendingCall(true);
    await createWaiterCall(order.table_number || 1, callType, order.customer_name);
    setIsSendingCall(false);
    setCallSuccessNotice(`Pelayan telah diberitahu untuk Meja ${order.table_number}!`);
    setTimeout(() => {
      setCallSuccessNotice('');
      setIsCallWaiterOpen(false);
    }, 2000);
  };

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  if (isLoading) {
    return (
      <div className="bg-[#FAF8F5] min-h-screen flex items-center justify-center p-4">
        <div className="text-center space-y-3">
          <div className="w-9 h-9 border-3 border-stone-900 border-t-amber-500 rounded-full animate-spin mx-auto"></div>
          <p className="text-xs font-bold text-stone-500">Memuat status pesanan Anda...</p>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="bg-[#FAF8F5] min-h-screen flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 rounded-3xl bg-white border border-stone-200/80 shadow-warm-md flex items-center justify-center text-stone-400 mb-4">
          <Receipt className="w-8 h-8 text-stone-600" />
        </div>
        <h2 className="font-black text-lg text-stone-900">Belum Ada Pesanan Aktif</h2>
        <p className="text-xs text-stone-500 max-w-xs mt-1.5 mb-6 leading-relaxed">
          Anda belum memiliki pesanan aktif di meja ini atau pesanan sebelumnya telah selesai.
        </p>
        <Link
          href={`/?meja=${queryTable || '5'}`}
          className="bg-stone-950 text-white font-bold px-6 py-3 rounded-full text-xs shadow-warm-md hover:bg-stone-800 transition active:scale-95"
        >
          Lihat Menu & Mulai Pesan
        </Link>
      </div>
    );
  }

  const isCompleted = order.order_status === 'completed';
  const isPaid = order.payment_status === 'paid';
  const isWaitingVerification = order.payment_status === 'waiting_confirmation';

  return (
    <div className="bg-[#FAF8F5] min-h-screen text-[#1A1816] font-sans pb-20 selection:bg-stone-900 selection:text-amber-300">
      
      {/* Top Navbar */}
      <header className="sticky top-0 z-30 glass-panel border-b border-stone-200/80 px-4 py-3 shadow-warm-sm">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <Link
            href={`/?meja=${order.table_number || queryTable || '5'}`}
            className="flex items-center space-x-1.5 text-xs font-bold text-stone-700 hover:text-stone-950 transition active:scale-95"
          >
            <ArrowLeft className="w-4 h-4 text-stone-600" />
            <span>Kembali ke Menu</span>
          </Link>
          <div className="flex items-center space-x-2 bg-emerald-50 text-emerald-800 border border-emerald-200 px-3 py-1 rounded-full text-[11px] font-bold">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>Live Kitchen Sync</span>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-md mx-auto px-4 pt-4 space-y-4">

        {/* Scan Mismatch Alert */}
        {showScanMismatch && (
          <div className="bg-amber-500 text-stone-950 p-4 rounded-2xl shadow-warm-md border border-amber-600/30 animate-in fade-in space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-stone-950 shrink-0" />
                <h4 className="font-bold text-xs uppercase tracking-tight">Pindah Duduk ke Meja {queryTable}?</h4>
              </div>
              <button onClick={() => setShowScanMismatch(false)} className="text-stone-950 hover:opacity-75">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-stone-950 leading-relaxed">
              Anda baru saja memindai kode QR <strong>Meja {queryTable}</strong>, tetapi pesanan Anda masih terdaftar di <strong>Meja {order.table_number}</strong>.
            </p>
            <div className="flex gap-2 pt-1">
              <button
                disabled={isTransferring}
                onClick={() => handleTransferTable(parseInt(queryTable!, 10))}
                className="bg-stone-950 text-white font-bold px-3 py-1.5 rounded-xl text-xs hover:bg-stone-800 transition"
              >
                {isTransferring ? 'Memindahkan...' : `Ya, Pindah ke Meja ${queryTable}`}
              </button>
              <button
                onClick={() => setShowScanMismatch(false)}
                className="bg-amber-400/80 text-stone-950 font-semibold px-2.5 py-1.5 rounded-xl text-xs"
              >
                Tetap di Meja {order.table_number}
              </button>
            </div>
          </div>
        )}

        {/* HERO STATUS CARD (Luxury Restaurant Guest Check) */}
        <div className="bg-white rounded-3xl border border-stone-200/80 p-5 shadow-warm-md space-y-4 relative overflow-hidden">
          
          {/* Header Metadata */}
          <div className="flex items-start justify-between pb-3 border-b border-stone-100">
            <div>
              <span className="text-[10px] font-black uppercase tracking-widest text-amber-700 block">
                Tiket Pesanan
              </span>
              <p className="font-mono text-base font-black text-stone-950 mt-0.5">{order.order_number}</p>
              <p className="text-xs text-stone-500 mt-0.5">Tamu: <strong className="text-stone-900">{order.customer_name}</strong></p>
            </div>
            <div className="text-right">
              {isPaid ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-black bg-emerald-50 text-emerald-800 border border-emerald-200 shadow-2xs">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Lunas ({order.payment_method || 'Kasir'})</span>
                </span>
              ) : isWaitingVerification ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-black bg-blue-50 text-blue-700 border border-blue-200 animate-pulse shadow-2xs">
                  <span className="w-2 h-2 rounded-full bg-blue-600"></span>
                  <span>Verifikasi Kasir</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-black bg-amber-50 text-amber-900 border border-amber-200 shadow-2xs">
                  <span>Belum Bayar</span>
                </span>
              )}
            </div>
          </div>

          {/* Large Animated Stage Card */}
          <div className={`p-5 rounded-2xl border text-center space-y-1.5 transition duration-300 ${
            order.order_status === 'pending'
              ? 'bg-stone-900 text-white border-stone-950 shadow-warm-sm'
              : order.order_status === 'processing'
              ? 'bg-gradient-to-br from-blue-700 to-indigo-800 text-white border-blue-800 shadow-warm-md'
              : order.order_status === 'ready'
              ? 'bg-gradient-to-br from-emerald-600 to-teal-700 text-white border-emerald-700 shadow-warm-md'
              : 'bg-stone-900 text-white border-stone-900'
          }`}>
            <div className="flex items-center justify-center space-x-1.5 text-[11px] uppercase tracking-wider font-bold opacity-80">
              {order.order_status === 'processing' && <ChefHat className="w-4 h-4 text-amber-300 animate-bounce" />}
              {order.order_status === 'ready' && <Sparkles className="w-4 h-4 text-emerald-200" />}
              <span>Tahapan Saat Ini</span>
            </div>

            <h3 className="text-lg sm:text-xl font-black tracking-tight">
              {order.order_status === 'pending' && 'Pesanan Diterima Restoran'}
              {order.order_status === 'processing' && 'Sedang Dimasak Koki di Dapur 🍳'}
              {order.order_status === 'ready' && 'Makanan Siap Disajikan ke Meja Anda! 🍽️'}
              {order.order_status === 'completed' && 'Pesanan Telah Selesai. Selamat Menikmati! ✨'}
            </h3>

            <p className="text-xs opacity-90 max-w-xs mx-auto leading-relaxed">
              {order.order_status === 'pending' && 'Tiket pesanan Anda telah masuk secara otomatis ke layar monitor dapur.'}
              {order.order_status === 'processing' && 'Koki kami sedang meracik hidangan segar pesanan Anda dengan cermat.'}
              {order.order_status === 'ready' && 'Pelayan sedang membawakan hidangan lezat langsung ke nomor meja Anda.'}
              {order.order_status === 'completed' && 'Terima kasih atas kunjungan Anda. Semoga menikmati hidangan istimewa ini.'}
            </p>
          </div>

          {/* Stepper Progress Indicator */}
          <div className="grid grid-cols-4 gap-1.5 pt-1 text-center text-[10px] font-bold">
            <div className={`py-2 px-1 rounded-xl border transition ${
              ['pending', 'processing', 'ready', 'completed'].includes(order.order_status)
                ? 'bg-stone-900 text-white border-stone-900'
                : 'bg-stone-50 text-stone-400 border-stone-200'
            }`}>
              1. Diterima
            </div>
            <div className={`py-2 px-1 rounded-xl border transition ${
              ['processing', 'ready', 'completed'].includes(order.order_status)
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-stone-50 text-stone-400 border-stone-200'
            }`}>
              2. Dimasak
            </div>
            <div className={`py-2 px-1 rounded-xl border transition ${
              ['ready', 'completed'].includes(order.order_status)
                ? 'bg-emerald-600 text-white border-emerald-600'
                : 'bg-stone-50 text-stone-400 border-stone-200'
            }`}>
              3. Siap Saji
            </div>
            <div className={`py-2 px-1 rounded-xl border transition ${
              order.order_status === 'completed'
                ? 'bg-emerald-600 text-white border-emerald-600'
                : 'bg-stone-50 text-stone-400 border-stone-200'
            }`}>
              4. Selesai
            </div>
          </div>

          {/* Table Location & Transfer Button */}
          <div className="pt-3 border-t border-stone-100 flex items-center justify-between">
            <div className="flex items-center space-x-2.5">
              <div className="w-9 h-9 rounded-xl bg-stone-900 text-amber-300 flex items-center justify-center font-black text-xs shadow-warm-sm">
                <MapPin className="w-4 h-4 text-amber-400" />
              </div>
              <div>
                <p className="text-[10px] text-stone-400 font-bold uppercase">Posisi Meja</p>
                <p className="text-xs sm:text-sm font-black text-stone-950">Meja {order.table_number || '-'}</p>
              </div>
            </div>

            <button
              onClick={() => setIsTransferModalOpen(true)}
              className="flex items-center space-x-1.5 px-3.5 py-2 bg-stone-100 hover:bg-stone-200 text-stone-900 text-xs font-bold rounded-full border border-stone-200 transition active:scale-95 shadow-2xs"
            >
              <ArrowLeftRight className="w-3.5 h-3.5 text-stone-600" />
              <span>Pindah Meja</span>
            </button>
          </div>

          {transferNotice && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs text-emerald-800 font-bold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{transferNotice}</span>
            </div>
          )}

          {/* Action Row */}
          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              onClick={() => setIsCallWaiterOpen(true)}
              className="py-3 px-3 bg-stone-100 hover:bg-stone-200 text-stone-900 font-bold text-xs rounded-2xl flex items-center justify-center gap-1.5 transition border border-stone-200 active:scale-95"
            >
              <Bell className="w-4 h-4 text-amber-600" />
              <span>Panggil Pelayan</span>
            </button>

            {!isPaid ? (
              <button
                onClick={() => {
                  if (isQrisExpired || qrisTimeLeft <= 0) handleRegenerateQris();
                  setIsQrisModalOpen(true);
                }}
                className="py-3 px-3 bg-stone-950 hover:bg-stone-900 text-white font-bold text-xs rounded-2xl flex items-center justify-center gap-1.5 transition shadow-warm-md active:scale-95"
              >
                <QrCode className="w-4 h-4 text-amber-400" />
                <span>Bayar QRIS ({isQrisExpired ? 'Expired' : formatTimer(qrisTimeLeft)})</span>
              </button>
            ) : (
              <Link
                href={`/?meja=${order.table_number || '5'}`}
                className="py-3 px-3 bg-stone-950 hover:bg-stone-900 text-white font-bold text-xs rounded-2xl flex items-center justify-center gap-1.5 transition text-center shadow-warm-md active:scale-95"
              >
                <Utensils className="w-4 h-4 text-amber-400" />
                <span>Pesan Menu Lain</span>
              </Link>
            )}
          </div>
        </div>

        {/* ORDER ITEMS BREAKDOWN CARD */}
        <div className="bg-white rounded-3xl border border-stone-200/80 p-5 shadow-warm-md space-y-3.5">
          <div className="flex items-center justify-between pb-2 border-b border-stone-100">
            <h4 className="font-black text-xs uppercase tracking-tight text-stone-950">Rincian Menu Dipesan</h4>
            <span className="text-[11px] font-bold text-stone-500">{(order.items || []).length} Hidangan</span>
          </div>

          <div className="divide-y divide-stone-100 text-xs">
            {(order.items || []).map((item, idx) => (
              <div key={idx} className="py-2.5 flex justify-between items-start">
                <div className="pr-3 space-y-0.5">
                  <p className="font-bold text-stone-900">
                    <span className="text-amber-800 font-black mr-1.5 font-mono">{item.qty}x</span>
                    {item.menu_name}
                  </p>
                  {item.item_notes && (
                    <p className="text-[11px] text-stone-400 italic">Catatan: {item.item_notes}</p>
                  )}
                </div>
                <span className="font-bold text-stone-900 shrink-0 font-mono">
                  {formatRupiah(item.subtotal)}
                </span>
              </div>
            ))}
          </div>

          {order.notes && (
            <div className="p-3 bg-stone-50 border border-stone-200/80 rounded-2xl text-xs text-stone-700 italic">
              <strong>Catatan Meja:</strong> {order.notes}
            </div>
          )}

          {/* Pricing Totals */}
          <div className="pt-3 border-t border-stone-100 space-y-1.5 text-xs">
            <div className="flex justify-between text-stone-500 font-medium">
              <span>Subtotal Hidangan</span>
              <span className="font-mono">{formatRupiah(order.total_amount - (order.tax_amount || 0))}</span>
            </div>
            {Boolean(order.tax_amount) && (
              <div className="flex justify-between text-stone-500 font-medium">
                <span>Pajak Restoran PB1 (10%)</span>
                <span className="font-mono">{formatRupiah(order.tax_amount || 0)}</span>
              </div>
            )}
            <div className="flex justify-between text-base font-black text-stone-950 pt-2 border-t border-stone-100">
              <span>Total Tagihan</span>
              <span className="font-mono text-amber-900">{formatRupiah(order.total_amount)}</span>
            </div>
          </div>
        </div>

        {/* RESTAURANT WI-FI & INFO CARD */}
        {setting?.wifi_password && (
          <div className="bg-white rounded-3xl border border-stone-200/80 p-4 shadow-warm-sm flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-50 border border-amber-200/80 flex items-center justify-center text-amber-700 shrink-0">
                <Wifi className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[10px] uppercase font-bold text-stone-400">Wi-Fi Restoran</p>
                <p className="text-xs font-bold text-stone-900">{setting.wifi_password}</p>
              </div>
            </div>
            <button
              onClick={() => {
                navigator.clipboard.writeText(setting.wifi_password || '');
                setWifiCopied(true);
                setTimeout(() => setWifiCopied(false), 2000);
              }}
              className="text-[11px] font-bold px-3 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-800 rounded-full transition border border-stone-200 flex items-center gap-1 active:scale-95"
            >
              {wifiCopied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-stone-500" />}
              <span>{wifiCopied ? 'Tersalin' : 'Salin'}</span>
            </button>
          </div>
        )}

        {/* Bottom Action: Back to Menu */}
        <div className="text-center pt-2">
          <Link
            href={`/?meja=${order.table_number || '5'}`}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-stone-600 hover:text-stone-950 transition"
          >
            <Utensils className="w-3.5 h-3.5 text-amber-600" />
            <span>Ingin Tambah Menu? Buka Katalog Menu Resto</span>
          </Link>
        </div>

      </main>

      {/* MODAL PINDAH MEJA */}
      {isTransferModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="w-full max-w-sm bg-white rounded-3xl p-5 shadow-2xl border border-stone-200 space-y-4 animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-2 border-b border-stone-100">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-700 flex items-center justify-center font-bold">
                  <ArrowLeftRight className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-black text-sm text-stone-950">Pindah Nomor Meja</h3>
                  <p className="text-[10px] text-stone-500">Pindahkan pesanan ke meja baru</p>
                </div>
              </div>
              <button onClick={() => setIsTransferModalOpen(false)} className="text-stone-400 hover:text-stone-900 p-1">
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-stone-600 leading-relaxed">
              Pesanan Anda saat ini tercatat di <strong className="text-stone-950">Meja {order.table_number}</strong>. Sentuh nomor meja baru tempat Anda pindah duduk:
            </p>

            <div className="grid grid-cols-5 gap-2">
              {tables.map(tbl => {
                const isCurrent = order.table_number === tbl.table_number;
                return (
                  <button
                    key={tbl.table_number}
                    disabled={isCurrent || isTransferring}
                    onClick={() => handleTransferTable(tbl.table_number)}
                    className={`py-3 rounded-2xl border text-center font-bold text-xs transition ${
                      isCurrent
                        ? 'bg-stone-100 text-stone-400 border-stone-200 cursor-not-allowed opacity-60'
                        : 'bg-white hover:bg-stone-950 hover:text-white border-stone-300 text-stone-900 shadow-2xs active:scale-95'
                    }`}
                  >
                    M-{tbl.table_number}
                  </button>
                );
              })}
            </div>

            <div className="p-3 bg-stone-50 border border-stone-200 rounded-2xl text-center">
              <p className="text-[11px] text-stone-500">
                Layar Dapur dan Kasir akan otomatis ter-update agar pesanan tidak salah diantar.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* MODAL PANGGIL PELAYAN */}
      {isCallWaiterOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="w-full max-w-sm bg-white rounded-3xl p-5 shadow-2xl border border-stone-200 space-y-3.5">
            <div className="flex items-center justify-between pb-2 border-b border-stone-100">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center font-bold">
                  <Bell className="w-4 h-4" />
                </div>
                <h3 className="font-black text-xs uppercase tracking-tight text-stone-950">
                  Panggil Pelayan • Meja {order.table_number}
                </h3>
              </div>
              <button onClick={() => setIsCallWaiterOpen(false)} className="text-stone-400 hover:text-stone-900">
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-stone-500 leading-relaxed">
              Pilih bantuan yang Anda butuhkan, pelayan kami akan segera datang ke Meja {order.table_number}:
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
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-center text-xs text-emerald-800 font-bold flex items-center justify-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>{callSuccessNotice}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* DYNAMIC TIMED QRIS MODAL */}
      {isQrisModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl text-center space-y-4 border border-stone-200">
            <div className="flex justify-between items-center pb-2 border-b border-stone-100">
              <span className="font-black text-xs uppercase tracking-wider text-stone-800">
                Pembayaran QRIS Dinamis
              </span>
              <button 
                onClick={() => setIsQrisModalOpen(false)}
                className="text-stone-400 hover:text-stone-900"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-1">
              <p className="text-2xl font-black text-amber-950 font-mono tracking-tight">
                {formatRupiah(order.total_amount)}
              </p>
              <p className="text-[11px] text-stone-500">
                Pindai dengan GoPay, OVO, Dana, ShopeePay, atau BCA Mobile
              </p>
            </div>

            {/* Countdown Badge */}
            <div className="flex items-center justify-center space-x-1.5">
              <div className={`px-3 py-1 rounded-full text-xs font-mono font-bold flex items-center space-x-1.5 ${
                isQrisExpired 
                  ? 'bg-rose-100 text-rose-700 border border-rose-200' 
                  : qrisTimeLeft < 60 
                  ? 'bg-amber-100 text-amber-800 border border-amber-300 animate-pulse' 
                  : 'bg-stone-100 text-stone-800 border border-stone-200'
              }`}>
                <Clock className="w-3.5 h-3.5" />
                <span>{isQrisExpired ? 'QR Expired' : `Sisa Waktu: ${formatTimer(qrisTimeLeft)}`}</span>
              </div>
            </div>

            {/* QR Image Container */}
            <div className="relative mx-auto w-64 h-64 bg-white p-3 rounded-3xl border-2 border-dashed border-stone-300 flex items-center justify-center shadow-inner">
              {isQrisExpired ? (
                <div className="absolute inset-0 bg-white/95 backdrop-blur-xs rounded-3xl flex flex-col items-center justify-center p-4 space-y-2">
                  <AlertTriangle className="w-8 h-8 text-rose-500" />
                  <p className="text-xs font-bold text-stone-800">QRIS Telah Kedaluwarsa</p>
                  <p className="text-[11px] text-stone-500 text-center">Silakan buat kode baru untuk melanjutkan transaksi.</p>
                  <button
                    onClick={handleRegenerateQris}
                    className="mt-1 bg-stone-950 hover:bg-stone-800 text-white text-xs font-bold px-4 py-2 rounded-xl flex items-center gap-1.5 transition shadow-sm"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Perbarui QRIS</span>
                  </button>
                </div>
              ) : qrisDataUrl ? (
                <img 
                  src={qrisDataUrl} 
                  alt="QRIS Pembayaran Resto" 
                  className="w-full h-full object-contain"
                />
              ) : (
                <div className="text-xs text-stone-400 animate-pulse">Menyiapkan QRIS...</div>
              )}
            </div>

            <div className="space-y-2 pt-1">
              <button
                onClick={async () => {
                  await updateOrderStatus(order.id, { payment_status: 'waiting_confirmation' });
                  setOrder(prev => (prev ? { ...prev, payment_status: 'waiting_confirmation' } : null));
                  setIsQrisModalOpen(false);
                }}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-2xl text-xs flex items-center justify-center gap-1.5 transition shadow-warm-md active:scale-98"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Saya Sudah Membayar</span>
              </button>
              
              <button
                onClick={() => setIsQrisModalOpen(false)}
                className="w-full text-stone-500 hover:text-stone-800 text-xs py-1"
              >
                Bayar Nanti di Kasir
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default function StatusPage() {
  return (
    <Suspense fallback={<div className="bg-[#FAF8F5] min-h-screen flex items-center justify-center text-xs font-bold text-stone-500">Memuat status pesanan...</div>}>
      <StatusContent />
    </Suspense>
  );
}
