'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireUser } from '@/lib/auth/session';
import { createOrganizationSchema } from '@/lib/validations/schemas';

export interface ActionResult<T = undefined> {
  success: boolean;
  error?: string;
  data?: T;
}

/** createOrganization — Membuat workspace organisasi baru. Pembuat otomatis jadi admin. */
export async function createOrganization(formData: FormData): Promise<ActionResult<{ id: string }>> {
  const user = await requireUser();
  const supabase = createClient();

  const parsed = createOrganizationSchema.safeParse({
    name: formData.get('name'),
    description: formData.get('description') || undefined,
  });
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message ?? 'Input tidak valid' };
  }

  const { data: org, error } = await supabase
    .from('organizations')
    .insert({
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      created_by: user.id,
    })
    .select('id')
    .single();

  if (error || !org) {
    return { success: false, error: error?.message ?? 'Gagal membuat organisasi' };
  }

  // Pembuat organisasi otomatis menjadi admin pertama.
  const { error: memberError } = await supabase.from('organization_members').insert({
    organization_id: org.id,
    user_id: user.id,
    role: 'admin',
  });

  if (memberError) {
    return { success: false, error: memberError.message };
  }

  revalidatePath('/dashboard');
  return { success: true, data: { id: org.id } };
}
