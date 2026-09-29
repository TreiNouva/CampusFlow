'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireUser } from '@/lib/auth/session';
import { createProjectSchema } from '@/lib/validations/schemas';
import type { ActionResult } from './organization-actions';
import type { ActivityLog } from '@/types/database';

/**
 * createProject — Membuat project/event baru dalam sebuah organisasi.
 * Pembuat otomatis menjadi coordinator project tsb.
 */
export async function createProject(formData: FormData): Promise<ActionResult<{ id: string }>> {
  const user = await requireUser();

  const parsed = createProjectSchema.safeParse({
    organizationId: formData.get('organizationId'),
    name: formData.get('name'),
    description: formData.get('description') || undefined,
    startDate: formData.get('startDate') || undefined,
    endDate: formData.get('endDate') || undefined,
  });
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message ?? 'Input tidak valid' };
  }

  // Siapa pun anggota organisasi boleh membuat project (bukan hanya admin) —
  // sesuai skenario "Coordinator membuat project/event" di §12.
  const supabase = createClient();
  const { data: membership } = await supabase
    .from('organization_members')
    .select('id')
    .eq('organization_id', parsed.data.organizationId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!membership) {
    return { success: false, error: 'Kamu bukan anggota organisasi ini.' };
  }

  const { data: project, error } = await supabase
    .from('projects')
    .insert({
      organization_id: parsed.data.organizationId,
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      start_date: parsed.data.startDate ?? null,
      end_date: parsed.data.endDate ?? null,
      created_by: user.id,
    })
    .select('id')
    .single();

  if (error || !project) {
    return { success: false, error: error?.message ?? 'Gagal membuat project' };
  }

  const { error: memberError } = await supabase.from('project_members').insert({
    project_id: project.id,
    user_id: user.id,
    role: 'coordinator',
    notification_level: 'all',
  });
  if (memberError) {
    return { success: false, error: memberError.message };
  }

  await supabase.from('activity_logs').insert({
    project_id: project.id,
    actor_id: user.id,
    action_type: 'project_created',
    new_value: parsed.data.name,
  });

  revalidatePath(`/organizations/${parsed.data.organizationId}`);
  return { success: true, data: { id: project.id } };
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
