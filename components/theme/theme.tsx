'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { cn } from '@/lib/utils';

const KEY = 'cf-theme';

/**
 * Dijalankan di <head> sebelum halaman tampil, supaya tidak ada "kedipan" tema terang
 * saat pengguna memilih tema gelap. Default (v8.4): ikut pengaturan perangkat; setelah pengguna
 * menekan tombol tema, pilihannya disimpan dan dipakai seterusnya.
 */
export const THEME_INIT_SCRIPT = `try{var t=localStorage.getItem('${KEY}');if(t==='dark'||(t!=='light'&&window.matchMedia('(prefers-color-scheme: dark)').matches))document.documentElement.classList.add('dark')}catch(e){}`;

function isDarkNow() {
  return typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
}

/**
 * Tombol ganti tema. Tema baru "menyebar seperti tinta" dari posisi tombol
 * (View Transitions API + mask SVG, lihat globals.css). Browser lama / pengguna yang
 * mematikan animasi langsung berganti tanpa efek.
 */
export function ThemeToggle({ className, withLabel = false }: { className?: string; withLabel?: boolean }) {
  const [dark, setDark] = useState(false);
  useEffect(() => setDark(isDarkNow()), []);

  function toggle(e: React.MouseEvent<HTMLButtonElement>) {
    const next = !isDarkNow();
    const apply = () => {
      document.documentElement.classList.toggle('dark', next);
      try { localStorage.setItem(KEY, next ? 'dark' : 'light'); } catch { /* storage diblokir */ }
      setDark(next);
    };
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const doc = document as Document & { startViewTransition?: (cb: () => void) => unknown };
    if (!doc.startViewTransition || reduce) { apply(); return; }
    const r = e.currentTarget.getBoundingClientRect();
    const root = document.documentElement.style;
    root.setProperty('--ink-x', `${r.left + r.width / 2}px`);
    root.setProperty('--ink-y', `${r.top + r.height / 2}px`);
    doc.startViewTransition(apply);
  }

  const label = dark ? 'Tema terang' : 'Tema gelap';
  return (
    <button type="button" onClick={toggle} aria-label={label} title={label}
      className={cn('flex items-center gap-3 rounded-lg text-gray-600 transition hover:bg-gray-100 hover:text-ink', withLabel ? 'w-full px-3 py-2 text-sm' : 'p-2', className)}>
      <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden className={withLabel ? 'text-gray-400' : ''}>
        {dark ? (
          <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>
        ) : (
          <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" />
        )}
      </svg>
      {withLabel && <span>{label}</span>}
    </button>
  );
}

/** Logo horizontal yang otomatis memakai versi putih di tema gelap. */
export function ThemedLogo({ width, height, className, priority }: { width: number; height: number; className?: string; priority?: boolean }) {
  return (
    <>
      <Image src="/brand/campusflow-logo-horizontal.svg" alt="CampusFlow" width={width} height={height} priority={priority} className={cn('logo-on-light', className)} />
      <Image src="/brand/campusflow-logo-horizontal-dark.svg" alt="CampusFlow" width={width} height={height} priority={priority} className={cn('logo-on-dark', className)} />
    </>
  );
}
