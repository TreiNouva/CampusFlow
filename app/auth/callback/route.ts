import { NextResponse, type NextRequest } from 'next/server';
import type { EmailOtpType } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/** Hanya halaman ini yang boleh jadi tujuan setelah link email diverifikasi (mencegah open redirect). */
const ALLOWED_NEXT = ['/reset-password', '/dashboard'];

/**
 * Tujuan link di email Supabase (reset password). Mendukung dua format link:
 *  1) ?code=...                  -> alur PKCE bawaan (link harus dibuka di browser yang sama dengan saat meminta reset)
 *  2) ?token_hash=...&type=...   -> alur token hash (bisa dibuka di perangkat lain; butuh edit template email, lihat README)
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const tokenHash = searchParams.get('token_hash');
  const type = searchParams.get('type') as EmailOtpType | null;
  const nextParam = searchParams.get('next') ?? '/reset-password';
  const next = ALLOWED_NEXT.includes(nextParam) ? nextParam : '/reset-password';

  const supabase = createClient();
  let verified = false;

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    verified = !error;
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    verified = !error;
  }

  // Di balik proxy/CDN (Vercel) alamat publik ada di header x-forwarded-*; protokolnya ikut header juga.
  const forwardedHost = request.headers.get('x-forwarded-host');
  const forwardedProto = request.headers.get('x-forwarded-proto') ?? 'https';
  const base = forwardedHost ? `${forwardedProto}://${forwardedHost}` : origin;

  return NextResponse.redirect(`${base}${verified ? next : '/reset-password?error=invalid'}`);
}
