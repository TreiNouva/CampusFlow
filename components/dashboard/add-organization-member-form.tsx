'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { addOrganizationMember } from '@/actions/member-actions';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Input, Label, Select } from '@/components/ui/input';
import { LoadingOverlay } from '@/components/ui/loading-overlay';
import { NETWORK_ERROR_MESSAGE } from '@/lib/utils';

export function AddOrganizationMemberForm({ organizationId }: { organizationId: string }) {
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [busy, setBusy] = useState(false);
  const [, startTransition] = useTransition();
  const router = useRouter();

  function handleSubmit(formData: FormData) {
    setError(null);
    setSuccess(false);
    setBusy(true);
    startTransition(async () => {
      try {
        const result = await addOrganizationMember(formData);
        if (!result.success) {
          setError(result.error ?? 'Gagal menambahkan anggota.');
          return;
        }
        setSuccess(true);
        router.refresh();
      } catch {
        setError(NETWORK_ERROR_MESSAGE);
      } finally {
        setBusy(false);
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <h2 className="font-heading text-base font-bold text-ink">Tambah Anggota</h2>
        <p className="text-xs text-muted">User harus sudah punya akun CampusFlow.</p>
      </CardHeader>
      <CardBody>
        <form action={handleSubmit} className="space-y-4">
          <input type="hidden" name="organizationId" value={organizationId} />
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" placeholder="anggota@kampus.ac.id" required />
          </div>
          <div>
            <Label htmlFor="role">Role</Label>
            <Select id="role" name="role" defaultValue="member">
              <option value="admin">Admin</option>
              <option value="coordinator">Coordinator</option>
              <option value="member">Member</option>
              <option value="viewer">Viewer</option>
            </Select>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          {success && <p className="text-sm text-green-600">Anggota berhasil ditambahkan.</p>}
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? 'Menambahkan...' : 'Tambah Anggota'}
          </Button>
        </form>
      </CardBody>
      {busy && <LoadingOverlay label="Menambahkan anggota..." />}
    </Card>
  );
}
