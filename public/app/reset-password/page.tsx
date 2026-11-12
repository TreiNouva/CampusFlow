import type { Metadata } from 'next';
import { ResetPasswordView } from '@/components/auth/reset-password-view';
import { getCurrentUser } from '@/lib/auth/session';

export const metadata: Metadata = { title: 'Atur Ulang Password — CampusFlow' };

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  // Halaman ini hanya valid jika link email sudah diverifikasi (user punya sesi) dan tidak ada error.
  const user = await getCurrentUser();
  const linkValid = Boolean(user) && !searchParams.error;

  return <ResetPasswordView linkValid={linkValid} />;
}
