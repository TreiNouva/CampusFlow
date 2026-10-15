'use client';

import { InputHTMLAttributes, useState } from 'react';
import { cn } from '@/lib/utils';

type PasswordInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  /** Class untuk pembungkus (posisi relatif tempat tombol mata menempel). */
  wrapperClassName?: string;
};

/**
 * Input password dengan tombol mata untuk menampilkan/menyembunyikan isinya,
 * supaya user bisa memastikan password yang diketik sudah benar.
 */
export function PasswordInput({ className, wrapperClassName, ...props }: PasswordInputProps) {
  const [visible, setVisible] = useState(false);

  return (
    <div className={cn('relative', wrapperClassName)}>
      <input
        {...props}
        type={visible ? 'text' : 'password'}
        className={cn(className, 'pr-11')}
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        // Cegah input kehilangan fokus saat tombol mata diklik (nyaman di HP).
        onMouseDown={(e) => e.preventDefault()}
        aria-label={visible ? 'Sembunyikan password' : 'Tampilkan password'}
        aria-pressed={visible}
        title={visible ? 'Sembunyikan password' : 'Tampilkan password'}
        className="auth-eye"
      >
        {visible ? (
          // Mata dicoret: password sedang terlihat, klik untuk menyembunyikan
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
            <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
            <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
            <line x1="1" y1="1" x2="23" y2="23" />
          </svg>
        ) : (
          // Mata terbuka: password tersembunyi, klik untuk menampilkan
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        )}
      </button>
    </div>
  );
}
