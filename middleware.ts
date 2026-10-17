import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

const PUBLIC_PATHS = ['/', '/login', '/register', '/api/health', '/auth/callback', '/reset-password'];

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request: { headers: request.headers } });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://localhost:54321',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'public-anon-key',
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          response = NextResponse.next({ request: { headers: request.headers } });
          response.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          response = NextResponse.next({ request: { headers: request.headers } });
          response.cookies.set({ name, value: '', ...options });
        },
      },
    }
  );

  // getClaims() memverifikasi JWT secara lokal (cepat) sekaligus me-refresh
  // session jika sudah kedaluwarsa. Fallback ke getUser() bila tidak berhasil.
  let isLoggedIn = false;
  try {
    const { data, error } = await supabase.auth.getClaims();
    isLoggedIn = !error && Boolean(data?.claims?.sub);
  } catch {
    isLoggedIn = false;
  }
  if (!isLoggedIn) {
    const {
      data: { user: fallbackUser },
    } = await supabase.auth.getUser();
    isLoggedIn = Boolean(fallbackUser);
  }

  const isPublic = PUBLIC_PATHS.includes(request.nextUrl.pathname) || request.nextUrl.pathname.startsWith('/join/');

  if (!isLoggedIn && !isPublic) {
    const loginUrl = new URL('/login', request.url);
    return NextResponse.redirect(loginUrl);
  }

  if (isLoggedIn && (request.nextUrl.pathname === '/login' || request.nextUrl.pathname === '/register')) {
    // Jika datang dari halaman undangan, kembalikan ke sana; selain itu ke dashboard
    const next = request.nextUrl.searchParams.get('next') ?? '';
    const dest = /^\/join\/[A-Za-z0-9]{20,100}$/.test(next) ? next : '/dashboard';
    return NextResponse.redirect(new URL(dest, request.url));
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Terapkan ke semua route KECUALI asset statis Next.js.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
