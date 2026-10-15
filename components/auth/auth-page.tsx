'use client';

import { FormEvent, useState, useTransition } from 'react';
import { login, register } from '@/actions/auth-actions';
import { LoadingOverlay } from '@/components/ui/loading-overlay';
import { PasswordInput } from '@/components/ui/password-input';
import { ParticleBackground } from '@/components/auth/particle-background';
import { cn, isNextRedirect, NETWORK_ERROR_MESSAGE } from '@/lib/utils';

type Mode = 'login' | 'register';

interface FormProps {
  /** Dipanggil saat proses dimulai/selesai agar overlay blur ditampilkan di luar kartu. */
  onBusyChange: (label: string | null) => void;
  onSwitch: () => void;
}

/**
 * Menonaktifkan fokus/klik pada sisi kartu yang sedang tersembunyi (dipasang lewat ref
 * agar bekerja di semua versi React, karena atribut `inert` belum ada di tipe React 18).
 */
const inertRef = (isInert: boolean) => (el: HTMLElement | null) => {
  if (!el) return;
  if (isInert) el.setAttribute('inert', '');
  else el.removeAttribute('inert');
};

export function AuthPage({ initialMode }: { initialMode: Mode }) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const [overlayLabel, setOverlayLabel] = useState<string | null>(null);
  const isRegister = mode === 'register';

  function switchMode(next: Mode) {
    setMode(next);
    try {
      // Sinkronkan URL (/login <-> /register) tanpa memuat ulang halaman.
      window.history.replaceState(null, '', next === 'login' ? '/login' : '/register');
    } catch {
      // abaikan: URL tidak berubah, tampilan tetap berfungsi
    }
  }

  return (
    <main className="auth-page">
      <ParticleBackground />

      <div className={cn('auth-container', isRegister && 'active')}>
        {/* Form Daftar */}
        <section className="auth-form-container auth-sign-up" ref={inertRef(!isRegister)} aria-hidden={!isRegister}>
          <RegisterForm onBusyChange={setOverlayLabel} onSwitch={() => switchMode('login')} />
        </section>

        {/* Form Masuk */}
        <section className="auth-form-container auth-sign-in" ref={inertRef(isRegister)} aria-hidden={isRegister}>
          <LoginForm onBusyChange={setOverlayLabel} onSwitch={() => switchMode('register')} />
        </section>

        {/* Panel gradient yang bergeser (hanya tampil di layar lebar) */}
        <div className="auth-toggle-container">
          <div className="auth-toggle">
            <div className="auth-toggle-panel auth-toggle-left" ref={inertRef(!isRegister)} aria-hidden={!isRegister}>
              <h2>Selamat Datang Kembali!</h2>
              <p>Sudah punya akun? Masuk untuk lanjut mengelola project dan task organisasimu.</p>
              <button type="button" className="auth-ghost" onClick={() => switchMode('login')}>
                Masuk
              </button>
            </div>
            <div className="auth-toggle-panel auth-toggle-right" ref={inertRef(isRegister)} aria-hidden={isRegister}>
              <h2>Halo, Teman!</h2>
              <p>Belum punya akun? Daftar gratis dan mulai kelola organisasi kampusmu bersama CampusFlow.</p>
              <button type="button" className="auth-ghost" onClick={() => switchMode('register')}>
                Daftar
              </button>
            </div>
          </div>
        </div>
      </div>

      <p className="auth-copy">© {new Date().getFullYear()} CampusFlow — Run Your Organization, Not Your Spreadsheets.</p>

      {overlayLabel && <LoadingOverlay label={overlayLabel} />}
    </main>
  );
}

