import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Navbar } from '@/components/layout/navbar';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { AddOrganizationMemberForm } from '@/components/dashboard/add-organization-member-form';
import { InviteManager } from '@/components/invites/invite-manager';
import { OrgMemberRow } from '@/components/members/org-member-row';
import { requireUser } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { canInviteToOrg, isOrgManagerRole, ORG_ROLES } from '@/lib/roles';
import type { Invite, OrgRole } from '@/types/database';

export default async function OrganizationMembersPage({
  params,
}: {
  params: { organizationId: string };
}) {
  const user = await requireUser();
  const supabase = createClient();

  const [{ data: organization }, { data: myMembership }, { data: members }, { data: invites }] = await Promise.all([
    supabase.from('organizations').select('id, name').eq('id', params.organizationId).single(),
    supabase
      .from('organization_members')
      .select('role')
      .eq('organization_id', params.organizationId)
      .eq('user_id', user.id)
      .maybeSingle(),
    supabase
      .from('organization_members')
      .select('id, role, user_id, profile:profiles(id, full_name, email)')
      .eq('organization_id', params.organizationId),
    // Link undangan organisasi (RLS: hanya pembuat & pengurus inti yang bisa melihat)
    supabase
      .from('invites')
      .select('*')
      .eq('organization_id', params.organizationId)
      .is('project_id', null)
      .is('revoked_at', null)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false }),
  ]);
  if (!organization || !myMembership) notFound();

  const myRole = myMembership.role as OrgRole;
  const isManager = isOrgManagerRole(myRole);
  const mayInvite = canInviteToOrg(myRole);

  // Urutkan sesuai tingkatan jabatan: Ketua, Wakil Ketua, Koordinator, ...
  const sorted = [...(members ?? [])].sort(
    (a: any, b: any) => ORG_ROLES.indexOf(a.role) - ORG_ROLES.indexOf(b.role) || (a.profile?.full_name ?? '').localeCompare(b.profile?.full_name ?? '')
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="mx-auto max-w-5xl px-6 py-8">
        <Link href={`/organizations/${organization.id}`} className="text-xs font-semibold uppercase tracking-wide text-teal">
          ← {organization.name}
        </Link>
        <h1 className="font-heading text-2xl font-bold text-ink">Anggota & Undangan</h1>

        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <h2 className="font-heading text-base font-bold text-ink">{sorted.length} Anggota</h2>
                <p className="text-xs text-muted">
                  Ketua dan Wakil Ketua hanya satu orang. Koordinator, Sekretaris, Bendahara, dan Member bisa lebih dari satu.
                  {isManager ? ' Ketua dan Wakil Ketua dapat mengatur jabatan dan mengeluarkan anggota.' : ''}
                </p>
              </CardHeader>
              <ul className="divide-y divide-gray-100">
                {sorted.map((m: any) => (
                  <OrgMemberRow
                    key={m.id}
                    organizationId={organization.id}
                    member={{
                      userId: m.user_id,
                      name: m.profile?.full_name || 'Tanpa nama',
                      email: m.profile?.email ?? '',
                      role: m.role,
                    }}
                    myRole={myRole}
                    myUserId={user.id}
                  />
                ))}
              </ul>
            </Card>
          </div>

          <div className="space-y-6">
            {mayInvite && (
              <InviteManager
                scope="organization"
                organizationId={organization.id}
                invites={(invites ?? []) as Invite[]}
                path={`/organizations/${organization.id}/members`}
              />
            )}
            {isManager ? (
              <AddOrganizationMemberForm organizationId={organization.id} myRole={myRole} />
            ) : (
              <Card>
                <CardBody className="text-sm text-muted">
                  Hanya Ketua dan Wakil Ketua yang dapat menambah atau mengatur anggota organisasi.
                </CardBody>
              </Card>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
