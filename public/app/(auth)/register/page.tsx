import type { Metadata } from 'next';
import { AuthPage } from '@/components/auth/auth-page';

export const metadata: Metadata = { title: 'Daftar — CampusFlow' };

/** Hanya terima tujuan berupa halaman undangan (cegah open redirect). */
function safeNext(value: string | string[] | undefined): string | undefined {
  const v = Array.isArray(value) ? value[0] : value;
  return v && /^\/join\/[A-Za-z0-9]{20,100}$/.test(v) ? v : undefined;
}

export default function RegisterPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  return <AuthPage initialMode="register" nextPath={safeNext(searchParams.next)} />;
}