function LoginForm({ onBusyChange, onSwitch }: FormProps) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [, startTransition] = useTransition();

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); // pakai onSubmit (bukan action) supaya isian tidak ter-reset saat gagal
    const formData = new FormData(e.currentTarget);
    setError(null);
    setBusy(true);
    onBusyChange('Sedang masuk...');

    startTransition(async () => {
      try {
        const result = await login(formData);
        if (result && !result.success) {
          setError(result.error ?? 'Gagal masuk.');
          setBusy(false);
          onBusyChange(null);
        }
        // Sukses: server mengarahkan ke /dashboard. Overlay tetap tampil sampai halaman berpindah.
      } catch (err) {
        if (isNextRedirect(err)) return;
        setError(NETWORK_ERROR_MESSAGE);
        setBusy(false);
        onBusyChange(null);
      }
    });
  }

  return (
    <form className="auth-form" onSubmit={handleSubmit}>
      <span className="auth-brand">CampusFlow</span>
      <h1 className="auth-title">Masuk</h1>
      <p className="auth-sub">Gunakan email dan password akunmu.</p>

      <div className="auth-field">
        <label htmlFor="login-email" className="sr-only">
          Email
        </label>
        <input
          id="login-email"
          name="email"
          type="email"
          placeholder="Email"
          autoComplete="email"
          autoCapitalize="none"
          required
          className="auth-input"
        />
      </div>
      <div className="auth-field">
        <label htmlFor="login-password" className="sr-only">
          Password
        </label>
        <PasswordInput
          id="login-password"
          name="password"
          placeholder="Password"
          autoComplete="current-password"
          required
          className="auth-input"
        />
      </div>

      {error && (
        <p role="alert" className="auth-error">
          {error}
        </p>
      )}

      <button type="submit" className="auth-btn" disabled={busy}>
        {busy ? 'Memproses...' : 'Masuk'}
      </button>

      <p className="auth-mobile-switch">
        Belum punya akun?{' '}
        <button type="button" onClick={onSwitch}>
          Daftar
        </button>
      </p>
    </form>
  );
}

function RegisterForm({ onBusyChange, onSwitch }: FormProps) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [, startTransition] = useTransition();

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    setError(null);
    setBusy(true);
    onBusyChange('Membuat akun...');

    startTransition(async () => {
      try {
        const result = await register(formData);
        if (result && !result.success) {
          setError(result.error ?? 'Gagal mendaftar.');
          setBusy(false);
          onBusyChange(null);
        }
        // Sukses: server mengarahkan ke /dashboard. Overlay tetap tampil sampai halaman berpindah.
      } catch (err) {
        if (isNextRedirect(err)) return;
        setError(NETWORK_ERROR_MESSAGE);
        setBusy(false);
        onBusyChange(null);
      }
    });
  }

  return (
    <form className="auth-form" onSubmit={handleSubmit}>
      <span className="auth-brand">CampusFlow</span>
      <h1 className="auth-title">Buat Akun</h1>
      <p className="auth-sub">Gratis untuk organisasi kampus.</p>

      <div className="auth-field">
        <label htmlFor="register-name" className="sr-only">
          Nama lengkap
        </label>
        <input
          id="register-name"
          name="fullName"
          type="text"
          placeholder="Nama lengkap"
          autoComplete="name"
          required
          className="auth-input"
        />
      </div>
      <div className="auth-field">
        <label htmlFor="register-email" className="sr-only">
          Email
        </label>
        <input
          id="register-email"
          name="email"
          type="email"
          placeholder="Email"
          autoComplete="email"
          autoCapitalize="none"
          required
          className="auth-input"
        />
      </div>
      <div className="auth-field">
        <label htmlFor="register-password" className="sr-only">
          Password
        </label>
        <PasswordInput
          id="register-password"
          name="password"
          placeholder="Password (minimal 8 karakter)"
          autoComplete="new-password"
          minLength={8}
          required
          className="auth-input"
        />
      </div>

      {error && (
        <p role="alert" className="auth-error">
          {error}
        </p>
      )}

      <button type="submit" className="auth-btn" disabled={busy}>
        {busy ? 'Memproses...' : 'Daftar'}
      </button>

      <p className="auth-mobile-switch">
        Sudah punya akun?{' '}
        <button type="button" onClick={onSwitch}>
          Masuk
        </button>
      </p>
    </form>
  );
}
