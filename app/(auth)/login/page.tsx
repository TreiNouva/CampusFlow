import type { Metadata } from 'next';
import { AuthPage } from '@/components/auth/auth-page';

export const metadata: Metadata = { title: 'Masuk — CampusFlow' };

export default function LoginPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  // /login?forgot=1 langsung membuka form "Lupa password" (dipakai dari halaman link kedaluwarsa)
  return <AuthPage initialMode="login" initialForgot={searchParams.forgot === '1'} />;
}
