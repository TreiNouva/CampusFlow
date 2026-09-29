import { notFound } from 'next/navigation';
import { Navbar } from '@/components/layout/navbar';
import { Card, CardBody, CardHeader, Badge } from '@/components/ui/card';
import { AddOrganizationMemberForm } from '@/components/dashboard/add-organization-member-form';
import { requireUser } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { initials } from '@/lib/utils';

const ROLE_COLOR: Record<string, string> = {
  admin: 'bg-orange-light text-orange',
  coordinator: 'bg-sky text-navy',
  member: 'bg-gray-100 text-gray-700',
  viewer: 'bg-gray-100 text-gray-500',
};

export default async function OrganizationMembersPage({
  params,
}: {
  params: { organizationId: string };
}) {
  const user = await requireUser();
  const supabase = createClient();

  const { data: organization } = await supabase
    .from('organizations')
    .select('id, name')
    .eq('id', params.organizationId)
    .single();
  if (!organization) notFound();

  const { data: myMembership } = await supabase
    .from('organization_members')
    .select('role')
    .eq('organization_id', params.organizationId)
    .eq('user_id', user.id)
    .maybeSingle();
  if (!myMembership) notFound();

  const { data: members } = await supabase
    .from('organization_members')
    .select('id, role, profile:profiles(id, full_name, email)')
    .eq('organization_id', params.organizationId)
    .order('created_at', { ascending: true });

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="mx-auto max-w-4xl px-6 py-8">
        <p className="text-xs font-semibold uppercase tracking-wide text-teal">{organization.name}</p>
        <h1 className="font-heading text-2xl font-bold text-ink">Anggota Organisasi</h1>

        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <h2 className="font-heading text-base font-bold text-ink">
                  {members?.length ?? 0} Anggota
                </h2>
              </CardHeader>
              <ul className="divide-y divide-gray-100">
                {(members ?? []).map((m: any) => (
                  <li key={m.id} className="flex items-center justify-between gap-4 px-5 py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-navy text-xs font-bold text-white">
                        {initials(m.profile?.full_name || m.profile?.email || '?')}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-ink">{m.profile?.full_name}</p>
                        <p className="text-xs text-muted">{m.profile?.email}</p>
                      </div>
                    </div>
                    <Badge color={ROLE_COLOR[m.role]}>{m.role}</Badge>
                  </li>
                ))}
              </ul>
            </Card>
          </div>

          <div>
            {myMembership.role === 'admin' ? (
              <AddOrganizationMemberForm organizationId={organization.id} />
            ) : (
              <Card>
                <CardBody className="text-sm text-muted">
                  Hanya admin organisasi yang dapat menambah anggota baru.
                </CardBody>
              </Card>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
