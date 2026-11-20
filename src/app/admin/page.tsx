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
  Search,
  Bell,
  Settings,
  Flame,
  Crown,
  ChefHat,
  LayoutGrid,
  Tags,
  Layers,
  Award,
  Calendar,
  Sparkles,
  ArrowUp,
  CreditCard,
  MessageSquare,
  HelpCircle,
  ExternalLink
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
  const [activeTab, setActiveTab] = useState<'dashboard' | 'menus' | 'categories' | 'orders' | 'customers' | 'expenses' | 'tables' | 'users' | 'settings'>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [trendRange, setTrendRange] = useState<'today' | 'week' | 'month'>('week');
  const [searchQuery, setSearchQuery] = useState('');

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

  // Form Expense
  const [expDate, setExpDate] = useState(new Date().toISOString().slice(0, 10));
  const [expCategory, setExpCategory] = useState('Bahan Baku Makanan');
  const [expDesc, setExpDesc] = useState('');
  const [expAmount, setExpAmount] = useState<number>(0);

  // Verify session on mount
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
    link.setAttribute('download', `Laporan_Resto_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Full Realtime listener
  useEffect(() => {
    loadAllData();

    if (isSupabaseConfigured && supabase) {
      const channel = supabase
        .channel('admin-realtime-analytics')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => loadAllData())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'expenses' }, () => loadAllData())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'menus' }, () => loadAllData())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, () => loadAllData())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'restaurant_tables' }, () => loadAllData())
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
  const totalOrdersCount = orders.length;
  const aov = paidOrders.length > 0 ? Math.round(totalIncome / paidOrders.length) : 0;
  
  // Distinct customers
  const customerNames = Array.from(new Set(orders.map(o => o.customer_name).filter(Boolean)));
  const totalCustomers = customerNames.length || orders.length;

  // Order Status breakdown
  const completedOrders = orders.filter(o => o.order_status === 'completed').length;
  const preparingOrders = orders.filter(o => o.order_status === 'processing').length;
  const pendingOrders = orders.filter(o => o.order_status === 'pending').length;
  const cancelledOrders = orders.filter(o => o.order_status === 'cancelled').length;
  const totalStatusCount = Math.max(orders.length, 1);

  const completedPct = Math.round((completedOrders / totalStatusCount) * 100);
  const preparingPct = Math.round((preparingOrders / totalStatusCount) * 100);
  const pendingPct = Math.round((pendingOrders / totalStatusCount) * 100);
  const cancelledPct = Math.max(0, 100 - completedPct - preparingPct - pendingPct);

  // Best Sellers Calculation
  const menuSalesMap: { [name: string]: { qty: number; revenue: number; image?: string } } = {};
  paidOrders.forEach(order => {
    (order.items || []).forEach(item => {
      if (!menuSalesMap[item.menu_name]) {
        const foundMenu = menus.find(m => m.name.toLowerCase() === item.menu_name.toLowerCase());
        menuSalesMap[item.menu_name] = { 
          qty: 0, 
          revenue: 0, 
          image: foundMenu?.image || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=120&auto=format&fit=crop&q=80' 
        };
      }
      menuSalesMap[item.menu_name].qty += item.qty;
      menuSalesMap[item.menu_name].revenue += item.subtotal;
    });
  });

  const bestSellers = Object.entries(menuSalesMap)
    .map(([name, data]) => ({ name, ...data }))
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 5);

  // Fallback sample items if no orders yet to look exactly like the design
  const displayDishes = bestSellers.length > 0 ? bestSellers : [
    { name: 'Paneer Butter Masala', qty: 124, revenue: 64500, image: 'https://images.unsplash.com/photo-1631452180519-c014fe946bc7?w=120&auto=format&fit=crop&q=80' },
    { name: 'Chicken Biryani', qty: 98, revenue: 53200, image: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=120&auto=format&fit=crop&q=80' },
    { name: 'Veg Pizza', qty: 76, revenue: 42800, image: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=120&auto=format&fit=crop&q=80' },
    { name: 'Masala Dosa', qty: 58, revenue: 31200, image: 'https://images.unsplash.com/photo-1668236543090-82eba5ee5976?w=120&auto=format&fit=crop&q=80' },
    { name: 'Chocolate Lava Cake', qty: 38, revenue: 22800, image: 'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?w=120&auto=format&fit=crop&q=80' }
  ];

  // Category breakdown calculation
  const catSales = {
    mainCourse: { name: 'Main Course', orders: 0, pct: 55, color: '#FF5B26' },
    snacks: { name: 'Snacks', orders: 0, pct: 20, color: '#FBBF24' },
    beverages: { name: 'Beverages', orders: 0, pct: 15, color: '#10B981' },
    desserts: { name: 'Desserts', orders: 0, pct: 10, color: '#8B5CF6' }
  };

  paidOrders.forEach(o => {
    (o.items || []).forEach(item => {
      const n = item.menu_name.toLowerCase();
      if (n.includes('es ') || n.includes('jus') || n.includes('teh') || n.includes('kopi') || n.includes('air') || n.includes('latte')) {
        catSales.beverages.orders += item.qty;
      } else if (n.includes('pisang') || n.includes('roti') || n.includes('kentang') || n.includes('tahu') || n.includes('tempe')) {
        catSales.snacks.orders += item.qty;
      } else if (n.includes('cake') || n.includes('puding') || n.includes('es krim')) {
        catSales.desserts.orders += item.qty;
      } else {
        catSales.mainCourse.orders += item.qty;
      }
    });
  });

  const totalCatSum = (catSales.mainCourse.orders + catSales.snacks.orders + catSales.beverages.orders + catSales.desserts.orders) || 168;
  const mainCourseOrders = catSales.mainCourse.orders || 93;
  const snacksOrders = catSales.snacks.orders || 34;
  const beveragesOrders = catSales.beverages.orders || 25;
  const dessertsOrders = catSales.desserts.orders || 16;

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

  // Dynamic greeting based on current hour
  const currentHour = new Date().getHours();
  const greeting = currentHour < 11 ? 'Good Morning' : currentHour < 15 ? 'Good Afternoon' : currentHour < 19 ? 'Good Evening' : 'Good Night';
  const chefName = activeAdmin?.name ? `Chef ${activeAdmin.name.split(' ')[0]}` : 'Chef Rohan';

  // Format today date e.g. "05 Jul 2026"
  const formattedToday = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

  // Navigation Items matching the exact design
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutGrid },
    { id: 'menus', label: 'Menu Items', icon: Utensils, badge: menus.length },
    { id: 'categories', label: 'Categories', icon: Tags },
    { id: 'orders', label: 'Orders', icon: Receipt, badge: orders.length },
    { id: 'customers', label: 'Customers', icon: Users, badge: totalCustomers },
    { id: 'expenses', label: 'Inventory', icon: Wallet },
    { id: 'tables', label: 'Tables & QR', icon: QrCode, badge: tables.length },
    { id: 'users', label: 'Staff & Shift', icon: Shield, badge: users.length },
    { id: 'settings', label: 'Settings', icon: Settings }
  ];

  // Admin Auth Gate Screen
  if (isAuthLoaded && !activeAdmin) {
    const adminUsers = users.filter(u => u.role === 'admin' && u.is_active);
    const displayAdmins = adminUsers.length > 0 ? adminUsers : users.slice(0, 3);
    const selectedAdminObj = users.find(u => u.id === selectedAdminId);

    return (
      <div className="bg-[#F8F9FA] min-h-screen text-[#1A1816] flex flex-col items-center justify-center p-4 font-sans selection:bg-[#FF5B26] selection:text-white">
        <div className="w-full max-w-md bg-white border border-gray-100 rounded-3xl p-6 sm:p-8 space-y-6 shadow-[0_10px_35px_rgba(0,0,0,0.06)] relative">
          
          <div className="text-center space-y-2">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-[#FF5B26]/10 border border-[#FF5B26]/20 flex items-center justify-center text-[#FF5B26] shadow-sm">
              <ChefHat className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center justify-center gap-2">
                <span className="font-extrabold text-xl tracking-tight text-gray-900">Food<span className="text-[#FF5B26]">Analytics</span></span>
              </div>
              <p className="text-xs text-gray-400 mt-1 font-medium">Smart Food Insights • Admin Login</p>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block">
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
                        ? 'bg-[#FF5B26]/10 border-[#FF5B26] ring-2 ring-[#FF5B26]/30'
                        : 'bg-gray-50 border-gray-100 hover:border-gray-300 text-gray-700'
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs uppercase ${
                      isSelected ? 'bg-[#FF5B26] text-white font-black' : 'bg-gray-200 text-gray-600'
                    }`}>
                      {user.name.charAt(0)}
                    </div>
                    <div className="overflow-hidden">
                      <p className={`text-xs font-bold truncate ${isSelected ? 'text-[#FF5B26]' : 'text-gray-900'}`}>
                        {user.name}
                      </p>
                      <p className="text-[10px] text-gray-400 uppercase">{user.role}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <form onSubmit={handleAdminLogin} className="space-y-4">
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">PIN Masuk</label>
                {selectedAdminObj && (
                  <span className="text-[10px] text-gray-500">
                    Akun: <strong className="text-gray-800">{selectedAdminObj.name}</strong>
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
                className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 text-center tracking-[0.6em] text-xl font-bold text-gray-900 focus:outline-none focus:border-[#FF5B26] focus:bg-white transition"
              />
            </div>

            <div className="grid grid-cols-3 gap-2">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
                <button
                  key={num}
                  type="button"
                  onClick={() => setAdminPin(prev => (prev.length < 6 ? prev + num : prev))}
                  className="py-3 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-2xl text-base font-bold text-gray-800 transition active:scale-95"
                >
                  {num}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setAdminPin('')}
                className="py-3 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-2xl text-xs font-bold text-gray-400 transition"
              >
                C
              </button>
              <button
                type="button"
                onClick={() => setAdminPin(prev => (prev.length < 6 ? prev + '0' : prev))}
                className="py-3 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-2xl text-base font-bold text-gray-800 transition active:scale-95"
              >
                0
              </button>
              <button
                type="button"
                onClick={() => setAdminPin(prev => prev.slice(0, -1))}
                className="py-3 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-2xl text-xs font-bold text-gray-400 transition"
              >
                ⌫
              </button>
            </div>

            {loginError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-center text-xs text-rose-600 font-medium">
                {loginError}
              </div>
            )}

            <button
              type="submit"
              className="w-full bg-[#FF5B26] hover:bg-[#E84E1C] text-white font-bold py-3.5 rounded-2xl text-xs uppercase tracking-wider transition shadow-lg shadow-[#FF5B26]/30 active:scale-98"
            >
              Masuk Dashboard Admin
            </button>
          </form>

          <div className="pt-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-400">
            <Link href="/kasir" className="hover:text-[#FF5B26] transition flex items-center gap-1">
              ← Layar Kasir
            </Link>
            <Link href="/" className="hover:text-[#FF5B26] transition flex items-center gap-1">
              Halaman Tamu →
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#F8F9FA] min-h-screen text-[#1A1816] font-sans flex antialiased selection:bg-[#FF5B26] selection:text-white">
      
      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div 
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 bg-black/40 z-40 lg:hidden backdrop-blur-xs"
        />
      )}

      {/* Modern Left Sidebar matching FoodAnalytics */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-60 bg-white flex flex-col border-r border-gray-100 transition-transform duration-200 ease-in-out lg:translate-x-0 ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        
        {/* Logo & Brand Header */}
        <div className="p-5 pb-4 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#FF5B26] flex items-center justify-center text-white shadow-md shadow-[#FF5B26]/25">
              <Utensils className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center text-[15px] font-extrabold tracking-tight text-gray-900 leading-none">
                Food<span className="text-[#FF5B26]">Analytics</span>
              </div>
              <p className="text-[10px] text-gray-400 font-medium mt-0.5">Smart Food Insights</p>
            </div>
          </div>
          <button 
            onClick={() => setSidebarOpen(false)} 
            className="lg:hidden text-gray-400 hover:text-gray-700 p-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Sidebar Navigation */}
        <nav className="flex-1 px-3 py-2 space-y-1 overflow-y-auto no-scrollbar">
          {navItems.map(item => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setActiveTab(item.id as any);
                  setSidebarOpen(false);
                }}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition ${
                  isActive 
                    ? 'bg-[#FF5B26] text-white shadow-md shadow-[#FF5B26]/30' 
                    : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-gray-400'}`} />
                  <span>{item.label}</span>
                </div>
                {item.badge !== undefined && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-mono font-bold ${
                    isActive ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'
                  }`}>
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Upgrade to Pro Sidebar Banner */}
        <div className="p-3 mx-3 mb-4 rounded-2xl bg-gradient-to-b from-[#FFF5F1] to-[#FFEFE8] border border-[#FFD9CA] text-center space-y-2 relative overflow-hidden">
          <div className="w-12 h-12 mx-auto rounded-full bg-white shadow-sm flex items-center justify-center">
            <span className="text-2xl">🥗</span>
          </div>
          <div>
            <h4 className="font-bold text-xs text-gray-900">Upgrade to Pro</h4>
            <p className="text-[10px] text-gray-500 mt-0.5 leading-snug">
              Unlock advanced insights and grow your food business.
            </p>
          </div>
          <button 
            onClick={() => setActiveTab('orders')}
            className="w-full bg-[#FF5B26] hover:bg-[#E84E1C] text-white font-bold py-2 rounded-xl text-[11px] shadow-sm transition active:scale-98"
          >
            Upgrade Now
          </button>
        </div>

      </aside>

      {/* Main Content Area */}
      <div className="flex-1 lg:pl-60 flex flex-col min-h-screen">
        
        {/* Top Header Bar */}
        <header className="bg-white border-b border-gray-100 sticky top-0 z-30 px-5 sm:px-8 py-3.5 flex items-center justify-between">
          <div className="flex items-center space-x-3 grow max-w-xl">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden w-8 h-8 rounded-xl bg-gray-100 flex items-center justify-center text-gray-600 hover:bg-gray-200 mr-1"
            >
              <MenuIcon className="w-4 h-4" />
            </button>
            
            <span className="font-bold text-sm text-gray-900 hidden sm:inline mr-2 capitalize">
              {activeTab}
            </span>

            {/* Pill Search Box */}
            <div className="relative grow max-w-md">
              <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search food, orders, customers..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full bg-[#F8F9FA] border border-gray-100 rounded-full pl-9 pr-4 py-2 text-xs text-gray-800 placeholder-gray-400 focus:bg-white focus:outline-none focus:border-[#FF5B26] transition"
              />
            </div>
          </div>

          {/* Right Header Icons & Profile */}
          <div className="flex items-center space-x-3">
            {/* Notification Bell */}
            <div className="relative">
              <button 
                onClick={() => setActiveTab('orders')}
                className="w-9 h-9 rounded-full bg-gray-50 hover:bg-gray-100 flex items-center justify-center text-gray-600 transition"
              >
                <Bell className="w-4 h-4" />
                <span className="absolute top-1 right-1 w-4 h-4 bg-[#FF5B26] text-white text-[9px] font-bold rounded-full flex items-center justify-center border-2 border-white">
                  3
                </span>
              </button>
            </div>

            {/* Settings Gear */}
            <button 
              onClick={() => setActiveTab('settings')}
              className="w-9 h-9 rounded-full bg-gray-50 hover:bg-gray-100 flex items-center justify-center text-gray-600 transition"
            >
              <Settings className="w-4 h-4" />
            </button>

            {/* User Profile */}
            <div className="flex items-center space-x-2.5 pl-2 border-l border-gray-100">
              <img
                src="https://images.unsplash.com/photo-1577219491135-ce391730fb2c?w=100&auto=format&fit=crop&q=80"
                alt="Chef"
                className="w-9 h-9 rounded-full object-cover border border-gray-200"
              />
              <div className="hidden sm:block text-left">
                <p className="text-xs font-bold text-gray-900 leading-tight">
                  {activeAdmin?.name || 'Chef Rohan'}
                </p>
                <p className="text-[10px] text-gray-400 font-medium">Owner</p>
              </div>
            </div>
          </div>
        </header>

        {/* Dashboard Content */}
        <main className="p-4 sm:p-7 grow space-y-5 max-w-[1400px]">

          {/* TAB: DASHBOARD (Exact Match with Image) */}
          {activeTab === 'dashboard' && (
            <div className="space-y-5">
              
              {/* Greeting & Action Header Row */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h1 className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight flex items-center gap-2">
                    {greeting}, {chefName}! <span className="text-xl">🧑‍🍳</span>
                  </h1>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Here's what's happening with your food business today.
                  </p>
                </div>

                <div className="flex items-center space-x-2 shrink-0">
                  {/* Date Pill */}
                  <div className="bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs font-semibold text-gray-700 flex items-center gap-1.5 shadow-2xs">
                    <Calendar className="w-3.5 h-3.5 text-gray-400" />
                    <span>{formattedToday}</span>
                  </div>

                  {/* Download Report Button */}
                  <button
                    onClick={handleExportCSV}
                    className="bg-[#FF5B26] hover:bg-[#E84E1C] text-white font-bold px-3.5 py-2 rounded-xl text-xs flex items-center gap-1.5 shadow-sm shadow-[#FF5B26]/25 transition active:scale-95"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download Report</span>
                  </button>

                  {/* Add Item Button */}
                  <button
                    onClick={() => setIsAddMenuOpen(true)}
                    className="bg-white hover:bg-gray-50 text-gray-800 font-bold px-3 py-2 rounded-xl text-xs flex items-center gap-1 border border-gray-200 shadow-2xs transition"
                  >
                    <Plus className="w-3.5 h-3.5 text-gray-600" />
                    <span>Add Item</span>
                  </button>
                </div>
              </div>

              {/* ROW 1: 4 Key Metric Cards with Sparklines */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                
                {/* 1. Total Revenue */}
                <div className="bg-white rounded-2xl p-4.5 border border-gray-100 shadow-[0_2px_12px_rgba(0,0,0,0.03)] flex justify-between items-center">
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <div className="w-7 h-7 rounded-lg bg-[#FF5B26]/10 flex items-center justify-center text-[#FF5B26]">
                        <Wallet className="w-3.5 h-3.5" />
                      </div>
                      <span className="text-[11px] font-semibold text-gray-500">Total Revenue</span>
                    </div>
                    <h3 className="text-xl font-black text-gray-900 tracking-tight">
                      {totalIncome > 0 ? formatRupiah(totalIncome) : '₹32,450'}
                    </h3>
                    <p className="text-[11px] font-bold text-emerald-600 flex items-center gap-0.5">
                      <ArrowUp className="w-3 h-3" />
                      <span>8.2%</span>
                      <span className="text-gray-400 font-normal ml-0.5">vs Yesterday</span>
                    </p>
                  </div>
                  {/* Mini Sparkline SVG */}
                  <div className="w-16 h-10 shrink-0">
                    <svg viewBox="0 0 70 35" className="w-full h-full overflow-visible">
                      <path
                        d="M 0 30 Q 15 28 25 18 T 45 22 T 70 6"
                        fill="none"
                        stroke="#FF5B26"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                      />
                    </svg>
                  </div>
                </div>

                {/* 2. Total Orders */}
                <div className="bg-white rounded-2xl p-4.5 border border-gray-100 shadow-[0_2px_12px_rgba(0,0,0,0.03)] flex justify-between items-center">
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <div className="w-7 h-7 rounded-lg bg-[#FF8A00]/10 flex items-center justify-center text-[#FF8A00]">
                        <ShoppingBag className="w-3.5 h-3.5" />
                      </div>
                      <span className="text-[11px] font-semibold text-gray-500">Total Orders</span>
                    </div>
                    <h3 className="text-xl font-black text-gray-900 tracking-tight">
                      {totalOrdersCount > 0 ? totalOrdersCount : '168'}
                    </h3>
                    <p className="text-[11px] font-bold text-emerald-600 flex items-center gap-0.5">
                      <ArrowUp className="w-3 h-3" />
                      <span>6.2%</span>
                      <span className="text-gray-400 font-normal ml-0.5">vs Yesterday</span>
                    </p>
                  </div>
                  {/* Mini Sparkline SVG */}
                  <div className="w-16 h-10 shrink-0">
                    <svg viewBox="0 0 70 35" className="w-full h-full overflow-visible">
                      <path
                        d="M 0 28 Q 18 26 30 16 T 50 20 T 70 8"
                        fill="none"
                        stroke="#FF8A00"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                      />
                    </svg>
                  </div>
                </div>

                {/* 3. New Customers */}
                <div className="bg-white rounded-2xl p-4.5 border border-gray-100 shadow-[0_2px_12px_rgba(0,0,0,0.03)] flex justify-between items-center">
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <div className="w-7 h-7 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-600">
                        <Users className="w-3.5 h-3.5" />
                      </div>
                      <span className="text-[11px] font-semibold text-gray-500">New Customers</span>
                    </div>
                    <h3 className="text-xl font-black text-gray-900 tracking-tight">
                      {totalCustomers > 0 ? totalCustomers : '52'}
                    </h3>
                    <p className="text-[11px] font-bold text-emerald-600 flex items-center gap-0.5">
                      <ArrowUp className="w-3 h-3" />
                      <span>4.1%</span>
                      <span className="text-gray-400 font-normal ml-0.5">vs Yesterday</span>
                    </p>
                  </div>
                  {/* Mini Sparkline SVG */}
                  <div className="w-16 h-10 shrink-0">
                    <svg viewBox="0 0 70 35" className="w-full h-full overflow-visible">
                      <path
                        d="M 0 32 Q 20 28 35 15 T 55 24 T 70 10"
                        fill="none"
                        stroke="#10B981"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                      />
                    </svg>
                  </div>
                </div>

                {/* 4. Average Order Value */}
                <div className="bg-white rounded-2xl p-4.5 border border-gray-100 shadow-[0_2px_12px_rgba(0,0,0,0.03)] flex justify-between items-center">
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <div className="w-7 h-7 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-500">
                        <DollarSign className="w-3.5 h-3.5" />
                      </div>
                      <span className="text-[11px] font-semibold text-gray-500">Average Order Value</span>
                    </div>
                    <h3 className="text-xl font-black text-gray-900 tracking-tight">
                      {aov > 0 ? formatRupiah(aov) : '₹193'}
                    </h3>
                    <p className="text-[11px] font-bold text-emerald-600 flex items-center gap-0.5">
                      <ArrowUp className="w-3 h-3" />
                      <span>3.7%</span>
                      <span className="text-gray-400 font-normal ml-0.5">vs Yesterday</span>
                    </p>
                  </div>
                  {/* Mini Sparkline SVG */}
                  <div className="w-16 h-10 shrink-0">
                    <svg viewBox="0 0 70 35" className="w-full h-full overflow-visible">
                      <path
                        d="M 0 30 Q 18 29 32 20 T 52 22 T 70 11"
                        fill="none"
                        stroke="#F59E0B"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                      />
                    </svg>
                  </div>
                </div>

              </div>

              {/* ROW 2: Middle Section (Revenue & Orders Trend + Orders by Category) */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                
                {/* Card 1: Revenue & Orders Trend (7 or 8 cols) */}
                <div className="lg:col-span-7 xl:col-span-8 bg-white rounded-3xl p-5 sm:p-6 border border-gray-100 shadow-[0_2px_12px_rgba(0,0,0,0.03)] space-y-4">
                  {/* Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2">
                    <div>
                      <h3 className="font-bold text-sm text-gray-900">Revenue & Orders Trend</h3>
                    </div>

                    <div className="flex items-center space-x-3">
                      {/* Pill filter: Today, This Week, This Month */}
                      <div className="bg-gray-100 p-0.5 rounded-full flex items-center text-[11px] font-semibold">
                        <button
                          onClick={() => setTrendRange('today')}
                          className={`px-3 py-1 rounded-full transition ${
                            trendRange === 'today' ? 'bg-[#FF5B26] text-white shadow-xs' : 'text-gray-500 hover:text-gray-900'
                          }`}
                        >
                          Today
                        </button>
                        <button
                          onClick={() => setTrendRange('week')}
                          className={`px-3 py-1 rounded-full transition ${
                            trendRange === 'week' ? 'bg-[#FF5B26] text-white shadow-xs' : 'text-gray-500 hover:text-gray-900'
                          }`}
                        >
                          This Week
                        </button>
                        <button
                          onClick={() => setTrendRange('month')}
                          className={`px-3 py-1 rounded-full transition ${
                            trendRange === 'month' ? 'bg-[#FF5B26] text-white shadow-xs' : 'text-gray-500 hover:text-gray-900'
                          }`}
                        >
                          This Month
                        </button>
                      </div>

                      {/* Dropdown */}
                      <span className="text-[11px] font-semibold text-gray-600 bg-gray-50 px-2.5 py-1 rounded-lg border border-gray-200">
                        This Week ▾
                      </span>
                    </div>
                  </div>

                  {/* Legend */}
                  <div className="flex items-center justify-end space-x-4 text-[11px] font-semibold">
                    <div className="flex items-center space-x-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#FF5B26]"></span>
                      <span className="text-gray-600">Revenue (₹)</span>
                    </div>
                    <div className="flex items-center space-x-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                      <span className="text-gray-600">Orders</span>
                    </div>
                  </div>

                  {/* SVG Dual Spline Wave Area Chart */}
                  <div className="relative h-60 w-full pt-4">
                    <svg viewBox="0 0 650 200" className="w-full h-full overflow-visible" preserveAspectRatio="none">
                      <defs>
                        <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#FF5B26" stopOpacity="0.25" />
                          <stop offset="100%" stopColor="#FF5B26" stopOpacity="0.0" />
                        </linearGradient>
                        <linearGradient id="ordersGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#10B981" stopOpacity="0.25" />
                          <stop offset="100%" stopColor="#10B981" stopOpacity="0.0" />
                        </linearGradient>
                      </defs>

                      {/* Grid Lines */}
                      <line x1="40" y1="20" x2="620" y2="20" stroke="#F1F3F5" strokeDasharray="3 3" />
                      <line x1="40" y1="60" x2="620" y2="60" stroke="#F1F3F5" strokeDasharray="3 3" />
                      <line x1="40" y1="100" x2="620" y2="100" stroke="#F1F3F5" strokeDasharray="3 3" />
                      <line x1="40" y1="140" x2="620" y2="140" stroke="#F1F3F5" strokeDasharray="3 3" />
                      <line x1="40" y1="180" x2="620" y2="180" stroke="#E5E7EB" />

                      {/* Y-Axis Labels Left */}
                      <text x="15" y="24" fontSize="10" fill="#9CA3AF" fontFamily="sans-serif">8K</text>
                      <text x="15" y="64" fontSize="10" fill="#9CA3AF" fontFamily="sans-serif">6K</text>
                      <text x="15" y="104" fontSize="10" fill="#9CA3AF" fontFamily="sans-serif">4K</text>
                      <text x="15" y="144" fontSize="10" fill="#9CA3AF" fontFamily="sans-serif">2K</text>
                      <text x="20" y="184" fontSize="10" fill="#9CA3AF" fontFamily="sans-serif">0</text>

                      {/* Y-Axis Labels Right */}
                      <text x="630" y="24" fontSize="10" fill="#9CA3AF" fontFamily="sans-serif">40</text>
                      <text x="630" y="64" fontSize="10" fill="#9CA3AF" fontFamily="sans-serif">30</text>
                      <text x="630" y="104" fontSize="10" fill="#9CA3AF" fontFamily="sans-serif">20</text>
                      <text x="630" y="144" fontSize="10" fill="#9CA3AF" fontFamily="sans-serif">10</text>
                      <text x="635" y="184" fontSize="10" fill="#9CA3AF" fontFamily="sans-serif">0</text>

                      {/* Revenue Area & Path */}
                      <path
                        d="M 50 170 C 130 160 170 145 220 135 C 270 125 300 45 330 45 C 360 45 390 120 440 120 C 490 120 530 80 560 90 C 590 100 610 125 615 130 L 615 180 L 50 180 Z"
                        fill="url(#revenueGrad)"
                      />
                      <path
                        d="M 50 170 C 130 160 170 145 220 135 C 270 125 300 45 330 45 C 360 45 390 120 440 120 C 490 120 530 80 560 90 C 590 100 610 125 615 130"
                        fill="none"
                        stroke="#FF5B26"
                        strokeWidth="3"
                        strokeLinecap="round"
                      />

                      {/* Orders Area & Path */}
                      <path
                        d="M 50 175 C 130 170 170 160 220 150 C 270 140 300 75 330 75 C 360 75 390 140 440 140 C 490 140 530 110 560 120 C 590 130 610 150 615 155 L 615 180 L 50 180 Z"
                        fill="url(#ordersGrad)"
                      />
                      <path
                        d="M 50 175 C 130 170 170 160 220 150 C 270 140 300 75 330 75 C 360 75 390 140 440 140 C 490 140 530 110 560 120 C 590 130 610 150 615 155"
                        fill="none"
                        stroke="#10B981"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                      />

                      {/* Peak Pins */}
                      <circle cx="330" cy="45" r="4" fill="#FF5B26" stroke="#FFFFFF" strokeWidth="2" />
                      <rect x="315" y="24" width="30" height="15" rx="4" fill="#FF5B26" />
                      <text x="330" y="35" fontSize="9" fontWeight="bold" fill="#FFFFFF" textAnchor="middle">₹5.6K</text>

                      <circle cx="330" cy="75" r="4" fill="#10B981" stroke="#FFFFFF" strokeWidth="2" />
                      <rect x="320" y="85" width="20" height="15" rx="4" fill="#10B981" />
                      <text x="330" y="96" fontSize="9" fontWeight="bold" fill="#FFFFFF" textAnchor="middle">28</text>
                    </svg>
                  </div>

                  {/* X Axis Time Labels */}
                  <div className="flex justify-between text-[11px] font-semibold text-gray-400 px-6 pt-1">
                    <span>12 AM</span>
                    <span>4 AM</span>
                    <span>8 AM</span>
                    <span className="text-[#FF5B26] font-bold">12 PM</span>
                    <span>4 PM</span>
                    <span>8 PM</span>
                    <span>11 PM</span>
                  </div>

                  {/* Bottom Strip inside Card */}
                  <div className="pt-3 border-t border-gray-100 grid grid-cols-2 sm:grid-cols-4 gap-2 text-center sm:text-left">
                    <div className="flex items-center space-x-2">
                      <div className="w-6 h-6 rounded-md bg-[#FF5B26]/10 flex items-center justify-center text-[#FF5B26]">
                        <Wallet className="w-3 h-3" />
                      </div>
                      <div>
                        <p className="text-[10px] text-gray-400">Today's Revenue</p>
                        <p className="text-xs font-bold text-gray-900">₹8,020</p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      <div className="w-6 h-6 rounded-md bg-[#FF8A00]/10 flex items-center justify-center text-[#FF8A00]">
                        <ShoppingBag className="w-3 h-3" />
                      </div>
                      <div>
                        <p className="text-[10px] text-gray-400">Today's Orders</p>
                        <p className="text-xs font-bold text-gray-900">32</p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      <div className="w-6 h-6 rounded-md bg-amber-500/10 flex items-center justify-center text-amber-500">
                        <TrendingUp className="w-3 h-3" />
                      </div>
                      <div>
                        <p className="text-[10px] text-gray-400">Peak Revenue</p>
                        <p className="text-xs font-bold text-gray-900">₹5,600 | 4 PM</p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      <div className="w-6 h-6 rounded-md bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                        <Users className="w-3 h-3" />
                      </div>
                      <div>
                        <p className="text-[10px] text-gray-400">Peak Orders</p>
                        <p className="text-xs font-bold text-gray-900">28 | 4 PM</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Card 2: Orders by Category (5 or 4 cols) */}
                <div className="lg:col-span-5 xl:col-span-4 bg-white rounded-3xl p-5 sm:p-6 border border-gray-100 shadow-[0_2px_12px_rgba(0,0,0,0.03)] flex flex-col justify-between space-y-4">
                  {/* Header */}
                  <div className="flex items-center justify-between pb-1">
                    <h3 className="font-bold text-sm text-gray-900">Orders by Category</h3>
                    <span className="text-[11px] font-semibold text-gray-600 bg-gray-50 px-2.5 py-1 rounded-lg border border-gray-200">
                      This Week ▾
                    </span>
                  </div>

                  {/* Donut Chart with Breakdown */}
                  <div className="flex items-center justify-between gap-4 py-2">
                    {/* SVG Donut */}
                    <div className="relative w-36 h-36 shrink-0 flex items-center justify-center">
                      <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                        {/* Main Course 55% */}
                        <circle
                          cx="50"
                          cy="50"
                          r="38"
                          fill="transparent"
                          stroke="#FF5B26"
                          strokeWidth="14"
                          strokeDasharray="131.9 238.7"
                          strokeDashoffset="0"
                        />
                        {/* Snacks 20% */}
                        <circle
                          cx="50"
                          cy="50"
                          r="38"
                          fill="transparent"
                          stroke="#FBBF24"
                          strokeWidth="14"
                          strokeDasharray="47.7 238.7"
                          strokeDashoffset="-131.9"
                        />
                        {/* Beverages 15% */}
                        <circle
                          cx="50"
                          cy="50"
                          r="38"
                          fill="transparent"
                          stroke="#10B981"
                          strokeWidth="14"
                          strokeDasharray="35.8 238.7"
                          strokeDashoffset="-179.6"
                        />
                        {/* Desserts 10% */}
                        <circle
                          cx="50"
                          cy="50"
                          r="38"
                          fill="transparent"
                          stroke="#8B5CF6"
                          strokeWidth="14"
                          strokeDasharray="23.8 238.7"
                          strokeDashoffset="-215.4"
                        />
                      </svg>
                      {/* Center Text */}
                      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                        <span className="text-xl font-black text-gray-900 leading-none">
                          {totalCatSum}
                        </span>
                        <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider mt-0.5">
                          Total Orders
                        </span>
                      </div>
                    </div>

                    {/* Breakdown List */}
                    <div className="grow space-y-2 text-xs">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-1.5">
                          <span className="w-2.5 h-2.5 rounded-full bg-[#FF5B26]"></span>
                          <span className="font-semibold text-gray-700">Main Course</span>
                        </div>
                        <div className="text-right">
                          <span className="font-bold text-gray-900">55%</span>
                          <p className="text-[10px] text-gray-400">{mainCourseOrders} Orders</p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-1.5">
                          <span className="w-2.5 h-2.5 rounded-full bg-[#FBBF24]"></span>
                          <span className="font-semibold text-gray-700">Snacks</span>
                        </div>
                        <div className="text-right">
                          <span className="font-bold text-gray-900">20%</span>
                          <p className="text-[10px] text-gray-400">{snacksOrders} Orders</p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-1.5">
                          <span className="w-2.5 h-2.5 rounded-full bg-[#10B981]"></span>
                          <span className="font-semibold text-gray-700">Beverages</span>
                        </div>
                        <div className="text-right">
                          <span className="font-bold text-gray-900">15%</span>
                          <p className="text-[10px] text-gray-400">{beveragesOrders} Orders</p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-1.5">
                          <span className="w-2.5 h-2.5 rounded-full bg-[#8B5CF6]"></span>
                          <span className="font-semibold text-gray-700">Desserts</span>
                        </div>
                        <div className="text-right">
                          <span className="font-bold text-gray-900">10%</span>
                          <p className="text-[10px] text-gray-400">{dessertsOrders} Orders</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Top Category Callout Card */}
                  <div className="p-3 bg-gradient-to-r from-[#FFF5F1] to-[#FFF8F5] rounded-2xl border border-[#FFE2D6] flex items-center space-x-3">
                    <div className="w-8 h-8 rounded-xl bg-[#FF5B26]/15 flex items-center justify-center text-[#FF5B26] shrink-0">
                      <Crown className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-[#FF5B26] uppercase tracking-wide">Top Category</p>
                      <p className="text-xs text-gray-800 font-medium">
                        <strong className="text-gray-900">Main Course</strong> is the most ordered category this week.
                      </p>
                    </div>
                  </div>
                </div>

              </div>

              {/* ROW 3: Bottom Section (Top Selling Dishes, Order Status, Business Insights) */}
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-12 gap-5">
                
                {/* 1. Top Selling Dishes (4 cols) */}
                <div className="xl:col-span-4 bg-white rounded-3xl p-5 sm:p-6 border border-gray-100 shadow-[0_2px_12px_rgba(0,0,0,0.03)] space-y-4 flex flex-col justify-between">
                  <div className="flex items-center justify-between pb-1">
                    <h3 className="font-bold text-sm text-gray-900">Top Selling Dishes</h3>
                    <button 
                      onClick={() => setActiveTab('menus')}
                      className="text-xs font-semibold text-gray-400 hover:text-[#FF5B26] transition"
                    >
                      View All
                    </button>
                  </div>

                  <div className="space-y-3">
                    {displayDishes.map((dish, idx) => (
                      <div key={idx} className="flex items-center justify-between text-xs">
                        <div className="flex items-center space-x-3">
                          <span className="w-5 h-5 rounded-full bg-gray-100 text-gray-600 font-bold flex items-center justify-center text-[10px]">
                            {idx + 1}
                          </span>
                          <img 
                            src={dish.image} 
                            alt={dish.name}
                            className="w-9 h-9 rounded-full object-cover border border-gray-100" 
                          />
                          <div>
                            <p className="font-bold text-gray-900 line-clamp-1">{dish.name}</p>
                            <p className="text-[10px] text-gray-400">{dish.qty} Orders</p>
                          </div>
                        </div>
                        <span className="font-bold text-gray-900 font-mono">
                          {formatRupiah(dish.revenue)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 2. Order Status (4 cols) */}
                <div className="xl:col-span-4 bg-white rounded-3xl p-5 sm:p-6 border border-gray-100 shadow-[0_2px_12px_rgba(0,0,0,0.03)] space-y-4 flex flex-col justify-between">
                  <div className="flex items-center justify-between pb-1">
                    <h3 className="font-bold text-sm text-gray-900">Order Status</h3>
                    <span className="text-[11px] font-semibold text-gray-600 bg-gray-50 px-2.5 py-1 rounded-lg border border-gray-200">
                      This Week ▾
                    </span>
                  </div>

                  {/* Speedometer Gauge SVG */}
                  <div className="relative w-48 h-24 mx-auto flex items-end justify-center">
                    <svg viewBox="0 0 200 100" className="w-full h-full overflow-visible">
                      {/* Gray track */}
                      <path
                        d="M 20 90 A 70 70 0 0 1 180 90"
                        fill="none"
                        stroke="#F3F4F6"
                        strokeWidth="16"
                        strokeLinecap="round"
                      />
                      {/* Green Completed Arc */}
                      <path
                        d="M 20 90 A 70 70 0 0 1 125 24"
                        fill="none"
                        stroke="#10B981"
                        strokeWidth="16"
                        strokeLinecap="round"
                      />
                      {/* Yellow Preparing Arc */}
                      <path
                        d="M 130 27 A 70 70 0 0 1 160 52"
                        fill="none"
                        stroke="#FBBF24"
                        strokeWidth="16"
                        strokeLinecap="round"
                      />
                      {/* Orange Pending Arc */}
                      <path
                        d="M 163 57 A 70 70 0 0 1 175 75"
                        fill="none"
                        stroke="#FF5B26"
                        strokeWidth="16"
                        strokeLinecap="round"
                      />
                      {/* Red Cancelled Arc */}
                      <path
                        d="M 176 80 A 70 70 0 0 1 180 90"
                        fill="none"
                        stroke="#EF4444"
                        strokeWidth="16"
                        strokeLinecap="round"
                      />
                    </svg>
                  </div>

                  {/* 4 Bottom Status Pills */}
                  <div className="grid grid-cols-4 gap-2 pt-2 border-t border-gray-100 text-center">
                    <div>
                      <p className="text-[10px] font-bold text-emerald-600 flex items-center justify-center gap-0.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                        {completedPct}%
                      </p>
                      <p className="text-sm font-black text-gray-900 mt-0.5">{completedOrders || 108}</p>
                      <p className="text-[9px] text-gray-400 font-medium">Completed</p>
                    </div>

                    <div>
                      <p className="text-[10px] font-bold text-amber-500 flex items-center justify-center gap-0.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                        {preparingPct || 22}%
                      </p>
                      <p className="text-sm font-black text-gray-900 mt-0.5">{preparingOrders || 37}</p>
                      <p className="text-[9px] text-gray-400 font-medium">Preparing</p>
                    </div>

                    <div>
                      <p className="text-[10px] font-bold text-[#FF5B26] flex items-center justify-center gap-0.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#FF5B26]"></span>
                        {pendingPct || 10}%
                      </p>
                      <p className="text-sm font-black text-gray-900 mt-0.5">{pendingOrders || 17}</p>
                      <p className="text-[9px] text-gray-400 font-medium">Pending</p>
                    </div>

                    <div>
                      <p className="text-[10px] font-bold text-rose-500 flex items-center justify-center gap-0.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                        {cancelledPct || 4}%
                      </p>
                      <p className="text-sm font-black text-gray-900 mt-0.5">{cancelledOrders || 6}</p>
                      <p className="text-[9px] text-gray-400 font-medium">Cancelled</p>
                    </div>
                  </div>
                </div>

                {/* 3. Business Insights (4 cols) */}
                <div className="xl:col-span-4 bg-white rounded-3xl p-5 sm:p-6 border border-gray-100 shadow-[0_2px_12px_rgba(0,0,0,0.03)] space-y-4 flex flex-col justify-between">
                  <div className="flex items-center space-x-2 pb-1">
                    <span className="text-base">💡</span>
                    <h3 className="font-bold text-sm text-gray-900">Business Insights</h3>
                  </div>

                  {/* 2x2 Metric Grid */}
                  <div className="grid grid-cols-2 gap-4 py-1 text-xs">
                    <div className="space-y-0.5">
                      <p className="text-[11px] text-gray-400 font-medium">Revenue</p>
                      <p className="font-bold text-emerald-600 flex items-center gap-1">
                        <ArrowUp className="w-3 h-3" />
                        <span>8.2%</span>
                      </p>
                      <p className="text-[10px] text-gray-400">vs Yesterday</p>
                    </div>

                    <div className="space-y-0.5">
                      <p className="text-[11px] text-gray-400 font-medium">Top Item</p>
                      <p className="font-bold text-gray-900 truncate">
                        {bestSellers[0]?.name || 'Paneer Butter Masala'}
                      </p>
                    </div>

                    <div className="space-y-0.5 pt-2 border-t border-gray-50">
                      <p className="text-[11px] text-gray-400 font-medium">Best Seller</p>
                      <p className="font-bold text-gray-900 truncate">
                        {bestSellers[1]?.name || 'Chicken Biryani'}
                      </p>
                    </div>

                    <div className="space-y-0.5 pt-2 border-t border-gray-50">
                      <p className="text-[11px] text-gray-400 font-medium">Peak Hour</p>
                      <p className="font-bold text-gray-900">
                        1:00 PM – 2:00 PM
                      </p>
                    </div>
                  </div>

                  {/* Motivational Cheer Banner */}
                  <div className="p-3 bg-[#FFF8F5] rounded-2xl border border-[#FFE6DC] text-center">
                    <p className="text-xs font-semibold text-gray-700">
                      Keep going! You're performing great today. 🎉
                    </p>
                  </div>
                </div>

              </div>

            </div>
          )}

          {/* TAB: MENU ITEMS & CATEGORIES */}
          {(activeTab === 'menus' || activeTab === 'categories') && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-5 rounded-3xl border border-gray-100 shadow-[0_2px_12px_rgba(0,0,0,0.03)]">
                <div>
                  <h3 className="font-bold text-sm text-gray-900">Katalog Menu & Kategori Makanan</h3>
                  <p className="text-xs text-gray-500">Kelola daftar menu, foto, harga, dan ketersediaan stok</p>
                </div>
                <button
                  onClick={() => setIsAddMenuOpen(true)}
                  className="bg-[#FF5B26] hover:bg-[#E84E1C] text-white font-bold px-4 py-2.5 rounded-2xl text-xs flex items-center gap-1.5 transition self-start sm:self-auto shadow-sm"
                >
                  <Plus className="w-4 h-4" />
                  <span>Tambah Menu Baru</span>
                </button>
              </div>

              {/* Menu Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {menus.map(item => (
                  <div key={item.id} className="bg-white rounded-3xl border border-gray-100 p-4 flex gap-3.5 shadow-sm hover:shadow-md transition">
                    <img 
                      src={item.image} 
                      alt={item.name} 
                      className="w-20 h-20 rounded-2xl object-cover bg-gray-100 shrink-0" 
                    />
                    <div className="flex flex-col justify-between grow min-w-0">
                      <div>
                        <div className="flex justify-between items-start gap-1">
                          <h4 className="font-bold text-xs text-gray-900 truncate">{item.name}</h4>
                          <button
                            onClick={() => handleDeleteMenu(item.id)}
                            className="text-gray-300 hover:text-rose-600 transition"
                            title="Hapus Menu"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <p className="text-[10px] text-gray-500 line-clamp-1 mt-0.5">{item.description}</p>
                        <p className="text-xs font-mono font-bold text-gray-900 mt-1">{formatRupiah(item.price)}</p>
                      </div>

                      <div className="pt-2 border-t border-gray-100 flex items-center justify-between">
                        <span className="text-[10px] text-gray-500">Status Stok:</span>
                        <button
                          onClick={() => handleToggleMenu(item.id, item.is_available)}
                          className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full transition ${
                            item.is_available 
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                              : 'bg-gray-100 text-gray-500 border border-gray-200'
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

          {/* TAB: ORDERS & TRANSACTIONS */}
          {(activeTab === 'orders' || activeTab === 'customers') && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-5 rounded-3xl border border-gray-100 shadow-[0_2px_12px_rgba(0,0,0,0.03)]">
                <div>
                  <h3 className="font-bold text-sm text-gray-900">Riwayat Pesanan & Data Pelanggan</h3>
                  <p className="text-xs text-gray-500">Semua transaksi yang masuk secara realtime dari Meja dan POS</p>
                </div>
                <button
                  onClick={handleExportCSV}
                  className="bg-[#FF5B26] hover:bg-[#E84E1C] text-white font-bold px-4 py-2.5 rounded-2xl text-xs flex items-center gap-1.5 transition self-start sm:self-auto shadow-sm"
                >
                  <Download className="w-4 h-4" />
                  <span>Export Laporan (CSV / Excel)</span>
                </button>
              </div>

              <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-100 text-gray-600 font-semibold text-[11px]">
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
                    <tbody className="divide-y divide-gray-100">
                      {orders.map(ord => (
                        <tr key={ord.id} className="hover:bg-gray-50/60 transition">
                          <td className="py-3.5 px-5 font-mono font-bold text-gray-900">{ord.order_number}</td>
                          <td className="py-3.5 px-5 font-bold">
                            {ord.order_type === 'takeaway' ? 'Takeaway' : `Meja ${ord.table_number}`}
                          </td>
                          <td className="py-3.5 px-5 text-gray-700">{ord.customer_name}</td>
                          <td className="py-3.5 px-5">
                            <span className="text-[11px] font-semibold text-gray-800 bg-gray-100 px-2 py-0.5 rounded-md">
                              {ord.cashier_name || 'Kasir'}
                            </span>
                          </td>
                          <td className="py-3.5 px-5 font-bold text-gray-900 font-mono">{formatRupiah(ord.total_amount)}</td>
                          <td className="py-3.5 px-5 text-gray-600 font-medium">{ord.payment_method}</td>
                          <td className="py-3.5 px-5">
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-gray-100 text-gray-800">
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

          {/* TAB: INVENTORY & EXPENSES */}
          {activeTab === 'expenses' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-5 rounded-3xl border border-gray-100 shadow-[0_2px_12px_rgba(0,0,0,0.03)]">
                <div>
                  <h3 className="font-bold text-sm text-gray-900">Inventory & Catatan Biaya Operasional</h3>
                  <p className="text-xs text-gray-500">Mencatat pembelian bahan baku dapur, utilitas listrik/gas, dan inventaris</p>
                </div>
                <button
                  onClick={() => setIsAddExpenseOpen(true)}
                  className="bg-[#FF5B26] hover:bg-[#E84E1C] text-white font-bold px-4 py-2.5 rounded-2xl text-xs flex items-center gap-1.5 transition self-start sm:self-auto shadow-sm"
                >
                  <Plus className="w-4 h-4" />
                  <span>Tambah Pengeluaran</span>
                </button>
              </div>

              <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-100 text-gray-600 font-semibold text-[11px]">
                        <th className="py-3.5 px-5">Tanggal</th>
                        <th className="py-3.5 px-5">Kategori Biaya</th>
                        <th className="py-3.5 px-5">Keterangan</th>
                        <th className="py-3.5 px-5 text-right">Nominal</th>
                        <th className="py-3.5 px-5 text-center">Hapus</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {expenses.map(exp => (
                        <tr key={exp.id} className="hover:bg-gray-50/60 transition">
                          <td className="py-3.5 px-5 text-gray-600 font-mono">{exp.expense_date}</td>
                          <td className="py-3.5 px-5">
                            <span className="bg-gray-100 text-gray-700 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border border-gray-200">
                              {exp.category}
                            </span>
                          </td>
                          <td className="py-3.5 px-5 text-gray-900">{exp.description}</td>
                          <td className="py-3.5 px-5 text-right font-bold text-gray-900 font-mono">
                            {formatRupiah(exp.amount)}
                          </td>
                          <td className="py-3.5 px-5 text-center">
                            <button
                              onClick={() => handleDeleteExpense(exp.id)}
                              className="text-gray-400 hover:text-rose-600 p-1.5 rounded-lg hover:bg-rose-50 transition"
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

          {/* TAB: TABLES & QR */}
          {activeTab === 'tables' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-5 rounded-3xl border border-gray-100 shadow-[0_2px_12px_rgba(0,0,0,0.03)]">
                <div>
                  <h3 className="font-bold text-sm text-gray-900">Manajemen Meja & QR Stand</h3>
                  <p className="text-xs text-gray-500">Daftar meja restoran yang telah terpasang standing akrilik QR</p>
                </div>
                <Link
                  href="/qr-meja"
                  className="bg-[#FF5B26] hover:bg-[#E84E1C] text-white font-bold px-4 py-2.5 rounded-2xl text-xs flex items-center gap-1.5 transition self-start sm:self-auto shadow-sm"
                >
                  <QrCode className="w-4 h-4" />
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
                          ? 'bg-[#FFF5F1] border-[#FF5B26]/30 text-gray-900 shadow-sm' 
                          : 'bg-white border-gray-100 text-gray-900 shadow-sm'
                      }`}
                    >
                      <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-gray-400 block mb-1">
                        {tbl.table_code}
                      </span>
                      <h4 className="text-xl font-black text-gray-900">Meja {tbl.table_number}</h4>
                      <div className="mt-3">
                        <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          hasActiveOrder 
                            ? 'bg-[#FF5B26] text-white' 
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

          {/* TAB: STAFF & USERS */}
          {activeTab === 'users' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-5 rounded-3xl border border-gray-100 shadow-[0_2px_12px_rgba(0,0,0,0.03)]">
                <div>
                  <h3 className="font-bold text-sm text-gray-900">Kelola Pengguna & Akun Kasir</h3>
                  <p className="text-xs text-gray-500">Tambah akun staf kasir, atur 4-digit PIN shift, dan hak akses sistem</p>
                </div>
                <button
                  onClick={() => setIsAddUserOpen(true)}
                  className="bg-[#FF5B26] hover:bg-[#E84E1C] text-white font-bold px-4 py-2.5 rounded-2xl text-xs flex items-center gap-1.5 transition self-start sm:self-auto shadow-sm"
                >
                  <Plus className="w-4 h-4" />
                  <span>Tambah Karyawan Baru</span>
                </button>
              </div>

              {/* Users Table */}
              <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-100 text-gray-600 font-semibold text-[11px]">
                        <th className="py-3.5 px-5">Nama Karyawan</th>
                        <th className="py-3.5 px-5">Username</th>
                        <th className="py-3.5 px-5">Role Akses</th>
                        <th className="py-3.5 px-5">PIN Kasir</th>
                        <th className="py-3.5 px-5">Status</th>
                        <th className="py-3.5 px-5 text-center">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {users.map(u => (
                        <tr key={u.id} className="hover:bg-gray-50/60 transition">
                          <td className="py-3.5 px-5 font-bold text-gray-900 flex items-center gap-3">
                            <div className="w-8 h-8 rounded-xl bg-[#FF5B26]/10 border border-[#FF5B26]/20 flex items-center justify-center font-bold text-[#FF5B26] text-xs">
                              {u.name.charAt(0)}
                            </div>
                            <span>{u.name}</span>
                          </td>
                          <td className="py-3.5 px-5 font-mono text-gray-600">{u.username || '-'}</td>
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
                          <td className="py-3.5 px-5 font-mono font-bold text-gray-800 tracking-widest">
                            {u.pin ? '••••' : 'Tanpa PIN'}
                          </td>
                          <td className="py-3.5 px-5">
                            <button
                              onClick={() => handleToggleUserStatus(u)}
                              className={`px-2.5 py-1 rounded-full text-[10px] font-bold transition ${
                                u.is_active !== false 
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100' 
                                  : 'bg-gray-100 text-gray-500 border border-gray-200 hover:bg-gray-200'
                              }`}
                            >
                              {u.is_active !== false ? 'Aktif' : 'Nonaktif'}
                            </button>
                          </td>
                          <td className="py-3.5 px-5 text-center">
                            <button
                              onClick={() => handleDeleteUser(u.id)}
                              className="text-gray-400 hover:text-rose-600 p-1.5 rounded-lg hover:bg-rose-50 transition"
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

          {/* TAB: SETTINGS */}
          {activeTab === 'settings' && (
            <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm space-y-4 max-w-xl">
              <h3 className="font-bold text-sm text-gray-900">Pengaturan Restoran & Sistem</h3>
              <p className="text-xs text-gray-500">Konfigurasi outlet dan profil administrator</p>
              
              <div className="pt-2 space-y-3 text-xs">
                <div>
                  <label className="block font-semibold text-gray-700 mb-1">Nama Restoran</label>
                  <input
                    type="text"
                    defaultValue={setting?.name || 'Rasa Nusantara'}
                    disabled
                    className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-3.5 py-2.5 text-xs text-gray-600"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-gray-700 mb-1">Administrator Aktif</label>
                  <input
                    type="text"
                    defaultValue={activeAdmin?.name || 'Administrator'}
                    disabled
                    className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-3.5 py-2.5 text-xs text-gray-600"
                  />
                </div>

                <div className="pt-3">
                  <button
                    onClick={handleAdminLogout}
                    className="w-full bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold py-3 rounded-2xl text-xs transition"
                  >
                    Keluar Sesi Administrator
                  </button>
                </div>
              </div>
            </div>
          )}

        </main>
      </div>

      {/* MODAL TAMBAH USER / KARYAWAN */}
      {isAddUserOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl overflow-hidden p-6 space-y-4 border border-gray-100">
            <div className="flex justify-between items-center pb-3 border-b border-gray-100">
              <h3 className="font-bold text-sm text-gray-900">Tambah Akun Karyawan / Kasir</h3>
              <button onClick={() => setIsAddUserOpen(false)} className="text-gray-400 hover:text-gray-900">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddUser} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-gray-700 mb-1">Nama Lengkap</label>
                <input
                  type="text"
                  placeholder="Contoh: Rina Maharani"
                  value={newUserName}
                  onChange={e => setNewUserName(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-3.5 py-2.5 text-xs focus:bg-white focus:outline-none focus:border-[#FF5B26]"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block font-semibold text-gray-700 mb-1">Username Login</label>
                  <input
                    type="text"
                    placeholder="rina"
                    value={newUserUsername}
                    onChange={e => setNewUserUsername(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-3.5 py-2.5 text-xs font-mono focus:bg-white focus:outline-none focus:border-[#FF5B26]"
                    required
                  />
                </div>

                <div>
                  <label className="block font-semibold text-gray-700 mb-1">Role Akses</label>
                  <select
                    value={newUserRole}
                    onChange={e => setNewUserRole(e.target.value as any)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-3.5 py-2.5 text-xs focus:bg-white focus:outline-none focus:border-[#FF5B26]"
                  >
                    <option value="kasir">Kasir</option>
                    <option value="dapur">Dapur (Chef)</option>
                    <option value="admin">Admin / Manajer</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-gray-700 mb-1">4-Digit PIN Kasir</label>
                <input
                  type="password"
                  maxLength={6}
                  placeholder="1234"
                  value={newUserPin}
                  onChange={e => setNewUserPin(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-3.5 py-2.5 text-xs font-mono tracking-widest focus:bg-white focus:outline-none focus:border-[#FF5B26]"
                  required
                />
                <p className="text-[10px] text-gray-400 mt-0.5">Digunakan staf saat membuka shift kasir di terminal POS.</p>
              </div>

              <div>
                <label className="block font-semibold text-gray-700 mb-1">Email (Opsional)</label>
                <input
                  type="email"
                  placeholder="rina@resto.com"
                  value={newUserEmail}
                  onChange={e => setNewUserEmail(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-3.5 py-2.5 text-xs focus:bg-white focus:outline-none focus:border-[#FF5B26]"
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="submit"
                  className="grow bg-[#FF5B26] hover:bg-[#E84E1C] text-white font-bold py-3 rounded-2xl text-xs transition shadow-sm"
                >
                  Simpan Karyawan
                </button>
                <button
                  type="button"
                  onClick={() => setIsAddUserOpen(false)}
                  className="px-4 bg-gray-100 text-gray-700 font-bold py-3 rounded-2xl text-xs hover:bg-gray-200"
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
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl overflow-hidden p-6 space-y-4 border border-gray-100">
            <div className="flex justify-between items-center pb-3 border-b border-gray-100">
              <h3 className="font-bold text-sm text-gray-900">Tambah Menu Makanan/Minuman</h3>
              <button onClick={() => setIsAddMenuOpen(false)} className="text-gray-400 hover:text-gray-900">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddMenu} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-gray-700 mb-1">Kategori</label>
                <select
                  value={menuCatId}
                  onChange={e => setMenuCatId(parseInt(e.target.value))}
                  className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-3.5 py-2.5 text-xs focus:bg-white"
                >
                  <option value={1}>Makanan Utama (Main Course)</option>
                  <option value={2}>Minuman Segar (Beverages)</option>
                  <option value={3}>Camilan & Side Dish (Snacks)</option>
                  <option value={4}>Desserts & Penutup</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-gray-700 mb-1">Nama Menu</label>
                <input
                  type="text"
                  placeholder="Contoh: Paneer Butter Masala"
                  value={menuName}
                  onChange={e => setMenuName(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-3.5 py-2.5 text-xs focus:bg-white focus:outline-none focus:border-[#FF5B26]"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-gray-700 mb-1">Harga Satuan (Rp / ₹)</label>
                <input
                  type="number"
                  placeholder="25000"
                  value={menuPrice || ''}
                  onChange={e => setMenuPrice(parseInt(e.target.value) || 0)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-3.5 py-2.5 text-xs font-bold focus:bg-white focus:outline-none focus:border-[#FF5B26]"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-gray-700 mb-1">Deskripsi Singkat</label>
                <textarea
                  placeholder="Keterangan bumbu atau sajian..."
                  value={menuDesc}
                  onChange={e => setMenuDesc(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-3.5 py-2.5 text-xs h-16 resize-none focus:bg-white focus:outline-none focus:border-[#FF5B26]"
                />
              </div>

              <div>
                <label className="block font-semibold text-gray-700 mb-1">URL Foto Menu</label>
                <input
                  type="url"
                  placeholder="https://..."
                  value={menuImage}
                  onChange={e => setMenuImage(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-3.5 py-2.5 text-xs focus:bg-white focus:outline-none focus:border-[#FF5B26]"
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="submit"
                  className="grow bg-[#FF5B26] hover:bg-[#E84E1C] text-white font-bold py-3 rounded-2xl text-xs transition shadow-sm"
                >
                  Simpan Menu
                </button>
                <button
                  type="button"
                  onClick={() => setIsAddMenuOpen(false)}
                  className="px-4 bg-gray-100 text-gray-700 font-bold py-3 rounded-2xl text-xs hover:bg-gray-200"
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
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl overflow-hidden p-6 space-y-4 border border-gray-100">
            <div className="flex justify-between items-center pb-3 border-b border-gray-100">
              <h3 className="font-bold text-sm text-gray-900">Catat Pengeluaran Restoran</h3>
              <button onClick={() => setIsAddExpenseOpen(false)} className="text-gray-400 hover:text-gray-900">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddExpense} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-gray-700 mb-1">Tanggal</label>
                <input
                  type="date"
                  value={expDate}
                  onChange={e => setExpDate(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-3.5 py-2.5 text-xs focus:bg-white"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-gray-700 mb-1">Kategori Biaya</label>
                <select
                  value={expCategory}
                  onChange={e => setExpCategory(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-3.5 py-2.5 text-xs focus:bg-white"
                >
                  <option value="Bahan Baku Makanan">Bahan Baku Dapur</option>
                  <option value="Operasional & Utilitas">Operasional & Listrik/Gas</option>
                  <option value="Gaji & Upah Staf">Gaji & Upah Karyawan</option>
                  <option value="Sewa & Pemeliharaan">Sewa Tempat & Servis</option>
                  <option value="Lain-lain">Lain-lain</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-gray-700 mb-1">Keterangan Biaya</label>
                <input
                  type="text"
                  placeholder="Contoh: Belanja beras & bumbu dapur di pasar"
                  value={expDesc}
                  onChange={e => setExpDesc(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-3.5 py-2.5 text-xs focus:bg-white"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-gray-700 mb-1">Nominal Biaya (Rp)</label>
                <input
                  type="number"
                  placeholder="150000"
                  value={expAmount || ''}
                  onChange={e => setExpAmount(parseInt(e.target.value) || 0)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-3.5 py-2.5 text-xs font-bold focus:bg-white"
                  required
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="submit"
                  className="grow bg-[#FF5B26] hover:bg-[#E84E1C] text-white font-bold py-3 rounded-2xl text-xs transition shadow-sm"
                >
                  Simpan Biaya
                </button>
                <button
                  type="button"
                  onClick={() => setIsAddExpenseOpen(false)}
                  className="px-4 bg-gray-100 text-gray-700 font-bold py-3 rounded-2xl text-xs hover:bg-gray-200"
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
