import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Navbar } from '@/components/layout/navbar';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { ActivityFeed } from '@/components/projects/activity-feed';
import { AnnouncementForm } from '@/components/projects/announcement-form';
import { AnnouncementList } from '@/components/projects/announcement-list';
import { ProjectRoleBadge } from '@/components/ui/role-badge';
import { requireUser } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { getProjectActivity } from '@/actions/project-actions';
import { canPostAnnouncementRole, isProjectManagerRole, PROJECT_ROLES } from '@/lib/roles';
import { calcProgress, formatDate } from '@/lib/utils';
import type { Announcement, ProjectRole } from '@/types/database';

export default async function ProjectOverviewPage({ params }: { params: { projectId: string } }) {
  const user = await requireUser();
  const supabase = createClient();

  const [{ data: project }, { data: membership }, { data: tasks }, { data: members }, { data: announcements }, activity] =
    await Promise.all([
      supabase
        .from('projects')
        .select('*, organization:organizations(id, name)')
        .eq('id', params.projectId)
        .single(),
      supabase
        .from('project_members')
        .select('role, division:project_divisions(name)')
        .eq('project_id', params.projectId)
        .eq('user_id', user.id)
        .maybeSingle(),
      supabase.from('tasks').select('id, status').eq('project_id', params.projectId),
      supabase
        .from('project_members')
        .select('id, role, division:project_divisions(name), profile:profiles(full_name)')
        .eq('project_id', params.projectId),
      // Pengumuman tersimpan di database: semua anggota (termasuk pembuatnya) bisa melihatnya
      supabase
        .from('announcements')
        .select('*, author:profiles!announcements_author_id_fkey(id, full_name)')
        .eq('project_id', params.projectId)
        .order('created_at', { ascending: false }),
      getProjectActivity(params.projectId, 10),
    ]);
  if (!project || !membership) notFound();

  const myRole = membership.role as ProjectRole;
  const total = tasks?.length ?? 0;
  const done = tasks?.filter((t) => t.status === 'done').length ?? 0;
  const progress = calcProgress(done, total);
  const canPost = canPostAnnouncementRole(myRole);
  const canModerate = isProjectManagerRole(myRole);

  const sortedMembers = [...(members ?? [])].sort(
    (a: any, b: any) => PROJECT_ROLES.indexOf(a.role) - PROJECT_ROLES.indexOf(b.role)
  );
  // Urutan tampil ringkas: Ketua, PM, Wakil PM lebih dulu; sisanya mengikuti urutan role
  const memberPreview = sortedMembers.slice(0, 8);

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
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="font-heading text-2xl font-bold text-ink">{project.name}</h1>
              <ProjectRoleBadge role={myRole} divisionName={(membership as any).division?.name} />
            </div>
            <p className="mt-1 text-sm text-muted">{project.description || 'Tidak ada deskripsi.'}</p>
            <p className="mt-1 text-xs text-muted">
              {formatDate(project.start_date)} — {formatDate(project.end_date)}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/projects/${project.id}/tasks`}
              className="rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-navy-dark"
            >
              Buka Task Board
            </Link>
            <Link
              href={`/projects/${project.id}/members`}
              className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-ink hover:bg-gray-50"
            >
              Anggota & Divisi
            </Link>
            <Link
              href={`/projects/${project.id}/settings/notifications`}
              className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-ink hover:bg-gray-50"
            >
              Notifikasi
            </Link>
          </div>
        </div>

        {myRole === 'ketua' && (
          <p className="mt-4 rounded-lg border border-sky bg-sky/40 px-4 py-2 text-sm text-navy">
            Kamu melihat project ini sebagai <strong>Ketua</strong> (viewer): bisa melihat semua isi project dan
            mengatur keanggotaan, tetapi tidak mengubah task atau membuat pengumuman.
          </p>
        )}

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
          <div className="space-y-6 lg:col-span-2">
            <Card>
              <CardHeader>
                <h2 className="font-heading text-base font-bold text-ink">Pengumuman</h2>
                <p className="text-xs text-muted">
                  {canModerate
                    ? 'Kamu bisa mengedit dan menghapus semua pengumuman.'
                    : 'Pembuat pengumuman bisa mengedit dan menghapus pengumumannya sendiri.'}
                </p>
              </CardHeader>
              <CardBody>
                <AnnouncementList
                  announcements={(announcements ?? []) as unknown as Announcement[]}
                  projectId={project.id}
                  currentUserId={user.id}
                  canModerate={canModerate}
                />
              </CardBody>
            </Card>

            {canPost ? (
              <AnnouncementForm projectId={project.id} />
            ) : (
              <p className="text-xs text-muted">
                Pengumuman dibuat oleh Project Manager, Wakil PM, PIC, Koordinator, atau Sekretaris.
              </p>
            )}

            <Card>
              <CardHeader>
                <h2 className="font-heading text-base font-bold text-ink">Activity Feed</h2>
              </CardHeader>
              <CardBody>
                <ActivityFeed activity={activity} />
              </CardBody>
            </Card>
          </div>

          <div>
            <Card>
              <CardHeader>
                <h2 className="font-heading text-base font-bold text-ink">Anggota Project</h2>
              </CardHeader>
              <ul className="divide-y divide-gray-100">
                {memberPreview.map((m: any) => (
                  <li key={m.id} className="flex items-center justify-between gap-2 px-5 py-2.5 text-sm">
                    <span className="truncate text-ink">{m.profile?.full_name}</span>
                    <ProjectRoleBadge role={m.role} divisionName={m.division?.name} />
                  </li>
                ))}
              </ul>
              <div className="border-t border-gray-100 px-5 py-3">
                <Link href={`/projects/${project.id}/members`} className="text-sm font-semibold text-navy hover:underline">
                  {sortedMembers.length > memberPreview.length
                    ? `Lihat semua ${sortedMembers.length} anggota →`
                    : 'Kelola anggota, divisi & undangan →'}
                </Link>
              </div>
            </Card>
          </div>
        </section>
      </main>
    </div>
  );
}
