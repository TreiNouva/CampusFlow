'use server';

import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth/session';
import {
  loginSchema,
  registerSchema,
  resetPasswordSchema,
} from '@/lib/validations/schemas';
import type { ActionResult } from './organization-actions';

/** Hanya izinkan kembali ke halaman undangan (/join/<token>); selain itu ke dashboard (cegah open redirect). */
function safeNextPath(value: FormDataEntryValue | null): string {
  const next = typeof value === 'string' ? value : '';
  return /^\/join\/[A-Za-z0-9]{20,100}$/.test(next) ? next : '/dashboard';
}

export async function login(formData: FormData): Promise<ActionResult> {
  const parsed = loginSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Input tidak valid' };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) {
    if ((error as any).code === 'email_not_confirmed' || /not confirmed/i.test(error.message)) {
      return { success: false, error: 'Email belum dikonfirmasi. Buka email dari CampusFlow (cek juga folder Spam) dan klik link konfirmasinya.' };
    }
    return { success: false, error: 'Email atau password salah.' };
  }

  redirect(safeNextPath(formData.get('next')));
}

/** Alamat publik aplikasi untuk link di email (Vercel menaruhnya di header x-forwarded-*). */
async function publicOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host');
  if (host) return `${h.get('x-forwarded-proto') ?? 'https'}://${host}`;
  return (process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000').replace(/\/$/, '');
}

export async function register(formData: FormData): Promise<ActionResult<{ needsConfirmation: boolean; email: string }>> {
  const parsed = registerSchema.safeParse({
    fullName: formData.get('fullName'),
    email: formData.get('email'),
    password: formData.get('password'),
  });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Input tidak valid' };
  }

  const next = safeNextPath(formData.get('next'));
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { full_name: parsed.data.fullName },
      // Link konfirmasi kembali ke aplikasi ini (bukan localhost), lalu lanjut ke tujuan semula.
      emailRedirectTo: `${await publicOrigin()}/auth/callback?next=${encodeURIComponent(next)}`,
    },
  });

  if (error) {
    if (/rate limit/i.test(error.message)) return { success: false, error: 'Terlalu banyak pendaftaran dalam waktu singkat. Coba lagi beberapa menit lagi.' };
    if (/already registered/i.test(error.message)) return { success: false, error: 'Email ini sudah terdaftar. Silakan masuk.' };
    return { success: false, error: error.message };
  }

  // "Confirm email" aktif: belum ada sesi sampai link di email diklik.
  if (!data.session) {
    // Email yang sudah terdaftar dikembalikan tanpa identities (Supabase tidak membocorkannya lewat error).
    if (data.user && (data.user.identities?.length ?? 0) === 0) {
      return { success: false, error: 'Email ini sudah terdaftar. Silakan masuk atau gunakan Lupa password.' };
    }
    // Pindah ke halaman masuk dengan pesan "cek email". Dilakukan lewat redirect (bukan state di form)
    // karena Supabase menyimpan cookie verifikasi saat signUp, yang membuat form dimuat ulang.
    const params = new URLSearchParams({ registered: '1', email: parsed.data.email });
    if (next !== '/dashboard') params.set('next', next);
    redirect(`/login?${params.toString()}`);
  }

  redirect(next);
}

export async function logout(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/login');
}

/** updatePassword — simpan password baru. Hanya bisa dipakai user yang sedang punya sesi (dari link reset). */
export async function updatePassword(formData: FormData): Promise<ActionResult> {
  const parsed = resetPasswordSchema.safeParse({
    password: formData.get('password'),
    confirmPassword: formData.get('confirmPassword'),
  });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Input tidak valid' };
  }

  const user = await getCurrentUser();
  if (!user) {
    return { success: false, error: 'Sesi reset password sudah berakhir. Silakan minta link baru.' };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    console.error('[updatePassword]', error.status, error.message);
    if (error.message.toLowerCase().includes('different')) {
      return { success: false, error: 'Password baru harus berbeda dari password lama.' };
    }
    return { success: false, error: 'Gagal mengubah password. Coba lagi.' };
  }

  redirect('/dashboard');
}
