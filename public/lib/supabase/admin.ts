import 'server-only';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

/**
 * Client dengan service role key — melewati RLS.
 * HANYA dipakai di server actions untuk kebutuhan sistem, misalnya
 * mengambil daftar email penerima notifikasi lintas-organisasi.
 * JANGAN pernah diimpor dari Client Component.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://localhost:54321';
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? 'service-role-key';

  return createSupabaseClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
