import Link from 'next/link';
import { Navbar } from '@/components/layout/navbar';
import { Card, CardBody, Badge } from '@/components/ui/card';
import { CreateOrganizationForm } from '@/components/dashboard/create-organization-form';
import { requireUser } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { formatDate, PRIORITY_COLOR, PRIORITY_LABEL, STATUS_COLOR, STATUS_LABEL } from '@/lib/utils';
import type { TaskPriority, TaskStatus } from '@/types/database';

export default async function DashboardPage() {
  const user = await requireUser();
  const supabase = createClient();

  // Dua query independen -> dijalankan bersamaan, bukan satu per satu.
  const [{ data: orgMemberships }, { data: myTasks }] = await Promise.all([
    supabase
      .from('organization_members')
      .select('organization:organizations(id, name, description)')
      .eq('user_id', user.id),
    supabase
      .from('tasks')
      .select('id, title, status, priority, due_date, project:projects(id, name)')
      .eq('assignee_id', user.id)
      .neq('status', 'done')
      .order('due_date', { ascending: true, nullsFirst: false })
      .limit(6),
  ]);

  const organizations = (orgMemberships ?? [])
    .map((row: any) => row.organization)
    .filter(Boolean);

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="mx-auto max-w-6xl px-6 py-8">
        <div className="flex items-center justify-between">
          <h1 className="font-heading text-2xl font-bold text-ink">Dashboard</h1>
          <Link
            href="#create-organization"
            className="rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-navy-dark"
          >
            + Organisasi Baru
          </Link>
        </div>

        <section className="mt-8">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">Organisasi Kamu</h2>
          {organizations.length === 0 ? (
            <EmptyOrganizations />
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {organizations.map((org: any) => (
                <Link key={org.id} href={`/organizations/${org.id}`}>
                  <Card className="h-full transition hover:border-navy">
                    <CardBody>
                      <h3 className="font-heading text-base font-bold text-ink">{org.name}</h3>
                      <p className="mt-1 line-clamp-2 text-sm text-muted">{org.description || 'Tidak ada deskripsi.'}</p>
                    </CardBody>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </section>

        <section className="mt-10">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">
            Task Kamu yang Mendekati Deadline
          </h2>
          <Card>
            {(!myTasks || myTasks.length === 0) && (
              <CardBody>
                <p className="text-sm text-muted">Tidak ada task aktif yang ditugaskan ke kamu. 🎉</p>
              </CardBody>
            )}
            <ul className="divide-y divide-gray-100">
              {(myTasks ?? []).map((task: any) => (
                <li key={task.id}>
                  <Link
                    href={`/projects/${task.project?.id}/tasks/${task.id}`}
                    className="flex items-center justify-between gap-4 px-5 py-3 hover:bg-gray-50"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-ink">{task.title}</p>
                      <p className="text-xs text-muted">{task.project?.name}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Badge color={PRIORITY_COLOR[task.priority as TaskPriority]}>
                        {PRIORITY_LABEL[task.priority as TaskPriority]}
                      </Badge>
                      <Badge color={STATUS_COLOR[task.status as TaskStatus]}>
                        {STATUS_LABEL[task.status as TaskStatus]}
                      </Badge>
                      <span className="text-xs text-muted">{formatDate(task.due_date)}</span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        </section>

        <section id="create-organization" className="mt-10">
          <CreateOrganizationForm />
        </section>
      </main>
    </div>
  );
}

function EmptyOrganizations() {
  return (
    <Card>
      <CardBody className="py-8 text-center">
        <p className="text-sm text-muted">
          Kamu belum tergabung di organisasi mana pun. Buat organisasi pertamamu di bawah ini.
        </p>
      </CardBody>
    </Card>
  );
}
