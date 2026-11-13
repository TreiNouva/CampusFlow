'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { requireUser } from '@/lib/auth/session';

/** Tandai notifikasi sudah dibaca: satu (id) atau semua milik user. RLS membatasi ke milik sendiri. */
export async function markNotificationsRead(id?: string): Promise<{ success: boolean }> {
  const user = await requireUser();
  if (id && !z.string().uuid().safeParse(id).success) return { success: false };
  let q = (await createClient()).from('notifications').update({ is_read: true }).eq('user_id', user.id).eq('is_read', false);
  if (id) q = q.eq('id', id);
  const { error } = await q;
  if (error) console.error('[inapp read]', error.code, error.message);
  revalidatePath('/', 'layout');
  return { success: !error };
}
