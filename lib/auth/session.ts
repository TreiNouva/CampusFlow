import { createClient } from '@/lib/supabase/server';
import type { Profile } from '@/types/database';
import { redirect } from 'next/navigation';

/** Mengembalikan user yang login, atau null jika belum login. */
export async function getCurrentUser() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/** Mengembalikan profile lengkap (tabel profiles) dari user yang login. */
export async function getCurrentProfile(): Promise<Profile | null> {
  const supabase = createClient();
  const user = await getCurrentUser();
  if (!user) return null;

  const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();
  return data;
}

/** Dipakai di halaman yang wajib login. Redirect ke /login jika belum. */
export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login');
  }
  return user;
}
