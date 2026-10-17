import type { Metadata } from 'next';
import { AuthPage } from '@/components/auth/auth-page';

export const metadata: Metadata = { title: 'Masuk — CampusFlow' };

/** Hanya terima tujuan berupa halaman undangan (cegah open redirect). */
function safeNext(value: string | string[] | undefined): string | undefined {
  const v = Array.isArray(value) ? value[0] : value;
  return v && /^\/join\/[A-Za-z0-9]{20,100}$/.test(v) ? v : undefined;
}

export default function LoginPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  // /login?forgot=1 langsung membuka form "Lupa password"; /login?next=/join/<token> kembali ke undangan setelah masuk
  return (
    <AuthPage initialMode="login" initialForgot={searchParams.forgot === '1'} nextPath={safeNext(searchParams.next)} />
  );
}
