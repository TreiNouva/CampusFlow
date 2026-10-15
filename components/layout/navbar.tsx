import { Suspense } from 'react';
import Link from 'next/link';
import { logout } from '@/actions/auth-actions';
import { getCurrentProfile } from '@/lib/auth/session';
import { initials } from '@/lib/utils';

/**
 * Navbar dibungkus Suspense: bagian profil user dimuat terpisah (streaming)
 * sehingga isi halaman tidak perlu menunggu query profil selesai.
 */
export function Navbar() {
  return (
    <header className="sticky top-0 z-10 border-b border-gray-100 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
        <Link href="/dashboard" className="font-heading text-lg font-bold text-navy">
          CampusFlow
        </Link>

        <div className="flex items-center gap-4">
          <Suspense fallback={<div className="h-8 w-32 animate-pulse rounded-full bg-gray-100" />}>
            <NavbarUser />
          </Suspense>
          <form action={logout}>
            <button type="submit" className="text-sm font-medium text-muted hover:text-ink">
              Keluar
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}

async function NavbarUser() {
  const profile = await getCurrentProfile();
  if (!profile) return null;

  return (
    <div className="flex items-center gap-2">
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-navy text-xs font-bold text-white">
        {initials(profile.full_name || profile.email)}
      </div>
      <span className="hidden text-sm text-ink sm:inline">{profile.full_name || profile.email}</span>
    </div>
  );
}
