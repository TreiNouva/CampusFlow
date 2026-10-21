import { notFound } from 'next/navigation';
import { CreateTaskForm } from '@/components/tasks/create-task-form';
import { TaskBoard, type BoardTask } from '@/components/tasks/task-board';
import { requireUser } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { todayJakarta } from '@/lib/dates';
import type { ProjectRole } from '@/types/database';

export default async function TaskBoardPage({ params }: { params: { projectId: string } }) {
  const user = await requireUser();
  const supabase = createClient();
  const today = todayJakarta();

  const [{ data: project }, { data: membership }, { data: tasks }, { data: members }, { data: divisions }, { data: docs }] =
    await Promise.all([
      supabase.from('projects').select('id, name, start_date, end_date').eq('id', params.projectId).single(),
      supabase.from('project_members').select('role, division_id').eq('project_id', params.projectId).eq('user_id', user.id).maybeSingle(),
      supabase
        .from('tasks')
        .select('id, title, status, priority, due_date, start_date, division_id, assignee_id, assignee:profiles!tasks_assignee_id_fkey(id, full_name)')
        .eq('project_id', params.projectId)
        .order('due_date', { ascending: true, nullsFirst: false }),
      supabase.from('project_members').select('user_id, role, division_id, profile:profiles(id, full_name)').eq('project_id', params.projectId),
      supabase.from('project_divisions').select('id, name, color').eq('project_id', params.projectId).order('created_at'),
      supabase.from('documents').select('task_id').eq('project_id', params.projectId).not('task_id', 'is', null),
    ]);
  if (!project || !membership) notFound();

  const myRole = membership.role as ProjectRole;
  const myDivisionId = (membership.division_id as string | null) ?? null;

  const attachments = new Map<string, number>();
  for (const d of (docs ?? []) as any[]) attachments.set(d.task_id, (attachments.get(d.task_id) ?? 0) + 1);

  const boardTasks: BoardTask[] = ((tasks ?? []) as any[]).map((t) => ({
    id: t.id, title: t.title, status: t.status, priority: t.priority, due_date: t.due_date, start_date: t.start_date,
    division_id: t.division_id, assignee_id: t.assignee_id, assigneeName: t.assignee?.full_name ?? null, attachments: attachments.get(t.id) ?? 0,
  }));

  // Ketua hanya viewer: tidak bisa ditugaskan task
  const assignable = ((members ?? []) as any[])
    .filter((m) => m.role !== 'ketua' && m.profile)
    .map((m) => ({ id: m.profile.id as string, full_name: m.profile.full_name as string, role: m.role as ProjectRole, division_id: (m.division_id as string | null) ?? null }));

  return (
    <div>
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-heading text-2xl font-bold text-ink">Task Board</h1>
            {myRole === 'member' && <p className="text-xs text-muted">Kamu melihat task divisimu dan task yang ditugaskan kepadamu.</p>}
          </div>
          {myRole === 'ketua' ? (
            <span className="rounded-lg bg-sky/40 px-3 py-1.5 text-xs text-navy">Mode lihat (Ketua)</span>
          ) : (
            <CreateTaskForm projectId={project.id} members={assignable} divisions={(divisions ?? []) as any[]} myRole={myRole} myDivisionId={myDivisionId} defaultStart={today} period={{ start: (project as any).start_date ?? null, end: (project as any).end_date ?? null }} />
          )}
        </div>
        <div className="mt-4">
          <TaskBoard projectId={project.id} tasks={boardTasks} divisions={(divisions ?? []) as any[]} myRole={myRole} myUserId={user.id} myDivisionId={myDivisionId} today={today} />
        </div>
      </main>
    </div>
  );
}
