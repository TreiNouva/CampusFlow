'use client';

import { useState } from 'react';
import {
  changeOrganizationMemberRole,
  removeOrganizationMember,
  transferKetua,
} from '@/actions/member-actions';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/input';
import { LoadingOverlay } from '@/components/ui/loading-overlay';
import { OrgRoleBadge } from '@/components/ui/role-badge';
import { ASSIGNABLE_ORG_ROLES, ORG_ROLE_LABEL } from '@/lib/roles';
import { useAction } from '@/lib/use-action';
import { initials } from '@/lib/utils';
import type { OrgRole } from '@/types/database';

interface Props {
  organizationId: string;
  member: { userId: string; name: string; email: string; role: OrgRole };
  myRole: OrgRole;
  myUserId: string;
}

export function OrgMemberRow({ organizationId, member, myRole, myUserId }: Props) {
  const isKetuaMe = myRole === 'ketua';
  const isManager = myRole === 'ketua' || myRole === 'wakil_ketua';
  const isSelf = member.userId === myUserId;

  // Ketua tidak bisa diubah/dikeluarkan; Wakil Ketua hanya bisa diubah oleh Ketua
  const canEdit = isManager && member.role !== 'ketua' && (member.role !== 'wakil_ketua' || isKetuaMe);
  const roleOptions = ASSIGNABLE_ORG_ROLES.filter((r) => r !== 'wakil_ketua' || isKetuaMe);

  const [role, setRole] = useState<OrgRole>(member.role);
  const { error, busy, run } = useAction();

  function payload() {
    const fd = new FormData();
    fd.set('organizationId', organizationId);
    fd.set('userId', member.userId);
    return fd;
  }

  function handleSave() {
    const fd = payload();
    fd.set('role', role);
    void run(() => changeOrganizationMemberRole(fd));
  }

  function handleKick() {
    if (!window.confirm(`Keluarkan ${member.name} dari organisasi? Ia juga akan keluar dari semua project organisasi ini.`)) return;
    void run(() => removeOrganizationMember(payload()));
  }

  function handleTransfer() {
    if (!window.confirm(`Alihkan jabatan Ketua ke ${member.name}? Kamu akan menjadi Member biasa dan tidak bisa membatalkannya sendiri.`)) return;
    void run(() => transferKetua(payload()));
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

        {canEdit ? (
          <div className="flex flex-wrap items-center gap-2">
            <Select
              aria-label={`Role ${member.name}`}
              value={role}
              onChange={(e) => setRole(e.target.value as OrgRole)}
              className="w-40 py-1.5"
              disabled={busy}
            >
              {roleOptions.map((r) => (
                <option key={r} value={r}>
                  {ORG_ROLE_LABEL[r]}
                </option>
              ))}
            </Select>
            {role !== member.role && (
              <Button type="button" size="sm" onClick={handleSave} disabled={busy}>
                Simpan
              </Button>
            )}
            {isKetuaMe && (
              <Button type="button" size="sm" variant="ghost" onClick={handleTransfer} disabled={busy}>
                Jadikan Ketua
              </Button>
            )}
            <Button type="button" size="sm" variant="danger" onClick={handleKick} disabled={busy}>
              Keluarkan
            </Button>
          </div>
        ) : (
          <OrgRoleBadge role={member.role} />
        )}
      </div>
      {role === 'wakil_ketua' && role !== member.role && (
        <p className="mt-1 text-xs text-muted">Wakil Ketua hanya satu orang: pemegang jabatan sebelumnya otomatis menjadi Member.</p>
      )}
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
      {busy && <LoadingOverlay label="Memproses..." />}
    </li>
  );
}
