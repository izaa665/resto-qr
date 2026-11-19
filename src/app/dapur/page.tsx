'use client';

import React, { useState, useEffect } from 'react';
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
  Coffee
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
    return n.includes('es ') || n.includes('kopi') || n.includes('teh') || n.includes('jus') || n.includes('air') || n.includes('latte') || n.includes('lemon');
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
    <div className="bg-neutral-100 min-h-screen text-neutral-900 font-sans selection:bg-neutral-900 selection:text-white">
      
      {/* KDS Header Bar (Light Mode, Standalone Dapur Murni) */}
      <header className="bg-white border-b border-neutral-200 sticky top-0 z-30 px-4 sm:px-6 py-3 shadow-xs">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="font-bold text-sm tracking-tight text-neutral-950 uppercase">
                  Layar Antrean Dapur (KDS)
                </h1>
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              </div>
              <p className="text-[11px] text-neutral-500">Monitoring & Penyiapan Masakan</p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <div className="hidden sm:flex items-center space-x-1.5 bg-neutral-100 px-3 py-1.5 rounded-lg text-xs font-mono font-semibold text-neutral-800 border border-neutral-200">
              <Clock className="w-3.5 h-3.5 text-neutral-500" />
              <span>{currentTime || '--:--:--'}</span>
            </div>

            <button
              onClick={() => {
                setIsAudioEnabled(!isAudioEnabled);
                if (!isAudioEnabled) playCashierChime();
              }}
              className="flex items-center space-x-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 px-3 py-1.5 rounded-lg text-xs font-medium border border-neutral-200 transition"
            >
              {isAudioEnabled ? <Volume2 className="w-3.5 h-3.5 text-amber-600" /> : <VolumeX className="w-3.5 h-3.5 text-neutral-400" />}
              <span className="hidden sm:inline">{isAudioEnabled ? 'Audio Aktif' : 'Mute'}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main KDS Canvas */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-4">

        {/* Live Waiter Calls Alert Bar for Kitchen */}
        {waiterCalls.length > 0 && (
          <div className="bg-amber-500 text-neutral-950 p-3 rounded-xl mb-4 text-xs font-bold flex items-center justify-between shadow-md">
            <div className="flex items-center space-x-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-neutral-950 animate-ping"></span>
              <Bell className="w-4 h-4 text-neutral-950" />
              <span>
                Panggilan Meja {waiterCalls[0].table_number}: "{waiterCalls[0].call_type}" ({waiterCalls[0].customer_name || 'Tamu'})
                {waiterCalls.length > 1 && ` (+${waiterCalls.length - 1} panggilan lain)`}
              </span>
            </div>
            <button
              onClick={() => handleResolveCall(waiterCalls[0].id)}
              className="bg-neutral-950 hover:bg-neutral-900 text-white px-3 py-1 rounded-lg text-xs font-bold transition shadow-xs"
            >
              ✓ Selesai / Tangani
            </button>
          </div>
        )}

        {/* Tab Filters & Station Selector */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-neutral-200 mb-4 gap-2.5">
          <div className="flex items-center space-x-1.5 overflow-x-auto no-scrollbar">
            <button
              onClick={() => setFilter('active')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition border ${
                filter === 'active' 
                  ? 'bg-neutral-950 text-white border-neutral-950 font-bold' 
                  : 'bg-white text-neutral-700 border-neutral-200 hover:bg-neutral-50'
              }`}
            >
              Antrean Aktif ({pendingCount + processingCount})
            </button>

            <button
              onClick={() => setFilter('pending')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition border ${
                filter === 'pending' 
                  ? 'bg-amber-500 text-neutral-950 border-amber-500 font-bold' 
                  : 'bg-white text-neutral-700 border-neutral-200 hover:bg-neutral-50'
              }`}
            >
              Menunggu ({pendingCount})
            </button>

            <button
              onClick={() => setFilter('processing')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition border ${
                filter === 'processing' 
                  ? 'bg-blue-600 text-white border-blue-600 font-bold' 
                  : 'bg-white text-neutral-700 border-neutral-200 hover:bg-neutral-50'
              }`}
            >
              Sedang Dimasak ({processingCount})
            </button>

            <button
              onClick={() => setFilter('ready')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition border ${
                filter === 'ready' 
                  ? 'bg-emerald-600 text-white border-emerald-600 font-bold' 
                  : 'bg-white text-neutral-700 border-neutral-200 hover:bg-neutral-50'
              }`}
            >
              Siap Saji ({readyCount})
            </button>
          </div>

          <div className="flex items-center space-x-2 shrink-0">
            {/* Station Split */}
            <div className="flex items-center bg-white p-0.5 rounded-lg border border-neutral-200 text-xs">
              <button
                onClick={() => setStation('all')}
                className={`px-2.5 py-1 rounded-md font-semibold transition ${
                  station === 'all' ? 'bg-neutral-950 text-white' : 'text-neutral-600 hover:text-neutral-950'
                }`}
              >
                Semua
              </button>
              <button
                onClick={() => setStation('dapur')}
                className={`px-2.5 py-1 rounded-md font-semibold transition flex items-center gap-1 ${
                  station === 'dapur' ? 'bg-neutral-950 text-white' : 'text-neutral-600 hover:text-neutral-950'
                }`}
              >
                <Utensils className="w-3 h-3" />
                <span>Makanan</span>
              </button>
              <button
                onClick={() => setStation('bar')}
                className={`px-2.5 py-1 rounded-md font-semibold transition flex items-center gap-1 ${
                  station === 'bar' ? 'bg-neutral-950 text-white' : 'text-neutral-600 hover:text-neutral-950'
                }`}
              >
                <Coffee className="w-3 h-3" />
                <span>Bar / Minuman</span>
              </button>
            </div>

            <button
              onClick={loadOrders}
              className="text-neutral-500 hover:text-neutral-950 p-1.5 transition"
              title="Refresh Antrean"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Tickets Grid (Clean Light Mode) */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredOrders.map(order => {
            const isPending = order.order_status === 'pending';
            const isProcessing = order.order_status === 'processing';
            const isReady = order.order_status === 'ready';
            const elapsedMinutes = Math.floor((Date.now() - new Date(order.created_at).getTime()) / 60000);

            // Timer color urgency
            const timerColor = elapsedMinutes > 15
              ? 'bg-red-100 text-red-800 border border-red-300 font-bold'
              : elapsedMinutes > 8
              ? 'bg-amber-100 text-amber-800 border border-amber-300 font-bold'
              : 'bg-neutral-100 text-neutral-600 border border-neutral-200';

            return (
              <div
                key={order.id}
                className="bg-white rounded-xl border border-neutral-200 flex flex-col justify-between overflow-hidden shadow-xs hover:border-neutral-300 transition"
              >
                <div>
                  {/* Ticket Header Bar */}
                  <div className={`px-3.5 py-2.5 border-b flex items-start justify-between ${
                    isPending 
                      ? 'bg-amber-50 border-amber-100' 
                      : isProcessing
                      ? 'bg-blue-50 border-blue-100'
                      : 'bg-emerald-50 border-emerald-100'
                  }`}>
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className={`font-bold text-base tracking-tight ${
                          isPending ? 'text-amber-950' : isProcessing ? 'text-blue-950' : 'text-emerald-950'
                        }`}>
                          {order.order_type === 'takeaway' ? 'TAKEAWAY' : `MEJA ${String(order.table_number || '').padStart(2, '0')}`}
                        </span>
                        <span className="font-mono text-xs text-neutral-500">#{order.order_number.slice(-3)}</span>
                      </div>
                      <p className="text-[11px] text-neutral-600 mt-0.5 font-medium">{order.customer_name}</p>
                    </div>

                    <div className="flex items-center space-x-1.5">
                      <div className={`px-2 py-0.5 rounded text-[11px] font-mono flex items-center gap-1 ${timerColor}`}>
                        <Timer className="w-3 h-3" />
                        <span>{elapsedMinutes}m</span>
                      </div>
                    </div>
                  </div>

                  {/* Items List */}
                  <div className="p-3 space-y-2">
                    {(order.items || []).map((item, idx) => {
                      const itemKey = `${order.id}-${idx}`;
                      const isItemChecked = Boolean(checkedItems[itemKey]);

                      return (
                        <div 
                          key={idx}
                          onClick={() => toggleItemCheck(order.id, idx)}
                          className={`p-2 rounded-lg cursor-pointer transition select-none border ${
                            isItemChecked 
                              ? 'bg-neutral-100/60 border-neutral-200 opacity-40 line-through' 
                              : 'bg-neutral-50 border-neutral-200 hover:bg-neutral-100'
                          }`}
                        >
                          <div className="flex items-start space-x-2.5">
                            <span className="shrink-0 mt-0.5 text-neutral-400">
                              {isItemChecked ? (
                                <CheckSquare className="w-4 h-4 text-emerald-600" />
                              ) : (
                                <Square className="w-4 h-4 text-neutral-400" />
                              )}
                            </span>
                            <div className="grow min-w-0">
                              <div className="flex items-baseline space-x-1.5">
                                <span className="font-mono font-bold text-sm text-neutral-950">{item.qty}x</span>
                                <span className="text-xs font-semibold text-neutral-900 leading-snug">{item.menu_name}</span>
                              </div>
                              {item.item_notes && (
                                <p className="text-[11px] text-amber-900 font-medium mt-1 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                                  {item.item_notes}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    {order.notes && (
                      <div className="mt-2 text-[11px] bg-neutral-50 text-neutral-700 p-2 rounded-lg border border-neutral-200">
                        <span className="font-semibold text-neutral-500 block mb-0.5">Catatan Tambahan:</span>
                        <span>{order.notes}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Ticket Action Footer */}
                <div className="p-2.5 bg-neutral-50 border-t border-neutral-200 flex gap-2">
                  {isPending && (
                    <button
                      onClick={() => handleUpdateStatus(order.id, 'processing')}
                      className="grow bg-neutral-950 hover:bg-neutral-900 text-white font-semibold py-2.5 rounded-lg text-xs transition"
                    >
                      Terima & Mulai Masak
                    </button>
                  )}

                  {isProcessing && (
                    <button
                      onClick={() => handleUpdateStatus(order.id, 'ready')}
                      className="grow bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-2.5 rounded-lg text-xs transition"
                    >
                      Pesanan Siap Saji
                    </button>
                  )}

                  {isReady && (
                    <button
                      onClick={() => handleUpdateStatus(order.id, 'completed')}
                      className="grow bg-white hover:bg-neutral-100 text-neutral-800 font-semibold py-2.5 rounded-lg text-xs border border-neutral-300 transition"
                    >
                      Selesai (Arsipkan)
                    </button>
                  )}

                  <button
                    onClick={() => {
                      setSelectedTicketOrder(order);
                      setTimeout(() => window.print(), 100);
                    }}
                    className="bg-white hover:bg-neutral-100 text-neutral-700 border border-neutral-200 px-3 py-2.5 rounded-lg text-xs transition"
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
          <div className="text-center py-20 text-neutral-400 text-xs font-mono">
            TIDAK ADA ANTREAN PESANAN AKTIF DI DAPUR
          </div>
        )}

      </main>

      {/* Printable KOT */}
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
