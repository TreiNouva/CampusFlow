'use client';

import { FormEvent, useRef } from 'react';
import { addOrganizationMember } from '@/actions/member-actions';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Input, Label, Select } from '@/components/ui/input';
import { LoadingOverlay } from '@/components/ui/loading-overlay';
import { ASSIGNABLE_ORG_ROLES, ORG_ROLE_LABEL } from '@/lib/roles';
import { useAction } from '@/lib/use-action';
import type { OrgRole } from '@/types/database';

export function AddOrganizationMemberForm({
  organizationId,
  myRole,
}: {
  organizationId: string;
  myRole: OrgRole;
}) {
  const { error, busy, run } = useAction();
  const formRef = useRef<HTMLFormElement>(null);
  // Hanya Ketua yang boleh menunjuk Wakil Ketua
  const roles = ASSIGNABLE_ORG_ROLES.filter((r) => r !== 'wakil_ketua' || myRole === 'ketua');

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    void run(() => addOrganizationMember(formData), { onSuccess: () => formRef.current?.reset() });
  }

  return (
    <Card>
      <CardHeader>
        <h2 className="font-heading text-base font-bold text-ink">Tambah Anggota (via email)</h2>
        <p className="text-xs text-muted">
          User harus sudah punya akun CampusFlow. Untuk mengundang orang yang belum bergabung, pakai link undangan.
        </p>
      </CardHeader>
      <CardBody>
        <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
          <input type="hidden" name="organizationId" value={organizationId} />
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" placeholder="anggota@kampus.ac.id" required />
          </div>
          <div>
            <Label htmlFor="role">Jabatan</Label>
            <Select id="role" name="role" defaultValue="member">
              {roles.map((r) => (
                <option key={r} value={r}>
                  {ORG_ROLE_LABEL[r]}
                </option>
              ))}
            </Select>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? 'Menambahkan...' : 'Tambah Anggota'}
          </Button>
        </form>
      </CardBody>
      {busy && <LoadingOverlay label="Menambahkan anggota..." />}
    </Card>
  );
}
