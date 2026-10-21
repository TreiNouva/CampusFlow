'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireUser } from '@/lib/auth/session';
import { announcementSchema, updateAnnouncementSchema } from '@/lib/validations/schemas';
import { sendEmail } from '@/lib/email/send';
import { projectAnnouncementEmail } from '@/emails/project-announcement';
import type { ActionResult } from './organization-actions';
import type { Profile } from '@/types/database';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? '';
const POST_DENIED =
  'Kamu tidak berhak membuat pengumuman untuk cakupan ini. PIC/Koordinator hanya dapat membuat pengumuman untuk divisinya sendiri; Global oleh PM, Wakil PM, atau Sekretaris.';

/**
 * Kirim email pengumuman ke anggota project: kecuali pembuat aksi (tidak dikirimi email atas
 * aksinya sendiri) dan kecuali anggota yang mematikan notifikasi (Off).
 * Pengumuman SELALU tampil di halaman project untuk semua anggota (termasuk pembuatnya),
 * jadi pembuat tetap bisa melihat & mengedit pengumumannya walau tidak menerima emailnya.
 */
async function emailAnnouncement(params: {
  projectId: string;
  actorId: string;
  title: string;
  body: string;
  isUpdate: boolean;
  divisionId: string | null;
}) {
  const { projectId, actorId, title, body, isUpdate, divisionId } = params;
  const supabase = createClient();
  const admin = createAdminClient();

  const [{ data: project }, { data: actorProfile }, { data: members }, { data: division }] = await Promise.all([
    supabase.from('projects').select('name').eq('id', projectId).single(),
    supabase.from('profiles').select('full_name').eq('id', actorId).single(),
    admin
      .from('project_members')
      .select('user_id, role, division_id, notification_level, profile:profiles(id, full_name, email)')
      .eq('project_id', projectId),
    divisionId
      ? admin.from('project_divisions').select('name').eq('id', divisionId).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const recipients = (members ?? [])
    .filter((row: any) => row.user_id !== actorId)
    .filter((row: any) => row.notification_level !== 'off')
    // Global: semua anggota. Divisi: anggota divisi itu + Project Manager + Wakil PM.
    .filter(
      (row: any) =>
        !divisionId ||
        row.division_id === divisionId ||
        row.role === 'project_manager' ||
        row.role === 'wakil_project_manager'
    )
    .map((row: any) => row.profile as Profile | null)
    .filter((p): p is Profile => Boolean(p));

  await Promise.all(
    recipients.map(async (recipient) => {
      const { subject, html } = projectAnnouncementEmail({
        recipientName: recipient.full_name,
        actorName: actorProfile?.full_name ?? 'Seseorang',
        projectName: project?.name ?? 'Project',
        title,
        body,
        projectUrl: `${APP_URL}/projects/${projectId}`,
        isUpdate,
        scopeLabel: division ? `Divisi ${division.name}` : undefined,
      });
      const result = await sendEmail({ to: recipient.email, subject, html });

      await admin.from('notification_logs').insert({
        event_type: isUpdate ? 'announcement_updated' : 'project_announcement',
        recipient_id: recipient.id,
        project_id: projectId,
        status: result.success ? 'sent' : 'failed',
        provider_id: result.providerId ?? null,
        error_message: result.errorMessage ?? null,
      });
    })
  );
}

/** Buat pengumuman: disimpan di database (tampil di halaman project) lalu dikirim lewat email. */
export async function createAnnouncement(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = announcementSchema.safeParse({
    projectId: formData.get('projectId'),
    title: formData.get('title'),
    body: formData.get('body'),
    divisionId: formData.get('divisionId') || null,
  });
  if (!parsed.success) return { success: false, error: parsed.error.errors[0]?.message ?? 'Input tidak valid' };
  const divisionId = parsed.data.divisionId ?? null;

  const { data: announcement, error } = await createClient()
    .from('announcements')
    .insert({
      project_id: parsed.data.projectId,
      author_id: user.id,
      title: parsed.data.title,
      body: parsed.data.body,
      division_id: divisionId,
    })
    .select('id')
    .single();

  if (error || !announcement) {
    if (error?.code === '42501') return { success: false, error: POST_DENIED };
    console.error('[createAnnouncement]', error?.code, error?.message);
    return { success: false, error: 'Gagal menyimpan pengumuman.' };
  }

  await createAdminClient().from('activity_logs').insert({
    project_id: parsed.data.projectId,
    actor_id: user.id,
    action_type: 'project_announcement',
    new_value: parsed.data.title,
    metadata: { announcement_id: announcement.id },
  });

  await emailAnnouncement({
    projectId: parsed.data.projectId,
    actorId: user.id,
    title: parsed.data.title,
    body: parsed.data.body,
    isUpdate: false,
    divisionId,
  });

  revalidatePath(`/projects/${parsed.data.projectId}`, 'layout');
  return { success: true };
}

/** Edit pengumuman (pembuatnya atau Project Manager / Wakil PM). Email ulang hanya jika dicentang. */
export async function updateAnnouncement(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = updateAnnouncementSchema.safeParse({
    announcementId: formData.get('announcementId'),
    projectId: formData.get('projectId'),
    title: formData.get('title'),
    body: formData.get('body'),
    resend: formData.get('resend') === 'on',
  });
  if (!parsed.success) return { success: false, error: parsed.error.errors[0]?.message ?? 'Input tidak valid' };

  const { data, error } = await createClient()
    .from('announcements')
    .update({ title: parsed.data.title, body: parsed.data.body })
    .eq('id', parsed.data.announcementId)
    .eq('project_id', parsed.data.projectId)
    .select('id, division_id');

  if (error) {
    console.error('[updateAnnouncement]', error.code, error.message);
    return { success: false, error: 'Gagal menyimpan perubahan pengumuman.' };
  }
  if (!data || data.length === 0) {
    return { success: false, error: 'Pengumuman tidak ditemukan atau kamu tidak berhak mengeditnya.' };
  }

  await createAdminClient().from('activity_logs').insert({
    project_id: parsed.data.projectId,
    actor_id: user.id,
    action_type: 'announcement_updated',
    new_value: parsed.data.title,
    metadata: { announcement_id: parsed.data.announcementId },
  });

  if (parsed.data.resend) {
    await emailAnnouncement({
      divisionId: data[0].division_id ?? null,
      projectId: parsed.data.projectId,
      actorId: user.id,
      title: parsed.data.title,
      body: parsed.data.body,
      isUpdate: true,
    });
  }

  revalidatePath(`/projects/${parsed.data.projectId}`, 'layout');
  return { success: true };
}

export async function deleteAnnouncement(formData: FormData): Promise<ActionResult> {
  await requireUser();
  const announcementId = String(formData.get('announcementId') ?? '');
  const projectId = String(formData.get('projectId') ?? '');
  if (!/^[0-9a-f-]{36}$/i.test(announcementId) || !/^[0-9a-f-]{36}$/i.test(projectId)) {
    return { success: false, error: 'Pengumuman tidak valid.' };
  }

  const { data, error } = await createClient()
    .from('announcements')
    .delete()
    .eq('id', announcementId)
    .eq('project_id', projectId)
    .select('id');

  if (error) {
    console.error('[deleteAnnouncement]', error.code, error.message);
    return { success: false, error: 'Gagal menghapus pengumuman.' };
  }
  if (!data || data.length === 0) {
    return { success: false, error: 'Pengumuman tidak ditemukan atau kamu tidak berhak menghapusnya.' };
  }

  revalidatePath(`/projects/${projectId}`, 'layout');
  return { success: true };
}
