import 'server-only';
import { getCurrentUser } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';

/**
 * Akses halaman tim (rekap interest check). Isi ADMIN_EMAILS di Vercel dengan email anggota tim,
 * dipisah koma: a@binus.ac.id,b@gmail.com. Kosong = tidak ada yang bisa membuka.
 * Tanda kutip/spasi yang ikut tersalin dari .env.example dibersihkan otomatis.
 */
function adminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? '')
    .split(/[,;\s]+/)
    .map((e) => e.trim().replace(/^["']+|["']+$/g, '').toLowerCase())
    .filter(Boolean);
}

/** Cek cepat (tanpa jaringan) — hanya untuk menampilkan menu. Halaman tetap memakai isTeamAdmin(). */
export async function looksLikeTeamAdmin(): Promise<boolean> {
  const user = await getCurrentUser();
  const email = user?.email?.toLowerCase();
  return Boolean(email && adminEmails().includes(email));
}

/**
 * Cek penuh untuk membuka halaman/unduhan admin: user diverifikasi ke server Auth (getUser) dan
 * emailnya wajib sudah dikonfirmasi — mencegah orang lain mendaftar memakai email tim.
 */
export async function isTeamAdmin(): Promise<boolean> {
  const {
    data: { user },
  } = await (await createClient()).auth.getUser();
  const email = user?.email?.toLowerCase();
  if (!email || !user?.email_confirmed_at) return false;
  return adminEmails().includes(email);
}
