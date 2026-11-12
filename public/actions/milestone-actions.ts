'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireUser } from '@/lib/auth/session';
import { milestoneSchema } from '@/lib/validations/schemas';
import { checkProjectPeriod } from '@/lib/project-period';
import { rpcErrorMessage } from '@/lib/rpc';
import type { ActionResult } from './organization-actions';

export async function createMilestone(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = milestoneSchema.safeParse({
    projectId: formData.get('projectId'), title: formData.get('title'), dueDate: formData.get('dueDate'),
  });
  if (!parsed.success) return { success: false, error: parsed.error.errors[0]?.message ?? 'Input tidak valid' };
  const periodError = await checkProjectPeriod(parsed.data.projectId, [[parsed.data.dueDate, 'Tanggal milestone']]);
  if (periodError) return { success: false, error: periodError };
  const { error } = await createClient().from('project_milestones').insert({
    project_id: parsed.data.projectId, title: parsed.data.title, due_date: parsed.data.dueDate, created_by: user.id,
  });
  if (error) {
    if (error.code === '42501') return { success: false, error: 'Hanya Project Manager atau Wakil PM yang dapat membuat milestone.' };
    return { success: false, error: rpcErrorMessage(error, 'Gagal menyimpan milestone.') };
  }
  revalidatePath(`/projects/${parsed.data.projectId}`, 'layout');
  return { success: true };
}

export async function deleteMilestone(formData: FormData): Promise<ActionResult> {
  await requireUser();
  const id = String(formData.get('milestoneId') ?? '');
  const projectId = String(formData.get('projectId') ?? '');
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { success: false, error: 'Milestone tidak valid.' };
  const { data, error } = await createClient().from('project_milestones').delete().eq('id', id).eq('project_id', projectId).select('id');
  if (error || !data || data.length === 0) return { success: false, error: 'Milestone tidak ditemukan atau kamu tidak berhak menghapusnya.' };
  revalidatePath(`/projects/${projectId}`, 'layout');
  return { success: true };
}
