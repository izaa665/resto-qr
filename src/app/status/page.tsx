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
  Sparkles
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

  // Load order data
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

  // Scan mismatch detection: if query 'meja' is different from order.table_number
  useEffect(() => {
    if (order && order.table_number && queryTable) {
      const scannedTableNum = parseInt(queryTable, 10);
      if (scannedTableNum > 0 && scannedTableNum !== order.table_number) {
        setShowScanMismatch(true);
      }
    }
  }, [order?.table_number, queryTable]);

  // Realtime order listener
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

  // QRIS Timer
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
      color: { dark: '#0a0a0a', light: '#ffffff' }
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
      <div className="bg-neutral-50 min-h-screen flex items-center justify-center p-4">
        <div className="text-center space-y-2">
          <div className="w-8 h-8 border-2 border-neutral-900 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-xs font-semibold text-neutral-500">Memuat status pesanan Anda...</p>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="bg-neutral-50 min-h-screen flex flex-col items-center justify-center p-6 text-center">
        <div className="w-14 h-14 rounded-2xl bg-neutral-200 flex items-center justify-center text-neutral-400 mb-3">
          <Receipt className="w-7 h-7" />
        </div>
        <h2 className="font-bold text-base text-neutral-900">Belum Ada Pesanan Aktif</h2>
        <p className="text-xs text-neutral-500 max-w-xs mt-1 mb-6">
          Anda belum memiliki pesanan aktif di meja ini atau pesanan sebelumnya telah selesai.
        </p>
        <Link
          href={`/?meja=${queryTable || '5'}`}
          className="bg-neutral-950 text-white font-bold px-5 py-2.5 rounded-xl text-xs shadow-md hover:bg-neutral-800 transition"
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
    <div className="bg-neutral-100 min-h-screen text-neutral-900 font-sans pb-16 selection:bg-neutral-900 selection:text-white">
      
      {/* Top Navbar */}
      <header className="bg-white border-b border-neutral-200 sticky top-0 z-30 px-4 py-3">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <Link
            href={`/?meja=${order.table_number || queryTable || '5'}`}
            className="flex items-center space-x-1.5 text-xs font-semibold text-neutral-700 hover:text-neutral-950 transition"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Kembali ke Menu</span>
          </Link>
          <div className="flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-tight">Live Tracking</span>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-md mx-auto px-4 pt-4 space-y-3.5">

        {/* Scan Mismatch Alert */}
        {showScanMismatch && (
          <div className="bg-amber-500 text-neutral-950 p-4 rounded-2xl shadow-md border border-amber-600/30 animate-in fade-in space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-neutral-950 shrink-0" />
                <h4 className="font-bold text-xs uppercase">Pindah Duduk ke Meja {queryTable}?</h4>
              </div>
              <button onClick={() => setShowScanMismatch(false)} className="text-neutral-950 hover:opacity-75">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-neutral-900 leading-relaxed">
              Anda baru saja memindai kode QR <strong>Meja {queryTable}</strong>, tetapi pesanan Anda masih terdaftar di <strong>Meja {order.table_number}</strong>.
            </p>
            <div className="flex gap-2 pt-1">
              <button
                disabled={isTransferring}
                onClick={() => handleTransferTable(parseInt(queryTable!, 10))}
                className="bg-neutral-950 text-white font-bold px-3 py-1.5 rounded-xl text-xs hover:bg-neutral-800 transition"
              >
                {isTransferring ? 'Memindahkan...' : `Ya, Pindah ke Meja ${queryTable}`}
              </button>
              <button
                onClick={() => setShowScanMismatch(false)}
                className="bg-amber-400/80 text-neutral-950 font-semibold px-2.5 py-1.5 rounded-xl text-xs"
              >
                Tetap di Meja {order.table_number}
              </button>
            </div>
          </div>
        )}

        {/* HERO STATUS CARD */}
        <div className="bg-white rounded-2xl border border-neutral-200 p-5 shadow-sm space-y-4">
          
          {/* Header Row */}
          <div className="flex items-start justify-between pb-3 border-b border-neutral-100">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">Nomor Pesanan</p>
              <p className="font-mono text-base font-black text-neutral-950 mt-0.5">{order.order_number}</p>
              <p className="text-[11px] text-neutral-500 mt-0.5">Pemesan: <strong className="text-neutral-800">{order.customer_name}</strong></p>
            </div>
            <div className="text-right">
              {isPaid ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Lunas ({order.payment_method || 'Kasir'})</span>
                </span>
              ) : isWaitingVerification ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200 animate-pulse">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-600"></span>
                  <span>Verifikasi Kasir</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200">
                  <span>Belum Bayar</span>
                </span>
              )}
            </div>
          </div>

          {/* Large Stage Banner */}
          <div className={`p-4 rounded-xl border text-center space-y-1 ${
            order.order_status === 'pending'
              ? 'bg-neutral-950 text-white border-neutral-900'
              : order.order_status === 'processing'
              ? 'bg-blue-600 text-white border-blue-700'
              : order.order_status === 'ready'
              ? 'bg-emerald-600 text-white border-emerald-700'
              : 'bg-neutral-900 text-white border-neutral-900'
          }`}>
            <p className="text-[11px] uppercase tracking-wider font-semibold opacity-80">Tahapan Pesanan</p>
            <h3 className="text-lg font-black tracking-tight">
              {order.order_status === 'pending' && 'Pesanan Diterima Resto'}
              {order.order_status === 'processing' && 'Sedang Dimasak Koki di Dapur 🍳'}
              {order.order_status === 'ready' && 'Makanan Siap Disajikan ke Meja! 🍽️'}
              {order.order_status === 'completed' && 'Pesanan Telah Selesai. Selamat Menikmati! ✨'}
            </h3>
            <p className="text-xs opacity-90">
              {order.order_status === 'pending' && 'Tiket antrean telah masuk ke layar monitor dapur.'}
              {order.order_status === 'processing' && 'Koki sedang meracik hidangan segar untuk Anda.'}
              {order.order_status === 'ready' && 'Pelayan sedang membawakan hidangan ke nomor meja Anda.'}
              {order.order_status === 'completed' && 'Terima kasih atas kunjungan Anda di restoran kami.'}
            </p>
          </div>

          {/* Stepper Dots & Progress */}
          <div className="grid grid-cols-4 gap-1.5 pt-1 text-center text-[10px] font-bold">
            <div className={`py-2 px-1 rounded-lg border ${
              ['pending', 'processing', 'ready', 'completed'].includes(order.order_status)
                ? 'bg-neutral-900 text-white border-neutral-900'
                : 'bg-neutral-50 text-neutral-400 border-neutral-200'
            }`}>
              1. Diterima
            </div>
            <div className={`py-2 px-1 rounded-lg border ${
              ['processing', 'ready', 'completed'].includes(order.order_status)
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-neutral-50 text-neutral-400 border-neutral-200'
            }`}>
              2. Dimasak
            </div>
            <div className={`py-2 px-1 rounded-lg border ${
              ['ready', 'completed'].includes(order.order_status)
                ? 'bg-emerald-600 text-white border-emerald-600'
                : 'bg-neutral-50 text-neutral-400 border-neutral-200'
            }`}>
              3. Siap Saji
            </div>
            <div className={`py-2 px-1 rounded-lg border ${
              order.order_status === 'completed'
                ? 'bg-emerald-600 text-white border-emerald-600'
                : 'bg-neutral-50 text-neutral-400 border-neutral-200'
            }`}>
              4. Selesai
            </div>
          </div>

          {/* Table Location & Table Transfer */}
          <div className="pt-3 border-t border-neutral-100 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 rounded-lg bg-neutral-100 flex items-center justify-center text-neutral-700">
                <MapPin className="w-4 h-4 text-neutral-600" />
              </div>
              <div>
                <p className="text-[10px] text-neutral-400 font-semibold uppercase">Nomor Meja</p>
                <p className="text-xs font-black text-neutral-950">Meja {order.table_number || '-'}</p>
              </div>
            </div>

            <button
              onClick={() => setIsTransferModalOpen(true)}
              className="flex items-center space-x-1.5 px-3 py-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 text-xs font-semibold rounded-xl border border-neutral-200 transition active:scale-95"
            >
              <ArrowLeftRight className="w-3.5 h-3.5 text-neutral-600" />
              <span>Pindah Meja</span>
            </button>
          </div>

          {transferNotice && (
            <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 font-semibold flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{transferNotice}</span>
            </div>
          )}

          {/* Quick Buttons: Call Waiter / Settle */}
          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              onClick={() => setIsCallWaiterOpen(true)}
              className="py-2.5 px-3 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition border border-neutral-200"
            >
              <Bell className="w-3.5 h-3.5 text-amber-600" />
              <span>Panggil Pelayan</span>
            </button>

            {!isPaid ? (
              <button
                onClick={() => {
                  if (isQrisExpired || qrisTimeLeft <= 0) handleRegenerateQris();
                  setIsQrisModalOpen(true);
                }}
                className="py-2.5 px-3 bg-neutral-950 hover:bg-neutral-900 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition shadow-sm"
              >
                <QrCode className="w-3.5 h-3.5 text-amber-400" />
                <span>Bayar QRIS ({isQrisExpired ? 'Expired' : formatTimer(qrisTimeLeft)})</span>
              </button>
            ) : (
              <Link
                href={`/?meja=${order.table_number || '5'}`}
                className="py-2.5 px-3 bg-neutral-950 hover:bg-neutral-900 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition text-center"
              >
                <Utensils className="w-3.5 h-3.5 text-amber-400" />
                <span>Pesan Menu Lain</span>
              </Link>
            )}
          </div>
        </div>

        {/* ORDER ITEMS BREAKDOWN CARD */}
        <div className="bg-white rounded-2xl border border-neutral-200 p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-neutral-100">
            <h4 className="font-bold text-xs uppercase tracking-tight text-neutral-950">Rincian Menu Dipesan</h4>
            <span className="text-[11px] font-semibold text-neutral-500">{(order.items || []).length} Menu</span>
          </div>

          <div className="divide-y divide-neutral-100 text-xs">
            {(order.items || []).map((item, idx) => (
              <div key={idx} className="py-2.5 flex justify-between items-start">
                <div className="pr-3 space-y-0.5">
                  <p className="font-bold text-neutral-900">
                    <span className="text-amber-600 font-black mr-1">{item.qty}x</span>
                    {item.menu_name}
                  </p>
                  {item.item_notes && (
                    <p className="text-[11px] text-neutral-400 italic">Catatan: {item.item_notes}</p>
                  )}
                </div>
                <span className="font-semibold text-neutral-900 shrink-0 font-mono">
                  {formatRupiah(item.subtotal)}
                </span>
              </div>
            ))}
          </div>

          {order.notes && (
            <div className="p-2.5 bg-neutral-50 border border-neutral-200 rounded-xl text-xs text-neutral-600 italic">
              <strong>Catatan Pesanan:</strong> {order.notes}
            </div>
          )}

          {/* Pricing Totals */}
          <div className="pt-3 border-t border-neutral-100 space-y-1.5 text-xs">
            <div className="flex justify-between text-neutral-500">
              <span>Subtotal Menu</span>
              <span className="font-mono">{formatRupiah(order.total_amount - (order.tax_amount || 0))}</span>
            </div>
            {Boolean(order.tax_amount) && (
              <div className="flex justify-between text-neutral-500">
                <span>Pajak Restoran PB1 (10%)</span>
                <span className="font-mono">{formatRupiah(order.tax_amount || 0)}</span>
              </div>
            )}
            <div className="flex justify-between text-sm font-black text-neutral-950 pt-1.5 border-t border-neutral-100">
              <span>Total Tagihan</span>
              <span className="font-mono">{formatRupiah(order.total_amount)}</span>
            </div>
          </div>
        </div>

        {/* RESTAURANT WI-FI & INFO CARD */}
        {setting?.wifi_password && (
          <div className="bg-white rounded-2xl border border-neutral-200 p-4 shadow-sm flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 shrink-0">
                <Wifi className="w-4 h-4" />
              </div>
              <div>
                <p className="text-[10px] uppercase font-bold text-neutral-400">Wi-Fi Restoran</p>
                <p className="text-xs font-bold text-neutral-900">{setting.wifi_password}</p>
              </div>
            </div>
            <button
              onClick={() => {
                navigator.clipboard.writeText(setting.wifi_password || '');
                setWifiCopied(true);
                setTimeout(() => setWifiCopied(false), 2000);
              }}
              className="text-[11px] font-semibold px-2.5 py-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-lg transition border border-neutral-200 flex items-center gap-1"
            >
              {wifiCopied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-neutral-500" />}
              <span>{wifiCopied ? 'Tersalin' : 'Salin'}</span>
            </button>
          </div>
        )}

        {/* Bottom Action: Back to Menu */}
        <div className="text-center pt-2">
          <Link
            href={`/?meja=${order.table_number || '5'}`}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-neutral-600 hover:text-neutral-950 transition"
          >
            <Utensils className="w-3.5 h-3.5" />
            <span>Ingin Tambah Makanan? Buka Menu Resto</span>
          </Link>
        </div>

      </main>

      {/* MODAL PINDAH MEJA */}
      {isTransferModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white rounded-2xl p-5 shadow-2xl border border-neutral-200 space-y-4 animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-2 border-b border-neutral-100">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-600">
                  <ArrowLeftRight className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-neutral-950">Pindah Nomor Meja</h3>
                  <p className="text-[10px] text-neutral-500">Pindahkan pesanan ke meja baru</p>
                </div>
              </div>
              <button onClick={() => setIsTransferModalOpen(false)} className="text-neutral-400 hover:text-neutral-900 p-1">
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-neutral-600 leading-relaxed">
              Pesanan Anda saat ini tercatat di <strong className="text-neutral-950">Meja {order.table_number}</strong>. Sentuh nomor meja baru tempat Anda pindah duduk:
            </p>

            <div className="grid grid-cols-5 gap-2">
              {tables.map(tbl => {
                const isCurrent = order.table_number === tbl.table_number;
                return (
                  <button
                    key={tbl.table_number}
                    disabled={isCurrent || isTransferring}
                    onClick={() => handleTransferTable(tbl.table_number)}
                    className={`py-3 rounded-xl border text-center font-bold text-xs transition ${
                      isCurrent
                        ? 'bg-neutral-100 text-neutral-400 border-neutral-200 cursor-not-allowed opacity-60'
                        : 'bg-white hover:bg-neutral-950 hover:text-white border-neutral-300 text-neutral-900 shadow-xs active:scale-95'
                    }`}
                  >
                    M-{tbl.table_number}
                  </button>
                );
              })}
            </div>

            <div className="p-2.5 bg-neutral-50 border border-neutral-200 rounded-xl text-center">
              <p className="text-[11px] text-neutral-500">
                Layar Dapur dan Kasir akan otomatis ter-update agar pesanan tidak salah diantar.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* MODAL PANGGIL PELAYAN */}
      {isCallWaiterOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white rounded-2xl p-4 shadow-xl border border-neutral-200 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-neutral-100">
              <div className="flex items-center space-x-2">
                <Bell className="w-4 h-4 text-amber-500" />
                <h3 className="font-bold text-xs uppercase tracking-tight text-neutral-950">
                  Panggil Pelayan • Meja {order.table_number}
                </h3>
              </div>
              <button onClick={() => setIsCallWaiterOpen(false)} className="text-neutral-400 hover:text-neutral-900">
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-neutral-500 leading-relaxed">
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
                  className="w-full p-2.5 rounded-xl border border-neutral-200 bg-neutral-50 hover:bg-neutral-100 hover:border-neutral-300 text-left font-semibold text-neutral-800 transition flex items-center justify-between disabled:opacity-50"
                >
                  <span>{opt.label}</span>
                  <ChevronRight className="w-3.5 h-3.5 text-neutral-400" />
                </button>
              ))}
            </div>

            {callSuccessNotice && (
              <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-center text-xs text-emerald-800 font-semibold flex items-center justify-center gap-1.5 animate-fadeIn">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>{callSuccessNotice}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* DYNAMIC TIMED QRIS MODAL */}
      {isQrisModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl text-center space-y-4 border border-neutral-200">
            <div className="flex justify-between items-center pb-2 border-b border-neutral-100">
              <span className="font-bold text-xs uppercase tracking-wider text-neutral-800">
                Pembayaran QRIS Dinamis
              </span>
              <button 
                onClick={() => setIsQrisModalOpen(false)}
                className="text-neutral-400 hover:text-neutral-900"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-1">
              <p className="text-xl font-black text-neutral-950 font-mono tracking-tight">
                {formatRupiah(order.total_amount)}
              </p>
              <p className="text-[11px] text-neutral-500">
                Pindai QRIS dengan GoPay, OVO, Dana, ShopeePay, atau BCA Mobile
              </p>
            </div>

            {/* Countdown Badge */}
            <div className="flex items-center justify-center space-x-1.5">
              <div className={`px-3 py-1 rounded-full text-xs font-mono font-bold flex items-center space-x-1.5 ${
                isQrisExpired 
                  ? 'bg-rose-100 text-rose-700 border border-rose-200' 
                  : qrisTimeLeft < 60 
                  ? 'bg-amber-100 text-amber-800 border border-amber-300 animate-pulse' 
                  : 'bg-neutral-100 text-neutral-800 border border-neutral-200'
              }`}>
                <Clock className="w-3.5 h-3.5" />
                <span>{isQrisExpired ? 'QR Expired' : `Sisa Waktu: ${formatTimer(qrisTimeLeft)}`}</span>
              </div>
            </div>

            {/* QR Image Container */}
            <div className="relative mx-auto w-64 h-64 bg-white p-3 rounded-2xl border-2 border-dashed border-neutral-300 flex items-center justify-center shadow-inner">
              {isQrisExpired ? (
                <div className="absolute inset-0 bg-white/95 backdrop-blur-xs rounded-2xl flex flex-col items-center justify-center p-4 space-y-2">
                  <AlertTriangle className="w-8 h-8 text-rose-500" />
                  <p className="text-xs font-bold text-neutral-800">QRIS Telah Kedaluwarsa</p>
                  <p className="text-[11px] text-neutral-500 text-center">Silakan buat kode baru untuk melanjutkan transaksi.</p>
                  <button
                    onClick={handleRegenerateQris}
                    className="mt-1 bg-neutral-950 hover:bg-neutral-800 text-white text-xs font-bold px-4 py-2 rounded-xl flex items-center gap-1.5 transition shadow-sm"
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
                <div className="text-xs text-neutral-400 animate-pulse">Menyiapkan QRIS...</div>
              )}
            </div>

            <div className="space-y-2 pt-1">
              <button
                onClick={async () => {
                  await updateOrderStatus(order.id, { payment_status: 'waiting_confirmation' });
                  setOrder(prev => (prev ? { ...prev, payment_status: 'waiting_confirmation' } : null));
                  setIsQrisModalOpen(false);
                }}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5 transition shadow-md shadow-emerald-600/20"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Saya Sudah Membayar</span>
              </button>
              
              <button
                onClick={() => setIsQrisModalOpen(false)}
                className="w-full text-neutral-500 hover:text-neutral-800 text-xs py-1"
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
    <Suspense fallback={<div className="bg-neutral-50 min-h-screen flex items-center justify-center text-xs font-bold text-neutral-500">Memuat status pesanan...</div>}>
      <StatusContent />
    </Suspense>
  );
}
