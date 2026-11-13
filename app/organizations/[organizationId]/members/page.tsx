import Link from 'next/link';
import { getOrgBilling } from '@/lib/billing';
import { PLAN_NAME } from '@/lib/plans';
import { notFound } from 'next/navigation';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { AddOrganizationMemberForm } from '@/components/dashboard/add-organization-member-form';
import { InviteManager } from '@/components/invites/invite-manager';
import { OrgMemberRow } from '@/components/members/org-member-row';
import { requireUser } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { canInviteToOrg, isOrgManagerRole, ORG_ROLES } from '@/lib/roles';
import type { Invite, OrgRole } from '@/types/database';

export default async function OrganizationMembersPage(
  props: {
    params: Promise<{ organizationId: string }>;
  }
) {
  const params = await props.params;
  const user = await requireUser();
  const supabase = await createClient();

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
  const billing = await getOrgBilling(organization.id, myRole);
  const seatsLeft = billing.memberLimit === null ? null : Math.max(0, billing.memberLimit - billing.memberCount);
  const isManager = isOrgManagerRole(myRole);
  const mayInvite = canInviteToOrg(myRole);

  // Urutkan sesuai tingkatan jabatan: Ketua, Wakil Ketua, Koordinator, ...
  const sorted = [...(members ?? [])].sort(
    (a: any, b: any) => ORG_ROLES.indexOf(a.role) - ORG_ROLES.indexOf(b.role) || (a.profile?.full_name ?? '').localeCompare(b.profile?.full_name ?? '')
  );

  return (
    <div>
      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
        <Link href={`/organizations/${organization.id}`} className="text-xs font-semibold uppercase tracking-wide text-teal">
          ← {organization.name}
        </Link>
        <h1 className="font-heading text-2xl font-bold text-ink">Anggota & Undangan</h1>
        {seatsLeft !== null && (
          <p className={`mt-2 inline-flex flex-wrap items-center gap-2 rounded-lg px-3 py-1.5 text-sm ${seatsLeft === 0 ? 'bg-red-50 text-red-700' : seatsLeft <= 3 ? 'bg-orange-light text-warn-ink' : 'bg-gray-100 text-gray-700'}`}>
            {billing.memberCount}/{billing.memberLimit} anggota ({PLAN_NAME[billing.plan]}) ·{' '}
            {seatsLeft === 0 ? 'kuota penuh, undangan baru akan ditolak.' : `sisa ${seatsLeft} slot.`}
            <Link href={`/organizations/${organization.id}/billing`} className="font-semibold underline-offset-2 hover:underline">Tambah kuota</Link>
          </p>
        )}

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
