import type { Metadata } from 'next';
import { AuthPage } from '@/components/auth/auth-page';

export const metadata: Metadata = { title: 'Masuk — CampusFlow' };

/** Hanya terima tujuan berupa halaman undangan (cegah open redirect). */
function safeNext(value: string | string[] | undefined): string | undefined {
  const v = Array.isArray(value) ? value[0] : value;
  return v && /^\/join\/[A-Za-z0-9]{20,100}$/.test(v) ? v : undefined;
}

function noticeFor(sp: { [key: string]: string | string[] | undefined }) {
  const email = typeof sp.email === 'string' ? sp.email.slice(0, 120) : '';
  if (sp.registered === '1') {
    return {
      tone: 'info' as const,
      text: `Akun dibuat! Kami mengirim link konfirmasi ke ${email || 'emailmu'}. Buka email itu (cek juga folder Spam/Promosi) dan klik linknya — kamu akan langsung masuk.`,
    };
  }
  if (sp.confirm === 'failed') {
    return {
      tone: 'error' as const,
      text: 'Link konfirmasi tidak valid atau sudah dipakai. Kalau emailmu sudah terkonfirmasi, silakan masuk di sini.',
    };
  }
  return undefined;
}

export default async function LoginPage(
  props: {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
  }
) {
  const searchParams = await props.searchParams;
  // /login?forgot=1 langsung membuka form "Lupa password"; /login?next=/join/<token> kembali ke undangan setelah masuk
  return (
    <AuthPage
      initialMode="login"
      initialForgot={searchParams.forgot === '1'}
      nextPath={safeNext(searchParams.next)}
      notice={noticeFor(searchParams)}
    />
  );
}
