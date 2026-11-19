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
  ArrowUpRight
} from 'lucide-react';
import { Order, WaiterCall } from '@/types/database';
import { fetchOrders, updateOrderStatus, fetchWaiterCalls, resolveWaiterCall, isSupabaseConfigured, supabase } from '@/lib/supabase';
import { playCashierChime } from '@/lib/utils';

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
    return n.includes('es ') || n.includes('kopi') || n.includes('teh') || n.includes('jus') || n.includes('air') || n.includes('latte') || n.includes('lemon') || n.includes('matcha');
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
        .channel('kitchen-kds')
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
    <div className="bg-[#0C0B0A] min-h-screen text-[#F5F2EC] font-sans selection:bg-amber-500 selection:text-black antialiased">
      
      {/* Heavy-Duty Industrial Top Bar */}
      <header className="bg-[#141312] border-b border-[#252320] sticky top-0 z-30 px-4 sm:px-6 py-3 shadow-lg">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3.5">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <ChefHat className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2.5">
                <h1 className="font-bold text-sm tracking-wide text-white uppercase font-mono">
                  KDS COMMAND • KITCHEN DISPLAY SYSTEM
                </h1>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  LIVE STREAM
                </span>
              </div>
              <p className="text-[11px] text-[#8C8275]">Stasiun Produksi Masakan & Bar Minuman</p>
            </div>
          </div>

          <div className="flex items-center space-x-2.5">
            {/* Live Clock Display */}
            <div className="hidden sm:flex items-center space-x-2 bg-[#1A1817] px-3.5 py-1.5 rounded-lg text-xs font-mono font-bold text-[#E8E1D5] border border-[#2B2824]">
              <Clock className="w-3.5 h-3.5 text-amber-400" />
              <span className="tracking-widest">{currentTime || '--:--:--'}</span>
            </div>

            {/* Audio Toggle */}
            <button
              onClick={() => {
                setIsAudioEnabled(!isAudioEnabled);
                if (!isAudioEnabled) playCashierChime();
              }}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
                isAudioEnabled 
                  ? 'bg-amber-500/15 border-amber-500/40 text-amber-300 hover:bg-amber-500/25' 
                  : 'bg-[#1A1817] border-[#2B2824] text-[#8C8275] hover:text-[#E8E1D5]'
              }`}
            >
              {isAudioEnabled ? <Volume2 className="w-3.5 h-3.5 text-amber-400" /> : <VolumeX className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">{isAudioEnabled ? 'Sirine Aktif' : 'Mute'}</span>
            </button>

            {/* Link to POS */}
            <Link
              href="/kasir"
              className="hidden md:flex items-center space-x-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#1A1817] text-[#A69B8D] hover:text-white border border-[#2B2824] hover:border-[#3D3934] transition"
            >
              <span>Layar Kasir</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </header>

      {/* Main KDS Workspace */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-4">

        {/* Tactical Waiter Call Banner */}
        {waiterCalls.length > 0 && (
          <div className="bg-gradient-to-r from-amber-500 to-amber-600 text-neutral-950 p-3.5 rounded-xl mb-4 font-bold flex items-center justify-between shadow-xl shadow-amber-500/10 animate-pulse">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 rounded-lg bg-black/20 flex items-center justify-center shrink-0">
                <Bell className="w-5 h-5 text-neutral-950" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-wider font-black">
                  PANGGILAN PRASMANAN • MEJA {waiterCalls[0].table_number}
                </p>
                <p className="text-[11px] font-semibold text-neutral-900 mt-0.5">
                  "{waiterCalls[0].call_type}" ({waiterCalls[0].customer_name || 'Tamu'})
                  {waiterCalls.length > 1 && ` (+${waiterCalls.length - 1} meja lainnya)`}
                </p>
              </div>
            </div>
            <button
              onClick={() => handleResolveCall(waiterCalls[0].id)}
              className="bg-neutral-950 hover:bg-neutral-900 text-white px-3.5 py-1.5 rounded-lg text-xs font-black transition tracking-wider uppercase shadow-md active:scale-95"
            >
              ✓ Selesai
            </button>
          </div>
        )}

        {/* Tab Filters & Station Selector */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3.5 border-b border-[#252320] mb-5 gap-3">
          <div className="flex items-center space-x-2 overflow-x-auto no-scrollbar">
            <button
              onClick={() => setFilter('active')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-mono font-bold whitespace-nowrap transition border ${
                filter === 'active' 
                  ? 'bg-amber-500 text-neutral-950 border-amber-500 shadow-md shadow-amber-500/20' 
                  : 'bg-[#151413] text-[#A69B8D] border-[#252320] hover:text-white hover:border-[#3D3934]'
              }`}
            >
              ANTREAN AKTIF ({pendingCount + processingCount})
            </button>

            <button
              onClick={() => setFilter('pending')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-mono font-bold whitespace-nowrap transition border ${
                filter === 'pending' 
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/60' 
                  : 'bg-[#151413] text-[#A69B8D] border-[#252320] hover:text-white'
              }`}
            >
              MENUNGGU ({pendingCount})
            </button>

            <button
              onClick={() => setFilter('processing')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-mono font-bold whitespace-nowrap transition border ${
                filter === 'processing' 
                  ? 'bg-blue-500/20 text-blue-300 border-blue-500/60' 
                  : 'bg-[#151413] text-[#A69B8D] border-[#252320] hover:text-white'
              }`}
            >
              SEDANG DIMASAK ({processingCount})
            </button>

            <button
              onClick={() => setFilter('ready')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-mono font-bold whitespace-nowrap transition border ${
                filter === 'ready' 
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/60' 
                  : 'bg-[#151413] text-[#A69B8D] border-[#252320] hover:text-white'
              }`}
            >
              SIAP SAJI ({readyCount})
            </button>
          </div>

          <div className="flex items-center space-x-2 shrink-0">
            {/* Station Split */}
            <div className="flex items-center bg-[#151413] p-1 rounded-lg border border-[#252320] text-xs font-mono">
              <button
                onClick={() => setStation('all')}
                className={`px-3 py-1 rounded-md font-bold transition ${
                  station === 'all' ? 'bg-[#2B2824] text-white shadow-xs' : 'text-[#8C8275] hover:text-white'
                }`}
              >
                SEMUA
              </button>
              <button
                onClick={() => setStation('dapur')}
                className={`px-3 py-1 rounded-md font-bold transition flex items-center gap-1.5 ${
                  station === 'dapur' ? 'bg-[#2B2824] text-amber-400 shadow-xs' : 'text-[#8C8275] hover:text-white'
                }`}
              >
                <Utensils className="w-3 h-3" />
                <span>DAPUR</span>
              </button>
              <button
                onClick={() => setStation('bar')}
                className={`px-3 py-1 rounded-md font-bold transition flex items-center gap-1.5 ${
                  station === 'bar' ? 'bg-[#2B2824] text-blue-400 shadow-xs' : 'text-[#8C8275] hover:text-white'
                }`}
              >
                <Coffee className="w-3 h-3" />
                <span>BAR</span>
              </button>
            </div>

            <button
              onClick={loadOrders}
              className="text-[#8C8275] hover:text-white p-2 rounded-lg bg-[#151413] border border-[#252320] hover:border-[#3D3934] transition"
              title="Refresh Antrean"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* High-Contrast Tactical KDS Ticket Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredOrders.map(order => {
            const isPending = order.order_status === 'pending';
            const isProcessing = order.order_status === 'processing';
            const isReady = order.order_status === 'ready';
            const elapsedMinutes = Math.floor((Date.now() - new Date(order.created_at).getTime()) / 60000);

            // Timer color urgency
            const timerBadge = elapsedMinutes > 15 ? (
              <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-rose-950/80 text-rose-300 border border-rose-700/60 flex items-center gap-1 animate-pulse">
                <AlertTriangle className="w-3 h-3 text-rose-400" />
                {elapsedMinutes}m (TERLAMBAT)
              </span>
            ) : elapsedMinutes > 8 ? (
              <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-amber-950/70 text-amber-300 border border-amber-700/50 flex items-center gap-1">
                <Timer className="w-3 h-3 text-amber-400" />
                {elapsedMinutes}m
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-emerald-950/60 text-emerald-300 border border-emerald-800/40 flex items-center gap-1">
                <Timer className="w-3 h-3 text-emerald-400" />
                {elapsedMinutes}m
              </span>
            );

            return (
              <div
                key={order.id}
                className={`bg-[#151413] rounded-2xl border flex flex-col justify-between overflow-hidden shadow-xl transition-all duration-200 ${
                  isPending 
                    ? 'border-amber-500/40 ring-1 ring-amber-500/20' 
                    : isProcessing
                    ? 'border-blue-500/40'
                    : 'border-emerald-500/40'
                }`}
              >
                <div>
                  {/* High Visibility Header Banner */}
                  <div className={`px-4 py-3 border-b flex items-center justify-between ${
                    isPending 
                      ? 'bg-amber-500/10 border-amber-500/20' 
                      : isProcessing
                      ? 'bg-blue-500/10 border-blue-500/20'
                      : 'bg-emerald-500/10 border-emerald-500/20'
                  }`}>
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-mono font-black text-lg tracking-tight text-white">
                          {order.order_type === 'takeaway' ? 'TAKEAWAY' : `MEJA ${String(order.table_number || '').padStart(2, '0')}`}
                        </span>
                        <span className="font-mono text-xs px-1.5 py-0.5 rounded bg-black/40 text-[#A69B8D] border border-white/10">
                          #{order.order_number.slice(-3)}
                        </span>
                      </div>
                      <p className="text-xs text-[#A69B8D] mt-0.5 font-medium truncate max-w-[160px]">
                        {order.customer_name || 'Tamu Resto'}
                      </p>
                    </div>

                    <div className="text-right">
                      {timerBadge}
                      <p className="text-[10px] font-mono text-[#8C8275] mt-1">
                        {new Date(order.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>

                  {/* High Contrast Recipe / Items List */}
                  <div className="p-3.5 space-y-2">
                    {(order.items || []).map((item, idx) => {
                      const itemKey = `${order.id}-${idx}`;
                      const isItemChecked = Boolean(checkedItems[itemKey]);

                      return (
                        <div 
                          key={idx}
                          onClick={() => toggleItemCheck(order.id, idx)}
                          className={`p-2.5 rounded-xl cursor-pointer transition select-none border ${
                            isItemChecked 
                              ? 'bg-[#100F0E] border-[#22201E] opacity-35 line-through' 
                              : 'bg-[#1C1A19] border-[#2B2825] hover:border-[#3E3A35] hover:bg-[#22201E]'
                          }`}
                        >
                          <div className="flex items-start space-x-3">
                            <span className="shrink-0 mt-0.5">
                              {isItemChecked ? (
                                <CheckSquare className="w-4 h-4 text-emerald-400" />
                              ) : (
                                <Square className="w-4 h-4 text-[#6E6457]" />
                              )}
                            </span>
                            <div className="grow min-w-0">
                              <div className="flex items-baseline space-x-2">
                                <span className="font-mono font-black text-base text-amber-400">{item.qty}x</span>
                                <span className="text-sm font-bold text-white leading-snug">{item.menu_name}</span>
                              </div>
                              {item.item_notes && (
                                <p className="text-[11px] text-amber-300 font-semibold mt-1 bg-amber-950/40 px-2 py-0.5 rounded border border-amber-800/40">
                                  ⚡ {item.item_notes}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    {order.notes && (
                      <div className="mt-2 text-xs bg-[#1A1817] text-[#D8CEBF] p-2.5 rounded-xl border border-[#2D2A26]">
                        <span className="font-mono font-bold text-amber-400 block mb-0.5 uppercase tracking-wider text-[10px]">
                          Catatan Meja:
                        </span>
                        <span>{order.notes}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Tactile Punch Action Footer */}
                <div className="p-3 bg-[#11100F] border-t border-[#252320] flex gap-2">
                  {isPending && (
                    <button
                      onClick={() => handleUpdateStatus(order.id, 'processing')}
                      className="grow bg-amber-500 hover:bg-amber-400 text-neutral-950 font-black py-2.5 rounded-xl text-xs uppercase tracking-wider transition shadow-lg shadow-amber-500/10 flex items-center justify-center gap-1.5 active:scale-98"
                    >
                      <Flame className="w-4 h-4 text-neutral-950" />
                      <span>Mulai Masak</span>
                    </button>
                  )}

                  {isProcessing && (
                    <button
                      onClick={() => handleUpdateStatus(order.id, 'ready')}
                      className="grow bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-black py-2.5 rounded-xl text-xs uppercase tracking-wider transition shadow-lg shadow-emerald-500/15 flex items-center justify-center gap-1.5 active:scale-98"
                    >
                      <CheckCircle2 className="w-4 h-4 text-neutral-950" />
                      <span>Siap Saji</span>
                    </button>
                  )}

                  {isReady && (
                    <button
                      onClick={() => handleUpdateStatus(order.id, 'completed')}
                      className="grow bg-[#262421] hover:bg-[#33302C] text-[#E8E1D5] font-bold py-2.5 rounded-xl text-xs border border-[#3A3631] transition active:scale-98"
                    >
                      Selesai (Arsip)
                    </button>
                  )}

                  <button
                    onClick={() => {
                      setSelectedTicketOrder(order);
                      setTimeout(() => window.print(), 100);
                    }}
                    className="bg-[#1A1817] hover:bg-[#262421] text-[#A69B8D] hover:text-white border border-[#2B2824] px-3 py-2.5 rounded-xl text-xs transition active:scale-95"
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
          <div className="text-center py-28 text-[#665D52] font-mono text-sm border border-dashed border-[#262422] rounded-3xl mt-6">
            <ChefHat className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p className="font-bold tracking-widest uppercase">SEMUA PESANAN TELAH SELESAI DISAJIKAN</p>
            <p className="text-xs text-[#524B43] mt-1 font-sans">Layar KDS akan berbunyi otomatis saat ada pesanan baru masuk.</p>
          </div>
        )}

      </main>

      {/* Printable KOT Thermal Slip */}
      {selectedTicketOrder && (
        <div id="thermalReceipt" className="hidden">
          <div className="text-center pb-2 border-b border-black">
            <h2 className="font-bold text-xs uppercase">TIKET DAPUR (KOT)</h2>
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
