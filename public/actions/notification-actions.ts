'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireUser } from '@/lib/auth/session';
import { canAccessProject } from '@/lib/permissions';
import { notificationPreferenceSchema } from '@/lib/validations/schemas';
import type { ActionResult } from './organization-actions';
import type { NotificationLog } from '@/types/database';

/**
 * getNotificationPreferences — Mengambil preference notifikasi user pada
 * sebuah project, untuk ditampilkan di halaman Notification Settings.
 */
export async function getNotificationPreferences(projectId: string) {
  const user = await requireUser();
  const supabase = createClient();
  const { data } = await supabase
    .from('project_members')
    .select('notification_level')
    .eq('project_id', projectId)
    .eq('user_id', user.id)
    .single();

  return data?.notification_level ?? 'important';
}

/** updateNotificationPreference — Anggota mengatur sendiri: All / Important only / Off. */
export async function updateNotificationPreference(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();

  const parsed = notificationPreferenceSchema.safeParse({
    projectId: formData.get('projectId'),
    level: formData.get('level'),
  });
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message ?? 'Input tidak valid' };
  }

  const supabase = createClient();
  const { error } = await supabase
    .from('project_members')
    .update({ notification_level: parsed.data.level })
    .eq('project_id', parsed.data.projectId)
    .eq('user_id', user.id);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath(`/projects/${parsed.data.projectId}/settings/notifications`);
  return { success: true };
}

/** getNotificationLogs — Debug status pengiriman email (§13), dipakai di halaman activity/notification settings. */
export async function getNotificationLogs(projectId: string, limit = 30): Promise<NotificationLog[]> {
  const allowedUser = await requireUser();
  const allowed = await canAccessProject(projectId, allowedUser.id);
  if (!allowed) return [];

  const supabase = createClient();
  const { data } = await supabase
    .from('notification_logs')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
    .limit(limit);

  return data ?? [];
}
