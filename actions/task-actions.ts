'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireUser } from '@/lib/auth/session';
import { canWriteProject } from '@/lib/permissions';
import { rpcErrorMessage } from '@/lib/rpc';
import { checkProjectPeriod } from '@/lib/project-period';
import { createTaskSchema, updateTaskSchema } from '@/lib/validations/schemas';
import { sendEmail } from '@/lib/email/send';
import { taskAssignedEmail } from '@/emails/task-assigned';
import { taskUpdatedEmail } from '@/emails/task-updated';
import { formatDate, STATUS_LABEL } from '@/lib/utils';
import type { ActionResult } from './organization-actions';
import type { ActivityAction, NotificationLevel, Profile, ProjectRole, TaskStatus } from '@/types/database';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? '';

/**
 * Klasifikasi "seberapa penting" tiap jenis event (§8: preference All vs
 * Important vs Off). Anggota dengan preference "important" hanya menerima
 * event yang masuk kategori 'important' di sini.
 */
const EVENT_IMPORTANCE: Record<ActivityAction, 'all' | 'important'> = {
  task_created: 'important',
  task_status_changed: 'important',
  task_assignee_changed: 'important',
  task_due_date_changed: 'important',
  task_priority_changed: 'all',
  task_commented: 'all',
  project_created: 'important',
  project_announcement: 'important',
  announcement_updated: 'all',
  member_added: 'all',
  member_removed: 'all',
  member_role_changed: 'all',
  document_uploaded: 'all',
  event_created: 'all',
};

function isVisibleForLevel(level: NotificationLevel, event: ActivityAction): boolean {
  if (level === 'off') return false;
  if (level === 'all') return true;
  return EVENT_IMPORTANCE[event] === 'important';
}

interface Recipient {
  id: string;
  email: string;
  full_name: string;
}

/**
 * fetchProjectMembers() + pickRecipients() — jantung dari aturan anti-spam (§8):
 *   1) Hanya anggota project yang SAH yang bisa jadi penerima (§14 — email
 *      hanya dikirim kepada anggota project yang sah).
 *   2) Actor (pelaku perubahan) TIDAK PERNAH menerima email dari aksinya sendiri.
 *   3) Preference notifikasi per-anggota (All/Important/Off) dihormati.
 */
interface MemberRow {
  user_id: string;
  role: ProjectRole;
  division_id: string | null;
  notification_level: NotificationLevel;
  profile: Profile | null;
}

/** Hanya field yang menentukan siapa yang boleh melihat sebuah task. */
interface TaskScope {
  division_id: string | null;
  assignee_id: string | null;
}

/** Member biasa hanya melihat task divisinya sendiri atau yang ditugaskan padanya; peran lain melihat semua. */
function canSeeTask(member: MemberRow, task: TaskScope): boolean {
  if (member.role !== 'member') return true;
  return task.assignee_id === member.user_id || (!!task.division_id && task.division_id === member.division_id);
}

/** '' -> null (dikosongkan), tidak ada -> undefined (tidak diubah). */
function optionalField(value: FormDataEntryValue | null): string | null | undefined {
  if (value === null) return undefined;
  const text = String(value).trim();
  return text === '' ? null : text;
}

/** Ambil anggota project + preferensi notifikasinya SEKALI saja (dipakai ulang untuk semua event). */
async function fetchProjectMembers(projectId: string): Promise<MemberRow[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from('project_members')
    .select('user_id, role, division_id, notification_level, profile:profiles(id, full_name, email)')
    .eq('project_id', projectId);
  return (data as unknown as MemberRow[]) ?? [];
}

function pickRecipients(members: MemberRow[], actorId: string, event: ActivityAction, task?: TaskScope): Recipient[] {
  return members
    .filter((row) => row.user_id !== actorId)
    .filter((row) => !task || canSeeTask(row, task))
    .filter((row) => isVisibleForLevel(row.notification_level, event))
    .map((row) => row.profile)
    .filter((p): p is Profile => Boolean(p))
    .map((p) => ({ id: p.id, email: p.email, full_name: p.full_name }));
}

/**
 * Mengirim email ke setiap recipient lalu mencatat status pengiriman di
 * notification_logs (sent/failed) — dipakai untuk debug (§13 getNotificationLogs)
 * dan acceptance criteria "Perubahan database gagal tidak memicu email" secara
 * implisit terjaga karena fungsi ini HANYA dipanggil setelah update DB sukses.
 */
