import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Navbar } from '@/components/layout/navbar';
import { Card, CardBody } from '@/components/ui/card';
import { CreateProjectForm } from '@/components/projects/create-project-form';
import { requireUser } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { calcProgress } from '@/lib/utils';

export default async function OrganizationOverviewPage({
  params,
}: {
  params: { organizationId: string };
}) {
  const user = await requireUser();
  const supabase = createClient();

  // Empat query independen -> dijalankan bersamaan.
  const [{ data: organization }, { data: membership }, { count: memberCount }, { data: projects }] =
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
        .select('id, name, status, tasks(id, status)')
        .eq('organization_id', params.organizationId)
        .order('created_at', { ascending: false }),
    ]);

  if (!organization || !membership) notFound(); // RLS sudah menahan query; ini pengaman tambahan di UI.

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="mx-auto max-w-6xl px-6 py-8">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-teal">Organization</p>
            <h1 className="font-heading text-2xl font-bold text-ink">{organization.name}</h1>
            <p className="mt-1 text-sm text-muted">{organization.description || 'Tidak ada deskripsi.'}</p>
          </div>
          <Link
            href={`/organizations/${organization.id}/members`}
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-ink hover:bg-gray-50"
          >
            {memberCount ?? 0} Anggota
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
                const total = project.tasks?.length ?? 0;
                const done = project.tasks?.filter((t: any) => t.status === 'done').length ?? 0;
                const progress = calcProgress(done, total);
                return (
                  <Link key={project.id} href={`/projects/${project.id}`}>
                    <Card className="transition hover:border-navy">
                      <CardBody>
                        <div className="flex items-center justify-between">
                          <h3 className="font-heading text-base font-bold text-ink">{project.name}</h3>
                          <span className="text-xs font-semibold text-muted">{progress}%</span>
                        </div>
                        <div className="mt-2 h-2 w-full rounded-full bg-gray-100">
                          <div
                            className="h-2 rounded-full bg-orange"
                            style={{ width: `${progress}%` }}
                          />
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
            <CreateProjectForm organizationId={organization.id} />
          </div>
        </section>
      </main>
    </div>
  );
}
