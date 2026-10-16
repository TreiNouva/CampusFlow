'use client';

import Link from 'next/link';
import { FormEvent, useState, useTransition } from 'react';
import { updatePassword } from '@/actions/auth-actions';
import { WaveBackground } from '@/components/auth/wave-background';
import { LoadingOverlay } from '@/components/ui/loading-overlay';
import { PasswordInput } from '@/components/ui/password-input';
import { isNextRedirect, NETWORK_ERROR_MESSAGE } from '@/lib/utils';

/** Halaman tujuan link di email: atur password baru (atau info bahwa link tidak valid/kedaluwarsa). */
export function ResetPasswordView({ linkValid }: { linkValid: boolean }) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [, startTransition] = useTransition();

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    // Cek cepat di browser sebelum ke server
    if (formData.get('password') !== formData.get('confirmPassword')) {
      setError('Konfirmasi password tidak sama.');
      return;
    }

    setError(null);
    setBusy(true);
    startTransition(async () => {
      try {
        const result = await updatePassword(formData);
        if (result && !result.success) {
          setError(result.error ?? 'Gagal mengubah password.');
          setBusy(false);
        }
        // Sukses: server mengarahkan ke /dashboard. Overlay tetap tampil sampai halaman berpindah.
      } catch (err) {
        if (isNextRedirect(err)) return;
        setError(NETWORK_ERROR_MESSAGE);
        setBusy(false);
      }
    });
  }

  return (
    <main className="auth-page">
      <WaveBackground />

      <div className="auth-container auth-single">
        <div className="auth-single-body">
          {linkValid ? (
            <form className="auth-form" onSubmit={handleSubmit}>
              <span className="auth-brand">CampusFlow</span>
              <h1 className="auth-title">Password Baru</h1>
              <p className="auth-sub">Buat password baru untuk akunmu (minimal 8 karakter).</p>

              <div className="auth-field">
                <label htmlFor="new-password" className="sr-only">
                  Password baru
                </label>
                <PasswordInput
                  id="new-password"
                  name="password"
                  placeholder="Password baru"
                  autoComplete="new-password"
                  minLength={8}
                  required
                  className="auth-input"
                />
              </div>
              <div className="auth-field">
                <label htmlFor="confirm-password" className="sr-only">
                  Ulangi password baru
                </label>
                <PasswordInput
                  id="confirm-password"
                  name="confirmPassword"
                  placeholder="Ulangi password baru"
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
                {busy ? 'Menyimpan...' : 'Simpan Password'}
              </button>
            </form>
          ) : (
            <div className="auth-form">
              <span className="auth-brand">CampusFlow</span>
              <h1 className="auth-title">Link Tidak Valid</h1>
              <p className="auth-sub">
                Link reset password ini sudah kedaluwarsa atau sudah pernah dipakai. Minta link baru untuk melanjutkan.
              </p>
              <Link href="/login?forgot=1" className="auth-btn auth-btn-link">
                Minta Link Baru
              </Link>
              <Link href="/login" className="auth-link">
                ← Kembali ke Masuk
              </Link>
            </div>
          )}
        </div>
      </div>

      <p className="auth-copy">© {new Date().getFullYear()} CampusFlow — Run Your Organization, Not Your Spreadsheets.</p>
      {busy && <LoadingOverlay label="Menyimpan password..." />}
    </main>
  );
}
