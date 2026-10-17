import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Navbar } from '@/components/layout/navbar';
import { Card, CardBody } from '@/components/ui/card';
import { CreateProjectForm } from '@/components/projects/create-project-form';
import { JoinProjectButton } from '@/components/projects/join-project-button';
import { OrgRoleBadge } from '@/components/ui/role-badge';
import { requireUser } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { calcProgress } from '@/lib/utils';
import type { OrgRole } from '@/types/database';

export default async function OrganizationOverviewPage({
  params,
}: {
  params: { organizationId: string };
}) {
  const user = await requireUser();
  const supabase = createClient();

  const [{ data: organization }, { data: membership }, { count: memberCount }, { data: projects }, { data: myProjects }, { data: members }] =
    await Promise.all([
      supabase.from('organizations').select('*').eq('id', params.organizationId).single(),
      supabase
        .from('organization_members')
        .select('role')
        .eq('organization_id', params.organizationId)
        .eq('user_id', user.id)
        .maybeSingle(),
      supabase
        .from('organization_members')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', params.organizationId),
      supabase
        .from('projects')
        .select('id, name, description, status, tasks(id, status)')
        .eq('organization_id', params.organizationId)
        .order('created_at', { ascending: false }),
      // Project yang sudah kamu ikuti (RLS hanya mengembalikan project tempat kamu menjadi anggota)
      supabase.from('project_members').select('project_id').eq('user_id', user.id),
      supabase
        .from('organization_members')
        .select('user_id, role, profile:profiles(full_name)')
        .eq('organization_id', params.organizationId),
    ]);

  if (!organization || !membership) notFound(); // RLS sudah menahan query; ini pengaman tambahan di UI.

  const myRole = membership.role as OrgRole;
  const joinedIds = new Set((myProjects ?? []).map((p: any) => p.project_id));
  // Kandidat Project Manager: anggota organisasi selain Ketua (Ketua otomatis menjadi viewer)
  const candidates = (members ?? [])
    .filter((m: any) => m.role !== 'ketua')
    .map((m: any) => ({ id: m.user_id as string, name: (m.profile?.full_name as string) || 'Tanpa nama' }));

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="mx-auto max-w-6xl px-6 py-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-teal">Organization</p>
            <div className="flex items-center gap-3">
              <h1 className="font-heading text-2xl font-bold text-ink">{organization.name}</h1>
              <OrgRoleBadge role={myRole} />
            </div>
            <p className="mt-1 text-sm text-muted">{organization.description || 'Tidak ada deskripsi.'}</p>
          </div>
          <Link
            href={`/organizations/${organization.id}/members`}
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-ink hover:bg-gray-50"
          >
            {memberCount ?? 0} Anggota & Undangan
          </Link>
        </div>

        <section className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">Project</h2>
            {(!projects || projects.length === 0) && (
              <Card>
                <CardBody className="py-8 text-center text-sm text-muted">
                  Belum ada project. Buat project pertama di panel sebelah kanan.
                </CardBody>
              </Card>
            )}
            <div className="space-y-3">
              {(projects ?? []).map((project: any) => {
                const joined = joinedIds.has(project.id);
                const total = project.tasks?.length ?? 0;
                const done = project.tasks?.filter((t: any) => t.status === 'done').length ?? 0;
                const progress = calcProgress(done, total);

                if (!joined) {
                  // Belum bergabung: detail project (task, progress) memang belum bisa dilihat
                  return (
                    <Card key={project.id}>
                      <CardBody className="flex flex-wrap items-center justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="font-heading text-base font-bold text-ink">{project.name}</h3>
                          <p className="text-xs text-muted">
                            {project.description || 'Bergabung untuk melihat task dan anggota project ini.'}
                          </p>
                        </div>
                        <JoinProjectButton projectId={project.id} organizationId={organization.id} />
                      </CardBody>
                    </Card>
                  );
                }

                return (
                  <Link key={project.id} href={`/projects/${project.id}`}>
                    <Card className="transition hover:border-navy">
                      <CardBody>
                        <div className="flex items-center justify-between">
                          <h3 className="font-heading text-base font-bold text-ink">{project.name}</h3>
                          <span className="text-xs font-semibold text-muted">{progress}%</span>
                        </div>
                        <div className="mt-2 h-2 w-full rounded-full bg-gray-100">
                          <div className="h-2 rounded-full bg-orange" style={{ width: `${progress}%` }} />
                        </div>
                        <p className="mt-2 text-xs text-muted">
                          {done}/{total} task selesai
                        </p>
                      </CardBody>
                    </Card>
                  </Link>
                );
              })}
            </div>
          </div>

          <div>
            <CreateProjectForm
              organizationId={organization.id}
              candidates={candidates}
              currentUserId={user.id}
              currentUserIsKetua={myRole === 'ketua'}
            />
          </div>
        </section>
      </main>
    </div>
  );
}
