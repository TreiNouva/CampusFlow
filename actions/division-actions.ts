'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireUser } from '@/lib/auth/session';
import { deleteDivisionSchema, divisionSchema } from '@/lib/validations/schemas';
import type { ActionResult } from './organization-actions';

/** Buat divisi project (hanya Project Manager / Wakil PM; ditegakkan oleh RLS di database). */
export async function createDivision(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = divisionSchema.safeParse({
    projectId: formData.get('projectId'),
    name: formData.get('name'),
  });
  if (!parsed.success) return { success: false, error: parsed.error.errors[0]?.message ?? 'Input tidak valid' };

  const { error } = await createClient()
    .from('project_divisions')
    .insert({ project_id: parsed.data.projectId, name: parsed.data.name, created_by: user.id });

  if (error) {
    if (error.code === '23505') return { success: false, error: 'Divisi dengan nama tersebut sudah ada.' };
    if (error.code === '42501') return { success: false, error: 'Hanya Project Manager atau Wakil PM yang dapat membuat divisi.' };
    console.error('[createDivision]', error.code, error.message);
    return { success: false, error: 'Gagal membuat divisi.' };
  }

  revalidatePath(`/projects/${parsed.data.projectId}/members`);
  return { success: true };
}

/** Hapus divisi. Anggota yang ada di divisi itu tidak dikeluarkan, hanya kehilangan title divisinya. */
export async function deleteDivision(formData: FormData): Promise<ActionResult> {
  await requireUser();
  const parsed = deleteDivisionSchema.safeParse({
    projectId: formData.get('projectId'),
    divisionId: formData.get('divisionId'),
  });
  if (!parsed.success) return { success: false, error: parsed.error.errors[0]?.message ?? 'Input tidak valid' };

  const { data, error } = await createClient()
    .from('project_divisions')
    .delete()
    .eq('id', parsed.data.divisionId)
    .eq('project_id', parsed.data.projectId)
    .select('id');

  if (error) {
    console.error('[deleteDivision]', error.code, error.message);
    return { success: false, error: 'Gagal menghapus divisi.' };
  }
  if (!data || data.length === 0) {
    return { success: false, error: 'Divisi tidak ditemukan atau kamu tidak berhak menghapusnya.' };
  }

  revalidatePath(`/projects/${parsed.data.projectId}/members`);
  return { success: true };
}
