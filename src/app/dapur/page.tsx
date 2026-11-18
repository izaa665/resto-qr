'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  Clock, 
  Volume2, 
  VolumeX, 
  Printer, 
  RefreshCw, 
  ArrowLeft, 
  Check, 
  Timer,
  CheckSquare,
  Square,
  AlertTriangle
} from 'lucide-react';
import { Order } from '@/types/database';
import { fetchOrders, updateOrderStatus, isSupabaseConfigured, supabase } from '@/lib/supabase';
import { playCashierChime } from '@/lib/utils';

export default function KitchenDashboardPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [filter, setFilter] = useState<'active' | 'pending' | 'processing' | 'ready'>('active');
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

  const loadOrders = async () => {
    const data = await fetchOrders();
    setOrders(data);

    const pendingCount = data.filter(o => o.order_status === 'pending').length;
    if (pendingCount > previousPendingCount && previousPendingCount >= 0 && isAudioEnabled) {
      playCashierChime();
    }
    setPreviousPendingCount(pendingCount);
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
    if (filter === 'active') return o.order_status === 'pending' || o.order_status === 'processing';
    return o.order_status === filter;
  });

  const pendingCount = orders.filter(o => o.order_status === 'pending').length;
  const processingCount = orders.filter(o => o.order_status === 'processing').length;
  const readyCount = orders.filter(o => o.order_status === 'ready').length;

  return (
    <div className="bg-zinc-950 min-h-screen text-zinc-100 font-sans selection:bg-zinc-800 selection:text-white">
      
      {/* KDS Header Bar */}
      <header className="bg-zinc-900 border-b border-zinc-800 sticky top-0 z-30 px-4 sm:px-6 py-2.5">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Link
              href="/"
              className="w-8 h-8 rounded-lg bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center text-zinc-400 hover:text-white transition"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-mono font-bold text-sm tracking-wider uppercase text-white">
                  KDS • KITCHEN DISPLAY
                </span>
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              </div>
              <p className="text-[11px] text-zinc-400">Antrean Masak Realtime</p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <div className="hidden sm:flex items-center space-x-2 bg-zinc-800 px-3 py-1 rounded-lg text-xs font-mono text-zinc-300">
              <Clock className="w-3.5 h-3.5 text-zinc-400" />
              <span>{currentTime || '--:--:--'}</span>
            </div>

            <button
              onClick={() => {
                setIsAudioEnabled(!isAudioEnabled);
                if (!isAudioEnabled) playCashierChime();
              }}
              className="flex items-center space-x-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-3 py-1.5 rounded-lg text-xs font-medium transition"
            >
              {isAudioEnabled ? <Volume2 className="w-3.5 h-3.5 text-amber-400" /> : <VolumeX className="w-3.5 h-3.5 text-zinc-500" />}
              <span className="hidden sm:inline">{isAudioEnabled ? 'Audio Aktif' : 'Mute'}</span>
            </button>

            <Link
              href="/kasir"
              className="bg-zinc-800 hover:bg-zinc-700 text-zinc-200 px-3 py-1.5 rounded-lg text-xs font-medium transition"
            >
              Terminal Kasir
            </Link>
          </div>
        </div>
      </header>

      {/* Main KDS Canvas */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-4">

        {/* Tab Filters */}
        <div className="flex items-center justify-between pb-3 border-b border-zinc-800 mb-4">
          <div className="flex items-center space-x-1.5">
            <button
              onClick={() => setFilter('active')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                filter === 'active' ? 'bg-zinc-100 text-zinc-950 font-bold' : 'bg-zinc-900 text-zinc-400 hover:text-white'
              }`}
            >
              Antrean Aktif ({pendingCount + processingCount})
            </button>

            <button
              onClick={() => setFilter('pending')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                filter === 'pending' ? 'bg-amber-500 text-zinc-950 font-bold' : 'bg-zinc-900 text-zinc-400 hover:text-white'
              }`}
            >
              Baru / Menunggu ({pendingCount})
            </button>

            <button
              onClick={() => setFilter('processing')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                filter === 'processing' ? 'bg-blue-500 text-white font-bold' : 'bg-zinc-900 text-zinc-400 hover:text-white'
              }`}
            >
              Sedang Dimasak ({processingCount})
            </button>

            <button
              onClick={() => setFilter('ready')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                filter === 'ready' ? 'bg-emerald-600 text-white font-bold' : 'bg-zinc-900 text-zinc-400 hover:text-white'
              }`}
            >
              Siap Saji ({readyCount})
            </button>
          </div>

          <button
            onClick={loadOrders}
            className="text-zinc-400 hover:text-white p-1.5 transition"
            title="Refresh Antrean"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {/* Tickets Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredOrders.map(order => {
            const isPending = order.order_status === 'pending';
            const isProcessing = order.order_status === 'processing';
            const isReady = order.order_status === 'ready';
            const elapsedMinutes = Math.floor((Date.now() - new Date(order.created_at).getTime()) / 60000);

            // Timer color urgency
            const timerColor = elapsedMinutes > 15
              ? 'bg-red-500 text-white font-bold animate-pulse'
              : elapsedMinutes > 8
              ? 'bg-amber-500 text-zinc-950 font-bold'
              : 'bg-zinc-800 text-zinc-300';

            return (
              <div
                key={order.id}
                className="bg-zinc-900 rounded-lg border border-zinc-800 flex flex-col justify-between overflow-hidden shadow-sm"
              >
                <div>
                  {/* Ticket Header Bar */}
                  <div className={`px-3.5 py-2.5 border-b flex items-start justify-between ${
                    isPending 
                      ? 'bg-zinc-800 border-zinc-700 text-white' 
                      : isProcessing
                      ? 'bg-blue-950 border-blue-900 text-blue-100'
                      : 'bg-emerald-950 border-emerald-900 text-emerald-100'
                  }`}>
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-base tracking-tight">
                          {order.order_type === 'takeaway' ? 'TAKEAWAY' : `MEJA ${String(order.table_number || '').padStart(2, '0')}`}
                        </span>
                        <span className="font-mono text-xs opacity-75">#{order.order_number.slice(-3)}</span>
                      </div>
                      <p className="text-[11px] opacity-80 mt-0.5 font-medium">{order.customer_name}</p>
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
                          className={`p-2 rounded cursor-pointer transition select-none border ${
                            isItemChecked 
                              ? 'bg-zinc-900/40 border-zinc-850 opacity-40 line-through' 
                              : 'bg-zinc-800/60 border-zinc-700/60 hover:bg-zinc-800'
                          }`}
                        >
                          <div className="flex items-start space-x-2.5">
                            <span className="shrink-0 mt-0.5 text-zinc-400">
                              {isItemChecked ? (
                                <CheckSquare className="w-4 h-4 text-emerald-500" />
                              ) : (
                                <Square className="w-4 h-4 text-zinc-500" />
                              )}
                            </span>
                            <div className="grow min-w-0">
                              <div className="flex items-baseline space-x-1.5">
                                <span className="font-mono font-bold text-sm text-zinc-100">{item.qty}x</span>
                                <span className="text-xs font-semibold text-zinc-100 leading-snug">{item.menu_name}</span>
                              </div>
                              {item.item_notes && (
                                <p className="text-[11px] text-amber-300 font-medium mt-1 bg-amber-950/60 px-1.5 py-0.5 rounded border border-amber-800/40">
                                  {item.item_notes}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    {order.notes && (
                      <div className="mt-2 text-[11px] bg-zinc-800 text-zinc-300 p-2 rounded border border-zinc-700">
                        <span className="font-semibold text-zinc-400 block mb-0.5">Catatan Pesanan:</span>
                        <span>{order.notes}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Ticket Action Footer */}
                <div className="p-2.5 bg-zinc-900 border-t border-zinc-800 flex gap-2">
                  {isPending && (
                    <button
                      onClick={() => handleUpdateStatus(order.id, 'processing')}
                      className="grow bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold py-2.5 rounded text-xs transition"
                    >
                      Terima & Mulai Masak
                    </button>
                  )}

                  {isProcessing && (
                    <button
                      onClick={() => handleUpdateStatus(order.id, 'ready')}
                      className="grow bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2.5 rounded text-xs transition"
                    >
                      Pesanan Siap Saji
                    </button>
                  )}

                  {isReady && (
                    <button
                      onClick={() => handleUpdateStatus(order.id, 'completed')}
                      className="grow bg-zinc-800 hover:bg-zinc-700 text-emerald-400 font-bold py-2.5 rounded text-xs border border-zinc-700 transition"
                    >
                      Selesai (Arsipkan)
                    </button>
                  )}

                  <button
                    onClick={() => {
                      setSelectedTicketOrder(order);
                      setTimeout(() => window.print(), 100);
                    }}
                    className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-3 py-2.5 rounded text-xs transition"
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
          <div className="text-center py-20 text-zinc-500 text-xs font-mono">
            TIDAK ADA ANTREAN PESANAN AKTIF
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
