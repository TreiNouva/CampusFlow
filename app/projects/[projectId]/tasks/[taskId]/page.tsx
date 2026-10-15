import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Navbar } from '@/components/layout/navbar';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { TaskDetailForm } from '@/components/tasks/task-detail-form';
import { ActivityFeed } from '@/components/projects/activity-feed';
import { requireUser } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { formatDateTime } from '@/lib/utils';
import type { ActivityLog } from '@/types/database';

export default async function TaskDetailPage({
  params,
}: {
  params: { projectId: string; taskId: string };
}) {
  const user = await requireUser();
  const supabase = createClient();

  const [{ data: task }, { data: membership }, { data: members }, { data: taskActivity }] =
    await Promise.all([
      supabase
        .from('tasks')
        .select(
          '*, assignee:profiles!tasks_assignee_id_fkey(id, full_name), creator:profiles!tasks_created_by_fkey(full_name)'
        )
        .eq('id', params.taskId)
        .eq('project_id', params.projectId)
        .single(),
      supabase
        .from('project_members')
        .select('role')
        .eq('project_id', params.projectId)
        .eq('user_id', user.id)
        .maybeSingle(),
      supabase
        .from('project_members')
        .select('profile:profiles(id, full_name)')
        .eq('project_id', params.projectId),
      supabase
        .from('activity_logs')
        .select('*, actor:profiles!activity_logs_actor_id_fkey(id, full_name)')
        .eq('task_id', params.taskId)
        .order('created_at', { ascending: false }),
    ]);
  if (!task || !membership) notFound();

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="mx-auto max-w-4xl px-6 py-8">
        <Link
          href={`/projects/${params.projectId}/tasks`}
          className="text-xs font-semibold uppercase tracking-wide text-teal"
        >
          ← Kembali ke Task Board
        </Link>

        <div className="mt-2 grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <h1 className="font-heading text-xl font-bold text-ink">{task.title}</h1>
                <p className="mt-1 text-xs text-muted">
                  Dibuat oleh {(task as any).creator?.full_name ?? 'Seseorang'} • {formatDateTime(task.created_at)}
                </p>
              </CardHeader>
              <CardBody>
                <p className="whitespace-pre-line text-sm text-ink">
                  {task.description || 'Tidak ada deskripsi.'}
                </p>
              </CardBody>
            </Card>

            <Card>
              <CardHeader>
                <h2 className="font-heading text-base font-bold text-ink">Histori Task</h2>
              </CardHeader>
              <CardBody>
                <ActivityFeed activity={(taskActivity as unknown as ActivityLog[]) ?? []} />
              </CardBody>
            </Card>
          </div>

          <div>
            <TaskDetailForm
              task={task}
              members={(members ?? []).map((m: any) => m.profile).filter(Boolean)}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
