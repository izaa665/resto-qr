'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  TrendingUp, 
  TrendingDown, 
  Wallet, 
  Percent, 
  Plus, 
  Trash2, 
  Printer, 
  ArrowLeft,
  X,
  Users
} from 'lucide-react';
import { Expense, MenuItem, Order, User } from '@/types/database';
import { 
  fetchExpenses, 
  createExpense, 
  deleteExpense, 
  fetchMenus, 
  toggleMenuAvailability, 
  createMenuItem, 
  fetchOrders,
  fetchUsers
} from '@/lib/supabase';
import { formatRupiah } from '@/lib/utils';

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<'expenses' | 'menus' | 'analytics' | 'users'>('expenses');
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [menus, setMenus] = useState<MenuItem[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [users, setUsers] = useState<User[]>([]);

  // Modals
  const [isAddExpenseOpen, setIsAddExpenseOpen] = useState(false);
  const [isAddMenuOpen, setIsAddMenuOpen] = useState(false);

  // Form Expense
  const [expDate, setExpDate] = useState(new Date().toISOString().slice(0, 10));
  const [expCategory, setExpCategory] = useState('Bahan Baku Makanan');
  const [expDesc, setExpDesc] = useState('');
  const [expAmount, setExpAmount] = useState<number>(0);

  // Form Menu
  const [menuCatId, setMenuCatId] = useState<number>(1);
  const [menuName, setMenuName] = useState('');
  const [menuDesc, setMenuDesc] = useState('');
  const [menuPrice, setMenuPrice] = useState<number>(0);
  const [menuImage, setMenuImage] = useState('');

  const loadAllData = async () => {
    const [exp, mn, ord, usr] = await Promise.all([
      fetchExpenses(),
      fetchMenus(),
      fetchOrders(),
      fetchUsers()
    ]);
    setExpenses(exp);
    setMenus(mn);
    setOrders(ord);
    setUsers(usr);
  };

  useEffect(() => {
    loadAllData();
  }, []);

  // Financial calculations
  const totalIncome = orders
    .filter(o => o.payment_status === 'paid')
    .reduce((sum, o) => sum + o.total_amount, 0);

  const totalExpense = expenses.reduce((sum, e) => sum + e.amount, 0);
  const netProfit = totalIncome - totalExpense;
  const profitMargin = totalIncome > 0 ? Math.round((netProfit / totalIncome) * 100) : 0;

  // Best Sellers Calculation
  const menuSalesMap: { [name: string]: { qty: number; revenue: number } } = {};
  orders
    .filter(o => o.payment_status === 'paid')
    .forEach(order => {
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
    if (confirm('Hapus catatan biaya ini?')) {
      await deleteExpense(id);
      loadAllData();
    }
  };

  const handleToggleMenu = async (id: number, currentStatus: boolean) => {
    await toggleMenuAvailability(id, !currentStatus);
    loadAllData();
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

  return (
    <div className="bg-neutral-50 min-h-screen text-neutral-900 font-sans selection:bg-neutral-900 selection:text-white">
      
      {/* Backoffice Header */}
      <header className="bg-white border-b border-neutral-200 sticky top-0 z-30 px-4 sm:px-6 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Link href="/" className="w-8 h-8 rounded-lg bg-neutral-100 hover:bg-neutral-200 flex items-center justify-center text-neutral-600 transition">
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div>
              <h1 className="font-bold text-sm tracking-tight text-neutral-950 uppercase">
                Backoffice & Manajemen
              </h1>
              <p className="text-[11px] text-neutral-500">Laporan Penjualan, Biaya & Konfigurasi Restoran</p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Link
              href="/kasir"
              className="bg-neutral-100 hover:bg-neutral-200 text-neutral-800 font-semibold px-3 py-1.5 rounded-lg text-xs transition"
            >
              Kasir POS
            </Link>
            <button
              onClick={() => window.print()}
              className="bg-neutral-950 hover:bg-neutral-900 text-white font-semibold px-3.5 py-1.5 rounded-lg text-xs flex items-center gap-1.5 transition"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Cetak Rekap</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-5">

        {/* Financial KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          <div className="bg-white rounded-xl p-4 border border-neutral-200">
            <span className="text-[11px] uppercase tracking-wider text-neutral-400 font-semibold">Omset Penjualan</span>
            <h3 className="text-xl font-bold text-neutral-950 mt-1">{formatRupiah(totalIncome)}</h3>
            <p className="text-[11px] text-neutral-500 mt-0.5">Dari transaksi berstatus lunas</p>
          </div>

          <div className="bg-white rounded-xl p-4 border border-neutral-200">
            <span className="text-[11px] uppercase tracking-wider text-neutral-400 font-semibold">Total Pengeluaran</span>
            <h3 className="text-xl font-bold text-neutral-950 mt-1">{formatRupiah(totalExpense)}</h3>
            <p className="text-[11px] text-neutral-500 mt-0.5">{expenses.length} transaksi pembelanjaan toko</p>
          </div>

          <div className="bg-white rounded-xl p-4 border border-neutral-200">
            <span className="text-[11px] uppercase tracking-wider text-neutral-400 font-semibold">Laba Bersih (Net)</span>
            <h3 className={`text-xl font-bold mt-1 ${netProfit >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
              {formatRupiah(netProfit)}
            </h3>
            <p className="text-[11px] text-neutral-500 mt-0.5">Omset dikurangi total biaya</p>
          </div>

          <div className="bg-white rounded-xl p-4 border border-neutral-200">
            <span className="text-[11px] uppercase tracking-wider text-neutral-400 font-semibold">Profit Margin</span>
            <h3 className="text-xl font-bold text-neutral-950 mt-1">{profitMargin}%</h3>
            <p className="text-[11px] text-neutral-500 mt-0.5">Rasio efisiensi operasional</p>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
          <div className="flex border-b border-neutral-200 bg-neutral-50 px-3 py-2 gap-1.5 overflow-x-auto no-scrollbar">
            <button
              onClick={() => setActiveTab('expenses')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
                activeTab === 'expenses' ? 'bg-white text-neutral-950 shadow-sm' : 'text-neutral-500 hover:text-neutral-900'
              }`}
            >
              Pengeluaran & Pembelian
            </button>
            <button
              onClick={() => setActiveTab('menus')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
                activeTab === 'menus' ? 'bg-white text-neutral-950 shadow-sm' : 'text-neutral-500 hover:text-neutral-900'
              }`}
            >
              Katalog Menu & Stok
            </button>
            <button
              onClick={() => setActiveTab('analytics')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
                activeTab === 'analytics' ? 'bg-white text-neutral-950 shadow-sm' : 'text-neutral-500 hover:text-neutral-900'
              }`}
            >
              Menu Terlaris
            </button>
            <button
              onClick={() => setActiveTab('users')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
                activeTab === 'users' ? 'bg-white text-neutral-950 shadow-sm' : 'text-neutral-500 hover:text-neutral-900'
              }`}
            >
              Staf & Pengguna
            </button>
          </div>

          {/* Tab 1: Expenses */}
          {activeTab === 'expenses' && (
            <div className="p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-xs uppercase tracking-wider text-neutral-950">Catatan Pengeluaran Resto</h3>
                  <p className="text-xs text-neutral-500">Mencatat pembelian bahan baku dapur, utilitas gas, dan perlengkapan</p>
                </div>
                <button
                  onClick={() => setIsAddExpenseOpen(true)}
                  className="bg-neutral-950 hover:bg-neutral-900 text-white font-semibold px-3 py-1.5 rounded-lg text-xs flex items-center gap-1.5 transition"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Tambah Pengeluaran</span>
                </button>
              </div>

              <div className="overflow-x-auto rounded-lg border border-neutral-200">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-neutral-50 border-b border-neutral-200 text-neutral-600 font-semibold text-[11px]">
                      <th className="py-2.5 px-3">Tanggal</th>
                      <th className="py-2.5 px-3">Kategori</th>
                      <th className="py-2.5 px-3">Keterangan</th>
                      <th className="py-2.5 px-3 text-right">Nominal</th>
                      <th className="py-2.5 px-3 text-center">Hapus</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {expenses.map(exp => (
                      <tr key={exp.id} className="hover:bg-neutral-50/50">
                        <td className="py-2.5 px-3 whitespace-nowrap text-neutral-600">{exp.expense_date}</td>
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <span className="bg-neutral-100 text-neutral-700 px-2 py-0.5 rounded text-[11px] font-medium border border-neutral-200">
                            {exp.category}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-neutral-900">{exp.description}</td>
                        <td className="py-2.5 px-3 text-right font-bold text-neutral-900 whitespace-nowrap">
                          {formatRupiah(exp.amount)}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <button
                            onClick={() => handleDeleteExpense(exp.id)}
                            className="text-neutral-400 hover:text-red-600 p-1 transition"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-neutral-50 font-bold border-t border-neutral-200">
                      <td colSpan={3} className="py-2.5 px-3 text-right text-neutral-700">Total Pengeluaran:</td>
                      <td className="py-2.5 px-3 text-right text-neutral-950">{formatRupiah(totalExpense)}</td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* Tab 2: Menus */}
          {activeTab === 'menus' && (
            <div className="p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-xs uppercase tracking-wider text-neutral-950">Daftar Menu Makanan & Minuman</h3>
                  <p className="text-xs text-neutral-500">Kelola harga dan ketersediaan stok menu</p>
                </div>
                <button
                  onClick={() => setIsAddMenuOpen(true)}
                  className="bg-neutral-950 hover:bg-neutral-900 text-white font-semibold px-3 py-1.5 rounded-lg text-xs flex items-center gap-1.5 transition"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Tambah Menu</span>
                </button>
              </div>

              <div className="overflow-x-auto rounded-lg border border-neutral-200">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-neutral-50 border-b border-neutral-200 text-neutral-600 font-semibold text-[11px]">
                      <th className="py-2.5 px-3">Nama Menu</th>
                      <th className="py-2.5 px-3">Kategori</th>
                      <th className="py-2.5 px-3">Harga</th>
                      <th className="py-2.5 px-3 text-center">Ketersediaan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {menus.map(menu => (
                      <tr key={menu.id} className="hover:bg-neutral-50/50">
                        <td className="py-2 px-3">
                          <div className="flex items-center space-x-2.5">
                            <img src={menu.image} alt={menu.name} className="w-8 h-8 rounded object-cover bg-neutral-100 shrink-0" />
                            <div>
                              <p className="font-semibold text-neutral-950">{menu.name}</p>
                              <p className="text-[11px] text-neutral-400 line-clamp-1">{menu.description}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-2 px-3 text-neutral-600">{menu.category_name}</td>
                        <td className="py-2 px-3 font-semibold text-neutral-900">{formatRupiah(menu.price)}</td>
                        <td className="py-2 px-3 text-center">
                          <button
                            onClick={() => handleToggleMenu(menu.id, menu.is_available)}
                            className={`px-2.5 py-1 rounded text-[11px] font-semibold border transition ${
                              menu.is_available
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                                : 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100'
                            }`}
                          >
                            {menu.is_available ? 'Tersedia' : 'Habis'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Tab 3: Analytics */}
          {activeTab === 'analytics' && (
            <div className="p-5 space-y-4">
              <div>
                <h3 className="font-bold text-xs uppercase tracking-wider text-neutral-950">Menu Terlaris (Best Seller)</h3>
                <p className="text-xs text-neutral-500">Peringkat produk berdasarkan frekuensi pesanan yang lunas</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {bestSellers.map((item, idx) => (
                  <div key={idx} className="bg-white p-3.5 rounded-xl border border-neutral-200 flex items-center justify-between">
                    <div>
                      <span className="text-[11px] font-mono text-neutral-400">Peringkat #{idx + 1}</span>
                      <h4 className="font-bold text-xs text-neutral-950 mt-0.5">{item.name}</h4>
                      <p className="text-xs text-neutral-500 mt-0.5">Terjual: <strong>{item.qty} porsi</strong></p>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-neutral-400 block uppercase">Kontribusi Omset</span>
                      <span className="text-xs font-bold text-neutral-950">{formatRupiah(item.revenue)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tab 4: Users */}
          {activeTab === 'users' && (
            <div className="p-5 space-y-4">
              <div>
                <h3 className="font-bold text-xs uppercase tracking-wider text-neutral-950">Pengguna & Akses Karyawan</h3>
                <p className="text-xs text-neutral-500">Daftar akun staf restoran</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {users.map(u => (
                  <div key={u.id} className="bg-white p-3.5 rounded-xl border border-neutral-200">
                    <span className="text-[10px] uppercase font-bold text-neutral-400 tracking-wider">Role: {u.role}</span>
                    <h4 className="font-bold text-xs text-neutral-950 mt-0.5">{u.name}</h4>
                    <p className="text-xs text-neutral-500">{u.email}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

      </main>

      {/* Add Expense Modal */}
      {isAddExpenseOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full shadow-xl p-5 border border-neutral-200">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-bold text-xs uppercase tracking-wider text-neutral-950">Tambah Pengeluaran</h3>
              <button onClick={() => setIsAddExpenseOpen(false)} className="text-neutral-400 hover:text-neutral-900">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddExpense} className="space-y-3 text-xs">
              <div>
                <label className="block text-[11px] font-semibold text-neutral-600 mb-1">Tanggal</label>
                <input
                  type="date"
                  value={expDate}
                  onChange={e => setExpDate(e.target.value)}
                  className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-2.5 py-1.5"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-neutral-600 mb-1">Kategori Biaya</label>
                <select
                  value={expCategory}
                  onChange={e => setExpCategory(e.target.value)}
                  className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-2.5 py-1.5 font-medium"
                >
                  <option value="Bahan Baku Makanan">Bahan Baku Makanan</option>
                  <option value="Bahan Minuman">Bahan Minuman</option>
                  <option value="Operasional & Gas">Operasional & Gas</option>
                  <option value="Peralatan & Kebersihan">Peralatan & Kebersihan</option>
                  <option value="Gaji & Karyawan">Gaji & Karyawan</option>
                  <option value="Lain-lain">Lain-lain</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-neutral-600 mb-1">Keterangan Belanja</label>
                <input
                  type="text"
                  placeholder="Contoh: Beli ayam potong 10kg"
                  value={expDesc}
                  onChange={e => setExpDesc(e.target.value)}
                  className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-2.5 py-1.5"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-neutral-600 mb-1">Nominal (Rp)</label>
                <input
                  type="number"
                  placeholder="150000"
                  value={expAmount || ''}
                  onChange={e => setExpAmount(parseInt(e.target.value) || 0)}
                  className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-2.5 py-1.5 font-bold"
                />
              </div>
              <div className="pt-2 flex gap-2">
                <button type="submit" className="grow bg-neutral-950 hover:bg-neutral-900 text-white font-semibold py-2 rounded-lg text-xs">
                  Simpan Catatan
                </button>
                <button type="button" onClick={() => setIsAddExpenseOpen(false)} className="px-3 bg-neutral-100 text-neutral-700 font-semibold py-2 rounded-lg text-xs">
                  Batal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Menu Modal */}
      {isAddMenuOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full shadow-xl p-5 border border-neutral-200">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-bold text-xs uppercase tracking-wider text-neutral-950">Tambah Menu Makanan</h3>
              <button onClick={() => setIsAddMenuOpen(false)} className="text-neutral-400 hover:text-neutral-900">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddMenu} className="space-y-3 text-xs">
              <div>
                <label className="block text-[11px] font-semibold text-neutral-600 mb-1">Kategori</label>
                <select
                  value={menuCatId}
                  onChange={e => setMenuCatId(parseInt(e.target.value))}
                  className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-2.5 py-1.5 font-medium"
                >
                  <option value={1}>Makanan Utama</option>
                  <option value={2}>Minuman Segar</option>
                  <option value={3}>Camilan & Snack</option>
                  <option value={4}>Kopi & Dessert</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-neutral-600 mb-1">Nama Menu</label>
                <input
                  type="text"
                  placeholder="Contoh: Bebek Goreng Sambal Ijo"
                  value={menuName}
                  onChange={e => setMenuName(e.target.value)}
                  className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-2.5 py-1.5"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-neutral-600 mb-1">Harga (Rp)</label>
                <input
                  type="number"
                  placeholder="35000"
                  value={menuPrice || ''}
                  onChange={e => setMenuPrice(parseInt(e.target.value) || 0)}
                  className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-2.5 py-1.5 font-bold"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-neutral-600 mb-1">Deskripsi Singkat</label>
                <textarea
                  rows={2}
                  placeholder="Deskripsi singkat menu..."
                  value={menuDesc}
                  onChange={e => setMenuDesc(e.target.value)}
                  className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-2.5 py-1.5"
                />
              </div>
              <div className="pt-2 flex gap-2">
                <button type="submit" className="grow bg-neutral-950 hover:bg-neutral-900 text-white font-semibold py-2 rounded-lg text-xs">
                  Simpan Menu
                </button>
                <button type="button" onClick={() => setIsAddMenuOpen(false)} className="px-3 bg-neutral-100 text-neutral-700 font-semibold py-2 rounded-lg text-xs">
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
