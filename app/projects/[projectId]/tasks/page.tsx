import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Navbar } from '@/components/layout/navbar';
import { CreateTaskForm } from '@/components/tasks/create-task-form';
import { TaskCard } from '@/components/tasks/task-card';
import { requireUser } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { STATUS_LABEL } from '@/lib/utils';
import type { TaskStatus } from '@/types/database';

const COLUMNS: TaskStatus[] = ['todo', 'in_progress', 'done', 'blocked'];

export default async function TaskBoardPage({ params }: { params: { projectId: string } }) {
  const user = await requireUser();
  const supabase = createClient();

  const [{ data: project }, { data: membership }, { data: tasks }, { data: members }] =
    await Promise.all([
      supabase.from('projects').select('id, name').eq('id', params.projectId).single(),
      supabase
        .from('project_members')
        .select('role')
        .eq('project_id', params.projectId)
        .eq('user_id', user.id)
        .maybeSingle(),
      supabase
        .from('tasks')
        .select('*, assignee:profiles!tasks_assignee_id_fkey(id, full_name)')
        .eq('project_id', params.projectId)
        .order('due_date', { ascending: true, nullsFirst: false }),
      supabase
        .from('project_members')
        .select('user_id, profile:profiles(id, full_name)')
        .eq('project_id', params.projectId),
    ]);
  if (!project || !membership) notFound();

  const assignableMembers = (members ?? []).map((m: any) => m.profile).filter(Boolean);

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="mx-auto max-w-7xl px-6 py-8">
        <div className="flex items-center justify-between">
          <div>
            <Link href={`/projects/${project.id}`} className="text-xs font-semibold uppercase tracking-wide text-teal">
              ← Kembali ke {project.name}
            </Link>
            <h1 className="font-heading text-2xl font-bold text-ink">Task Board</h1>
          </div>
          <CreateTaskForm projectId={project.id} members={assignableMembers} />
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-4">
          {COLUMNS.map((status) => {
            const columnTasks = (tasks ?? []).filter((t: any) => t.status === status);
            return (
              <div key={status} className="rounded-card bg-white/60 p-3">
                <h2 className="mb-3 flex items-center justify-between text-xs font-bold uppercase tracking-wide text-muted">
                  {STATUS_LABEL[status]}
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px]">{columnTasks.length}</span>
                </h2>
                <div className="space-y-3">
                  {columnTasks.map((task: any) => (
                    <TaskCard key={task.id} task={task} projectId={project.id} />
                  ))}
                  {columnTasks.length === 0 && (
                    <p className="rounded-lg border border-dashed border-gray-200 px-3 py-6 text-center text-xs text-muted">
                      Kosong
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
