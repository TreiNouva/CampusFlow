'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { register } from '@/actions/auth-actions';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { LoadingOverlay } from '@/components/ui/loading-overlay';
import { isNextRedirect, NETWORK_ERROR_MESSAGE } from '@/lib/utils';

export default function RegisterPage() {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    setError(null);
    setBusy(true);
    startTransition(async () => {
      try {
        const result = await register(formData);
        if (result && !result.success) {
          setError(result.error ?? 'Gagal mendaftar.');
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
    <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm rounded-card border border-gray-100 bg-white p-8 shadow-sm">
        <h1 className="font-heading text-2xl font-bold text-navy">Buat Akun CampusFlow</h1>
        <p className="mt-1 text-sm text-muted">Gratis untuk organisasi kampus.</p>

        <form action={handleSubmit} className="mt-6 space-y-4">
          <div>
            <Label htmlFor="fullName">Nama Lengkap</Label>
            <Input id="fullName" name="fullName" type="text" placeholder="Nama kamu" required />
          </div>
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" placeholder="kamu@kampus.ac.id" required />
          </div>
          <div>
            <Label htmlFor="password">Password</Label>
            <Input id="password" name="password" type="password" placeholder="Minimal 8 karakter" required />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? 'Memproses...' : 'Daftar'}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-muted">
          Sudah punya akun?{' '}
          <Link href="/login" className="font-semibold text-navy">
            Masuk
          </Link>
        </p>
      </div>
      {busy && <LoadingOverlay label="Membuat akun..." />}
    </main>
  );
}
