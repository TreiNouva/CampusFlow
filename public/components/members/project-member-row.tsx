'use client';

import { useState } from 'react';
import { changeProjectMember, removeProjectMember } from '@/actions/member-actions';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/input';
import { LoadingOverlay } from '@/components/ui/loading-overlay';
import { ProjectRoleBadge } from '@/components/ui/role-badge';
import {
  ASSIGNABLE_PROJECT_ROLES,
  canManageProjectMembers,
  DIVISION_ROLES,
  isOrgManagerRole,
  PROJECT_ROLE_LABEL,
} from '@/lib/roles';
import { useAction } from '@/lib/use-action';
import { initials } from '@/lib/utils';
import type { OrgRole, ProjectRole } from '@/types/database';

interface Props {
  projectId: string;
  member: {
    userId: string;
    name: string;
    email: string;
    role: ProjectRole;
    divisionId: string | null;
    divisionName: string | null;
    isOrgKetua?: boolean;
  };
  divisions: { id: string; name: string }[];
  myRole: ProjectRole;
  myOrgRole: OrgRole | null;
  myUserId: string;
}

export function ProjectMemberRow({ projectId, member, divisions, myRole, myOrgRole, myUserId }: Props) {
  const canManage = canManageProjectMembers(myRole, myOrgRole);
  const mayAssignLeadership = myRole === 'project_manager' || isOrgManagerRole(myOrgRole);
  const isSelf = member.userId === myUserId;

  // Ketua (viewer) tetap otomatis. PM hanya bisa diganti dengan menunjuk PM baru di anggota lain.
  const editable = canManage && member.role !== 'ketua' && member.role !== 'project_manager';
  // Ketua organisasi boleh dijadikan Project Manager (jika mau atau perlu); PM lama otomatis kembali ke perannya
  const canMakeKetuaPm = mayAssignLeadership && member.role === 'ketua';
  const canKick = canManage && member.role !== 'ketua' && member.role !== 'project_manager';
  const roleOptions = ASSIGNABLE_PROJECT_ROLES.filter(
    (r) => mayAssignLeadership || (r !== 'project_manager' && r !== 'wakil_project_manager')
  );

  const [role, setRole] = useState<ProjectRole>(member.role);
  const [divisionId, setDivisionId] = useState<string>(member.divisionId ?? '');
  const { error, busy, run } = useAction();

  const hasDivision = DIVISION_ROLES.includes(role);
  const changed = role !== member.role || (hasDivision ? divisionId : '') !== (member.divisionId ?? '');

  function payload() {
    const fd = new FormData();
    fd.set('projectId', projectId);
    fd.set('userId', member.userId);
    return fd;
  }

  function handleSave() {
    const fd = payload();
    fd.set('role', role);
    if (hasDivision && divisionId) fd.set('divisionId', divisionId);
    void run(() => changeProjectMember(fd));
  }

  function handleMakePm() {
    if (!window.confirm(`Jadikan ${member.name} (Ketua) sebagai Project Manager? Project Manager saat ini otomatis menjadi Member.`)) return;
    const fd = payload();
    fd.set('role', 'project_manager');
    void run(() => changeProjectMember(fd));
  }

  function handleKick() {
    if (!window.confirm(`Keluarkan ${member.name} dari project ini? Task yang ditugaskan padanya akan menjadi belum ditugaskan.`)) return;
    void run(() => removeProjectMember(payload()));
  }

  return (
    <li className="px-5 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-navy text-xs font-bold text-white">
            {initials(member.name || member.email)}
          </div>
          <div>
            <p className="text-sm font-medium text-ink">
              {member.name} {isSelf && <span className="text-xs text-muted">(kamu)</span>}
            </p>
            <p className="text-xs text-muted">{member.email}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {editable ? (
            <>
              <Select
                aria-label={`Role ${member.name}`}
                value={role}
                onChange={(e) => setRole(e.target.value as ProjectRole)}
                className="w-48 py-1.5"
                disabled={busy}
              >
                {roleOptions.map((r) => (
                  <option key={r} value={r}>
                    {PROJECT_ROLE_LABEL[r]}
                  </option>
                ))}
              </Select>
              {hasDivision && (
                <Select
                  aria-label={`Divisi ${member.name}`}
                  value={divisionId}
                  onChange={(e) => setDivisionId(e.target.value)}
                  className="w-40 py-1.5"
                  disabled={busy}
                >
                  <option value="">Tanpa divisi</option>
                  {divisions.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </Select>
              )}
              {changed && (
                <Button type="button" size="sm" onClick={handleSave} disabled={busy}>
                  Simpan
                </Button>
              )}
            </>
          ) : (
            <ProjectRoleBadge role={member.role} divisionName={member.divisionName} />
          )}
          {canMakeKetuaPm && (
            <Button type="button" size="sm" variant="ghost" onClick={handleMakePm} disabled={busy}>
              Jadikan Project Manager
            </Button>
          )}
          {canKick && (
            <Button type="button" size="sm" variant="danger" onClick={handleKick} disabled={busy}>
              Keluarkan
            </Button>
          )}
        </div>
      </div>

      {editable && (role !== member.role || member.divisionName) && (
        <p className="mt-1 text-xs text-muted">
          Title saat ini: <span className="font-medium text-ink">{member.divisionName ? `${PROJECT_ROLE_LABEL[member.role]} ${member.divisionName}` : PROJECT_ROLE_LABEL[member.role]}</span>
        </p>
      )}
      {member.role === 'project_manager' && canManage && (
        <p className="mt-1 text-xs text-muted">
          Untuk mengganti Project Manager, tunjuk anggota lain sebagai Project Manager
          {member.isOrgKetua ? ' (Ketua otomatis kembali menjadi viewer).' : '.'}
        </p>
      )}
      {(role === 'project_manager' || role === 'wakil_project_manager') && role !== member.role && (
        <p className="mt-1 text-xs text-muted">Peran ini hanya satu orang: pemegang sebelumnya otomatis menjadi Member.</p>
      )}
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
      {busy && <LoadingOverlay label="Memproses..." />}
    </li>
  );
}
