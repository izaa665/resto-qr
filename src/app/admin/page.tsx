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
  ChevronRight,
  FileSpreadsheet,
  Download,
  LogOut,
  Lock,
  ArrowUpRight,
  Percent,
  Sparkles
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
  supabase,
  isSupabaseConfigured
} from '@/lib/supabase';
import { formatRupiah } from '@/lib/utils';

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<'analytics' | 'users' | 'menus' | 'tables' | 'orders' | 'expenses'>('analytics');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Admin Auth states
  const [activeAdmin, setActiveAdmin] = useState<User | null>(null);
  const [selectedAdminId, setSelectedAdminId] = useState<number | null>(null);
  const [adminPin, setAdminPin] = useState<string>('');
  const [loginError, setLoginError] = useState<string>('');
  const [isAuthLoaded, setIsAuthLoaded] = useState<boolean>(false);

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

  // Session verification on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('klir_active_admin');
      if (saved) {
        setActiveAdmin(JSON.parse(saved));
      }
    } catch (e) {
      console.error(e);
    }
    setIsAuthLoaded(true);
  }, []);

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

    if (!selectedAdminId && usr.length > 0) {
      const defaultAdmin = usr.find(u => u.role === 'admin') || usr[0];
      if (defaultAdmin) setSelectedAdminId(defaultAdmin.id);
    }
  };

  const handleAdminLogin = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setLoginError('');
    const targetUser = users.find(u => u.id === selectedAdminId) || users.find(u => u.role === 'admin');
    if (!targetUser) {
      setLoginError('Pilih akun administrator terlebih dahulu.');
      return;
    }
    if (targetUser.pin && targetUser.pin !== adminPin) {
      setLoginError('PIN Admin tidak sesuai. Silakan coba lagi.');
      return;
    }
    setActiveAdmin(targetUser);
    localStorage.setItem('klir_active_admin', JSON.stringify(targetUser));
    setAdminPin('');
  };

  const handleAdminLogout = () => {
    if (confirm('Keluar dari sesi Administrator Backoffice?')) {
      setActiveAdmin(null);
      localStorage.removeItem('klir_active_admin');
    }
  };

  const handleExportCSV = () => {
    const headers = ['ID,No_Order,Tipe,Meja,Pelanggan,Kasir,Metode_Bayar,Status_Bayar,Status_Pesanan,Total_Tagihan,Tanggal'];
    const rows = orders.map(o => {
      const date = new Date(o.created_at).toLocaleString('id-ID');
      const table = o.order_type === 'takeaway' ? 'Takeaway' : `Meja ${o.table_number || ''}`;
      return `"${o.id}","${o.order_number}","${o.order_type}","${table}","${o.customer_name}","${o.cashier_name || '-'}","${o.payment_method}","${o.payment_status}","${o.order_status}","${o.total_amount}","${date}"`;
    });
    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers, ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Laporan_Penjualan_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Full Realtime listener across all tables
  useEffect(() => {
    loadAllData();

    if (isSupabaseConfigured && supabase) {
      const channel = supabase
        .channel('admin-realtime-all')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => loadAllData())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'expenses' }, () => loadAllData())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'menus' }, () => loadAllData())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, () => loadAllData())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'restaurant_tables' }, () => loadAllData())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'waiter_calls' }, () => loadAllData())
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    } else {
      const interval = setInterval(loadAllData, 3000);
      return () => clearInterval(interval);
    }
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

  interface NavItem {
    id: 'analytics' | 'users' | 'menus' | 'tables' | 'orders' | 'expenses';
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
  ];

  // Admin Auth Gate Screen
  if (isAuthLoaded && !activeAdmin) {
    const adminUsers = users.filter(u => u.role === 'admin' && u.is_active);
    const displayAdmins = adminUsers.length > 0 ? adminUsers : users.slice(0, 3);
    const selectedAdminObj = users.find(u => u.id === selectedAdminId);

    return (
      <div className="bg-[#0E0D0C] min-h-screen text-white flex flex-col items-center justify-center p-4 font-sans selection:bg-amber-500 selection:text-neutral-950 antialiased">
        <div className="w-full max-w-md bg-[#161514] border border-[#2B2824] rounded-3xl p-6 sm:p-8 space-y-6 shadow-2xl relative">
          
          <div className="text-center space-y-2">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-xl shadow-amber-500/10">
              <Shield className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-white uppercase font-mono">
                Admin Executive Terminal
              </h1>
              <p className="text-xs text-[#8C8275] mt-1">Otorisasi & Manajemen Pemilik / Manajer Restoran</p>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[11px] font-mono font-bold text-[#8C8275] uppercase tracking-wider block">
              Pilih Akun Administrator
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {displayAdmins.map(user => {
                const isSelected = selectedAdminId === user.id;
                return (
                  <button
                    key={user.id}
                    type="button"
                    onClick={() => {
                      setSelectedAdminId(user.id);
                      setLoginError('');
                    }}
                    className={`p-3 rounded-2xl border text-left flex items-center space-x-3 transition ${
                      isSelected
                        ? 'bg-amber-500/15 border-amber-500/60 ring-1 ring-amber-500/40'
                        : 'bg-[#1C1A19] border-[#2B2824] hover:border-[#3D3A35] text-[#D4CCC0]'
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs uppercase ${
                      isSelected ? 'bg-amber-500 text-neutral-950 font-black' : 'bg-[#2B2824] text-[#8C8275]'
                    }`}>
                      {user.name.charAt(0)}
                    </div>
                    <div className="overflow-hidden">
                      <p className={`text-xs font-bold truncate ${isSelected ? 'text-amber-400' : 'text-[#E8E1D5]'}`}>
                        {user.name}
                      </p>
                      <p className="text-[10px] text-[#8C8275] uppercase font-mono">{user.role}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <form onSubmit={handleAdminLogin} className="space-y-4">
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <label className="text-[11px] font-mono font-bold text-[#8C8275] uppercase tracking-wider">PIN Masuk</label>
                {selectedAdminObj && (
                  <span className="text-[10px] text-[#8C8275]">
                    Akun: <strong className="text-amber-400">{selectedAdminObj.name}</strong>
                  </span>
                )}
              </div>
              <input
                type="password"
                maxLength={6}
                value={adminPin}
                onChange={e => {
                  setAdminPin(e.target.value);
                  setLoginError('');
                }}
                placeholder="••••"
                className="w-full bg-[#11100F] border border-[#2B2824] rounded-2xl px-4 py-3 text-center tracking-[0.6em] text-xl font-bold text-white focus:outline-none focus:border-amber-500 transition"
              />
            </div>

            <div className="grid grid-cols-3 gap-2">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
                <button
                  key={num}
                  type="button"
                  onClick={() => setAdminPin(prev => (prev.length < 6 ? prev + num : prev))}
                  className="py-3 bg-[#1C1A19] hover:bg-[#262421] border border-[#2B2824] rounded-2xl text-base font-bold text-white transition active:scale-95 shadow-xs"
                >
                  {num}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setAdminPin('')}
                className="py-3 bg-[#1C1A19] hover:bg-[#262421] border border-[#2B2824] rounded-2xl text-xs font-bold text-[#8C8275] hover:text-white transition"
              >
                CLEAR
              </button>
              <button
                type="button"
                onClick={() => setAdminPin(prev => (prev.length < 6 ? prev + '0' : prev))}
                className="py-3 bg-[#1C1A19] hover:bg-[#262421] border border-[#2B2824] rounded-2xl text-base font-bold text-white transition active:scale-95 shadow-xs"
              >
                0
              </button>
              <button
                type="button"
                onClick={() => setAdminPin(prev => prev.slice(0, -1))}
                className="py-3 bg-[#1C1A19] hover:bg-[#262421] border border-[#2B2824] rounded-2xl text-xs font-bold text-[#8C8275] hover:text-white transition"
              >
                ⌫
              </button>
            </div>

            {loginError && (
              <div className="p-3 bg-rose-950/60 border border-rose-800/60 rounded-xl text-center text-xs text-rose-300 font-medium">
                {loginError}
              </div>
            )}

            <button
              type="submit"
              className="w-full bg-amber-500 hover:bg-amber-400 text-neutral-950 font-black py-3.5 rounded-2xl text-xs uppercase tracking-wider transition shadow-xl shadow-amber-500/20 active:scale-98"
            >
              Masuk Dashboard Admin
            </button>
          </form>

          <div className="pt-3 border-t border-[#262421] flex items-center justify-between text-xs text-[#8C8275]">
            <Link href="/kasir" className="hover:text-amber-400 transition flex items-center gap-1">
              ← Layar Kasir (POS)
            </Link>
            <Link href="/" className="hover:text-amber-400 transition flex items-center gap-1">
              Halaman Pelanggan →
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#FAF8F5] min-h-screen text-[#1A1816] font-sans flex antialiased selection:bg-amber-500 selection:text-black">
      
      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div 
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 bg-black/60 z-40 lg:hidden backdrop-blur-sm"
        />
      )}

      {/* Fixed Left Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-[#141312] text-[#A69B8D] flex flex-col border-r border-[#262421] transition-transform duration-200 ease-in-out lg:translate-x-0 ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        
        {/* Sidebar Brand Header */}
        <div className="p-5 border-b border-[#262421] flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Store className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-sm tracking-tight text-white uppercase font-serif">
                {setting?.name || 'Rasa Nusantara'}
              </h2>
              <p className="text-[10px] text-[#8C8275] font-medium">Executive Backoffice</p>
            </div>
          </div>
          <button 
            onClick={() => setSidebarOpen(false)} 
            className="lg:hidden text-[#8C8275] hover:text-white p-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Admin Identity Card with Logout */}
        <div className="p-3 mx-3.5 my-3.5 bg-[#1C1A19] rounded-2xl border border-[#2B2824] flex items-center justify-between">
          <div className="flex items-center space-x-2.5 overflow-hidden">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center font-bold text-xs text-amber-400 shrink-0">
              {activeAdmin?.name?.charAt(0) || 'A'}
            </div>
            <div className="overflow-hidden">
              <p className="text-xs font-bold text-white truncate">{activeAdmin?.name || 'Administrator'}</p>
              <p className="text-[10px] text-emerald-400 font-medium flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                Owner / Manajer
              </p>
            </div>
          </div>
          <button
            onClick={handleAdminLogout}
            title="Keluar Admin"
            className="p-1.5 text-[#8C8275] hover:text-rose-400 hover:bg-[#252320] rounded-xl transition"
          >
            <LogOut className="w-4 h-4" />
          </button>
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
                    ? 'bg-amber-500 text-neutral-950 font-black shadow-lg shadow-amber-500/20' 
                    : 'text-[#9C9283] hover:text-white hover:bg-[#1C1A19]'
                }`}
              >
                <div className="flex items-center space-x-2.5">
                  <Icon className={`w-4 h-4 ${isActive ? 'text-neutral-950' : 'text-[#8C8275]'}`} />
                  <span>{item.label}</span>
                </div>
                {item.badge !== undefined && (
                  <span className={`text-[10px] px-2 py-0.5 rounded-md font-mono ${
                    isActive ? 'bg-neutral-950 text-amber-400 font-bold' : 'bg-[#1C1A19] text-[#8C8275] border border-[#2B2824]'
                  }`}>
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Sidebar Footer */}
        <div className="p-4 border-t border-[#262421] text-[11px] text-[#8C8275] space-y-1.5">
          <div className="flex items-center justify-between text-[10px]">
            <span>Mesin Sistem:</span>
            <span className="text-emerald-400 font-mono font-bold">ONLINE & SYNCED</span>
          </div>
          <p className="text-[10px] text-[#635B50] font-mono">Resto Engine v2.4 Enterprise</p>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 lg:pl-64 flex flex-col min-h-screen">
        
        {/* Top Header */}
        <header className="bg-white/90 backdrop-blur-md border-b border-stone-200/80 sticky top-0 z-30 px-4 sm:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden w-8 h-8 rounded-xl bg-stone-100 flex items-center justify-center text-stone-700 hover:bg-stone-200"
            >
              <MenuIcon className="w-4 h-4" />
            </button>
            <div>
              <h1 className="font-bold text-sm tracking-tight text-stone-900 uppercase">
                {navigationItems.find(i => i.id === activeTab)?.label}
              </h1>
              <p className="text-[11px] text-stone-500">
                Pusat Kontrol & Eksekutif Manajemen Restoran
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2.5">
            <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-800 rounded-full text-xs font-semibold border border-emerald-200/80">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              Realtime Database
            </span>

            <button
              onClick={() => window.print()}
              className="bg-white hover:bg-stone-100 text-stone-800 font-semibold px-3 py-1.5 rounded-xl text-xs flex items-center gap-1.5 border border-stone-200 shadow-warm-sm transition"
            >
              <Printer className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Cetak Dokumen</span>
            </button>

            <button
              onClick={handleAdminLogout}
              className="flex items-center space-x-1.5 px-3 py-1.5 bg-white hover:bg-rose-50 hover:text-rose-600 text-stone-700 text-xs font-semibold rounded-xl transition border border-stone-200 shadow-warm-sm"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Keluar</span>
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
                <div className="bg-white rounded-3xl p-5 border border-stone-200/90 shadow-warm-sm space-y-2">
                  <div className="flex justify-between items-center text-stone-400">
                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-stone-500">Total Omzet Penjualan</span>
                    <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                      <DollarSign className="w-4 h-4" />
                    </div>
                  </div>
                  <h3 className="text-xl sm:text-2xl font-black text-stone-900 tracking-tight">{formatRupiah(totalIncome)}</h3>
                  <p className="text-[11px] text-stone-500 font-medium">Dari {paidOrders.length} transaksi berstatus lunas</p>
                </div>

                <div className="bg-white rounded-3xl p-5 border border-stone-200/90 shadow-warm-sm space-y-2">
                  <div className="flex justify-between items-center text-stone-400">
                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-stone-500">Laba Bersih (Net)</span>
                    <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                      <TrendingUp className="w-4 h-4" />
                    </div>
                  </div>
                  <h3 className={`text-xl sm:text-2xl font-black tracking-tight ${netProfit >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                    {formatRupiah(netProfit)}
                  </h3>
                  <p className="text-[11px] text-stone-500 font-medium">Omzet dikurangi pengeluaran operasional</p>
                </div>

                <div className="bg-white rounded-3xl p-5 border border-stone-200/90 shadow-warm-sm space-y-2">
                  <div className="flex justify-between items-center text-stone-400">
                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-stone-500">Rata-rata Order (AOV)</span>
                    <div className="w-7 h-7 rounded-lg bg-stone-100 text-stone-700 flex items-center justify-center">
                      <ShoppingBag className="w-4 h-4" />
                    </div>
                  </div>
                  <h3 className="text-xl sm:text-2xl font-black text-stone-900 tracking-tight">{formatRupiah(aov)}</h3>
                  <p className="text-[11px] text-stone-500 font-medium">Rata-rata belanja per meja / pesanan</p>
                </div>

                <div className="bg-white rounded-3xl p-5 border border-stone-200/90 shadow-warm-sm space-y-2">
                  <div className="flex justify-between items-center text-stone-400">
                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-stone-500">Margin Keuntungan</span>
                    <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center font-bold text-xs">
                      %
                    </div>
                  </div>
                  <h3 className="text-xl sm:text-2xl font-black text-stone-900 tracking-tight">{profitMargin}%</h3>
                  <p className="text-[11px] text-stone-500 font-medium">Efisiensi keuangan operasional</p>
                </div>
              </div>

              {/* Chart & Distribution Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                
                {/* Visual Sales Bar Chart */}
                <div className="lg:col-span-2 bg-white rounded-3xl p-6 border border-stone-200/90 shadow-warm-sm space-y-5">
                  <div className="flex items-center justify-between pb-3 border-b border-stone-100">
                    <div>
                      <h3 className="font-bold text-sm text-stone-900">Tren Penjualan Mingguan</h3>
                      <p className="text-xs text-stone-500">Distribusi perkiraan perputaran harian</p>
                    </div>
                    <span className="text-[11px] font-mono font-bold bg-stone-100 text-stone-700 px-3 py-1 rounded-full border border-stone-200">
                      7 Hari Terakhir
                    </span>
                  </div>

                  {/* Pure CSS Bar Visualizer */}
                  <div className="h-56 flex items-end gap-3 pt-6 pb-2 px-2">
                    {dailyTrend.map((item, idx) => {
                      const barPercent = Math.max(14, Math.round((item.amount / maxDayAmount) * 100));
                      return (
                        <div key={idx} className="flex-1 flex flex-col items-center gap-2 group h-full justify-end">
                          <span className="text-[10px] font-mono text-stone-500 opacity-0 group-hover:opacity-100 transition whitespace-nowrap">
                            {formatRupiah(item.amount)}
                          </span>
                          <div 
                            style={{ height: `${barPercent}%` }} 
                            className="w-full bg-[#181615] group-hover:bg-amber-500 rounded-t-xl transition duration-200 shadow-xs"
                          />
                          <span className="text-xs font-bold text-stone-600 mt-1">{item.day}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Metode Pembayaran Breakdown */}
                <div className="bg-white rounded-3xl p-6 border border-stone-200/90 shadow-warm-sm space-y-5">
                  <div className="pb-3 border-b border-stone-100">
                    <h3 className="font-bold text-sm text-stone-900">Metode Pembayaran</h3>
                    <p className="text-xs text-stone-500">Realisasi pembayaran tamu</p>
                  </div>

                  <div className="space-y-4 pt-1">
                    {/* QRIS */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs">
                        <span className="font-semibold text-stone-800">QRIS Dinamis / Statis</span>
                        <span className="font-bold text-stone-900 font-mono">{formatRupiah(qrisRevenue)}</span>
                      </div>
                      <div className="w-full bg-stone-100 rounded-full h-2 overflow-hidden">
                        <div 
                          className="bg-amber-500 h-2 rounded-full transition-all" 
                          style={{ width: `${totalIncome > 0 ? (qrisRevenue / totalIncome) * 100 : 0}%` }}
                        />
                      </div>
                      <p className="text-[10px] text-stone-400">{paymentBreakdown.QRIS.length} transaksi</p>
                    </div>

                    {/* Tunai */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs">
                        <span className="font-semibold text-stone-800">Tunai (Cash di Kasir)</span>
                        <span className="font-bold text-stone-900 font-mono">{formatRupiah(tunaiRevenue)}</span>
                      </div>
                      <div className="w-full bg-stone-100 rounded-full h-2 overflow-hidden">
                        <div 
                          className="bg-emerald-600 h-2 rounded-full transition-all" 
                          style={{ width: `${totalIncome > 0 ? (tunaiRevenue / totalIncome) * 100 : 0}%` }}
                        />
                      </div>
                      <p className="text-[10px] text-stone-400">{paymentBreakdown.Tunai.length} transaksi</p>
                    </div>

                    {/* Debit / Transfer */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs">
                        <span className="font-semibold text-stone-800">Kartu Debit & Transfer</span>
                        <span className="font-bold text-stone-900 font-mono">{formatRupiah(debitRevenue)}</span>
                      </div>
                      <div className="w-full bg-stone-100 rounded-full h-2 overflow-hidden">
                        <div 
                          className="bg-[#181615] h-2 rounded-full transition-all" 
                          style={{ width: `${totalIncome > 0 ? (debitRevenue / totalIncome) * 100 : 0}%` }}
                        />
                      </div>
                      <p className="text-[10px] text-stone-400">{paymentBreakdown.Debit.length} transaksi</p>
                    </div>
                  </div>

                  {/* Order Type Pill */}
                  <div className="pt-3 border-t border-stone-100 flex items-center justify-between text-xs">
                    <span className="text-stone-500">Tipe Pesanan:</span>
                    <div className="flex gap-2">
                      <span className="bg-stone-100 px-2.5 py-0.5 rounded-lg font-bold text-stone-800">Dine-in: {dineInCount}</span>
                      <span className="bg-stone-100 px-2.5 py-0.5 rounded-lg font-bold text-stone-800">Takeaway: {takeawayCount}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Best Sellers & Table Ranking */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                
                {/* Top 5 Best Sellers */}
                <div className="bg-white rounded-3xl p-6 border border-stone-200/90 shadow-warm-sm space-y-4">
                  <div className="flex justify-between items-center pb-3 border-b border-stone-100">
                    <div>
                      <h3 className="font-bold text-sm text-stone-900">Top 5 Menu Terlaris</h3>
                      <p className="text-xs text-stone-500">Menu paling sering dipesan oleh pelanggan</p>
                    </div>
                    <span className="text-xs font-mono font-bold text-stone-500">Total: {totalItemSold} porsi</span>
                  </div>

                  <div className="space-y-3">
                    {bestSellers.length === 0 ? (
                      <p className="text-xs text-stone-400 py-6 text-center">Belum ada menu yang lunas terjual.</p>
                    ) : (
                      bestSellers.map((item, idx) => {
                        const percent = totalItemSold > 0 ? Math.round((item.qty / totalItemSold) * 100) : 0;
                        return (
                          <div key={idx} className="space-y-1">
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-bold text-stone-900">{idx + 1}. {item.name}</span>
                              <div className="flex items-center gap-2">
                                <span className="font-mono font-bold text-stone-900">{item.qty} porsi</span>
                                <span className="text-stone-400 text-[11px] font-mono">({formatRupiah(item.revenue)})</span>
                              </div>
                            </div>
                            <div className="w-full bg-stone-100 rounded-full h-1.5 overflow-hidden">
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
                <div className="bg-white rounded-3xl p-6 border border-stone-200/90 shadow-warm-sm space-y-4">
                  <div className="flex justify-between items-center pb-3 border-b border-stone-100">
                    <div>
                      <h3 className="font-bold text-sm text-stone-900">Performa Meja Restoran</h3>
                      <p className="text-xs text-stone-500">Ranking meja dengan perolehan omzet tertinggi</p>
                    </div>
                  </div>

                  <div className="space-y-2.5">
                    {Object.keys(tableRevenueMap).length === 0 ? (
                      <p className="text-xs text-stone-400 py-6 text-center">Belum ada transaksi meja tersimpan.</p>
                    ) : (
                      Object.entries(tableRevenueMap)
                        .sort(([, a], [, b]) => b.revenue - a.revenue)
                        .slice(0, 5)
                        .map(([tableNum, data], idx) => (
                          <div key={idx} className="flex items-center justify-between p-3 bg-stone-50/80 rounded-2xl border border-stone-200/80 text-xs">
                            <div className="flex items-center gap-3">
                              <span className="w-7 h-7 rounded-xl bg-stone-900 text-white font-bold flex items-center justify-center text-xs">
                                #{idx + 1}
                              </span>
                              <div>
                                <p className="font-bold text-stone-900">Meja {tableNum}</p>
                                <p className="text-[10px] text-stone-500">{data.count} kali pemesanan</p>
                              </div>
                            </div>
                            <span className="font-mono font-bold text-stone-900">{formatRupiah(data.revenue)}</span>
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
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-5 rounded-3xl border border-stone-200/90 shadow-warm-sm">
                <div>
                  <h3 className="font-bold text-sm text-stone-900">Kelola Pengguna & Akun Kasir</h3>
                  <p className="text-xs text-stone-500">Tambah akun staf kasir, atur 4-digit PIN shift, dan hak akses sistem</p>
                </div>
                <button
                  onClick={() => setIsAddUserOpen(true)}
                  className="bg-stone-900 hover:bg-black text-white font-bold px-4 py-2.5 rounded-2xl text-xs flex items-center gap-1.5 transition self-start sm:self-auto shadow-md"
                >
                  <Plus className="w-4 h-4 text-amber-400" />
                  <span>Tambah Karyawan Baru</span>
                </button>
              </div>

              {/* Users Table */}
              <div className="bg-white rounded-3xl border border-stone-200/90 shadow-warm-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-stone-50 border-b border-stone-200 text-stone-600 font-semibold text-[11px]">
                        <th className="py-3.5 px-5">Nama Karyawan</th>
                        <th className="py-3.5 px-5">Username</th>
                        <th className="py-3.5 px-5">Role Akses</th>
                        <th className="py-3.5 px-5">PIN Kasir</th>
                        <th className="py-3.5 px-5">Status</th>
                        <th className="py-3.5 px-5 text-center">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {users.map(u => (
                        <tr key={u.id} className="hover:bg-stone-50/60 transition">
                          <td className="py-3.5 px-5 font-bold text-stone-900 flex items-center gap-3">
                            <div className="w-8 h-8 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center font-bold text-amber-700 text-xs">
                              {u.name.charAt(0)}
                            </div>
                            <span>{u.name}</span>
                          </td>
                          <td className="py-3.5 px-5 font-mono text-stone-600">{u.username || '-'}</td>
                          <td className="py-3.5 px-5">
                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                              u.role === 'admin' 
                                ? 'bg-amber-100 text-amber-900 border border-amber-200' 
                                : u.role === 'kasir' 
                                ? 'bg-emerald-100 text-emerald-900 border border-emerald-200' 
                                : 'bg-blue-100 text-blue-900 border border-blue-200'
                            }`}>
                              {u.role}
                            </span>
                          </td>
                          <td className="py-3.5 px-5 font-mono font-bold text-stone-800 tracking-widest">
                            {u.pin ? '••••' : 'Tanpa PIN'}
                          </td>
                          <td className="py-3.5 px-5">
                            <button
                              onClick={() => handleToggleUserStatus(u)}
                              className={`px-2.5 py-1 rounded-full text-[10px] font-bold transition ${
                                u.is_active !== false 
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100' 
                                  : 'bg-stone-100 text-stone-500 border border-stone-200 hover:bg-stone-200'
                              }`}
                            >
                              {u.is_active !== false ? 'Aktif' : 'Nonaktif'}
                            </button>
                          </td>
                          <td className="py-3.5 px-5 text-center">
                            <button
                              onClick={() => handleDeleteUser(u.id)}
                              className="text-stone-400 hover:text-rose-600 p-1.5 rounded-lg hover:bg-rose-50 transition"
                              title="Hapus Karyawan"
                            >
                              <Trash2 className="w-4 h-4" />
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
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-5 rounded-3xl border border-stone-200/90 shadow-warm-sm">
                <div>
                  <h3 className="font-bold text-sm text-stone-900">Katalog Makanan & Minuman</h3>
                  <p className="text-xs text-stone-500">Kelola daftar menu yang tampil di scan QR Meja dan Kasir POS</p>
                </div>
                <button
                  onClick={() => setIsAddMenuOpen(true)}
                  className="bg-stone-900 hover:bg-black text-white font-bold px-4 py-2.5 rounded-2xl text-xs flex items-center gap-1.5 transition self-start sm:self-auto shadow-md"
                >
                  <Plus className="w-4 h-4 text-amber-400" />
                  <span>Tambah Menu Baru</span>
                </button>
              </div>

              {/* Menu Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {menus.map(item => (
                  <div key={item.id} className="bg-white rounded-3xl border border-stone-200/90 p-4 flex gap-3.5 shadow-warm-sm hover:shadow-warm-md transition">
                    <img 
                      src={item.image} 
                      alt={item.name} 
                      className="w-20 h-20 rounded-2xl object-cover bg-stone-100 shrink-0" 
                    />
                    <div className="flex flex-col justify-between grow min-w-0">
                      <div>
                        <div className="flex justify-between items-start gap-1">
                          <h4 className="font-bold text-xs text-stone-900 truncate">{item.name}</h4>
                          <button
                            onClick={() => handleDeleteMenu(item.id)}
                            className="text-stone-300 hover:text-rose-600 transition"
                            title="Hapus Menu"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <p className="text-[10px] text-stone-500 line-clamp-1 mt-0.5">{item.description}</p>
                        <p className="text-xs font-mono font-bold text-stone-900 mt-1">{formatRupiah(item.price)}</p>
                      </div>

                      <div className="pt-2 border-t border-stone-100 flex items-center justify-between">
                        <span className="text-[10px] text-stone-500">Status Stok:</span>
                        <button
                          onClick={() => handleToggleMenu(item.id, item.is_available)}
                          className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full transition ${
                            item.is_available 
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                              : 'bg-stone-100 text-stone-500 border border-stone-200'
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
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-5 rounded-3xl border border-stone-200/90 shadow-warm-sm">
                <div>
                  <h3 className="font-bold text-sm text-stone-900">Manajemen Meja & QR Stand</h3>
                  <p className="text-xs text-stone-500">Daftar meja restoran yang telah terpasang standing akrilik QR</p>
                </div>
                <Link
                  href="/qr-meja"
                  className="bg-stone-900 hover:bg-black text-white font-bold px-4 py-2.5 rounded-2xl text-xs flex items-center gap-1.5 transition self-start sm:self-auto shadow-md"
                >
                  <QrCode className="w-4 h-4 text-amber-400" />
                  <span>Buka Generator Standing Akrilik QR</span>
                </Link>
              </div>

              {/* Tables Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
                {tables.map(tbl => {
                  const hasActiveOrder = orders.some(
                    o => o.table_number === tbl.table_number && 
                    o.order_status !== 'completed' && 
                    o.order_status !== 'cancelled'
                  );

                  return (
                    <div 
                      key={tbl.id} 
                      className={`p-4 rounded-3xl border text-center transition ${
                        hasActiveOrder 
                          ? 'bg-amber-50/80 border-amber-300 text-amber-950 shadow-warm-sm' 
                          : 'bg-white border-stone-200/90 text-stone-900 shadow-warm-sm'
                      }`}
                    >
                      <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-stone-400 block mb-1">
                        {tbl.table_code}
                      </span>
                      <h4 className="text-xl font-black text-stone-900">Meja {tbl.table_number}</h4>
                      <div className="mt-3">
                        <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          hasActiveOrder 
                            ? 'bg-amber-200/70 text-amber-950' 
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
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-5 rounded-3xl border border-stone-200/90 shadow-warm-sm">
                <div>
                  <h3 className="font-bold text-sm text-stone-900">Riwayat Transaksi Lengkap</h3>
                  <p className="text-xs text-stone-500">Semua pesanan yang masuk melalui Scan QR Meja dan Kasir POS</p>
                </div>
                <button
                  onClick={handleExportCSV}
                  className="bg-stone-900 hover:bg-black text-white font-bold px-4 py-2.5 rounded-2xl text-xs flex items-center gap-1.5 transition self-start sm:self-auto shadow-md"
                >
                  <Download className="w-4 h-4 text-amber-400" />
                  <span>Export Laporan (CSV / Excel)</span>
                </button>
              </div>

              <div className="bg-white rounded-3xl border border-stone-200/90 shadow-warm-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-stone-50 border-b border-stone-200 text-stone-600 font-semibold text-[11px]">
                        <th className="py-3.5 px-5">No. Order</th>
                        <th className="py-3.5 px-5">Meja / Tipe</th>
                        <th className="py-3.5 px-5">Pelanggan</th>
                        <th className="py-3.5 px-5">Kasir Pelayan</th>
                        <th className="py-3.5 px-5">Total</th>
                        <th className="py-3.5 px-5">Metode</th>
                        <th className="py-3.5 px-5">Status Pesanan</th>
                        <th className="py-3.5 px-5">Status Bayar</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {orders.map(ord => (
                        <tr key={ord.id} className="hover:bg-stone-50/60 transition">
                          <td className="py-3.5 px-5 font-mono font-bold text-stone-900">{ord.order_number}</td>
                          <td className="py-3.5 px-5 font-bold">
                            {ord.order_type === 'takeaway' ? 'Takeaway' : `Meja ${ord.table_number}`}
                          </td>
                          <td className="py-3.5 px-5 text-stone-700">{ord.customer_name}</td>
                          <td className="py-3.5 px-5">
                            <span className="text-[11px] font-semibold text-stone-800 bg-stone-100 px-2 py-0.5 rounded-md">
                              {ord.cashier_name || 'Kasir'}
                            </span>
                          </td>
                          <td className="py-3.5 px-5 font-bold text-stone-950 font-mono">{formatRupiah(ord.total_amount)}</td>
                          <td className="py-3.5 px-5 text-stone-600 font-medium">{ord.payment_method}</td>
                          <td className="py-3.5 px-5">
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-stone-100 text-stone-800">
                              {ord.order_status}
                            </span>
                          </td>
                          <td className="py-3.5 px-5">
                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
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
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-5 rounded-3xl border border-stone-200/90 shadow-warm-sm">
                <div>
                  <h3 className="font-bold text-sm text-stone-900">Catatan Pengeluaran Operasional</h3>
                  <p className="text-xs text-stone-500">Mencatat pembelian bahan baku dapur, utilitas listrik/gas, dan gaji</p>
                </div>
                <button
                  onClick={() => setIsAddExpenseOpen(true)}
                  className="bg-stone-900 hover:bg-black text-white font-bold px-4 py-2.5 rounded-2xl text-xs flex items-center gap-1.5 transition self-start sm:self-auto shadow-md"
                >
                  <Plus className="w-4 h-4 text-amber-400" />
                  <span>Tambah Pengeluaran</span>
                </button>
              </div>

              <div className="bg-white rounded-3xl border border-stone-200/90 shadow-warm-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-stone-50 border-b border-stone-200 text-stone-600 font-semibold text-[11px]">
                        <th className="py-3.5 px-5">Tanggal</th>
                        <th className="py-3.5 px-5">Kategori Biaya</th>
                        <th className="py-3.5 px-5">Keterangan</th>
                        <th className="py-3.5 px-5 text-right">Nominal</th>
                        <th className="py-3.5 px-5 text-center">Hapus</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {expenses.map(exp => (
                        <tr key={exp.id} className="hover:bg-stone-50/60 transition">
                          <td className="py-3.5 px-5 text-stone-600 font-mono">{exp.expense_date}</td>
                          <td className="py-3.5 px-5">
                            <span className="bg-stone-100 text-stone-700 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border border-stone-200">
                              {exp.category}
                            </span>
                          </td>
                          <td className="py-3.5 px-5 text-stone-900">{exp.description}</td>
                          <td className="py-3.5 px-5 text-right font-bold text-stone-950 font-mono">
                            {formatRupiah(exp.amount)}
                          </td>
                          <td className="py-3.5 px-5 text-center">
                            <button
                              onClick={() => handleDeleteExpense(exp.id)}
                              className="text-stone-400 hover:text-rose-600 p-1.5 rounded-lg hover:bg-rose-50 transition"
                            >
                              <Trash2 className="w-4 h-4" />
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

        </main>
      </div>

      {/* MODAL TAMBAH USER / KARYAWAN */}
      {isAddUserOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl overflow-hidden p-6 space-y-4 border border-stone-200">
            <div className="flex justify-between items-center pb-3 border-b border-stone-100">
              <h3 className="font-bold text-sm text-stone-900">Tambah Akun Karyawan / Kasir</h3>
              <button onClick={() => setIsAddUserOpen(false)} className="text-stone-400 hover:text-stone-900">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddUser} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-stone-700 mb-1">Nama Lengkap</label>
                <input
                  type="text"
                  placeholder="Contoh: Rina Maharani"
                  value={newUserName}
                  onChange={e => setNewUserName(e.target.value)}
                  className="w-full bg-stone-50 border border-stone-200 rounded-2xl px-3.5 py-2.5 text-xs focus:bg-white focus:outline-none focus:border-amber-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block font-semibold text-stone-700 mb-1">Username Login</label>
                  <input
                    type="text"
                    placeholder="rina"
                    value={newUserUsername}
                    onChange={e => setNewUserUsername(e.target.value)}
                    className="w-full bg-stone-50 border border-stone-200 rounded-2xl px-3.5 py-2.5 text-xs font-mono focus:bg-white focus:outline-none focus:border-amber-500"
                    required
                  />
                </div>

                <div>
                  <label className="block font-semibold text-stone-700 mb-1">Role Akses</label>
                  <select
                    value={newUserRole}
                    onChange={e => setNewUserRole(e.target.value as any)}
                    className="w-full bg-stone-50 border border-stone-200 rounded-2xl px-3.5 py-2.5 text-xs focus:bg-white focus:outline-none focus:border-amber-500"
                  >
                    <option value="kasir">Kasir</option>
                    <option value="dapur">Dapur (Chef)</option>
                    <option value="admin">Admin / Manajer</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-stone-700 mb-1">4-Digit PIN Kasir</label>
                <input
                  type="password"
                  maxLength={6}
                  placeholder="1234"
                  value={newUserPin}
                  onChange={e => setNewUserPin(e.target.value)}
                  className="w-full bg-stone-50 border border-stone-200 rounded-2xl px-3.5 py-2.5 text-xs font-mono tracking-widest focus:bg-white focus:outline-none focus:border-amber-500"
                  required
                />
                <p className="text-[10px] text-stone-400 mt-0.5">Digunakan staf saat membuka shift kasir di terminal POS.</p>
              </div>

              <div>
                <label className="block font-semibold text-stone-700 mb-1">Email (Opsional)</label>
                <input
                  type="email"
                  placeholder="rina@resto.com"
                  value={newUserEmail}
                  onChange={e => setNewUserEmail(e.target.value)}
                  className="w-full bg-stone-50 border border-stone-200 rounded-2xl px-3.5 py-2.5 text-xs focus:bg-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="submit"
                  className="grow bg-stone-900 hover:bg-black text-white font-bold py-3 rounded-2xl text-xs transition"
                >
                  Simpan Karyawan
                </button>
                <button
                  type="button"
                  onClick={() => setIsAddUserOpen(false)}
                  className="px-4 bg-stone-100 text-stone-700 font-bold py-3 rounded-2xl text-xs hover:bg-stone-200"
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
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl overflow-hidden p-6 space-y-4 border border-stone-200">
            <div className="flex justify-between items-center pb-3 border-b border-stone-100">
              <h3 className="font-bold text-sm text-stone-900">Tambah Menu Makanan/Minuman</h3>
              <button onClick={() => setIsAddMenuOpen(false)} className="text-stone-400 hover:text-stone-900">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddMenu} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-stone-700 mb-1">Kategori</label>
                <select
                  value={menuCatId}
                  onChange={e => setMenuCatId(parseInt(e.target.value))}
                  className="w-full bg-stone-50 border border-stone-200 rounded-2xl px-3.5 py-2.5 text-xs focus:bg-white"
                >
                  <option value={1}>Makanan Utama</option>
                  <option value={2}>Minuman Segar</option>
                  <option value={3}>Camilan & Side Dish</option>
                  <option value={4}>Paket Hemat</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-stone-700 mb-1">Nama Menu</label>
                <input
                  type="text"
                  placeholder="Contoh: Nasi Goreng Spesial"
                  value={menuName}
                  onChange={e => setMenuName(e.target.value)}
                  className="w-full bg-stone-50 border border-stone-200 rounded-2xl px-3.5 py-2.5 text-xs focus:bg-white"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-stone-700 mb-1">Harga Satuan (Rp)</label>
                <input
                  type="number"
                  placeholder="25000"
                  value={menuPrice || ''}
                  onChange={e => setMenuPrice(parseInt(e.target.value) || 0)}
                  className="w-full bg-stone-50 border border-stone-200 rounded-2xl px-3.5 py-2.5 text-xs font-bold focus:bg-white"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-stone-700 mb-1">Deskripsi Singkat</label>
                <textarea
                  placeholder="Keterangan bumbu atau sajian..."
                  value={menuDesc}
                  onChange={e => setMenuDesc(e.target.value)}
                  className="w-full bg-stone-50 border border-stone-200 rounded-2xl px-3.5 py-2.5 text-xs h-16 resize-none focus:bg-white"
                />
              </div>

              <div>
                <label className="block font-semibold text-stone-700 mb-1">URL Foto Menu</label>
                <input
                  type="url"
                  placeholder="https://..."
                  value={menuImage}
                  onChange={e => setMenuImage(e.target.value)}
                  className="w-full bg-stone-50 border border-stone-200 rounded-2xl px-3.5 py-2.5 text-xs focus:bg-white"
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="submit"
                  className="grow bg-stone-900 hover:bg-black text-white font-bold py-3 rounded-2xl text-xs transition"
                >
                  Simpan Menu
                </button>
                <button
                  type="button"
                  onClick={() => setIsAddMenuOpen(false)}
                  className="px-4 bg-stone-100 text-stone-700 font-bold py-3 rounded-2xl text-xs hover:bg-stone-200"
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
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl overflow-hidden p-6 space-y-4 border border-stone-200">
            <div className="flex justify-between items-center pb-3 border-b border-stone-100">
              <h3 className="font-bold text-sm text-stone-900">Catat Pengeluaran Operasional</h3>
              <button onClick={() => setIsAddExpenseOpen(false)} className="text-stone-400 hover:text-stone-900">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddExpense} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-stone-700 mb-1">Tanggal</label>
                <input
                  type="date"
                  value={expDate}
                  onChange={e => setExpDate(e.target.value)}
                  className="w-full bg-stone-50 border border-stone-200 rounded-2xl px-3.5 py-2.5 text-xs focus:bg-white"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-stone-700 mb-1">Kategori Biaya</label>
                <select
                  value={expCategory}
                  onChange={e => setExpCategory(e.target.value)}
                  className="w-full bg-stone-50 border border-stone-200 rounded-2xl px-3.5 py-2.5 text-xs focus:bg-white"
                >
                  <option value="Bahan Baku Makanan">Bahan Baku Dapur</option>
                  <option value="Operasional & Utilitas">Operasional & Listrik/Gas</option>
                  <option value="Gaji & Upah Staf">Gaji & Upah Karyawan</option>
                  <option value="Sewa & Pemeliharaan">Sewa Tempat & Servis</option>
                  <option value="Lain-lain">Lain-lain</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-stone-700 mb-1">Keterangan Biaya</label>
                <input
                  type="text"
                  placeholder="Contoh: Belanja beras & bumbu dapur di pasar"
                  value={expDesc}
                  onChange={e => setExpDesc(e.target.value)}
                  className="w-full bg-stone-50 border border-stone-200 rounded-2xl px-3.5 py-2.5 text-xs focus:bg-white"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-stone-700 mb-1">Nominal Biaya (Rp)</label>
                <input
                  type="number"
                  placeholder="150000"
                  value={expAmount || ''}
                  onChange={e => setExpAmount(parseInt(e.target.value) || 0)}
                  className="w-full bg-stone-50 border border-stone-200 rounded-2xl px-3.5 py-2.5 text-xs font-bold focus:bg-white"
                  required
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="submit"
                  className="grow bg-stone-900 hover:bg-black text-white font-bold py-3 rounded-2xl text-xs transition"
                >
                  Simpan Biaya
                </button>
                <button
                  type="button"
                  onClick={() => setIsAddExpenseOpen(false)}
                  className="px-4 bg-stone-100 text-stone-700 font-bold py-3 rounded-2xl text-xs hover:bg-stone-200"
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
