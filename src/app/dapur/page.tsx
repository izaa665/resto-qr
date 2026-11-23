'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  Clock, 
  Volume2, 
  VolumeX, 
  Printer, 
  RefreshCw, 
  Timer,
  CheckSquare,
  Square,
  Bell,
  Utensils,
  Coffee,
  Flame,
  CheckCircle2,
  ChefHat,
  AlertTriangle,
  ArrowUpRight,
  Filter,
  Sparkles,
  ShoppingBag
} from 'lucide-react';
import { Order, WaiterCall } from '@/types/database';
import { fetchOrders, updateOrderStatus, fetchWaiterCalls, resolveWaiterCall, isSupabaseConfigured, supabase } from '@/lib/supabase';
import { formatRupiah, playCashierChime } from '@/lib/utils';

export default function KitchenDashboardPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [waiterCalls, setWaiterCalls] = useState<WaiterCall[]>([]);
  const [filter, setFilter] = useState<'active' | 'pending' | 'processing' | 'ready'>('active');
  const [station, setStation] = useState<'all' | 'dapur' | 'bar'>('all');
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [previousPendingCount, setPreviousPendingCount] = useState<number>(0);
  const [selectedTicketOrder, setSelectedTicketOrder] = useState<Order | null>(null);
  const [checkedItems, setCheckedItems] = useState<{ [key: string]: boolean }>({});
  const [currentTime, setCurrentTime] = useState('');

  // Clock
  useEffect(() => {
    const t = setInterval(() => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString('id-ID', { hour12: false }));
    }, 1000);
    return () => clearInterval(t);
  }, []);

  const isDrinkItem = (name: string) => {
    const n = name.toLowerCase();
    return n.includes('es ') || n.includes('kopi') || n.includes('teh') || n.includes('jus') || n.includes('air') || n.includes('latte') || n.includes('lemon') || n.includes('matcha') || n.includes('float') || n.includes('milk');
  };

  const loadOrders = async () => {
    const [data, calls] = await Promise.all([fetchOrders(), fetchWaiterCalls()]);
    setOrders(data);
    setWaiterCalls(calls);

    const pendingCount = data.filter(o => o.order_status === 'pending').length;
    if (pendingCount > previousPendingCount && previousPendingCount >= 0 && isAudioEnabled) {
      playCashierChime();
    }
    setPreviousPendingCount(pendingCount);
  };

  const handleResolveCall = async (callId: number) => {
    await resolveWaiterCall(callId);
    setWaiterCalls(prev => prev.filter(c => c.id !== callId));
  };

  useEffect(() => {
    loadOrders();

    if (isSupabaseConfigured && supabase) {
      const channel = supabase
        .channel('kitchen-kds-live')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'orders' },
          () => loadOrders()
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'waiter_calls' },
          () => loadOrders()
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    } else {
      const interval = setInterval(loadOrders, 3000);
      return () => clearInterval(interval);
    }
  }, [previousPendingCount, isAudioEnabled]);

  const handleUpdateStatus = async (orderId: number, newStatus: Order['order_status']) => {
    await updateOrderStatus(orderId, { order_status: newStatus, changed_by: 'Dapur' });
    loadOrders();
  };

  const toggleItemCheck = (orderId: number, itemIdx: number) => {
    const key = `${orderId}-${itemIdx}`;
    setCheckedItems(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const filteredOrders = orders.filter(o => {
    const matchesStatus = filter === 'active' ? (o.order_status === 'pending' || o.order_status === 'processing') : o.order_status === filter;
    if (!matchesStatus) return false;

    if (station === 'dapur') {
      return (o.items || []).some(i => !isDrinkItem(i.menu_name));
    }
    if (station === 'bar') {
      return (o.items || []).some(i => isDrinkItem(i.menu_name));
    }
    return true;
  });

  const pendingCount = orders.filter(o => o.order_status === 'pending').length;
  const processingCount = orders.filter(o => o.order_status === 'processing').length;
  const readyCount = orders.filter(o => o.order_status === 'ready').length;

  return (
    <div className="bg-[#F8F9FA] min-h-screen text-gray-900 font-sans antialiased selection:bg-orange-500 selection:text-white flex flex-col">
      
      {/* Modern KDS Header Bar */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-30 px-4 sm:px-8 py-3.5 shadow-xs">
        <div className="max-w-[1550px] mx-auto flex items-center justify-between gap-3">
          
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-2xl bg-[#FF5B26] flex items-center justify-center text-white shadow-sm">
              <ChefHat className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="font-extrabold text-sm sm:text-base tracking-tight text-gray-900 uppercase">
                  Layar Antrean Dapur (KDS)
                </h1>
              </div>
              <p className="text-[11px] text-gray-400 font-medium">Stasiun Pengolahan Makanan & Minuman</p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {/* Clock */}
            <div className="hidden sm:flex items-center space-x-1.5 bg-gray-50 border border-gray-200 px-3 py-1.5 rounded-xl text-xs font-mono font-bold text-gray-700">
              <Clock className="w-3.5 h-3.5 text-orange-500" />
              <span>{currentTime || '--:--:--'}</span>
            </div>

            {/* Audio Toggle */}
            <button
              onClick={() => {
                setIsAudioEnabled(!isAudioEnabled);
                if (!isAudioEnabled) playCashierChime();
              }}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition ${
                isAudioEnabled 
                  ? 'bg-orange-50 border-orange-200 text-orange-700' 
                  : 'bg-white border-gray-200 text-gray-400'
              }`}
            >
              {isAudioEnabled ? <Volume2 className="w-3.5 h-3.5 text-orange-600" /> : <VolumeX className="w-3.5 h-3.5" />}
              <span className="hidden md:inline">{isAudioEnabled ? 'Sirine Aktif' : 'Mute'}</span>
            </button>

            {/* Link to POS */}
            <Link
              href="/kasir"
              className="flex items-center space-x-1 px-3 py-1.5 rounded-xl text-xs font-bold bg-black text-white hover:bg-gray-800 transition shadow-2xs"
            >
              <span>Layar Kasir</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>

        </div>
      </header>

      {/* Main KDS Workspace */}
      <main className="max-w-[1550px] mx-auto p-4 sm:p-6 grow w-full space-y-4">

        {/* Live Waiter Calls Alert Bar */}
        {waiterCalls.length > 0 && (
          <div className="bg-gradient-to-r from-orange-500 to-amber-500 text-white p-3.5 rounded-2xl font-bold flex items-center justify-between shadow-xs">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                <Bell className="w-4 h-4 text-white" />
              </div>
              <div className="text-xs">
                <p className="font-extrabold uppercase tracking-wide">
                  Panggilan Tamu Meja {waiterCalls[0].table_number}
                </p>
                <p className="text-[11px] text-orange-100 font-medium">
                  "{waiterCalls[0].call_type}" ({waiterCalls[0].customer_name || 'Tamu'})
                  {waiterCalls.length > 1 && ` (+${waiterCalls.length - 1} panggilan lainnya)`}
                </p>
              </div>
            </div>
            <button
              onClick={() => handleResolveCall(waiterCalls[0].id)}
              className="bg-black hover:bg-gray-900 text-white px-3.5 py-1.5 rounded-xl text-xs font-black transition active:scale-95 shadow-2xs"
            >
              ✓ Selesai
            </button>
          </div>
        )}

        {/* Filters and Station Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-2 gap-3">
          
          {/* Status filter pills */}
          <div className="flex items-center space-x-2 overflow-x-auto no-scrollbar">
            <button
              onClick={() => setFilter('active')}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition ${
                filter === 'active' 
                  ? 'bg-black text-white shadow-xs' 
                  : 'bg-white text-gray-600 hover:text-gray-900 border border-gray-200'
              }`}
            >
              Semua Antrean ({pendingCount + processingCount})
            </button>

            <button
              onClick={() => setFilter('pending')}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition ${
                filter === 'pending' 
                  ? 'bg-[#FF5B26] text-white shadow-xs' 
                  : 'bg-white text-gray-600 hover:text-gray-900 border border-gray-200'
              }`}
            >
              Menunggu ({pendingCount})
            </button>

            <button
              onClick={() => setFilter('processing')}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition ${
                filter === 'processing' 
                  ? 'bg-blue-600 text-white shadow-xs' 
                  : 'bg-white text-gray-600 hover:text-gray-900 border border-gray-200'
              }`}
            >
              Dimasak ({processingCount})
            </button>

            <button
              onClick={() => setFilter('ready')}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition ${
                filter === 'ready' 
                  ? 'bg-emerald-600 text-white shadow-xs' 
                  : 'bg-white text-gray-600 hover:text-gray-900 border border-gray-200'
              }`}
            >
              Siap Saji ({readyCount})
            </button>
          </div>

          {/* Station selector */}
          <div className="flex items-center space-x-2 shrink-0">
            <div className="flex items-center bg-white p-1 rounded-2xl border border-gray-200 text-xs font-bold">
              <button
                onClick={() => setStation('all')}
                className={`px-3 py-1 rounded-xl transition ${
                  station === 'all' ? 'bg-black text-white shadow-2xs' : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                Semua
              </button>
              <button
                onClick={() => setStation('dapur')}
                className={`px-3 py-1 rounded-xl transition flex items-center gap-1 ${
                  station === 'dapur' ? 'bg-black text-white shadow-2xs' : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                <Utensils className="w-3 h-3" />
                <span>Makanan</span>
              </button>
              <button
                onClick={() => setStation('bar')}
                className={`px-3 py-1 rounded-xl transition flex items-center gap-1 ${
                  station === 'bar' ? 'bg-black text-white shadow-2xs' : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                <Coffee className="w-3 h-3" />
                <span>Bar Minuman</span>
              </button>
            </div>

            <button
              onClick={loadOrders}
              className="text-gray-500 hover:text-gray-900 p-2 bg-white rounded-xl border border-gray-200 transition active:scale-95"
              title="Refresh Antrean"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

        </div>

        {/* Responsive Ticket Grid: 1 col on mobile, 2 on tablet, 3 on laptop, 4 on desktop */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredOrders.map(order => {
            const isPending = order.order_status === 'pending';
            const isProcessing = order.order_status === 'processing';
            const isReady = order.order_status === 'ready';
            const elapsedMinutes = Math.floor((Date.now() - new Date(order.created_at).getTime()) / 60000);

            // Timer urgency color
            const timerBadge = elapsedMinutes > 15 ? (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-rose-50 text-rose-600 border border-rose-200 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                {elapsedMinutes}m (Terlambat)
              </span>
            ) : elapsedMinutes > 8 ? (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1">
                <Timer className="w-3 h-3" />
                {elapsedMinutes}m
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                <Timer className="w-3 h-3" />
                {elapsedMinutes}m
              </span>
            );

            return (
              <div
                key={order.id}
                className={`bg-white rounded-3xl border flex flex-col justify-between shadow-[0_2px_12px_rgba(0,0,0,0.02)] transition hover:shadow-md ${
                  isPending 
                    ? 'border-orange-200 ring-2 ring-orange-500/10' 
                    : isProcessing
                    ? 'border-blue-200 ring-2 ring-blue-500/10'
                    : 'border-emerald-200'
                }`}
              >
                <div>
                  {/* Card Header Banner */}
                  <div className={`p-4 border-b flex items-start justify-between rounded-t-3xl ${
                    isPending 
                      ? 'bg-orange-50/50 border-orange-100' 
                      : isProcessing
                      ? 'bg-blue-50/50 border-blue-100'
                      : 'bg-emerald-50/50 border-emerald-100'
                  }`}>
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-black text-base sm:text-lg text-gray-900 tracking-tight">
                          {order.order_type === 'takeaway' ? 'TAKEAWAY' : `MEJA ${String(order.table_number || '').padStart(2, '0')}`}
                        </span>
                        <span className="text-[10px] font-mono font-bold text-gray-500 bg-white px-1.5 py-0.5 rounded-md border border-gray-200">
                          #{order.order_number.slice(-3)}
                        </span>
                      </div>
                      <p className="text-xs text-gray-600 mt-0.5 font-bold truncate max-w-[150px]">
                        {order.customer_name || 'Tamu Resto'}
                      </p>
                    </div>

                    <div className="text-right">
                      {timerBadge}
                      <p className="text-[10px] text-gray-400 font-mono mt-1">
                        {new Date(order.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>

                  {/* Interactive Items Checklist */}
                  <div className="p-4 space-y-2">
                    {(order.items || []).map((item, idx) => {
                      const itemKey = `${order.id}-${idx}`;
                      const isItemChecked = Boolean(checkedItems[itemKey]);

                      return (
                        <div
                          key={idx}
                          onClick={() => toggleItemCheck(order.id, idx)}
                          className={`p-2.5 rounded-2xl cursor-pointer transition select-none border ${
                            isItemChecked
                              ? 'bg-gray-50 border-gray-200 opacity-40 line-through'
                              : 'bg-[#F9FAFB] border-gray-100 hover:border-gray-200 hover:bg-gray-50'
                          }`}
                        >
                          <div className="flex items-start space-x-2.5">
                            <span className="shrink-0 mt-0.5">
                              {isItemChecked ? (
                                <CheckSquare className="w-4 h-4 text-emerald-600" />
                              ) : (
                                <Square className="w-4 h-4 text-gray-300" />
                              )}
                            </span>
                            <div className="grow min-w-0">
                              <div className="flex items-baseline space-x-1.5">
                                <span className="font-black font-mono text-sm text-orange-600">{item.qty}x</span>
                                <span className="text-xs font-bold text-gray-900 leading-snug">{item.menu_name}</span>
                              </div>
                              {item.item_notes && (
                                <p className="text-[10px] text-amber-800 font-bold mt-1 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                                  ⚡ {item.item_notes}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    {order.notes && (
                      <div className="p-2.5 bg-gray-50 rounded-xl text-xs text-gray-700 border border-gray-200 mt-2">
                        <span className="font-bold text-gray-500 block text-[10px] uppercase">Catatan Meja:</span>
                        <span>{order.notes}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Tactile Action Footer */}
                <div className="p-3 bg-white border-t border-gray-100 rounded-b-3xl flex gap-2">
                  {isPending && (
                    <button
                      onClick={() => handleUpdateStatus(order.id, 'processing')}
                      className="grow bg-[#FF5B26] hover:bg-[#e04c1a] text-white font-extrabold py-3 min-h-[44px] rounded-2xl text-xs uppercase tracking-wider transition shadow-sm flex items-center justify-center gap-1.5 active:scale-98"
                    >
                      <Flame className="w-4 h-4" />
                      <span>Mulai Masak</span>
                    </button>
                  )}

                  {isProcessing && (
                    <button
                      onClick={() => handleUpdateStatus(order.id, 'ready')}
                      className="grow bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold py-3 min-h-[44px] rounded-2xl text-xs uppercase tracking-wider transition shadow-sm flex items-center justify-center gap-1.5 active:scale-98"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Pesanan Siap Saji</span>
                    </button>
                  )}

                  {isReady && (
                    <button
                      onClick={() => handleUpdateStatus(order.id, 'completed')}
                      className="grow bg-gray-900 hover:bg-black text-white font-bold py-3 min-h-[44px] rounded-2xl text-xs transition active:scale-98"
                    >
                      Selesai (Arsip)
                    </button>
                  )}

                  <button
                    onClick={() => {
                      setSelectedTicketOrder(order);
                      setTimeout(() => window.print(), 100);
                    }}
                    className="bg-gray-50 hover:bg-gray-100 text-gray-700 border border-gray-200 px-3.5 py-3 min-h-[44px] rounded-2xl text-xs transition active:scale-95 flex items-center justify-center"
                    title="Cetak Tiket KOT"
                  >
                    <Printer className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {filteredOrders.length === 0 && (
          <div className="text-center py-28 bg-white rounded-3xl border border-gray-100 text-gray-400">
            <ChefHat className="w-10 h-10 mx-auto mb-2 opacity-30 text-orange-500" />
            <p className="font-extrabold text-sm text-gray-700">SEMUA PESANAN TELAH SELESAI DIMASAK</p>
            <p className="text-xs text-gray-400 mt-1">Layar KDS akan berbunyi otomatis dan menyala saat ada pesanan baru masuk.</p>
          </div>
        )}

      </main>

      {/* Printable KOT Thermal Slip */}
      {selectedTicketOrder && (
        <div id="thermalReceipt" className="hidden print:block text-black p-4 text-xs font-mono">
          <div className="text-center pb-2 border-b border-black">
            <h2 className="font-bold text-xs uppercase">TIKET MASAK DAPUR (KOT)</h2>
            <p className="text-sm font-bold mt-0.5">
              {selectedTicketOrder.order_type === 'takeaway' ? 'TAKEAWAY' : `MEJA ${selectedTicketOrder.table_number}`}
            </p>
            <p className="text-[10px]">No: {selectedTicketOrder.order_number}</p>
            <p className="text-[10px]">{new Date(selectedTicketOrder.created_at).toLocaleTimeString('id-ID')}</p>
          </div>
          <div className="py-2 border-b border-black space-y-1 text-xs">
            {(selectedTicketOrder.items || []).map((item, idx) => (
              <div key={idx} className="flex justify-between font-bold">
                <span>{item.qty}x {item.menu_name}</span>
                {item.item_notes && <div className="text-[10px] font-normal">({item.item_notes})</div>}
              </div>
            ))}
          </div>
          {selectedTicketOrder.notes && (
            <p className="py-1 text-[10px]"><strong>Catatan:</strong> {selectedTicketOrder.notes}</p>
          )}
        </div>
      )}

    </div>
  );
}
