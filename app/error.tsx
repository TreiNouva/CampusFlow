'use client';

import Link from 'next/link';
import { useEffect } from 'react';

/** Tampilan saat sebuah halaman gagal dimuat — user bisa mencoba lagi tanpa memuat ulang seluruh aplikasi. */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('[CampusFlow] page error', error.digest ?? '', error.message);
  }, [error]);

  return (
    <main className="flex min-h-[70vh] flex-col items-center justify-center px-4 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-orange-light text-2xl font-bold text-orange" aria-hidden>!</span>
      <h1 className="mt-4 font-heading text-xl font-bold text-ink">Ada yang tidak beres</h1>
      <p className="mt-2 max-w-sm text-sm text-muted">
        Halaman ini gagal dimuat. Coba lagi. Kalau terus terjadi, periksa koneksi internetmu atau kembali ke Beranda.
      </p>
      {error.digest && <p className="mt-2 font-mono text-xs text-gray-400">Kode: {error.digest}</p>}
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <button type="button" onClick={reset} className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark">Coba lagi</button>
        <Link href="/dashboard" className="rounded-lg border border-line bg-surface px-4 py-2 text-sm font-semibold text-ink hover:bg-gray-50">Ke Beranda</Link>
      </div>
    </main>
  );
}
