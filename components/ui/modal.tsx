'use client';

import { ReactNode, useEffect } from 'react';

/** Dialog sederhana: tutup dengan Esc / klik latar, scroll halaman dikunci, isi bisa di-scroll di layar kecil. */
export function Modal({
  title,
  onClose,
  children,
  busy = false,
  maxWidth = 'max-w-md',
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  busy?: boolean;
  maxWidth?: string;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onClose();
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [busy, onClose]);

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-navy/30 p-4 backdrop-blur-[2px] animate-fade-in"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div className="flex min-h-full items-center justify-center">
        <div role="dialog" aria-modal="true" aria-label={title} className={`w-full ${maxWidth} rounded-card bg-white p-5 shadow-xl`}>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-heading text-lg font-bold text-ink">{title}</h2>
            <button type="button" onClick={onClose} disabled={busy} className="rounded-md px-2 py-1 text-sm text-muted hover:bg-gray-100" aria-label="Tutup">
              ✕
            </button>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