async function notifyRecipients(params: {
  projectId: string;
  taskId?: string;
  event: ActivityAction;
  recipients: Recipient[];
  buildEmail: (recipient: Recipient) => { subject: string; html: string };
}) {
  const { projectId, taskId, event, recipients, buildEmail } = params;
  if (recipients.length === 0) return;

  const admin = createAdminClient();

  await Promise.all(
    recipients.map(async (recipient) => {
      const { subject, html } = buildEmail(recipient);
      const result = await sendEmail({ to: recipient.email, subject, html });

      await admin.from('notification_logs').insert({
        event_type: event,
        recipient_id: recipient.id,
        project_id: projectId,
        task_id: taskId ?? null,
        status: result.success ? 'sent' : 'failed',
        provider_id: result.providerId ?? null,
        error_message: result.errorMessage ?? null,
      });
    })
  );
}

/** createTask — Membuat task baru dan menetapkan PIC (§12 langkah 4). */
export async function createTask(formData: FormData): Promise<ActionResult<{ id: string }>> {
  const user = await requireUser();

  const parsed = createTaskSchema.safeParse({
    projectId: formData.get('projectId'),
    title: formData.get('title'),
    description: formData.get('description') || undefined,
    assigneeId: formData.get('assigneeId') || undefined,
    priority: formData.get('priority') || 'medium',
    dueDate: formData.get('dueDate') || undefined,
    startDate: formData.get('startDate') || undefined,
    divisionId: formData.get('divisionId') || undefined,
  });
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message ?? 'Input tidak valid' };
  }
  if (parsed.data.startDate && parsed.data.dueDate && parsed.data.startDate > parsed.data.dueDate) {
    return { success: false, error: 'Tanggal mulai tidak boleh setelah deadline.' };
  }
  const createPeriodError = await checkProjectPeriod(parsed.data.projectId, [
    [parsed.data.startDate, 'Tanggal mulai task'],
    [parsed.data.dueDate, 'Deadline task'],
  ]);
  if (createPeriodError) return { success: false, error: createPeriodError };

  const supabase = createClient();

  // Tiga pengecekan/pengambilan data independen -> dijalankan bersamaan.
  const [allowed, { data: project }, { data: actorProfile }] = await Promise.all([
    canWriteProject(parsed.data.projectId, user.id),
    supabase.from('projects').select('id, name').eq('id', parsed.data.projectId).single(),
    supabase.from('profiles').select('full_name').eq('id', user.id).single(),
  ]);
  if (!allowed) {
    return { success: false, error: 'Kamu tidak dapat membuat task di project ini (Ketua hanya dapat melihat).' };
  }

  // Member hanya boleh membuat task untuk divisinya sendiri (juga ditegakkan oleh database).
  const { data: me } = await supabase
    .from('project_members')
    .select('role, division_id')
    .eq('project_id', parsed.data.projectId)
    .eq('user_id', user.id)
    .single();
  let divisionId = parsed.data.divisionId ?? null;
  if (me?.role === 'member') {
    if (!me.division_id) {
      return { success: false, error: 'Kamu belum masuk divisi mana pun, jadi belum bisa membuat task. Minta Project Manager menempatkanmu di sebuah divisi.' };
    }
    divisionId = me.division_id;
  }

  const { data: task, error } = await supabase
    .from('tasks')
    .insert({
      project_id: parsed.data.projectId,
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      assignee_id: parsed.data.assigneeId ?? null,
      priority: parsed.data.priority,
      due_date: parsed.data.dueDate ?? null,
      start_date: parsed.data.startDate ?? null,
      division_id: divisionId,
      created_by: user.id,
    })
    .select('*')
    .single();

  // §7: aktivitas & email hanya dibuat SETELAH insert task berhasil.
  if (error || !task) {
    return { success: false, error: error ? rpcErrorMessage(error, 'Gagal membuat task') : 'Gagal membuat task' };
  }

  const admin = createAdminClient();
  await admin.from('activity_logs').insert({
    project_id: parsed.data.projectId,
    task_id: task.id,
    actor_id: user.id,
    action_type: 'task_created',
    new_value: task.title,
  });

  if (task.assignee_id) {
    const members = await fetchProjectMembers(parsed.data.projectId);
    const recipients = pickRecipients(members, user.id, 'task_created', task).filter(
      (r) => r.id === task.assignee_id
    );

    await notifyRecipients({
      projectId: parsed.data.projectId,
      taskId: task.id,
      event: 'task_created',
      recipients,
      buildEmail: (recipient) =>
        taskAssignedEmail({
          recipientName: recipient.full_name,
          actorName: actorProfile?.full_name ?? 'Seseorang',
          taskTitle: task.title,
          projectName: project?.name ?? 'Project',
          dueDate: formatDate(task.due_date),
          isNewTask: true,
          taskUrl: `${APP_URL}/projects/${parsed.data.projectId}/tasks/${task.id}`,
        }),
    });
  }

  revalidatePath(`/projects/${parsed.data.projectId}`, 'layout');
  return { success: true, data: { id: task.id } };
}

