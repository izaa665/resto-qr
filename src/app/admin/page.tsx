'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  BarChart3, 
  Users, 
  Utensils, 
  QrCode, 
  Receipt, 
  Wallet, 
  Settings, 
  Plus, 
  Trash2, 
  Printer, 
  Check, 
  X, 
  Shield, 
  KeyRound, 
  TrendingUp, 
  ShoppingBag, 
  DollarSign, 
  Clock, 
  Store, 
  CheckCircle2, 
  AlertCircle,
  Eye,
  Menu as MenuIcon,
  ChevronRight
} from 'lucide-react';
import { Expense, MenuItem, Order, User, RestaurantTable, RestaurantSetting } from '@/types/database';
import { 
  fetchExpenses, 
  createExpense, 
  deleteExpense, 
  fetchMenus, 
  toggleMenuAvailability, 
  createMenuItem, 
  deleteMenuItem,
  fetchOrders,
  fetchUsers,
  createUser,
  updateUser,
  deleteUser,
  fetchTables,
  fetchSetting,
  updateSetting
} from '@/lib/supabase';
import { formatRupiah } from '@/lib/utils';

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<'analytics' | 'users' | 'menus' | 'tables' | 'orders' | 'expenses' | 'settings'>('analytics');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Data states
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [menus, setMenus] = useState<MenuItem[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [tables, setTables] = useState<RestaurantTable[]>([]);
  const [setting, setSetting] = useState<RestaurantSetting | null>(null);

  // Modals
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [isAddMenuOpen, setIsAddMenuOpen] = useState(false);
  const [isAddExpenseOpen, setIsAddExpenseOpen] = useState(false);

  // Form User
  const [newUserName, setNewUserName] = useState('');
  const [newUserUsername, setNewUserUsername] = useState('');
  const [newUserRole, setNewUserRole] = useState<'kasir' | 'dapur' | 'admin'>('kasir');
  const [newUserPin, setNewUserPin] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');

  // Form Menu
  const [menuCatId, setMenuCatId] = useState<number>(1);
  const [menuName, setMenuName] = useState('');
  const [menuDesc, setMenuDesc] = useState('');
  const [menuPrice, setMenuPrice] = useState<number>(0);
  const [menuImage, setMenuImage] = useState('');
  const [menuFilterCat, setMenuFilterCat] = useState<number | 'all'>('all');

  // Form Expense
  const [expDate, setExpDate] = useState(new Date().toISOString().slice(0, 10));
  const [expCategory, setExpCategory] = useState('Bahan Baku Makanan');
  const [expDesc, setExpDesc] = useState('');
  const [expAmount, setExpAmount] = useState<number>(0);

  // Settings Form
  const [settingName, setSettingName] = useState('');
  const [settingAddress, setSettingAddress] = useState('');
  const [settingPhone, setSettingPhone] = useState('');
  const [settingWifi, setSettingWifi] = useState('');
  const [settingTax, setSettingTax] = useState<number>(0);
  const [settingSavedNotice, setSettingSavedNotice] = useState(false);

  const loadAllData = async () => {
    const [exp, mn, ord, usr, tbl, st] = await Promise.all([
      fetchExpenses(),
      fetchMenus(),
      fetchOrders(),
      fetchUsers(),
      fetchTables(),
      fetchSetting()
    ]);
    setExpenses(exp);
    setMenus(mn);
    setOrders(ord);
    setUsers(usr);
    setTables(tbl);
    setSetting(st);

    if (st) {
      setSettingName(st.name);
      setSettingAddress(st.address);
      setSettingPhone(st.phone);
      setSettingWifi(st.wifi_password);
      setSettingTax(st.tax_percent);
    }
  };

  useEffect(() => {
    loadAllData();
  }, []);

  // Financial Calculations
  const paidOrders = orders.filter(o => o.payment_status === 'paid');
  const totalIncome = paidOrders.reduce((sum, o) => sum + o.total_amount, 0);
  const totalExpense = expenses.reduce((sum, e) => sum + e.amount, 0);
  const netProfit = totalIncome - totalExpense;
  const profitMargin = totalIncome > 0 ? Math.round((netProfit / totalIncome) * 100) : 0;
  const aov = paidOrders.length > 0 ? Math.round(totalIncome / paidOrders.length) : 0;

  // Best Sellers Calculation
  const menuSalesMap: { [name: string]: { qty: number; revenue: number } } = {};
  paidOrders.forEach(order => {
    (order.items || []).forEach(item => {
      if (!menuSalesMap[item.menu_name]) {
        menuSalesMap[item.menu_name] = { qty: 0, revenue: 0 };
      }
      menuSalesMap[item.menu_name].qty += item.qty;
      menuSalesMap[item.menu_name].revenue += item.subtotal;
    });
  });

  const bestSellers = Object.entries(menuSalesMap)
    .map(([name, data]) => ({ name, ...data }))
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 5);

  const totalItemSold = Object.values(menuSalesMap).reduce((s, m) => s + m.qty, 0);

  // Payment Methods Breakdown
  const paymentBreakdown = {
    QRIS: paidOrders.filter(o => o.payment_method?.toUpperCase().includes('QRIS')),
    Tunai: paidOrders.filter(o => o.payment_method?.toUpperCase().includes('TUNAI')),
    Debit: paidOrders.filter(o => o.payment_method?.toUpperCase().includes('KARTU') || o.payment_method?.toUpperCase().includes('DEBIT') || o.payment_method?.toUpperCase().includes('TRANSFER'))
  };

  const qrisRevenue = paymentBreakdown.QRIS.reduce((s, o) => s + o.total_amount, 0);
  const tunaiRevenue = paymentBreakdown.Tunai.reduce((s, o) => s + o.total_amount, 0);
  const debitRevenue = paymentBreakdown.Debit.reduce((s, o) => s + o.total_amount, 0);

  // Order Type Breakdown
  const dineInCount = orders.filter(o => o.order_type === 'dine_in').length;
  const takeawayCount = orders.filter(o => o.order_type === 'takeaway').length;

  // Table Performance
  const tableRevenueMap: { [tbl: number]: { count: number; revenue: number } } = {};
  paidOrders.forEach(o => {
    if (o.table_number) {
      if (!tableRevenueMap[o.table_number]) {
        tableRevenueMap[o.table_number] = { count: 0, revenue: 0 };
      }
      tableRevenueMap[o.table_number].count += 1;
      tableRevenueMap[o.table_number].revenue += o.total_amount;
    }
  });

  // Simulated 7-day sales trend
  const daysOfWeek = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];
  const dailyTrend = [
    { day: 'Sen', amount: Math.round(totalIncome * 0.11) },
    { day: 'Sel', amount: Math.round(totalIncome * 0.13) },
    { day: 'Rab', amount: Math.round(totalIncome * 0.14) },
    { day: 'Kam', amount: Math.round(totalIncome * 0.12) },
    { day: 'Jum', amount: Math.round(totalIncome * 0.18) },
    { day: 'Sab', amount: Math.round(totalIncome * 0.20) },
    { day: 'Min', amount: Math.round(totalIncome * 0.12) }
  ];
  const maxDayAmount = Math.max(...dailyTrend.map(d => d.amount), 1);

  // Handlers
  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserName.trim() || !newUserUsername.trim() || !newUserPin.trim()) {
      alert('Nama, Username, dan PIN wajib diisi!');
      return;
    }
    await createUser({
      name: newUserName.trim(),
      username: newUserUsername.trim().toLowerCase(),
      role: newUserRole,
      pin: newUserPin.trim(),
      email: newUserEmail.trim() || `${newUserUsername.trim().toLowerCase()}@resto.com`,
      is_active: true
    });
    setNewUserName('');
    setNewUserUsername('');
    setNewUserPin('');
    setNewUserEmail('');
    setIsAddUserOpen(false);
    loadAllData();
  };

  const handleToggleUserStatus = async (user: User) => {
    await updateUser(user.id, { is_active: !user.is_active });
    loadAllData();
  };

  const handleDeleteUser = async (id: number) => {
    if (confirm('Hapus akun pengguna ini secara permanen?')) {
      await deleteUser(id);
      loadAllData();
    }
  };

  const handleAddMenu = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!menuName.trim() || menuPrice <= 0) return;
    await createMenuItem({
      category_id: menuCatId,
      name: menuName.trim(),
      description: menuDesc.trim(),
      price: menuPrice,
      image: menuImage.trim() || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500&auto=format&fit=crop&q=80',
      is_available: true
    });
    setMenuName('');
    setMenuDesc('');
    setMenuPrice(0);
    setMenuImage('');
    setIsAddMenuOpen(false);
    loadAllData();
  };

  const handleToggleMenu = async (id: number, currentStatus: boolean) => {
    await toggleMenuAvailability(id, !currentStatus);
    loadAllData();
  };

  const handleDeleteMenu = async (id: number) => {
    if (confirm('Hapus menu ini dari daftar restoran?')) {
      await deleteMenuItem(id);
      loadAllData();
    }
  };

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!expDesc.trim() || expAmount <= 0) return;
    await createExpense({
      category: expCategory,
      description: expDesc.trim(),
      amount: expAmount,
      expense_date: expDate
    });
    setExpDesc('');
    setExpAmount(0);
    setIsAddExpenseOpen(false);
    loadAllData();
  };

  const handleDeleteExpense = async (id: number) => {
    if (confirm('Hapus catatan pengeluaran ini?')) {
      await deleteExpense(id);
      loadAllData();
    }
  };

  const handleSaveSetting = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateSetting({
      name: settingName.trim(),
      address: settingAddress.trim(),
      phone: settingPhone.trim(),
      wifi_password: settingWifi.trim(),
      tax_percent: settingTax
    });
    setSettingSavedNotice(true);
    setTimeout(() => setSettingSavedNotice(false), 3000);
    loadAllData();
  };

  interface NavItem {
    id: 'analytics' | 'users' | 'menus' | 'tables' | 'orders' | 'expenses' | 'settings';
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: number;
  }

  const navigationItems: NavItem[] = [
    { id: 'analytics', label: 'Statistik & Dashboard', icon: BarChart3 },
    { id: 'users', label: 'Karyawan & Kasir', icon: Users, badge: users.length },
    { id: 'menus', label: 'Katalog Menu & Stok', icon: Utensils, badge: menus.length },
    { id: 'tables', label: 'Meja & Kode QR', icon: QrCode, badge: tables.length },
    { id: 'orders', label: 'Pesanan & Transaksi', icon: Receipt, badge: orders.length },
    { id: 'expenses', label: 'Pengeluaran & Biaya', icon: Wallet },
    { id: 'settings', label: 'Pengaturan Resto', icon: Settings },
  ];

  return (
    <div className="bg-neutral-100 min-h-screen text-neutral-900 font-sans flex antialiased selection:bg-neutral-900 selection:text-white">
      
      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div 
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 bg-black/60 z-40 lg:hidden backdrop-blur-sm"
        />
      )}

      {/* Fixed Left Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-neutral-950 text-neutral-300 flex flex-col border-r border-neutral-800 transition-transform duration-200 ease-in-out lg:translate-x-0 ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        
        {/* Sidebar Brand Header */}
        <div className="p-5 border-b border-neutral-800 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Store className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-sm tracking-tight text-white uppercase">
                {setting?.name || 'Rasa Nusantara'}
              </h2>
              <p className="text-[10px] text-neutral-400 font-medium">Backoffice Resto</p>
            </div>
          </div>
          <button 
            onClick={() => setSidebarOpen(false)} 
            className="lg:hidden text-neutral-400 hover:text-white p-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Admin Identity Card */}
        <div className="p-3 mx-3 my-3 bg-neutral-900/80 rounded-xl border border-neutral-800/80 flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-lg bg-neutral-800 flex items-center justify-center font-bold text-xs text-amber-400">
            A
          </div>
          <div className="overflow-hidden">
            <p className="text-xs font-bold text-white truncate">Administrator</p>
            <p className="text-[10px] text-emerald-400 font-medium flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              Owner / Manajer
            </p>
          </div>
        </div>

        {/* Sidebar Navigation */}
        <nav className="flex-1 px-3 py-2 space-y-1 overflow-y-auto">
          {navigationItems.map(item => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setActiveTab(item.id);
                  setSidebarOpen(false);
                }}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition ${
                  isActive 
                    ? 'bg-amber-500 text-neutral-950 font-bold shadow-md shadow-amber-500/20' 
                    : 'text-neutral-400 hover:text-white hover:bg-neutral-900'
                }`}
              >
                <div className="flex items-center space-x-2.5">
                  <Icon className={`w-4 h-4 ${isActive ? 'text-neutral-950' : 'text-neutral-400'}`} />
                  <span>{item.label}</span>
                </div>
                {item.badge !== undefined && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-mono ${
                    isActive ? 'bg-neutral-950 text-amber-400 font-bold' : 'bg-neutral-900 text-neutral-500 border border-neutral-800'
                  }`}>
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Sidebar Footer */}
        <div className="p-3.5 border-t border-neutral-800 text-[11px] text-neutral-500 space-y-1">
          <div className="flex items-center justify-between text-[10px]">
            <span>Mesin Sistem:</span>
            <span className="text-emerald-400 font-medium">Online & Terhubung</span>
          </div>
          <p className="text-[10px] text-neutral-600">v2.4 Resto Engine Backoffice</p>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 lg:pl-64 flex flex-col min-h-screen">
        
        {/* Top Header */}
        <header className="bg-white border-b border-neutral-200 sticky top-0 z-30 px-4 sm:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden w-8 h-8 rounded-lg bg-neutral-100 flex items-center justify-center text-neutral-700 hover:bg-neutral-200"
            >
              <MenuIcon className="w-4 h-4" />
            </button>
            <div>
              <h1 className="font-bold text-sm tracking-tight text-neutral-950 uppercase">
                {navigationItems.find(i => i.id === activeTab)?.label}
              </h1>
              <p className="text-[11px] text-neutral-500">
                Pusat Kontrol & Manajemen Restoran
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => window.print()}
              className="bg-neutral-100 hover:bg-neutral-200 text-neutral-800 font-semibold px-3 py-1.5 rounded-lg text-xs flex items-center gap-1.5 transition"
            >
              <Printer className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Cetak Laporan</span>
            </button>
          </div>
        </header>

        {/* Tab Body */}
        <main className="p-4 sm:p-6 grow space-y-6 max-w-7xl">
          
          {/* TAB 1: ANALYTICS & STATISTIK PENJUALAN */}
          {activeTab === 'analytics' && (
            <div className="space-y-6">
              
              {/* Top Financial KPI Row */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
                <div className="bg-white rounded-2xl p-4 border border-neutral-200 shadow-sm space-y-1">
                  <div className="flex justify-between items-center text-neutral-400">
                    <span className="text-[11px] font-semibold uppercase tracking-wider">Total Omzet Penjualan</span>
                    <DollarSign className="w-4 h-4 text-emerald-600" />
                  </div>
                  <h3 className="text-xl font-black text-neutral-950">{formatRupiah(totalIncome)}</h3>
                  <p className="text-[10px] text-neutral-500 font-medium">Dari {paidOrders.length} transaksi berstatus lunas</p>
                </div>

                <div className="bg-white rounded-2xl p-4 border border-neutral-200 shadow-sm space-y-1">
                  <div className="flex justify-between items-center text-neutral-400">
                    <span className="text-[11px] font-semibold uppercase tracking-wider">Laba Bersih (Net)</span>
                    <TrendingUp className="w-4 h-4 text-amber-600" />
                  </div>
                  <h3 className={`text-xl font-black ${netProfit >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                    {formatRupiah(netProfit)}
                  </h3>
                  <p className="text-[10px] text-neutral-500 font-medium">Omzet dikurangi pengeluaran operasional</p>
                </div>

                <div className="bg-white rounded-2xl p-4 border border-neutral-200 shadow-sm space-y-1">
                  <div className="flex justify-between items-center text-neutral-400">
                    <span className="text-[11px] font-semibold uppercase tracking-wider">Rata-rata Order (AOV)</span>
                    <ShoppingBag className="w-4 h-4 text-neutral-600" />
                  </div>
                  <h3 className="text-xl font-black text-neutral-950">{formatRupiah(aov)}</h3>
                  <p className="text-[10px] text-neutral-500 font-medium">Rata-rata belanja per meja / pesanan</p>
                </div>

                <div className="bg-white rounded-2xl p-4 border border-neutral-200 shadow-sm space-y-1">
                  <div className="flex justify-between items-center text-neutral-400">
                    <span className="text-[11px] font-semibold uppercase tracking-wider">Margin Keuntungan</span>
                    <span className="text-xs font-bold text-neutral-800 font-mono">{profitMargin}%</span>
                  </div>
                  <h3 className="text-xl font-black text-neutral-950">{profitMargin}%</h3>
                  <p className="text-[10px] text-neutral-500 font-medium">Efisiensi keuangan operasional</p>
                </div>
              </div>

              {/* Chart & Distribution Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                
                {/* Visual Sales Bar Chart */}
                <div className="lg:col-span-2 bg-white rounded-2xl p-5 border border-neutral-200 shadow-sm space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
                    <div>
                      <h3 className="font-bold text-sm text-neutral-950">Tren Penjualan Mingguan</h3>
                      <p className="text-xs text-neutral-500">Estimasi distribusi transaksi harian</p>
                    </div>
                    <span className="text-[11px] font-semibold bg-neutral-100 text-neutral-700 px-2.5 py-1 rounded-lg">
                      7 Hari Terakhir
                    </span>
                  </div>

                  {/* SVG / Pure CSS Bar Visualizer */}
                  <div className="h-52 flex items-end gap-3 pt-6 pb-2 px-2">
                    {dailyTrend.map((item, idx) => {
                      const barPercent = Math.max(12, Math.round((item.amount / maxDayAmount) * 100));
                      return (
                        <div key={idx} className="flex-1 flex flex-col items-center gap-2 group h-full justify-end">
                          <span className="text-[10px] font-mono text-neutral-500 opacity-0 group-hover:opacity-100 transition whitespace-nowrap">
                            {formatRupiah(item.amount)}
                          </span>
                          <div 
                            style={{ height: `${barPercent}%` }} 
                            className="w-full bg-neutral-900 group-hover:bg-amber-500 rounded-t-lg transition duration-200"
                          />
                          <span className="text-[11px] font-bold text-neutral-600 mt-1">{item.day}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Metode Pembayaran Breakdown */}
                <div className="bg-white rounded-2xl p-5 border border-neutral-200 shadow-sm space-y-4">
                  <div className="pb-3 border-b border-neutral-100">
                    <h3 className="font-bold text-sm text-neutral-950">Metode Pembayaran</h3>
                    <p className="text-xs text-neutral-500">Distribusi realisasi pembayaran pelanggan</p>
                  </div>

                  <div className="space-y-4 pt-1">
                    {/* QRIS */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs">
                        <span className="font-semibold text-neutral-800">QRIS (GoPay/BCA/OVO)</span>
                        <span className="font-bold text-neutral-950">{formatRupiah(qrisRevenue)}</span>
                      </div>
                      <div className="w-full bg-neutral-100 rounded-full h-2 overflow-hidden">
                        <div 
                          className="bg-amber-500 h-2 rounded-full transition-all" 
                          style={{ width: `${totalIncome > 0 ? (qrisRevenue / totalIncome) * 100 : 0}%` }}
                        />
                      </div>
                      <p className="text-[10px] text-neutral-400">{paymentBreakdown.QRIS.length} transaksi</p>
                    </div>

                    {/* Tunai */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs">
                        <span className="font-semibold text-neutral-800">Tunai (Cash di Kasir)</span>
                        <span className="font-bold text-neutral-950">{formatRupiah(tunaiRevenue)}</span>
                      </div>
                      <div className="w-full bg-neutral-100 rounded-full h-2 overflow-hidden">
                        <div 
                          className="bg-emerald-600 h-2 rounded-full transition-all" 
                          style={{ width: `${totalIncome > 0 ? (tunaiRevenue / totalIncome) * 100 : 0}%` }}
                        />
                      </div>
                      <p className="text-[10px] text-neutral-400">{paymentBreakdown.Tunai.length} transaksi</p>
                    </div>

                    {/* Debit / Transfer */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs">
                        <span className="font-semibold text-neutral-800">Kartu Debit & Transfer</span>
                        <span className="font-bold text-neutral-950">{formatRupiah(debitRevenue)}</span>
                      </div>
                      <div className="w-full bg-neutral-100 rounded-full h-2 overflow-hidden">
                        <div 
                          className="bg-neutral-800 h-2 rounded-full transition-all" 
                          style={{ width: `${totalIncome > 0 ? (debitRevenue / totalIncome) * 100 : 0}%` }}
                        />
                      </div>
                      <p className="text-[10px] text-neutral-400">{paymentBreakdown.Debit.length} transaksi</p>
                    </div>
                  </div>

                  {/* Order Type Pill */}
                  <div className="pt-3 border-t border-neutral-100 flex items-center justify-between text-xs">
                    <span className="text-neutral-500">Tipe Pesanan:</span>
                    <div className="flex gap-2">
                      <span className="bg-neutral-100 px-2 py-0.5 rounded font-semibold text-neutral-800">Dine-in: {dineInCount}</span>
                      <span className="bg-neutral-100 px-2 py-0.5 rounded font-semibold text-neutral-800">Takeaway: {takeawayCount}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Best Sellers & Table Ranking */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                
                {/* Top 5 Best Sellers */}
                <div className="bg-white rounded-2xl p-5 border border-neutral-200 shadow-sm space-y-4">
                  <div className="flex justify-between items-center pb-3 border-b border-neutral-100">
                    <div>
                      <h3 className="font-bold text-sm text-neutral-950">Top 5 Menu Paling Laris</h3>
                      <p className="text-xs text-neutral-500">Menu paling sering dipesan oleh pelanggan</p>
                    </div>
                    <span className="text-xs font-mono font-bold text-neutral-500">Total: {totalItemSold} porsi</span>
                  </div>

                  <div className="space-y-3">
                    {bestSellers.length === 0 ? (
                      <p className="text-xs text-neutral-400 py-4 text-center">Belum ada menu yang lunas terjual.</p>
                    ) : (
                      bestSellers.map((item, idx) => {
                        const percent = totalItemSold > 0 ? Math.round((item.qty / totalItemSold) * 100) : 0;
                        return (
                          <div key={idx} className="space-y-1">
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-semibold text-neutral-900">{idx + 1}. {item.name}</span>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-neutral-900">{item.qty} porsi</span>
                                <span className="text-neutral-400 text-[11px]">({formatRupiah(item.revenue)})</span>
                              </div>
                            </div>
                            <div className="w-full bg-neutral-100 rounded-full h-1.5 overflow-hidden">
                              <div 
                                className="bg-amber-500 h-1.5 rounded-full" 
                                style={{ width: `${percent}%` }}
                              />
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Performa Omzet Meja */}
                <div className="bg-white rounded-2xl p-5 border border-neutral-200 shadow-sm space-y-4">
                  <div className="flex justify-between items-center pb-3 border-b border-neutral-100">
                    <div>
                      <h3 className="font-bold text-sm text-neutral-950">Performa Meja Makan</h3>
                      <p className="text-xs text-neutral-500">Ranking meja dengan perolehan omzet tertinggi</p>
                    </div>
                  </div>

                  <div className="space-y-2.5">
                    {Object.keys(tableRevenueMap).length === 0 ? (
                      <p className="text-xs text-neutral-400 py-4 text-center">Belum ada transaksi meja tersimpan.</p>
                    ) : (
                      Object.entries(tableRevenueMap)
                        .sort(([, a], [, b]) => b.revenue - a.revenue)
                        .slice(0, 5)
                        .map(([tableNum, data], idx) => (
                          <div key={idx} className="flex items-center justify-between p-2.5 bg-neutral-50 rounded-xl border border-neutral-100 text-xs">
                            <div className="flex items-center gap-2.5">
                              <span className="w-6 h-6 rounded-lg bg-neutral-900 text-white font-bold flex items-center justify-center text-[10px]">
                                #{idx + 1}
                              </span>
                              <div>
                                <p className="font-bold text-neutral-900">Meja {tableNum}</p>
                                <p className="text-[10px] text-neutral-500">{data.count} kali pemesanan</p>
                              </div>
                            </div>
                            <span className="font-bold text-neutral-950 font-mono">{formatRupiah(data.revenue)}</span>
                          </div>
                        ))
                    )}
                  </div>
                </div>

              </div>
            </div>
          )}

          {/* TAB 2: MANAJEMEN KARYAWAN & KASIR */}
          {activeTab === 'users' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-neutral-200 shadow-sm">
                <div>
                  <h3 className="font-bold text-sm text-neutral-950">Kelola Pengguna & Akun Kasir</h3>
                  <p className="text-xs text-neutral-500">Tambah akun staf kasir, atur 4-digit PIN shift, dan hak akses sistem</p>
                </div>
                <button
                  onClick={() => setIsAddUserOpen(true)}
                  className="bg-neutral-950 hover:bg-neutral-900 text-white font-semibold px-3.5 py-2 rounded-xl text-xs flex items-center gap-1.5 transition self-start sm:self-auto shadow-sm"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Tambah Karyawan Baru</span>
                </button>
              </div>

              {/* Users Table */}
              <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-neutral-50 border-b border-neutral-200 text-neutral-600 font-semibold text-[11px]">
                        <th className="py-3 px-4">Nama Karyawan</th>
                        <th className="py-3 px-4">Username</th>
                        <th className="py-3 px-4">Role Akses</th>
                        <th className="py-3 px-4">PIN Kasir</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4 text-center">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100">
                      {users.map(u => (
                        <tr key={u.id} className="hover:bg-neutral-50/50">
                          <td className="py-3 px-4 font-bold text-neutral-900 flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-lg bg-neutral-100 border border-neutral-200 flex items-center justify-center font-bold text-neutral-700 text-xs">
                              {u.name.charAt(0)}
                            </div>
                            <span>{u.name}</span>
                          </td>
                          <td className="py-3 px-4 font-mono text-neutral-600">{u.username || '-'}</td>
                          <td className="py-3 px-4">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                              u.role === 'admin' 
                                ? 'bg-amber-100 text-amber-900 border border-amber-200' 
                                : u.role === 'kasir' 
                                ? 'bg-emerald-100 text-emerald-900 border border-emerald-200' 
                                : 'bg-blue-100 text-blue-900 border border-blue-200'
                            }`}>
                              {u.role}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-mono font-bold text-neutral-800 tracking-widest">
                            {u.pin ? '••••' : 'Tanpa PIN'}
                          </td>
                          <td className="py-3 px-4">
                            <button
                              onClick={() => handleToggleUserStatus(u)}
                              className={`px-2 py-0.5 rounded-full text-[10px] font-semibold transition ${
                                u.is_active !== false 
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100' 
                                  : 'bg-neutral-100 text-neutral-500 border border-neutral-200 hover:bg-neutral-200'
                              }`}
                            >
                              {u.is_active !== false ? 'Aktif' : 'Nonaktif'}
                            </button>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <button
                              onClick={() => handleDeleteUser(u.id)}
                              className="text-neutral-400 hover:text-rose-600 p-1 transition"
                              title="Hapus Karyawan"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: KATALOG MENU & STOK */}
          {activeTab === 'menus' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-neutral-200 shadow-sm">
                <div>
                  <h3 className="font-bold text-sm text-neutral-950">Katalog Makanan & Minuman</h3>
                  <p className="text-xs text-neutral-500">Kelola daftar menu yang tampil di scan QR Meja dan Kasir POS</p>
                </div>
                <button
                  onClick={() => setIsAddMenuOpen(true)}
                  className="bg-neutral-950 hover:bg-neutral-900 text-white font-semibold px-3.5 py-2 rounded-xl text-xs flex items-center gap-1.5 transition self-start sm:self-auto"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Tambah Menu Baru</span>
                </button>
              </div>

              {/* Menu Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                {menus.map(item => (
                  <div key={item.id} className="bg-white rounded-2xl border border-neutral-200 p-3.5 flex gap-3 shadow-sm hover:shadow-md transition">
                    <img 
                      src={item.image} 
                      alt={item.name} 
                      className="w-20 h-20 rounded-xl object-cover bg-neutral-100 shrink-0" 
                    />
                    <div className="flex flex-col justify-between grow min-w-0">
                      <div>
                        <div className="flex justify-between items-start gap-1">
                          <h4 className="font-bold text-xs text-neutral-900 truncate">{item.name}</h4>
                          <button
                            onClick={() => handleDeleteMenu(item.id)}
                            className="text-neutral-300 hover:text-rose-600 transition"
                            title="Hapus Menu"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <p className="text-[10px] text-neutral-500 line-clamp-1 mt-0.5">{item.description}</p>
                        <p className="text-xs font-bold text-neutral-950 mt-1">{formatRupiah(item.price)}</p>
                      </div>

                      <div className="pt-2 border-t border-neutral-100 flex items-center justify-between">
                        <span className="text-[10px] text-neutral-500">Status:</span>
                        <button
                          onClick={() => handleToggleMenu(item.id, item.is_available)}
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded-full transition ${
                            item.is_available 
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                              : 'bg-neutral-100 text-neutral-500 border border-neutral-200'
                          }`}
                        >
                          {item.is_available ? 'Tersedia' : 'Stok Habis'}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 4: MEJA & KODE QR */}
          {activeTab === 'tables' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-neutral-200 shadow-sm">
                <div>
                  <h3 className="font-bold text-sm text-neutral-950">Manajemen Meja & QR Stand</h3>
                  <p className="text-xs text-neutral-500">Daftar meja restoran yang telah terpasang standing akrilik QR</p>
                </div>
                <Link
                  href="/qr-meja"
                  className="bg-neutral-950 hover:bg-neutral-900 text-white font-semibold px-3.5 py-2 rounded-xl text-xs flex items-center gap-1.5 transition self-start sm:self-auto"
                >
                  <QrCode className="w-3.5 h-3.5" />
                  <span>Buka Standing Generator QR Meja</span>
                </Link>
              </div>

              {/* Tables Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                {tables.map(tbl => {
                  const hasActiveOrder = orders.some(
                    o => o.table_number === tbl.table_number && 
                    o.order_status !== 'completed' && 
                    o.order_status !== 'cancelled'
                  );

                  return (
                    <div 
                      key={tbl.id} 
                      className={`p-4 rounded-2xl border text-center transition ${
                        hasActiveOrder 
                          ? 'bg-amber-50 border-amber-300 text-amber-950' 
                          : 'bg-white border-neutral-200 text-neutral-900'
                      }`}
                    >
                      <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 block mb-1">
                        {tbl.table_code}
                      </span>
                      <h4 className="text-xl font-black text-neutral-950">Meja {tbl.table_number}</h4>
                      <div className="mt-3">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          hasActiveOrder 
                            ? 'bg-amber-200/60 text-amber-900' 
                            : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        }`}>
                          {hasActiveOrder ? 'Sedang Terisi' : 'Kosong / Tersedia'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 5: PESANAN & TRANSAKSI */}
          {activeTab === 'orders' && (
            <div className="space-y-4">
              <div className="bg-white p-4 rounded-2xl border border-neutral-200 shadow-sm">
                <h3 className="font-bold text-sm text-neutral-950">Riwayat Pesanan & Transaksi Restoran</h3>
                <p className="text-xs text-neutral-500">Semua pesanan yang masuk melalui Scan QR Meja dan Kasir POS</p>
              </div>

              <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-neutral-50 border-b border-neutral-200 text-neutral-600 font-semibold text-[11px]">
                        <th className="py-3 px-4">No. Order</th>
                        <th className="py-3 px-4">Meja / Tipe</th>
                        <th className="py-3 px-4">Pelanggan</th>
                        <th className="py-3 px-4">Kasir Pelayan</th>
                        <th className="py-3 px-4">Total</th>
                        <th className="py-3 px-4">Metode</th>
                        <th className="py-3 px-4">Status Pesanan</th>
                        <th className="py-3 px-4">Status Bayar</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100">
                      {orders.map(ord => (
                        <tr key={ord.id} className="hover:bg-neutral-50/50">
                          <td className="py-3 px-4 font-mono font-bold text-neutral-900">{ord.order_number}</td>
                          <td className="py-3 px-4 font-bold">
                            {ord.order_type === 'takeaway' ? 'Takeaway' : `Meja ${ord.table_number}`}
                          </td>
                          <td className="py-3 px-4 text-neutral-700">{ord.customer_name}</td>
                          <td className="py-3 px-4">
                            <span className="text-[11px] font-semibold text-neutral-800 bg-neutral-100 px-2 py-0.5 rounded">
                              {ord.cashier_name || 'Kasir'}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-bold text-neutral-950 font-mono">{formatRupiah(ord.total_amount)}</td>
                          <td className="py-3 px-4 text-neutral-600 font-medium">{ord.payment_method}</td>
                          <td className="py-3 px-4">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-neutral-100 text-neutral-800">
                              {ord.order_status}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                              ord.payment_status === 'paid' 
                                ? 'bg-emerald-100 text-emerald-900 border border-emerald-200' 
                                : 'bg-amber-100 text-amber-900 border border-amber-200'
                            }`}>
                              {ord.payment_status === 'paid' ? 'Lunas' : 'Belum Bayar'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 6: PENGELUARAN & BIAYA */}
          {activeTab === 'expenses' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-neutral-200 shadow-sm">
                <div>
                  <h3 className="font-bold text-sm text-neutral-950">Catatan Pengeluaran & Pembelian Restoran</h3>
                  <p className="text-xs text-neutral-500">Mencatat pembelian bahan baku dapur, utilitas listrik/gas, dan gaji</p>
                </div>
                <button
                  onClick={() => setIsAddExpenseOpen(true)}
                  className="bg-neutral-950 hover:bg-neutral-900 text-white font-semibold px-3.5 py-2 rounded-xl text-xs flex items-center gap-1.5 transition self-start sm:self-auto"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Tambah Pengeluaran</span>
                </button>
              </div>

              <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-neutral-50 border-b border-neutral-200 text-neutral-600 font-semibold text-[11px]">
                        <th className="py-3 px-4">Tanggal</th>
                        <th className="py-3 px-4">Kategori Biaya</th>
                        <th className="py-3 px-4">Keterangan</th>
                        <th className="py-3 px-4 text-right">Nominal</th>
                        <th className="py-3 px-4 text-center">Hapus</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100">
                      {expenses.map(exp => (
                        <tr key={exp.id} className="hover:bg-neutral-50/50">
                          <td className="py-3 px-4 text-neutral-600 font-mono">{exp.expense_date}</td>
                          <td className="py-3 px-4">
                            <span className="bg-neutral-100 text-neutral-700 px-2 py-0.5 rounded text-[11px] font-medium border border-neutral-200">
                              {exp.category}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-neutral-900">{exp.description}</td>
                          <td className="py-3 px-4 text-right font-bold text-neutral-950 font-mono">
                            {formatRupiah(exp.amount)}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <button
                              onClick={() => handleDeleteExpense(exp.id)}
                              className="text-neutral-400 hover:text-rose-600 p-1 transition"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 7: PENGATURAN RESTORAN */}
          {activeTab === 'settings' && (
            <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-6 space-y-6 max-w-2xl">
              <div>
                <h3 className="font-bold text-sm text-neutral-950 uppercase tracking-tight">Konfigurasi Restoran</h3>
                <p className="text-xs text-neutral-500">Ubah profil resto yang tercetak pada struk kasir dan kode meja</p>
              </div>

              {settingSavedNotice && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Pengaturan restoran berhasil disimpan!</span>
                </div>
              )}

              <form onSubmit={handleSaveSetting} className="space-y-4 text-xs">
                <div>
                  <label className="block font-semibold text-neutral-700 mb-1">Nama Restoran / Outlet</label>
                  <input
                    type="text"
                    value={settingName}
                    onChange={e => setSettingName(e.target.value)}
                    className="w-full bg-white border border-neutral-200 rounded-xl px-3 py-2 text-xs font-medium focus:outline-none focus:border-neutral-900"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-neutral-700 mb-1">Alamat Outlet</label>
                  <input
                    type="text"
                    value={settingAddress}
                    onChange={e => setSettingAddress(e.target.value)}
                    className="w-full bg-white border border-neutral-200 rounded-xl px-3 py-2 text-xs font-medium focus:outline-none focus:border-neutral-900"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-neutral-700 mb-1">Nomor Telepon</label>
                    <input
                      type="text"
                      value={settingPhone}
                      onChange={e => setSettingPhone(e.target.value)}
                      className="w-full bg-white border border-neutral-200 rounded-xl px-3 py-2 text-xs font-medium focus:outline-none focus:border-neutral-900"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-neutral-700 mb-1">Password Wi-Fi Meja</label>
                    <input
                      type="text"
                      value={settingWifi}
                      onChange={e => setSettingWifi(e.target.value)}
                      className="w-full bg-white border border-neutral-200 rounded-xl px-3 py-2 text-xs font-medium focus:outline-none focus:border-neutral-900"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="bg-neutral-950 hover:bg-neutral-900 text-white font-semibold px-4 py-2 rounded-xl text-xs transition"
                >
                  Simpan Konfigurasi
                </button>
              </form>
            </div>
          )}

        </main>
      </div>

      {/* MODAL TAMBAH USER / KARYAWAN */}
      {isAddUserOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl overflow-hidden p-6 space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-neutral-100">
              <h3 className="font-bold text-sm text-neutral-950">Tambah Akun Karyawan / Kasir</h3>
              <button onClick={() => setIsAddUserOpen(false)} className="text-neutral-400 hover:text-neutral-900">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddUser} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-neutral-700 mb-1">Nama Lengkap</label>
                <input
                  type="text"
                  placeholder="Contoh: Rina Maharani"
                  value={newUserName}
                  onChange={e => setNewUserName(e.target.value)}
                  className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2 text-xs focus:bg-white"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block font-semibold text-neutral-700 mb-1">Username Login</label>
                  <input
                    type="text"
                    placeholder="rina"
                    value={newUserUsername}
                    onChange={e => setNewUserUsername(e.target.value)}
                    className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2 text-xs font-mono focus:bg-white"
                    required
                  />
                </div>

                <div>
                  <label className="block font-semibold text-neutral-700 mb-1">Role Akses</label>
                  <select
                    value={newUserRole}
                    onChange={e => setNewUserRole(e.target.value as any)}
                    className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2 text-xs focus:bg-white"
                  >
                    <option value="kasir">Kasir</option>
                    <option value="dapur">Dapur (Chef)</option>
                    <option value="admin">Admin / Manajer</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-neutral-700 mb-1">4-Digit PIN Kasir</label>
                <input
                  type="password"
                  maxLength={6}
                  placeholder="1234"
                  value={newUserPin}
                  onChange={e => setNewUserPin(e.target.value)}
                  className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2 text-xs font-mono tracking-widest focus:bg-white"
                  required
                />
                <p className="text-[10px] text-neutral-400 mt-0.5">Digunakan staf saat membuka shift kasir di terminal POS.</p>
              </div>

              <div>
                <label className="block font-semibold text-neutral-700 mb-1">Email (Opsional)</label>
                <input
                  type="email"
                  placeholder="rina@resto.com"
                  value={newUserEmail}
                  onChange={e => setNewUserEmail(e.target.value)}
                  className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2 text-xs focus:bg-white"
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="submit"
                  className="grow bg-neutral-950 hover:bg-neutral-900 text-white font-semibold py-2.5 rounded-xl text-xs transition"
                >
                  Simpan Karyawan
                </button>
                <button
                  type="button"
                  onClick={() => setIsAddUserOpen(false)}
                  className="px-4 bg-neutral-100 text-neutral-700 font-semibold py-2.5 rounded-xl text-xs hover:bg-neutral-200"
                >
                  Batal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL TAMBAH MENU */}
      {isAddMenuOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl overflow-hidden p-6 space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-neutral-100">
              <h3 className="font-bold text-sm text-neutral-950">Tambah Menu Makanan/Minuman</h3>
              <button onClick={() => setIsAddMenuOpen(false)} className="text-neutral-400 hover:text-neutral-900">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddMenu} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-neutral-700 mb-1">Kategori</label>
                <select
                  value={menuCatId}
                  onChange={e => setMenuCatId(parseInt(e.target.value))}
                  className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2 text-xs"
                >
                  <option value={1}>Makanan Utama</option>
                  <option value={2}>Minuman Segar</option>
                  <option value={3}>Camilan & Side Dish</option>
                  <option value={4}>Paket Hemat</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-neutral-700 mb-1">Nama Menu</label>
                <input
                  type="text"
                  placeholder="Contoh: Nasi Goreng Spesial"
                  value={menuName}
                  onChange={e => setMenuName(e.target.value)}
                  className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2 text-xs"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-neutral-700 mb-1">Harga Satuan (Rp)</label>
                <input
                  type="number"
                  placeholder="25000"
                  value={menuPrice || ''}
                  onChange={e => setMenuPrice(parseInt(e.target.value) || 0)}
                  className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2 text-xs font-bold"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-neutral-700 mb-1">Deskripsi Singkat</label>
                <textarea
                  placeholder="Keterangan bumbu atau sajian..."
                  value={menuDesc}
                  onChange={e => setMenuDesc(e.target.value)}
                  className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2 text-xs h-16 resize-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-neutral-700 mb-1">URL Foto Menu</label>
                <input
                  type="url"
                  placeholder="https://..."
                  value={menuImage}
                  onChange={e => setMenuImage(e.target.value)}
                  className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2 text-xs"
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="submit"
                  className="grow bg-neutral-950 hover:bg-neutral-900 text-white font-semibold py-2.5 rounded-xl text-xs transition"
                >
                  Simpan Menu
                </button>
                <button
                  type="button"
                  onClick={() => setIsAddMenuOpen(false)}
                  className="px-4 bg-neutral-100 text-neutral-700 font-semibold py-2.5 rounded-xl text-xs hover:bg-neutral-200"
                >
                  Batal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL TAMBAH PENGELUARAN */}
      {isAddExpenseOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl overflow-hidden p-6 space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-neutral-100">
              <h3 className="font-bold text-sm text-neutral-950">Catat Pengeluaran Restoran</h3>
              <button onClick={() => setIsAddExpenseOpen(false)} className="text-neutral-400 hover:text-neutral-900">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddExpense} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-neutral-700 mb-1">Tanggal</label>
                <input
                  type="date"
                  value={expDate}
                  onChange={e => setExpDate(e.target.value)}
                  className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2 text-xs"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-neutral-700 mb-1">Kategori Biaya</label>
                <select
                  value={expCategory}
                  onChange={e => setExpCategory(e.target.value)}
                  className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2 text-xs"
                >
                  <option value="Bahan Baku Makanan">Bahan Baku Dapur</option>
                  <option value="Operasional & Utilitas">Operasional & Listrik/Gas</option>
                  <option value="Gaji & Upah Staf">Gaji & Upah Karyawan</option>
                  <option value="Sewa & Pemeliharaan">Sewa Tempat & Servis</option>
                  <option value="Lain-lain">Lain-lain</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-neutral-700 mb-1">Keterangan Biaya</label>
                <input
                  type="text"
                  placeholder="Contoh: Belanja beras & bumbu dapur di pasar"
                  value={expDesc}
                  onChange={e => setExpDesc(e.target.value)}
                  className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2 text-xs"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-neutral-700 mb-1">Nominal Biaya (Rp)</label>
                <input
                  type="number"
                  placeholder="150000"
                  value={expAmount || ''}
                  onChange={e => setExpAmount(parseInt(e.target.value) || 0)}
                  className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2 text-xs font-bold"
                  required
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="submit"
                  className="grow bg-neutral-950 hover:bg-neutral-900 text-white font-semibold py-2.5 rounded-xl text-xs transition"
                >
                  Simpan Biaya
                </button>
                <button
                  type="button"
                  onClick={() => setIsAddExpenseOpen(false)}
                  className="px-4 bg-neutral-100 text-neutral-700 font-semibold py-2.5 rounded-xl text-xs hover:bg-neutral-200"
                >
                  Batal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
