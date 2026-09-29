'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireUser } from '@/lib/auth/session';
import { canAccessProject } from '@/lib/permissions';
import { notificationPreferenceSchema, projectAnnouncementSchema } from '@/lib/validations/schemas';
import { sendEmail } from '@/lib/email/send';
import { projectAnnouncementEmail } from '@/emails/project-announcement';
import type { ActionResult } from './organization-actions';
import type { NotificationLog, Profile } from '@/types/database';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? '';

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

/**
 * sendProjectUpdateEmail (project_announcement) — Coordinator mengirim
 * pengumuman ke SELURUH anggota project yang sah, minus dirinya sendiri
 * dan minus yang mematikan notifikasi (§8).
 */
export async function sendProjectAnnouncement(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();

  const parsed = projectAnnouncementSchema.safeParse({
    projectId: formData.get('projectId'),
    title: formData.get('title'),
    body: formData.get('body'),
  });
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message ?? 'Input tidak valid' };
  }

  const allowed = await canAccessProject(parsed.data.projectId, user.id);
  if (!allowed) {
    return { success: false, error: 'Kamu bukan anggota project ini.' };
  }

  const supabase = createClient();
  const { data: project } = await supabase
    .from('projects')
    .select('name')
    .eq('id', parsed.data.projectId)
    .single();
  const { data: actorProfile } = await supabase.from('profiles').select('full_name').eq('id', user.id).single();

  const admin = createAdminClient();
  await admin.from('activity_logs').insert({
    project_id: parsed.data.projectId,
    actor_id: user.id,
    action_type: 'project_announcement',
    new_value: parsed.data.title,
  });

  const { data: members } = await admin
    .from('project_members')
    .select('user_id, notification_level, profile:profiles(id, full_name, email)')
    .eq('project_id', parsed.data.projectId);

  const recipients = (members ?? [])
    .filter((row: any) => row.user_id !== user.id)
    .filter((row: any) => row.notification_level !== 'off') // announcement dianggap 'important'
    .map((row: any) => row.profile as Profile | null)
    .filter((p): p is Profile => Boolean(p));

  await Promise.all(
    recipients.map(async (recipient) => {
      const { subject, html } = projectAnnouncementEmail({
        recipientName: recipient.full_name,
        actorName: actorProfile?.full_name ?? 'Seseorang',
        projectName: project?.name ?? 'Project',
        title: parsed.data.title,
        body: parsed.data.body,
        projectUrl: `${APP_URL}/projects/${parsed.data.projectId}`,
      });
      const result = await sendEmail({ to: recipient.email, subject, html });

      await admin.from('notification_logs').insert({
        event_type: 'project_announcement',
        recipient_id: recipient.id,
        project_id: parsed.data.projectId,
        status: result.success ? 'sent' : 'failed',
        provider_id: result.providerId ?? null,
        error_message: result.errorMessage ?? null,
      });
    })
  );

  revalidatePath(`/projects/${parsed.data.projectId}`);
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
