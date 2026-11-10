import 'server-only';
import { getCurrentUser } from '@/lib/auth/session';

/**
 * Akses halaman tim (rekap interest check). Isi ADMIN_EMAILS di Vercel dengan email anggota tim,
 * dipisah koma: ADMIN_EMAILS="a@binus.ac.id,b@gmail.com". Kosong = tidak ada yang bisa membuka.
 */
export async function isTeamAdmin(): Promise<boolean> {
  const user = await getCurrentUser();
  const email = user?.email?.toLowerCase();
  if (!email) return false;
  const allowed = (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return allowed.includes(email);
}
