'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireUser } from '@/lib/auth/session';
import { createProjectSchema } from '@/lib/validations/schemas';
import { rpcErrorMessage } from '@/lib/rpc';
import type { ActionResult } from './organization-actions';
import type { ActivityLog } from '@/types/database';

/**
 * createProject — Membuat project/event baru. Pembuat menjadi Project Manager (atau menunjuk anggota
 * lain). Ketua organisasi otomatis ikut sebagai viewer. Semuanya dilakukan oleh fungsi database.
 */
export async function createProject(formData: FormData): Promise<ActionResult<{ id: string }>> {
  await requireUser();

  const parsed = createProjectSchema.safeParse({
    organizationId: formData.get('organizationId'),
    name: formData.get('name'),
    description: formData.get('description') || undefined,
    startDate: formData.get('startDate') || undefined,
    endDate: formData.get('endDate') || undefined,
    projectManagerId: formData.get('projectManagerId') || undefined,
  });
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message ?? 'Input tidak valid' };
  }
  if (parsed.data.startDate && parsed.data.endDate && parsed.data.endDate < parsed.data.startDate) {
    return { success: false, error: 'Tanggal selesai project tidak boleh sebelum tanggal mulai.' };
  }

  const { data, error } = await createClient().rpc('create_project', {
    p_org: parsed.data.organizationId,
    p_name: parsed.data.name,
    p_description: parsed.data.description ?? null,
    p_start: parsed.data.startDate ?? null,
    p_end: parsed.data.endDate ?? null,
    p_pm: parsed.data.projectManagerId ?? null,
  });
  if (error || !data) {
    return { success: false, error: error ? rpcErrorMessage(error, 'Gagal membuat project.') : 'Gagal membuat project.' };
  }

  revalidatePath(`/organizations/${parsed.data.organizationId}`);
  return { success: true, data: { id: data as string } };
}

/** getProjectActivity — Mengambil histori aktivitas terbaru sebuah project (§13). */
export async function getProjectActivity(projectId: string, limit = 20): Promise<ActivityLog[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from('activity_logs')
    .select('*, actor:profiles!activity_logs_actor_id_fkey(id, full_name, email), task:tasks(id, title)')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
    .limit(limit);

  return (data as unknown as ActivityLog[]) ?? [];
}
