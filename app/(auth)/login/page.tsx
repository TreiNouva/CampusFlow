import type { Metadata } from 'next';
import { AuthPage } from '@/components/auth/auth-page';

export const metadata: Metadata = { title: 'Masuk — CampusFlow' };

export default function LoginPage() {
  return <AuthPage initialMode="login" />;
}
