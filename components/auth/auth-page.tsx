'use client';

import { FormEvent, useEffect, useState, useTransition } from 'react';
import { login, register } from '@/actions/auth-actions';
import { LoadingOverlay } from '@/components/ui/loading-overlay';
import { PasswordInput } from '@/components/ui/password-input';
import { WaveBackground } from '@/components/auth/wave-background';
import { resetRequestErrorMessage } from '@/lib/auth/reset-errors';
import { createClient } from '@/lib/supabase/client';
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

export function AuthPage({
  initialMode,
  initialForgot = false,
  nextPath,
}: {
  initialMode: Mode;
  /** Halaman tujuan setelah masuk/daftar (hanya /join/<token>, dari halaman undangan). */
  nextPath?: string;
  /** Buka langsung form "Lupa password" (dari /login?forgot=1). */
  initialForgot?: boolean;
}) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const [overlayLabel, setOverlayLabel] = useState<string | null>(null);
  const isRegister = mode === 'register';

  function switchMode(next: Mode) {
    setMode(next);
    try {
      // Sinkronkan URL (/login <-> /register) tanpa memuat ulang halaman.
      window.history.replaceState(null, '', (next === 'login' ? '/login' : '/register') + window.location.search);
    } catch {
      // abaikan: URL tidak berubah, tampilan tetap berfungsi
    }
  }

  return (
    <main className="auth-page">
      <WaveBackground />

      <div className={cn('auth-container', isRegister && 'active')}>
        {/* Form Daftar */}
        <section className="auth-form-container auth-sign-up" ref={inertRef(!isRegister)} aria-hidden={!isRegister}>
          <RegisterForm onBusyChange={setOverlayLabel} onSwitch={() => switchMode('login')} nextPath={nextPath} />
        </section>

        {/* Form Masuk */}
        <section className="auth-form-container auth-sign-in" ref={inertRef(isRegister)} aria-hidden={isRegister}>
          <LoginForm
            onBusyChange={setOverlayLabel}
            onSwitch={() => switchMode('register')}
            initialView={initialForgot ? 'forgot' : 'login'}
            nextPath={nextPath}
          />
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

type LoginView = 'login' | 'forgot' | 'sent';

/** Jeda sebelum user boleh meminta email reset lagi (Supabase membatasi ±1 email/menit per user). */
const RESEND_COOLDOWN_SECONDS = 60;

function LoginForm({
  onBusyChange,
  onSwitch,
  initialView = 'login',
  nextPath,
}: FormProps & { initialView?: LoginView; nextPath?: string }) {
  const [view, setView] = useState<LoginView>(initialView);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const [, startTransition] = useTransition();

  // Hitung mundur untuk tombol "Kirim ulang"
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  function goTo(next: LoginView) {
    setError(null);
    setView(next);
  }

  function handleLogin(e: FormEvent<HTMLFormElement>) {
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

  function sendResetEmail(email: string) {
    setError(null);
    setBusy(true);
    onBusyChange('Mengirim link reset...');

    startTransition(async () => {
      try {
        // Dikirim langsung dari browser (bukan server action): kode verifikasi PKCE disimpan di
        // cookie browser, dan tampilan kartu tidak ter-refresh/ter-reset saat permintaan selesai.
        // Respons Supabase sama baik email terdaftar maupun tidak (tidak membocorkan daftar akun).
        const supabase = createClient();
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
        });
        if (resetError) {
          setError(resetRequestErrorMessage(resetError));
          return;
        }
        setResetEmail(email);
        setCooldown(RESEND_COOLDOWN_SECONDS);
        setView('sent');
      } catch {
        setError(NETWORK_ERROR_MESSAGE);
      } finally {
        setBusy(false);
        onBusyChange(null);
      }
    });
  }

  function handleForgot(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const email = String(new FormData(e.currentTarget).get('email') ?? '').trim();
    sendResetEmail(email);
  }

  // ---------- Tampilan: "Cek email kamu" ----------
  // Setiap tampilan diberi `key` berbeda supaya React membuat elemen BARU, bukan memakai ulang
  // elemen lama. Tanpa ini, tombol "Lupa password?" (type=button) berubah jadi tombol submit
  // di form berikutnya pada klik yang sama, sehingga form langsung ter-submit otomatis.
  if (view === 'sent') {
    return (
      <div key="view-sent" className="auth-form">
        <div className="auth-sent-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="5" width="18" height="14" rx="2" />
            <path d="m3 7 9 6 9-6" />
          </svg>
        </div>
        <h1 className="auth-title">Cek Email Kamu</h1>
        <p className="auth-sub">
          Jika <strong>{resetEmail}</strong> terdaftar, link untuk mengatur ulang password sudah kami kirim. Cek juga
          folder spam.
        </p>

        {error && (
          <p role="alert" className="auth-error">
            {error}
          </p>
        )}

        <button
          type="button"
          className="auth-btn"
          disabled={busy || cooldown > 0}
          onClick={() => sendResetEmail(resetEmail)}
        >
          {cooldown > 0 ? `Kirim ulang (${cooldown}s)` : 'Kirim ulang'}
        </button>
        <button type="button" className="auth-link" onClick={() => goTo('login')}>
          ← Kembali ke Masuk
        </button>
      </div>
    );
  }

  // ---------- Tampilan: "Lupa password?" ----------
  if (view === 'forgot') {
    return (
      <form key="view-forgot" className="auth-form" onSubmit={handleForgot}>
        <span className="auth-brand">CampusFlow</span>
        <h1 className="auth-title">Lupa Password?</h1>
        <p className="auth-sub">Masukkan email akunmu. Kami kirim link untuk mengatur ulang password.</p>

        <div className="auth-field">
          <label htmlFor="forgot-email" className="sr-only">
            Email
          </label>
          <input
            id="forgot-email"
            name="email"
            type="email"
            placeholder="Email"
            autoComplete="email"
            autoCapitalize="none"
            defaultValue={resetEmail}
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
          {busy ? 'Mengirim...' : 'Kirim Link Reset'}
        </button>
        <button type="button" className="auth-link" onClick={() => goTo('login')}>
          ← Kembali ke Masuk
        </button>
      </form>
    );
  }

  // ---------- Tampilan: Masuk ----------
  return (
    <form key="view-login" className="auth-form" onSubmit={handleLogin}>
      {nextPath && <input type="hidden" name="next" value={nextPath} />}
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

      <button type="button" className="auth-link auth-link-right" onClick={() => goTo('forgot')}>
        Lupa password?
      </button>

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

function RegisterForm({ onBusyChange, onSwitch, nextPath }: FormProps & { nextPath?: string }) {
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
      {nextPath && <input type="hidden" name="next" value={nextPath} />}
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
