import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Navbar } from '@/components/layout/navbar';
import { Card, CardBody, CardHeader, Badge } from '@/components/ui/card';
import { ActivityFeed } from '@/components/projects/activity-feed';
import { AddProjectMemberForm } from '@/components/projects/add-project-member-form';
import { AnnouncementForm } from '@/components/projects/announcement-form';
import { requireUser } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { getProjectActivity } from '@/actions/project-actions';
import { calcProgress, formatDate } from '@/lib/utils';

export default async function ProjectOverviewPage({ params }: { params: { projectId: string } }) {
  const user = await requireUser();
  const supabase = createClient();

  // Lima query independen -> dijalankan bersamaan (sebelumnya berurutan satu per satu).
  const [{ data: project }, { data: membership }, { data: tasks }, { data: members }, activity] =
    await Promise.all([
      supabase
        .from('projects')
        .select('*, organization:organizations(id, name)')
        .eq('id', params.projectId)
        .single(),
      supabase
        .from('project_members')
        .select('role')
        .eq('project_id', params.projectId)
        .eq('user_id', user.id)
        .maybeSingle(),
      supabase.from('tasks').select('id, status').eq('project_id', params.projectId),
      supabase
        .from('project_members')
        .select('id, role, profile:profiles(full_name)')
        .eq('project_id', params.projectId),
      getProjectActivity(params.projectId, 10),
    ]);
  if (!project || !membership) notFound();

  const total = tasks?.length ?? 0;
  const done = tasks?.filter((t) => t.status === 'done').length ?? 0;
  const progress = calcProgress(done, total);
  const isCoordinator = membership.role === 'coordinator';

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="mx-auto max-w-6xl px-6 py-8">
        <p className="text-xs font-semibold uppercase tracking-wide text-teal">
          <Link href={`/organizations/${(project as any).organization?.id}`}>
            {(project as any).organization?.name}
          </Link>
        </p>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="font-heading text-2xl font-bold text-ink">{project.name}</h1>
            <p className="mt-1 text-sm text-muted">{project.description || 'Tidak ada deskripsi.'}</p>
            <p className="mt-1 text-xs text-muted">
              {formatDate(project.start_date)} — {formatDate(project.end_date)}
            </p>
          </div>
          <div className="flex gap-2">
            <Link
              href={`/projects/${project.id}/tasks`}
              className="rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-navy-dark"
            >
              Buka Task Board
            </Link>
            <Link
              href={`/projects/${project.id}/settings/notifications`}
              className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-ink hover:bg-gray-50"
            >
              Notification Settings
            </Link>
          </div>
        </div>

        <section className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Card>
            <CardBody>
              <p className="text-xs font-semibold uppercase text-muted">Progress</p>
              <p className="mt-1 font-heading text-2xl font-bold text-navy">{progress}%</p>
              <div className="mt-2 h-2 w-full rounded-full bg-gray-100">
                <div className="h-2 rounded-full bg-orange" style={{ width: `${progress}%` }} />
              </div>
            </CardBody>
          </Card>
          <Card>
            <CardBody>
              <p className="text-xs font-semibold uppercase text-muted">Task Selesai</p>
              <p className="mt-1 font-heading text-2xl font-bold text-navy">
                {done}/{total}
              </p>
            </CardBody>
          </Card>
          <Card>
            <CardBody>
              <p className="text-xs font-semibold uppercase text-muted">Anggota</p>
              <p className="mt-1 font-heading text-2xl font-bold text-navy">{members?.length ?? 0}</p>
            </CardBody>
          </Card>
        </section>

        <section className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <h2 className="font-heading text-base font-bold text-ink">Activity Feed</h2>
              </CardHeader>
              <CardBody>
                <ActivityFeed activity={activity} />
              </CardBody>
            </Card>

            {isCoordinator && <AnnouncementForm projectId={project.id} />}
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <h2 className="font-heading text-base font-bold text-ink">Anggota Project</h2>
              </CardHeader>
              <ul className="divide-y divide-gray-100">
                {(members ?? []).map((m: any) => (
                  <li key={m.id} className="flex items-center justify-between px-5 py-2.5 text-sm">
                    <span className="text-ink">{m.profile?.full_name}</span>
                    <Badge>{m.role}</Badge>
                  </li>
                ))}
              </ul>
            </Card>

            {isCoordinator && <AddProjectMemberForm projectId={project.id} />}
          </div>
        </section>
      </main>
    </div>
  );
}
