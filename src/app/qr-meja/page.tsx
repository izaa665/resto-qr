'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  Printer, 
  ArrowLeft, 
  ExternalLink,
  Wifi,
  Globe,
  Laptop
} from 'lucide-react';
import QRCode from 'qrcode';
import { RestaurantTable } from '@/types/database';
import { fetchTables } from '@/lib/supabase';

export default function TableQRGeneratorPage() {
  const [tables, setTables] = useState<RestaurantTable[]>([]);
  const [qrCodeUrls, setQrCodeUrls] = useState<{ [tableNum: number]: string }>({});
  
  // Deteksi host aktif
  const localWifiIp = '10.49.165.23';
  const vercelLiveUrl = 'https://resto-next-sepia.vercel.app/?meja=';
  const [baseUrl, setBaseUrl] = useState(vercelLiveUrl);

  useEffect(() => {
    async function load() {
      const data = await fetchTables();
      setTables(data);
    }
    load();
  }, []);

  useEffect(() => {
    if (!baseUrl || tables.length === 0) return;

    async function generateQRs() {
      const urls: { [key: number]: string } = {};
      for (const t of tables) {
        const fullTargetUrl = `${baseUrl}${t.table_number}`;
        try {
          const qrDataUrl = await QRCode.toDataURL(fullTargetUrl, {
            width: 260,
            margin: 1,
            color: {
              dark: '#171717',
              light: '#ffffff',
            },
          });
          urls[t.table_number] = qrDataUrl;
        } catch (err) {
          console.error('QR Error:', err);
        }
      }
      setQrCodeUrls(urls);
    }

    generateQRs();
  }, [tables, baseUrl]);

  return (
    <div className="bg-neutral-100 min-h-screen text-neutral-900 font-sans p-4 sm:p-6 lg:p-8 selection:bg-neutral-900 selection:text-white">
      
      {/* Controls Bar */}
      <div className="max-w-6xl mx-auto mb-6 no-print">
        <div className="bg-white rounded-xl p-4 sm:p-5 border border-neutral-200 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <Link
              href="/"
              className="w-8 h-8 rounded-lg bg-neutral-100 hover:bg-neutral-200 flex items-center justify-center text-neutral-600 transition"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div>
              <h1 className="text-sm font-bold uppercase tracking-wider text-neutral-950">
                Kartu QR Meja Restoran (Siap Scan HP)
              </h1>
              <p className="text-xs text-neutral-500">
                Gunakan pilihan koneksi di bawah agar kamera HP asli bisa langsung membuka menu saat scan.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => window.print()}
              className="bg-neutral-950 hover:bg-neutral-900 text-white font-semibold px-4 py-2 rounded-lg text-xs flex items-center gap-1.5 transition"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Cetak Semua Kartu Meja</span>
            </button>
            <Link
              href="/kasir"
              className="bg-neutral-100 hover:bg-neutral-200 text-neutral-800 font-semibold px-3.5 py-2 rounded-lg text-xs transition"
            >
              Kasir
            </Link>
          </div>
        </div>

        {/* Quick Connection Switcher */}
        <div className="bg-white rounded-xl p-4 mt-3 border border-neutral-200 space-y-3 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-semibold text-neutral-700">Pilih Target URL untuk QR Code:</span>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setBaseUrl(`http://${localWifiIp}:3000/?meja=`)}
                className={`px-3 py-1.5 rounded-lg border flex items-center gap-1.5 font-semibold transition ${
                  baseUrl.includes(localWifiIp)
                    ? 'bg-neutral-950 text-white border-neutral-950'
                    : 'bg-neutral-50 text-neutral-700 border-neutral-200 hover:bg-neutral-100'
                }`}
              >
                <Wifi className="w-3.5 h-3.5" />
                <span>Wi-Fi HP ({localWifiIp})</span>
              </button>

              <button
                type="button"
                onClick={() => setBaseUrl(vercelLiveUrl)}
                className={`px-3 py-1.5 rounded-lg border flex items-center gap-1.5 font-semibold transition ${
                  baseUrl.includes('vercel.app')
                    ? 'bg-neutral-950 text-white border-neutral-950'
                    : 'bg-neutral-50 text-neutral-700 border-neutral-200 hover:bg-neutral-100'
                }`}
              >
                <Globe className="w-3.5 h-3.5" />
                <span>Online Vercel Live (Paket Data 4G/5G)</span>
              </button>

              <button
                type="button"
                onClick={() => setBaseUrl('http://localhost:3000/?meja=')}
                className={`px-3 py-1.5 rounded-lg border flex items-center gap-1.5 font-semibold transition ${
                  baseUrl.includes('localhost')
                    ? 'bg-neutral-950 text-white border-neutral-950'
                    : 'bg-neutral-50 text-neutral-700 border-neutral-200 hover:bg-neutral-100'
                }`}
              >
                <Laptop className="w-3.5 h-3.5" />
                <span>Localhost (Hanya Laptop)</span>
              </button>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-2 pt-2 border-t border-neutral-100 text-[11px] text-neutral-600">
            <span className="font-semibold shrink-0">Custom Domain / Vercel:</span>
            <input
              type="text"
              value={baseUrl}
              onChange={e => setBaseUrl(e.target.value)}
              placeholder="Contoh: https://resto-qr.vercel.app/?meja="
              className="bg-neutral-50 border border-neutral-200 rounded-lg px-2.5 py-1 text-xs font-mono text-neutral-900 grow focus:bg-white"
            />
          </div>

          <div className="flex items-center space-x-2 text-[11px] text-neutral-500">
            <span>Contoh URL QR Meja 05:</span>
            <code className="bg-neutral-100 text-neutral-900 font-mono px-2 py-0.5 rounded font-semibold grow truncate">
              {baseUrl}5
            </code>
          </div>
        </div>
      </div>

      {/* Grid Table Stand Acrylic Cards */}
      <div className="max-w-6xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {tables.map(tbl => {
          const num = tbl.table_number;
          const padNum = String(num).padStart(2, '0');
          const qrImg = qrCodeUrls[num];
          const currentUrl = `${baseUrl}${num}`;

          return (
            <div
              key={num}
              className="bg-white rounded-xl p-5 border border-neutral-200 flex flex-col items-center justify-between text-center relative hover:border-neutral-300 transition"
            >
              {/* Card Header */}
              <div className="w-full pb-3 border-b border-neutral-100 flex items-center justify-between text-[11px]">
                <span className="font-bold tracking-wider uppercase text-neutral-900">Kans Resto</span>
                <span className="text-neutral-400 font-mono">DINE-IN</span>
              </div>

              {/* Table Number */}
              <div className="my-4">
                <span className="text-[10px] uppercase font-semibold text-neutral-400 block tracking-widest">NOMOR MEJA</span>
                <p className="text-3xl font-black text-neutral-950 tracking-tight mt-0.5">{padNum}</p>
              </div>

              {/* QR Image Box */}
              <div className="p-2 border border-neutral-200 rounded-lg bg-white mb-3 shadow-sm">
                {qrImg ? (
                  <img src={qrImg} alt={`QR Meja ${num}`} className="w-40 h-40 mx-auto" />
                ) : (
                  <div className="w-40 h-40 flex items-center justify-center text-xs text-neutral-400">
                    Membuat QR...
                  </div>
                )}
              </div>

              {/* Instructions */}
              <div className="w-full bg-neutral-50 rounded-lg p-2.5 mb-3 border border-neutral-100 text-left text-[11px] text-neutral-600 space-y-0.5">
                <p className="font-semibold text-neutral-800">Cara Pesan:</p>
                <p>1. Buka kamera ponsel</p>
                <p>2. Arahkan ke kode QR di atas</p>
                <p>3. Pilih menu dan pesan dari meja</p>
              </div>

              {/* Test Action (Hidden on Print) */}
              <div className="w-full pt-2 border-t border-neutral-100 no-print">
                <a
                  href={currentUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full bg-neutral-950 hover:bg-neutral-900 text-white text-xs font-semibold py-2 rounded-lg flex items-center justify-center gap-1.5 transition"
                >
                  <ExternalLink className="w-3 h-3" />
                  <span>Test Buka Meja {num}</span>
                </a>
              </div>
            </div>
          );
        })}
      </div>

    </div>
  );
}
