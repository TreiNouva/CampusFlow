'use client';

import { createBrowserClient } from '@supabase/ssr';

/**
 * Supabase client untuk dipakai di Client Components.
 * Menggunakan anon key — aman untuk browser karena akses data
 * sesungguhnya tetap ditegakkan oleh Row Level Security di database.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://localhost:54321',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'public-anon-key'
  );
}
