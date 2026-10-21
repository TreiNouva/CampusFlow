'use server';

import { createClient } from '@/lib/supabase/server';
import { requireUser } from '@/lib/auth/session';

/**
 * Tandai tutorial sudah selesai/dilewati. Jika migrasi 0004 belum dijalankan (kolom belum ada),
 * error diabaikan — browser tetap menyimpan tanda di localStorage sebagai cadangan.
 */
export async function completeOnboarding(): Promise<{ success: boolean }> {
  const user = await requireUser();
  const { error } = await createClient().from('profiles').update({ onboarded_at: new Date().toISOString() }).eq('id', user.id);
  if (error) console.error('[onboarding]', error.code, error.message);
  return { success: !error };
}
