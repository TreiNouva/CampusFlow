import { notFound } from 'next/navigation';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { DivisionManager } from '@/components/projects/division-manager';
import { AddProjectMemberForm } from '@/components/projects/add-project-member-form';
import { InviteManager } from '@/components/invites/invite-manager';
import { ProjectMemberRow } from '@/components/members/project-member-row';
import { requireUser } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import {
  canInviteToProjectRole,
  canManageProjectMembers,
  isOrgManagerRole,
  isProjectManagerRole,
  PROJECT_ROLES,
} from '@/lib/roles';
import type { Invite, OrgRole, ProjectRole } from '@/types/database';

export default async function ProjectMembersPage({ params }: { params: { projectId: string } }) {
  const user = await requireUser();
  const supabase = createClient();

  const [{ data: project }, { data: membership }, { data: members }, { data: divisions }, { data: invites }] =
    await Promise.all([
      supabase.from('projects').select('id, name, organization_id').eq('id', params.projectId).single(),
      supabase
        .from('project_members')
        .select('role')
        .eq('project_id', params.projectId)
        .eq('user_id', user.id)
        .maybeSingle(),
      supabase
        .from('project_members')
        .select('id, user_id, role, division_id, profile:profiles(id, full_name, email), division:project_divisions(name)')
        .eq('project_id', params.projectId),
      supabase.from('project_divisions').select('id, name, color').eq('project_id', params.projectId).order('name'),
      supabase
        .from('invites')
        .select('*')
        .eq('project_id', params.projectId)
        .is('revoked_at', null)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false }),
    ]);
  if (!project || !membership) notFound();

  // Role organisasi saya (Ketua/Wakil Ketua organisasi juga boleh mengatur keanggotaan project)
  const { data: orgMembership } = await supabase
    .from('organization_members')
    .select('role')
    .eq('organization_id', project.organization_id)
    .eq('user_id', user.id)
    .maybeSingle();

  const { data: ketuaRow } = await supabase
    .from('organization_members')
    .select('user_id')
    .eq('organization_id', project.organization_id)
    .eq('role', 'ketua')
    .maybeSingle();
  const ketuaId = ketuaRow?.user_id ?? null;

  const myRole = membership.role as ProjectRole;
  const myOrgRole = (orgMembership?.role as OrgRole | undefined) ?? null;
  const canManage = canManageProjectMembers(myRole, myOrgRole);
  const mayInvite = canInviteToProjectRole(myRole, myOrgRole);
  const mayAssignLeadership = myRole === 'project_manager' || isOrgManagerRole(myOrgRole);

  const sorted = [...(members ?? [])].sort(
    (a: any, b: any) =>
      PROJECT_ROLES.indexOf(a.role) - PROJECT_ROLES.indexOf(b.role) ||
      (a.profile?.full_name ?? '').localeCompare(b.profile?.full_name ?? '')
  );
  const divisionList = (divisions ?? []).map((d: any) => ({
    id: d.id as string,
    name: d.name as string,
    color: (d.color as string) ?? 'blue',
    memberCount: (members ?? []).filter((m: any) => m.division_id === d.id).length,
  }));

  return (
    <div>
      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
        <h1 className="font-heading text-xl font-bold text-ink sm:text-2xl">Anggota & Divisi</h1>

        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <DivisionManager
              projectId={project.id}
              divisions={divisionList}
              canManage={isProjectManagerRole(myRole)}
            />

            <Card>
              <CardHeader>
                <h2 className="font-heading text-base font-bold text-ink">{sorted.length} Anggota</h2>
                <p className="text-xs text-muted">
                  Ketua organisasi otomatis menjadi anggota semua project sebagai viewer. Project Manager dan Wakil
                  Project Manager hanya satu orang; PIC, Koordinator, Bendahara, Sekretaris, dan Member bisa lebih dari
                  satu. {canManage ? 'Kamu dapat mengatur peran, divisi, dan mengeluarkan anggota.' : ''}
                </p>
              </CardHeader>
              <ul className="divide-y divide-gray-100">
                {sorted.map((m: any) => (
                  <ProjectMemberRow
                    key={m.id}
                    projectId={project.id}
                    member={{
                      userId: m.user_id,
                      name: m.profile?.full_name || 'Tanpa nama',
                      email: m.profile?.email ?? '',
                      role: m.role,
                      divisionId: m.division_id ?? null,
                      divisionName: m.division?.name ?? null,
                      isOrgKetua: m.user_id === ketuaId,
                    }}
                    divisions={(divisions ?? []) as { id: string; name: string }[]}
                    myRole={myRole}
                    myOrgRole={myOrgRole}
                    myUserId={user.id}
                  />
                ))}
              </ul>
            </Card>
          </div>

          <div className="space-y-6">
            {mayInvite && (
              <InviteManager
                scope="project"
                organizationId={project.organization_id}
                projectId={project.id}
                divisions={(divisions ?? []) as { id: string; name: string }[]}
                invites={(invites ?? []) as Invite[]}
                path={`/projects/${project.id}/members`}
              />
            )}
            {canManage ? (
              <AddProjectMemberForm
                projectId={project.id}
                divisions={(divisions ?? []) as { id: string; name: string }[]}
                mayAssignLeadership={mayAssignLeadership}
              />
            ) : (
              <Card>
                <CardBody className="text-sm text-muted">
                  Hanya Project Manager, Wakil Project Manager, serta Ketua/Wakil Ketua organisasi yang dapat mengatur
                  anggota project.
                </CardBody>
              </Card>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
