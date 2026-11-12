'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireUser } from '@/lib/auth/session';
import { createOrganizationSchema } from '@/lib/validations/schemas';
import { rpcErrorMessage } from '@/lib/rpc';

export interface ActionResult<T = undefined> {
  success: boolean;
  error?: string;
  data?: T;
}

/** createOrganization — Membuat organisasi baru. Pembuat otomatis menjadi Ketua. */
export async function createOrganization(formData: FormData): Promise<ActionResult<{ id: string }>> {
  await requireUser();

  const parsed = createOrganizationSchema.safeParse({
    name: formData.get('name'),
    description: formData.get('description') || undefined,
  });
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message ?? 'Input tidak valid' };
  }

  const supabase = createClient();
  // Fungsi database membuat organisasi + menjadikan pembuat sebagai Ketua dalam satu transaksi.
  const { data, error } = await supabase.rpc('create_organization', {
    p_name: parsed.data.name,
    p_description: parsed.data.description ?? null,
  });

  if (error || !data) {
    return { success: false, error: error ? rpcErrorMessage(error, 'Gagal membuat organisasi.') : 'Gagal membuat organisasi.' };
  }

  revalidatePath('/dashboard');
  return { success: true, data: { id: data as string } };
}
