import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Card, CardBody, CardHeader, Badge } from '@/components/ui/card';
import { TaskDetailForm } from '@/components/tasks/task-detail-form';
import { ActivityFeed } from '@/components/projects/activity-feed';
import { DocumentUploader } from '@/components/documents/document-uploader';
import { DocumentList, type DocItem } from '@/components/documents/document-list';
import { requireUser } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { divisionColor } from '@/lib/colors';
import { todayJakarta } from '@/lib/dates';
import { formatDate, formatDateTime, PRIORITY_COLOR, PRIORITY_LABEL, STATUS_COLOR, STATUS_LABEL } from '@/lib/utils';
import { isProjectManagerRole } from '@/lib/roles';
import type { ActivityLog, ProjectRole, TaskPriority, TaskStatus } from '@/types/database';

export default async function TaskDetailPage({ params }: { params: { projectId: string; taskId: string } }) {
  const user = await requireUser();
  const supabase = createClient();

  const [{ data: task }, { data: membership }, { data: members }, { data: taskActivity }, { data: divisions }, { data: docs }, { data: project }] =
    await Promise.all([
      supabase
        .from('tasks')
        .select('*, assignee:profiles!tasks_assignee_id_fkey(id, full_name), creator:profiles!tasks_created_by_fkey(full_name), division:project_divisions(id, name, color)')
        .eq('id', params.taskId)
        .eq('project_id', params.projectId)
        .single(),
      supabase.from('project_members').select('role, division_id').eq('project_id', params.projectId).eq('user_id', user.id).maybeSingle(),
      supabase.from('project_members').select('role, division_id, profile:profiles(id, full_name)').eq('project_id', params.projectId),
      supabase
        .from('activity_logs')
        .select('*, actor:profiles!activity_logs_actor_id_fkey(id, full_name)')
        .eq('task_id', params.taskId)
        .order('created_at', { ascending: false }),
      supabase.from('project_divisions').select('id, name').eq('project_id', params.projectId).order('name'),
      supabase
        .from('documents')
        .select('*, uploader:profiles!documents_uploaded_by_fkey(full_name)')
        .eq('task_id', params.taskId)
        .order('created_at', { ascending: false }),
      supabase.from('projects').select('name, start_date, end_date').eq('id', params.projectId).single(),
    ]);
  if (!task || !membership) notFound();

  const myRole = membership.role as ProjectRole;
  const t = task as any;
  const canWrite =
    myRole !== 'ketua' && (myRole !== 'member' || t.assignee_id === user.id || (!!t.division_id && t.division_id === membership.division_id));
  const c = divisionColor(t.division?.color);
  const overdue = t.status !== 'done' && t.due_date && t.due_date < todayJakarta();

  const attachments: DocItem[] = ((docs ?? []) as any[]).map((d) => ({
    id: d.id, name: d.name, category: d.category, size_bytes: Number(d.size_bytes), created_at: d.created_at,
    uploaderName: d.uploader?.full_name ?? 'Seseorang', uploadedBy: d.uploaded_by, taskId: d.task_id, taskTitle: null, divisionName: null, divisionColor: null,
  }));

  return (
    <div>
      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
        <Link href={`/projects/${params.projectId}/tasks`} className="mt-4 inline-block text-xs font-semibold uppercase tracking-wide text-teal">
          ← Kembali ke Task Board
        </Link>

        <div className="mt-2 grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <Card>
              <CardHeader style={{ borderTop: `4px solid ${c.accent}`, borderTopLeftRadius: 12, borderTopRightRadius: 12 }}>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge color={STATUS_COLOR[t.status as TaskStatus]}>{STATUS_LABEL[t.status as TaskStatus]}</Badge>
                  <Badge color={PRIORITY_COLOR[t.priority as TaskPriority]}>{PRIORITY_LABEL[t.priority as TaskPriority]}</Badge>
                  {t.division && (
                    <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold" style={{ backgroundColor: c.bg, color: c.text }}>
                      <i className="h-2 w-2 rounded-full" style={{ backgroundColor: c.accent }} />Divisi {t.division.name}
                    </span>
                  )}
                  {overdue && <Badge color="bg-red-100 text-red-700">Telat</Badge>}
                </div>
                <h1 className="mt-2 font-heading text-xl font-bold text-ink">{t.title}</h1>
                <p className="mt-1 text-xs text-muted">
                  Dibuat oleh {t.creator?.full_name ?? 'Seseorang'} • {formatDateTime(t.created_at)}
                  {t.assignee ? ` • PIC: ${t.assignee.full_name}` : ' • Belum ada PIC'}
                </p>
                <p className="mt-0.5 text-xs text-muted">
                  Mulai {formatDate(t.start_date)} → Deadline {formatDate(t.due_date)}
                  {t.completed_at ? ` • Selesai ${formatDateTime(t.completed_at)}` : ''}
                </p>
              </CardHeader>
              <CardBody>
                <p className="whitespace-pre-line text-sm text-ink">{t.description || 'Tidak ada deskripsi.'}</p>
              </CardBody>
            </Card>

            <Card>
              <CardHeader>
                <h2 className="font-heading text-base font-bold text-ink">Lampiran Dokumen ({attachments.length})</h2>
                <p className="text-xs text-muted">Unggah berkas pendukung task ini (proposal, desain, bukti, dll.).</p>
              </CardHeader>
              <CardBody className="space-y-4">
                {canWrite ? (
                  <DocumentUploader projectId={params.projectId} taskId={params.taskId} compact />
                ) : (
                  <p className="text-xs text-muted">Kamu tidak dapat menambah lampiran pada task ini.</p>
                )}
                <DocumentList projectId={params.projectId} docs={attachments} currentUserId={user.id} canModerate={isProjectManagerRole(myRole)} />
              </CardBody>
            </Card>

            <Card>
              <CardHeader><h2 className="font-heading text-base font-bold text-ink">Histori Task</h2></CardHeader>
              <CardBody><ActivityFeed activity={(taskActivity as unknown as ActivityLog[]) ?? []} /></CardBody>
            </Card>
          </div>

          <div>
            {canWrite ? (
              <TaskDetailForm
                task={task as any}
                members={((members ?? []) as any[])
                  .filter((m) => m.role !== 'ketua' && m.profile)
                  .map((m) => ({ id: m.profile.id, full_name: m.profile.full_name, role: m.role as ProjectRole, division_id: m.division_id ?? null }))}
                divisions={(divisions ?? []) as any[]}
                myRole={myRole}
                period={{ start: (project as any)?.start_date ?? null, end: (project as any)?.end_date ?? null }}
              />
            ) : (
              <Card>
                <CardBody className="text-sm text-muted">
                  {myRole === 'ketua' ? 'Kamu melihat task ini sebagai Ketua (viewer), jadi tidak bisa mengubahnya.' : 'Task ini bukan milik divisimu, jadi kamu hanya bisa melihatnya.'}
                </CardBody>
              </Card>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
