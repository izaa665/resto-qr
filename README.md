# 🍽️ Resto QR - Next.js, Tailwind CSS & Supabase

Aplikasi sistem pemesanan makanan berbasis QR Code di meja pelanggan dengan teknologi modern:
- **Next.js 14 (App Router & React 18)**
- **Tailwind CSS (Modern, Responsive & Clean UI)**
- **Supabase (PostgreSQL Database, Realtime & Auth Ready)**

---

## ⚡ 3 Sistem Utama

| Sistem | Rute Halaman | Deskripsi Fitur |
| :--- | :--- | :--- |
| **1. Pesanan Meja Pelanggan** | `/?meja=1` | • Deteksi nomor meja otomatis via QR.<br>• Filter kategori makanan & minuman, live search.<br>• Keranjang pesanan dinamis + catatan khusus per menu.<br>• Pilihan bayar: **Tunai**, **QRIS** (tampil QR instan), **Transfer**.<br>• Tracking status pesanan realtime. |
| **2. Terminal Kasir & Cetak Struk** | `/kasir` | • **Realtime Live Order** terintegrasi Supabase Realtime.<br>• **Notifikasi Audio Chime/Ding** saat ada pesanan baru.<br>• Aksi cepat kasir: Masak, Tandai Lunas, dan Selesai.<br>• **Cetak Struk Thermal (58mm/80mm)** standar printer POS kasir. |
| **3. Dashboard Atasan / Admin** | `/admin` | • **Pencatatan Pengeluaran & Pembelian**: Catat belanja bahan makanan dapur, operasional, gas LPG, gaji, dll.<br>• **Laporan Keuangan & Laba Bersih**: Omset Penjualan - Total Pengeluaran = Net Profit & Profit Margin.<br>• **Top 5 Menu Terlaris (Best Seller)**.<br>• **Kelola Menu & Stok**: Tambah menu baru, ubah harga, toggle stok (🟢 Tersedia / 🔴 Habis).<br>• Tombol Cetak Laporan Keuangan untuk atasan. |
| **QR Meja Khusus (1 s/d 10)** | `/qr-meja` | • Generator QR Code khusus untuk Meja 1 sampai Meja 10.<br>• Desain **Kartu Stand Akrilik Meja (Table Tent)** siap cetak.<br>• Tombol **"Cetak Semua Kartu Meja"** untuk langsung dipasang di meja resto. |

---

## 🚀 Cara Menjalankan Aplikasi

1. Buka Terminal / PowerShell di folder proyek:
   ```bash
   cd c:\xampp\htdocs\resto-next
   ```
2. Jalankan server pengembangan Next.js:
   ```bash
   npm run dev
   ```
3. Buka browser di:
   - **Cetak QR Meja (1-10):** [http://localhost:3000/qr-meja](http://localhost:3000/qr-meja)
   - **Menu Pelanggan Meja 1:** [http://localhost:3000/?meja=1](http://localhost:3000/?meja=1)
   - **Terminal Kasir:** [http://localhost:3000/kasir](http://localhost:3000/kasir)
   - **Dashboard Admin/Atasan:** [http://localhost:3000/admin](http://localhost:3000/admin)

---

## ☁️ Menghubungkan ke Supabase (Database & Realtime)

Aplikasi ini sudah dirancang dengan **Dual-Mode**:
- **Out-of-the-Box Mode:** Langsung bisa dijalankan dan dites secara offline/lokal tanpa konfigurasi awal.
- **Supabase Cloud Mode:** Untuk menghubungkan ke database online Supabase:
  1. Buka [https://supabase.com](https://supabase.com) dan buat project baru (gratis).
  2. Buka menu **SQL Editor**, buka file `supabase-schema.sql` di folder ini, lalu copy & paste seluruh isinya dan klik **Run**.
  3. Buka menu **Project Settings -> API**, salin **Project URL** dan **anon public key**.
  4. Buka file `.env.local` di folder `c:\xampp\htdocs\resto-next`, masukkan kredensial:
     ```env
     NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
     NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJh......
     ```
  5. Restart `npm run dev`. Sistem Anda sekarang terhubung langsung ke Supabase dengan fitur Realtime!