/**
 * updateTask — Server action utama sesuai alur §7 Arsitektur Sistem:
 *   frontend action -> server cek session/role/validasi -> DB simpan
 *   -> activity log -> ambil anggota relevan -> kirim email -> catat status.
 */
export async function updateTask(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();

  const parsed = updateTaskSchema.safeParse({
    taskId: formData.get('taskId'),
    title: formData.get('title') || undefined,
    description: optionalField(formData.get('description')),
    assigneeId: optionalField(formData.get('assigneeId')),
    status: formData.get('status') || undefined,
    priority: formData.get('priority') || undefined,
    dueDate: optionalField(formData.get('dueDate')),
    startDate: optionalField(formData.get('startDate')),
    divisionId: optionalField(formData.get('divisionId')),
  });
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message ?? 'Input tidak valid' };
  }

  const supabase = createClient();

  const [{ data: currentTask, error: fetchError }, { data: actorProfile }] = await Promise.all([
    supabase.from('tasks').select('*, project:projects(id, name)').eq('id', parsed.data.taskId).single(),
    supabase.from('profiles').select('full_name').eq('id', user.id).single(),
  ]);

  if (fetchError || !currentTask) {
    return { success: false, error: 'Task tidak ditemukan.' };
  }

  // Server memeriksa authorization, bukan hanya frontend (§14).
  const allowed = await canWriteProject(currentTask.project_id, user.id);
  if (!allowed) {
    return { success: false, error: 'Kamu tidak dapat mengubah task di project ini (Ketua hanya dapat melihat).' };
  }

  const actorName = actorProfile?.full_name ?? 'Seseorang';
  const projectName = (currentTask as any).project?.name ?? 'Project';

  const updates: Record<string, unknown> = {};
  if (parsed.data.title !== undefined) updates.title = parsed.data.title;
  if (parsed.data.description !== undefined) updates.description = parsed.data.description;
  if (parsed.data.assigneeId !== undefined) updates.assignee_id = parsed.data.assigneeId;
  if (parsed.data.status !== undefined) updates.status = parsed.data.status;
  if (parsed.data.priority !== undefined) updates.priority = parsed.data.priority;
  if (parsed.data.dueDate !== undefined) updates.due_date = parsed.data.dueDate;
  if (parsed.data.startDate !== undefined) updates.start_date = parsed.data.startDate;
  if (parsed.data.divisionId !== undefined) updates.division_id = parsed.data.divisionId;

  if (Object.keys(updates).length === 0) {
    return { success: false, error: 'Tidak ada perubahan untuk disimpan.' };
  }
  const nextStart = (updates.start_date !== undefined ? updates.start_date : currentTask.start_date) as string | null;
  const nextDue = (updates.due_date !== undefined ? updates.due_date : currentTask.due_date) as string | null;
  if (nextStart && nextDue && nextStart > nextDue) {
    return { success: false, error: 'Tanggal mulai tidak boleh setelah deadline.' };
  }
  // Hanya tanggal yang benar-benar berubah yang dicek terhadap periode project.
  const startChanged = updates.start_date !== undefined && updates.start_date !== currentTask.start_date;
  const dueChanged = updates.due_date !== undefined && updates.due_date !== currentTask.due_date;
  if (startChanged || dueChanged) {
    const updatePeriodError = await checkProjectPeriod(currentTask.project_id, [
      [startChanged ? nextStart : null, 'Tanggal mulai task'],
      [dueChanged ? nextDue : null, 'Deadline task'],
    ]);
    if (updatePeriodError) return { success: false, error: updatePeriodError };
  }

  const { data: updatedTask, error: updateError } = await supabase
    .from('tasks')
    .update(updates)
    .eq('id', parsed.data.taskId)
    .select('*')
    .single();

  // §7: "Email tidak boleh dikirim sebelum database memastikan perubahan berhasil."
  // Jika update gagal, fungsi berhenti di sini — tidak ada activity log / email.
  if (updateError || !updatedTask) {
    if (updateError?.code === 'PGRST116') {
      return { success: false, error: 'Kamu tidak berhak mengubah task ini (Member hanya dapat mengubah task divisinya sendiri).' };
    }
    return { success: false, error: updateError ? rpcErrorMessage(updateError, 'Gagal memperbarui task.') : 'Gagal memperbarui task.' };
  }

  const admin = createAdminClient();
  const taskUrl = `${APP_URL}/projects/${currentTask.project_id}/tasks/${currentTask.id}`;

  type Change = { action: ActivityAction; oldValue: string; newValue: string; summary: string };
  const changes: Change[] = [];

  if (parsed.data.status !== undefined && parsed.data.status !== currentTask.status) {
    changes.push({
      action: 'task_status_changed',
      oldValue: currentTask.status,
      newValue: parsed.data.status,
      summary: `Status: ${STATUS_LABEL[currentTask.status as TaskStatus]} → ${STATUS_LABEL[parsed.data.status as TaskStatus]}`,
    });
  }
  if (parsed.data.priority !== undefined && parsed.data.priority !== currentTask.priority) {
    changes.push({
      action: 'task_priority_changed',
      oldValue: currentTask.priority,
      newValue: parsed.data.priority,
      summary: `Priority: ${currentTask.priority} → ${parsed.data.priority}`,
    });
  }
  if (parsed.data.dueDate !== undefined && parsed.data.dueDate !== currentTask.due_date) {
    changes.push({
      action: 'task_due_date_changed',
      oldValue: currentTask.due_date ?? '-',
      newValue: parsed.data.dueDate ?? '-',
      summary: `Deadline: ${formatDate(currentTask.due_date)} → ${formatDate(parsed.data.dueDate)}`,
    });
  }
  if (parsed.data.assigneeId !== undefined && parsed.data.assigneeId !== currentTask.assignee_id) {
    changes.push({
      action: 'task_assignee_changed',
      oldValue: currentTask.assignee_id ?? '-',
      newValue: parsed.data.assigneeId ?? '-',
      summary: 'PIC task diperbarui.',
    });
  }

  // Perubahan kecil (mis. hanya title/description) sengaja TIDAK memicu email
  // (§8: "Jangan mengirim email untuk refresh atau perubahan kecil yang tidak penting").
  if (changes.length > 0) {
    // Activity log semua perubahan disimpan sekaligus (1 query), anggota project diambil sekali.
    const [, members] = await Promise.all([
      admin.from('activity_logs').insert(
        changes.map((change) => ({
          project_id: currentTask.project_id,
          task_id: currentTask.id,
          actor_id: user.id,
          action_type: change.action,
          old_value: String(change.oldValue),
          new_value: String(change.newValue),
        }))
      ),
      fetchProjectMembers(currentTask.project_id),
    ]);

    // Email untuk tiap perubahan dikirim bersamaan (bukan berurutan) agar respons lebih cepat.
    await Promise.all(
      changes.map(async (change) => {
        const recipients = pickRecipients(members, user.id, change.action, updatedTask);

        if (change.action === 'task_assignee_changed' && updatedTask.assignee_id) {
          const newAssignee = recipients.find((r) => r.id === updatedTask.assignee_id);
          const others = recipients.filter((r) => r.id !== updatedTask.assignee_id);

          await Promise.all([
            newAssignee
              ? notifyRecipients({
                  projectId: currentTask.project_id,
                  taskId: currentTask.id,
                  event: change.action,
                  recipients: [newAssignee],
                  buildEmail: (recipient) =>
                    taskAssignedEmail({
                      recipientName: recipient.full_name,
                      actorName,
                      taskTitle: updatedTask.title,
                      projectName,
                      dueDate: formatDate(updatedTask.due_date),
                      isNewTask: false,
                      taskUrl,
                    }),
                })
              : Promise.resolve(),
            notifyRecipients({
              projectId: currentTask.project_id,
              taskId: currentTask.id,
              event: change.action,
              recipients: others,
              buildEmail: (recipient) =>
                taskUpdatedEmail({
                  recipientName: recipient.full_name,
                  actorName,
                  taskTitle: updatedTask.title,
                  projectName,
                  changeSummary: change.summary,
                  taskUrl,
                }),
            }),
          ]);
          return;
        }

        await notifyRecipients({
          projectId: currentTask.project_id,
          taskId: currentTask.id,
          event: change.action,
          recipients,
          buildEmail: (recipient) =>
            taskUpdatedEmail({
              recipientName: recipient.full_name,
              actorName,
              taskTitle: updatedTask.title,
              projectName,
              changeSummary: change.summary,
              taskUrl,
            }),
        });
      })
    );
  }

  revalidatePath(`/projects/${currentTask.project_id}`, 'layout');
  revalidatePath(`/projects/${currentTask.project_id}/tasks/${currentTask.id}`);
  return { success: true };
}
