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
  ChefHat,
  Share2,
  Printer
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
    }
  }, [order?.id]);

  // QRIS Countdown Timer
  useEffect(() => {
    if (!isQrisModalOpen || isQrisExpired) return;

    const timer = setInterval(() => {
      setQrisTimeLeft(prev => {
        if (prev <= 1) {
          setIsQrisExpired(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isQrisModalOpen, isQrisExpired]);

  // QRIS Dynamic Code Generation
  useEffect(() => {
    if (!order) return;
    const salt = `${Date.now().toString().slice(-4)}${qrisVersion}`;
    const dynamicPayload = `00020101021226670014ID.GO.QRIS.WWW01189360052300000000000215ID1020261118001520458125303360540${order.total_amount}5802ID5913KANS RESTO6007JAKARTA62070703A016304${order.order_number}-${salt}`;

    QRCode.toDataURL(dynamicPayload, {
      width: 280,
      margin: 1,
      color: {
        dark: '#1c1917',
        light: '#ffffff',
      },
    }).then(url => {
      setQrisDataUrl(url);
    }).catch(console.error);
  }, [order?.total_amount, order?.order_number, qrisVersion]);

  const handleRegenerateQris = () => {
    setQrisTimeLeft(300);
    setIsQrisExpired(false);
    setQrisVersion(prev => prev + 1);
  };

  const handleTransferTable = async (newTableNumber: number) => {
    if (!order) return;
    setIsTransferring(true);
    const success = await updateOrderTable(order.id, newTableNumber);
    setIsTransferring(false);

    if (success) {
      setOrder(prev => prev ? { ...prev, table_number: newTableNumber } : prev);
      setTransferNotice(`Berhasil pindah ke Meja ${newTableNumber}! Dapur dan Kasir telah diperbarui.`);
      setIsTransferModalOpen(false);
      setShowScanMismatch(false);
      setTimeout(() => setTransferNotice(''), 4000);
    } else {
      alert('Gagal memindahkan meja. Silakan coba lagi.');
    }
  };

  const handleSendWaiterCall = async (callType: string) => {
    if (!order) return;
    setIsSendingCall(true);
    await createWaiterCall(order.table_number || 1, callType, order.customer_name);
    setIsSendingCall(false);
    setCallSuccessNotice(`Pelayan telah dipanggil untuk Meja ${order.table_number}!`);
    setTimeout(() => {
      setCallSuccessNotice('');
      setIsCallWaiterOpen(false);
    }, 2000);
  };

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (isLoading) {
    return (
      <div className="bg-[#F8F9FA] min-h-screen flex items-center justify-center p-4 font-sans text-xs text-gray-500">
        <div className="text-center space-y-2">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto text-orange-500" />
          <p className="font-bold">Memuat Status Pesanan...</p>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="bg-[#F8F9FA] min-h-screen flex flex-col items-center justify-center p-6 text-center font-sans space-y-4">
        <div className="w-16 h-16 rounded-3xl bg-white border border-gray-200 flex items-center justify-center text-gray-400 shadow-sm">
          <Receipt className="w-8 h-8" />
        </div>
        <div>
          <h2 className="text-base font-extrabold text-gray-900">Belum Ada Pesanan Aktif</h2>
          <p className="text-xs text-gray-400 mt-1 max-w-xs mx-auto">
            Silakan pilih menu lezat di katalog kami untuk mulai memesan.
          </p>
        </div>
        <Link
          href={`/?meja=${queryTable || '1'}`}
          className="bg-black text-white font-bold px-6 py-3 rounded-full text-xs shadow-md hover:bg-gray-800 transition active:scale-95"
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
    <div className="bg-[#F8F9FA] min-h-screen text-gray-900 font-sans pb-24 antialiased selection:bg-orange-500 selection:text-white">
      
      {/* Top Navbar */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-gray-100 px-4 sm:px-8 py-3.5 shadow-xs">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <Link
            href={`/?meja=${order.table_number || queryTable || '1'}`}
            className="flex items-center space-x-1.5 text-xs font-bold text-gray-700 hover:text-black transition active:scale-95"
          >
            <ArrowLeft className="w-4 h-4 text-gray-600" />
            <span>Kembali ke Menu</span>
          </Link>
          <div className="flex items-center space-x-2 bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-1 rounded-full text-[11px] font-bold">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>Realtime Kitchen Sync</span>
          </div>
        </div>
      </header>

      {/* Main Container - Responsive on phone, tablet, and desktop */}
      <main className="max-w-4xl mx-auto px-4 sm:px-8 pt-5 space-y-5">

        {/* Scan Mismatch Alert */}
        {showScanMismatch && (
          <div className="bg-orange-500 text-white p-4 rounded-3xl shadow-sm space-y-2 animate-in fade-in">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-white shrink-0" />
                <h4 className="font-extrabold text-xs uppercase tracking-tight">Pindah Duduk ke Meja {queryTable}?</h4>
              </div>
              <button onClick={() => setShowScanMismatch(false)} className="text-white hover:opacity-75">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-orange-100 leading-relaxed">
              Anda baru saja memindai barcode <strong>Meja {queryTable}</strong>, namun pesanan Anda terdaftar di <strong>Meja {order.table_number}</strong>.
            </p>
            <div className="flex gap-2 pt-1">
              <button
                disabled={isTransferring}
                onClick={() => handleTransferTable(parseInt(queryTable!, 10))}
                className="bg-black text-white font-bold px-3.5 py-1.5 rounded-xl text-xs hover:bg-gray-900 transition"
              >
                {isTransferring ? 'Memindahkan...' : `Ya, Pindah ke Meja ${queryTable}`}
              </button>
              <button
                onClick={() => setShowScanMismatch(false)}
                className="bg-white/20 text-white font-semibold px-3 py-1.5 rounded-xl text-xs"
              >
                Tetap di Meja {order.table_number}
              </button>
            </div>
          </div>
        )}

        {/* Hero Order Status Card */}
        <div className="bg-white rounded-3xl border border-gray-100 p-5 sm:p-7 shadow-[0_2px_12px_rgba(0,0,0,0.02)] space-y-5">
          
          {/* Metadata Row */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-gray-100 gap-2">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-orange-600 block">
                Tiket Pesanan Meja {order.table_number || '-'}
              </span>
              <h2 className="font-mono text-lg font-black text-gray-900 mt-0.5">{order.order_number}</h2>
              <p className="text-xs text-gray-500 mt-0.5">Tamu: <strong className="text-gray-900">{order.customer_name}</strong></p>
            </div>

            <div className="flex items-center space-x-2">
              {isPaid ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Lunas ({order.payment_method || 'Kasir'})</span>
                </span>
              ) : isWaitingVerification ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200 animate-pulse">
                  <span className="w-2 h-2 rounded-full bg-blue-600"></span>
                  <span>Verifikasi Kasir</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200">
                  <Clock className="w-3.5 h-3.5" />
                  <span>Belum Bayar</span>
                </span>
              )}
            </div>
          </div>

          {/* Animated Cooking / Preparation Banner */}
          <div className={`p-6 rounded-3xl text-center space-y-1.5 transition ${
            order.order_status === 'pending'
              ? 'bg-orange-50 border border-orange-200 text-orange-950'
              : order.order_status === 'processing'
              ? 'bg-blue-50 border border-blue-200 text-blue-950'
              : order.order_status === 'ready'
              ? 'bg-emerald-50 border border-emerald-200 text-emerald-950'
              : 'bg-gray-100 text-gray-900 border border-gray-200'
          }`}>
            <div className="flex items-center justify-center space-x-1.5 text-[11px] uppercase tracking-wider font-extrabold opacity-75">
              {order.order_status === 'processing' && <ChefHat className="w-4 h-4 text-blue-600 animate-bounce" />}
              {order.order_status === 'ready' && <Sparkles className="w-4 h-4 text-emerald-600" />}
              <span>Status Pesanan Saat Ini</span>
            </div>

            <h3 className="text-lg sm:text-2xl font-black tracking-tight">
              {order.order_status === 'pending' && 'Pesanan Telah Diterima Dapur 📋'}
              {order.order_status === 'processing' && 'Sedang Dimasak Koki di Dapur 🍳'}
              {order.order_status === 'ready' && 'Makanan Siap Disajikan ke Meja Anda! 🍽️'}
              {order.order_status === 'completed' && 'Pesanan Selesai. Selamat Menikmati! ✨'}
            </h3>

            <p className="text-xs opacity-85 max-w-md mx-auto leading-relaxed">
              {order.order_status === 'pending' && 'Tiket Anda telah terkirim dan masuk ke antrean KDS dapur.'}
              {order.order_status === 'processing' && 'Koki kami sedang mengolah hidangan segar Anda dengan bumbu istimewa.'}
              {order.order_status === 'ready' && 'Pelayan sedang membawakan hidangan langsung ke meja Anda.'}
              {order.order_status === 'completed' && 'Terima kasih telah berkunjung ke restoran kami.'}
            </p>
          </div>

          {/* 4-Step Visual Progress Bar */}
          <div className="grid grid-cols-4 gap-2 pt-1 text-center text-[10px] sm:text-xs font-bold">
            <div className={`py-2.5 px-1 rounded-2xl border transition ${
              ['pending', 'processing', 'ready', 'completed'].includes(order.order_status)
                ? 'bg-black text-white border-black'
                : 'bg-gray-50 text-gray-400 border-gray-200'
            }`}>
              1. Diterima
            </div>
            <div className={`py-2.5 px-1 rounded-2xl border transition ${
              ['processing', 'ready', 'completed'].includes(order.order_status)
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-gray-50 text-gray-400 border-gray-200'
            }`}>
              2. Dimasak
            </div>
            <div className={`py-2.5 px-1 rounded-2xl border transition ${
              ['ready', 'completed'].includes(order.order_status)
                ? 'bg-emerald-600 text-white border-emerald-600'
                : 'bg-gray-50 text-gray-400 border-gray-200'
            }`}>
              3. Siap Saji
            </div>
            <div className={`py-2.5 px-1 rounded-2xl border transition ${
              order.order_status === 'completed'
                ? 'bg-emerald-600 text-white border-emerald-600'
                : 'bg-gray-50 text-gray-400 border-gray-200'
            }`}>
              4. Selesai
            </div>
          </div>

          {/* Table Details & Actions */}
          <div className="pt-3 border-t border-gray-100 flex items-center justify-between">
            <div className="flex items-center space-x-2.5">
              <div className="w-9 h-9 rounded-2xl bg-orange-50 border border-orange-100 flex items-center justify-center text-orange-600">
                <MapPin className="w-4 h-4" />
              </div>
              <div>
                <p className="text-[10px] text-gray-400 font-bold uppercase">Lokasi Meja</p>
                <p className="text-xs sm:text-sm font-extrabold text-gray-900">Meja {order.table_number || '-'}</p>
              </div>
            </div>

            <button
              onClick={() => setIsTransferModalOpen(true)}
              className="flex items-center space-x-1.5 px-3.5 py-2 bg-gray-50 hover:bg-gray-100 text-gray-800 text-xs font-bold rounded-full border border-gray-200 transition active:scale-95"
            >
              <ArrowLeftRight className="w-3.5 h-3.5" />
              <span>Pindah Meja</span>
            </button>
          </div>

          {transferNotice && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs text-emerald-800 font-bold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{transferNotice}</span>
            </div>
          )}

          {/* Quick Action Buttons */}
          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              onClick={() => setIsCallWaiterOpen(true)}
              className="py-3 px-3 bg-gray-50 hover:bg-gray-100 text-gray-800 font-bold text-xs rounded-2xl flex items-center justify-center gap-1.5 transition border border-gray-200 active:scale-95"
            >
              <Bell className="w-4 h-4 text-orange-500" />
              <span>Panggil Pelayan</span>
            </button>

            {!isPaid ? (
              <button
                onClick={() => {
                  if (isQrisExpired || qrisTimeLeft <= 0) handleRegenerateQris();
                  setIsQrisModalOpen(true);
                }}
                className="py-3 px-3 bg-black hover:bg-gray-900 text-white font-bold text-xs rounded-2xl flex items-center justify-center gap-1.5 transition shadow-xs active:scale-95"
              >
                <QrCode className="w-4 h-4 text-orange-400" />
                <span>Bayar QRIS ({isQrisExpired ? 'Expired' : formatTimer(qrisTimeLeft)})</span>
              </button>
            ) : (
              <Link
                href={`/?meja=${order.table_number || '1'}`}
                className="py-3 px-3 bg-black hover:bg-gray-900 text-white font-bold text-xs rounded-2xl flex items-center justify-center gap-1.5 transition text-center shadow-xs active:scale-95"
              >
                <Utensils className="w-4 h-4 text-orange-400" />
                <span>Pesan Menu Lain</span>
              </Link>
            )}
          </div>

        </div>

        {/* Order Items Breakdown Card */}
        <div className="bg-white rounded-3xl border border-gray-100 p-5 sm:p-7 shadow-[0_2px_12px_rgba(0,0,0,0.02)] space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-gray-100">
            <h4 className="font-extrabold text-xs uppercase tracking-tight text-gray-900">Rincian Menu Dipesan</h4>
            <span className="text-[11px] font-bold text-gray-400">{(order.items || []).length} Hidangan</span>
          </div>

          <div className="divide-y divide-gray-100 text-xs sm:text-sm">
            {(order.items || []).map((item, idx) => (
              <div key={idx} className="py-3 flex justify-between items-start">
                <div className="pr-3 space-y-0.5">
                  <p className="font-bold text-gray-900">
                    <span className="text-orange-600 font-black mr-2 font-mono">{item.qty}x</span>
                    {item.menu_name}
                  </p>
                  {item.item_notes && (
                    <p className="text-xs text-gray-400 italic">Catatan: {item.item_notes}</p>
                  )}
                </div>
                <span className="font-bold text-gray-900 shrink-0 font-mono">
                  {formatRupiah(item.subtotal)}
                </span>
              </div>
            ))}
          </div>

          {order.notes && (
            <div className="p-3 bg-gray-50 border border-gray-100 rounded-2xl text-xs text-gray-600">
              <strong className="text-gray-700">Catatan Meja:</strong> {order.notes}
            </div>
          )}

          {/* Pricing Totals */}
          <div className="pt-3 border-t border-gray-100 space-y-1.5 text-xs text-gray-500">
            <div className="flex justify-between">
              <span>Subtotal Hidangan</span>
              <span className="font-mono text-gray-800 font-bold">{formatRupiah(order.total_amount - (order.tax_amount || 0))}</span>
            </div>
            {Boolean(order.tax_amount) && (
              <div className="flex justify-between">
                <span>Pajak Restoran PB1 (10%)</span>
                <span className="font-mono text-gray-800 font-bold">{formatRupiah(order.tax_amount || 0)}</span>
              </div>
            )}
            <div className="flex justify-between text-base font-black text-gray-900 pt-2 border-t border-gray-100">
              <span>Total Tagihan</span>
              <span className="font-mono text-emerald-600 text-lg">{formatRupiah(order.total_amount)}</span>
            </div>
          </div>
        </div>

        {/* Restaurant Wi-Fi Card */}
        {setting?.wifi_password && (
          <div className="bg-white rounded-3xl border border-gray-100 p-4 shadow-2xs flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-2xl bg-orange-50 border border-orange-100 flex items-center justify-center text-orange-600 shrink-0">
                <Wifi className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[10px] uppercase font-bold text-gray-400">Wi-Fi Restoran</p>
                <p className="text-xs font-bold text-gray-900">{setting.wifi_password}</p>
              </div>
            </div>
            <button
              onClick={() => {
                navigator.clipboard.writeText(setting.wifi_password || '');
                setWifiCopied(true);
                setTimeout(() => setWifiCopied(false), 2000);
              }}
              className="text-xs font-bold px-3 py-1.5 bg-gray-50 hover:bg-gray-100 text-gray-800 rounded-full transition border border-gray-200 flex items-center gap-1 active:scale-95"
            >
              {wifiCopied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-gray-400" />}
              <span>{wifiCopied ? 'Tersalin' : 'Salin'}</span>
            </button>
          </div>
        )}

      </main>

      {/* QRIS Dynamic Modal */}
      {isQrisModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl space-y-4 text-center">
            <div className="flex justify-between items-center pb-2 border-b border-gray-100">
              <h3 className="font-extrabold text-sm text-gray-900">Pembayaran QRIS Dinamis</h3>
              <button onClick={() => setIsQrisModalOpen(false)} className="text-gray-400 hover:text-gray-900">
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-gray-500">
              Scan barcode di bawah dengan BCA Mobile, GoPay, OVO, ShopeePay, atau DANA.
            </p>

            <div className="w-56 h-56 mx-auto bg-white p-3 rounded-2xl border border-gray-200 shadow-sm relative">
              {qrisDataUrl ? (
                <img src={qrisDataUrl} alt="QRIS" className="w-full h-full object-contain" />
              ) : (
                <div className="text-xs text-gray-400 pt-20">Menyiapkan QR...</div>
              )}
            </div>

            <div className="p-3 bg-gray-50 rounded-2xl border border-gray-100 flex items-center justify-between text-xs font-bold">
              <span className="text-gray-500">Waktu Pembayaran:</span>
              <span className={`font-mono text-sm ${qrisTimeLeft < 60 ? 'text-rose-600 font-black animate-pulse' : 'text-gray-900'}`}>
                {formatTimer(qrisTimeLeft)}
              </span>
            </div>

            <button
              onClick={() => {
                alert('Setelah scan berhasil di HP Anda, kasir akan segera mengonfirmasi lunas.');
                setIsQrisModalOpen(false);
              }}
              className="w-full bg-black hover:bg-gray-900 text-white font-bold py-3 rounded-2xl text-xs uppercase tracking-wider transition shadow-sm active:scale-98"
            >
              Saya Sudah Scan & Bayar
            </button>
          </div>
        </div>
      )}

      {/* Table Transfer Modal */}
      {isTransferModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-gray-100">
              <h3 className="font-extrabold text-sm text-gray-900">Pindah ke Meja Lain</h3>
              <button onClick={() => setIsTransferModalOpen(false)} className="text-gray-400 hover:text-gray-900">
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <p className="text-xs text-gray-500">
              Pilih nomor meja baru tempat Anda pindah duduk. Kasir dan Dapur akan langsung diperbarui.
            </p>

            <div className="grid grid-cols-4 gap-2">
              {tables.map(t => (
                <button
                  key={t.table_number}
                  disabled={isTransferring}
                  onClick={() => handleTransferTable(t.table_number)}
                  className={`py-3 rounded-2xl font-black text-xs transition ${
                    order.table_number === t.table_number
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
                <h3 className="font-extrabold text-sm text-gray-900">Panggil Pelayan ke Meja {order.table_number}</h3>
              </div>
              <button onClick={() => setIsCallWaiterOpen(false)} className="text-gray-400 hover:text-gray-900">
                <X className="w-4 h-4" />
              </button>
            </div>

            {callSuccessNotice ? (
              <div className="py-6 text-center text-xs font-bold text-emerald-600 bg-emerald-50 rounded-2xl border border-emerald-200">
                ✓ {callSuccessNotice}
              </div>
            ) : (
              <div className="space-y-2 text-xs">
                <p className="text-gray-500 text-[11px]">Pilih bantuan yang Anda perlukan:</p>
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

export default function StatusPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-xs text-gray-400">Memuat Status...</div>}>
      <StatusContent />
    </Suspense>
  );
}
