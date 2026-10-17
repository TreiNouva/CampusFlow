'use client';

import { FormEvent, useRef, useState } from 'react';
import { addProjectMember } from '@/actions/member-actions';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Input, Label, Select } from '@/components/ui/input';
import { LoadingOverlay } from '@/components/ui/loading-overlay';
import { ASSIGNABLE_PROJECT_ROLES, DIVISION_ROLES, PROJECT_ROLE_LABEL } from '@/lib/roles';
import { useAction } from '@/lib/use-action';
import type { ProjectRole } from '@/types/database';

export function AddProjectMemberForm({
  projectId,
  divisions,
  mayAssignLeadership,
}: {
  projectId: string;
  divisions: { id: string; name: string }[];
  /** Hanya Project Manager / Ketua & Wakil Ketua organisasi yang boleh menunjuk PM / Wakil PM. */
  mayAssignLeadership: boolean;
}) {
  const { error, busy, run } = useAction();
  const formRef = useRef<HTMLFormElement>(null);
  const [role, setRole] = useState<ProjectRole>('member');
  const roles = ASSIGNABLE_PROJECT_ROLES.filter(
    (r) => mayAssignLeadership || (r !== 'project_manager' && r !== 'wakil_project_manager')
  );

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    void run(() => addProjectMember(formData), {
      onSuccess: () => {
        formRef.current?.reset();
        setRole('member');
      },
    });
  }

  return (
    <Card>
      <CardHeader>
        <h2 className="font-heading text-base font-bold text-ink">Tambah Anggota (via email)</h2>
        <p className="text-xs text-muted">Orang tersebut harus sudah menjadi anggota organisasi.</p>
      </CardHeader>
      <CardBody>
        <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
          <input type="hidden" name="projectId" value={projectId} />
          <div>
            <Label htmlFor="pm-email">Email</Label>
            <Input id="pm-email" name="email" type="email" placeholder="anggota@kampus.ac.id" required />
          </div>
          <div>
            <Label htmlFor="pm-role">Peran</Label>
            <Select id="pm-role" name="role" value={role} onChange={(e) => setRole(e.target.value as ProjectRole)}>
              {roles.map((r) => (
                <option key={r} value={r}>
                  {PROJECT_ROLE_LABEL[r]}
                </option>
              ))}
            </Select>
          </div>
          {DIVISION_ROLES.includes(role) && (
            <div>
              <Label htmlFor="pm-division">Divisi (opsional)</Label>
              <Select id="pm-division" name="divisionId" defaultValue="">
                <option value="">Tanpa divisi</option>
                {divisions.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </Select>
            </div>
          )}
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" size="sm" className="w-full" disabled={busy}>
            {busy ? 'Menambahkan...' : 'Tambah'}
          </Button>
        </form>
      </CardBody>
      {busy && <LoadingOverlay label="Menambahkan anggota..." />}
    </Card>
  );
}
