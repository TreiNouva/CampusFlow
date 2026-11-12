import { cache } from 'react';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { Profile } from '@/types/database';

export interface SessionUser {
  id: string;
  email: string;
}

/**
 * Mengembalikan user yang login, atau null jika belum login.
 *
 * PERFORMA: dibungkus `cache()` supaya dalam SATU request (Navbar + halaman +
 * server action) pengecekan login cuma dilakukan sekali. `getClaims()`
 * memverifikasi JWT secara lokal (tanpa round-trip ke server Auth Supabase),
 * jauh lebih cepat daripada `getUser()` yang selalu memanggil jaringan.
 * Jika getClaims gagal/tidak tersedia, otomatis fallback ke `getUser()`.
 */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const supabase = createClient();

  try {
    const { data, error } = await supabase.auth.getClaims();
    const sub = data?.claims?.sub;
    if (!error && sub) {
      return { id: sub, email: (data?.claims?.email as string | undefined) ?? '' };
    }
  } catch {
    // lanjut ke fallback di bawah
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user ? { id: user.id, email: user.email ?? '' } : null;
});

/** Mengembalikan profile lengkap (tabel profiles) dari user yang login. */
export const getCurrentProfile = cache(async (): Promise<Profile | null> => {
  const user = await getCurrentUser();
  if (!user) return null;

  const supabase = createClient();
  const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();
  return data;
});

/** Dipakai di halaman yang wajib login. Redirect ke /login jika belum. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login');
  }
  return user;
}
