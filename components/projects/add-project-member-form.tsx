'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { addProjectMember } from '@/actions/member-actions';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Input, Label, Select } from '@/components/ui/input';
import { LoadingOverlay } from '@/components/ui/loading-overlay';
import { NETWORK_ERROR_MESSAGE } from '@/lib/utils';

export function AddProjectMemberForm({ projectId }: { projectId: string }) {
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
        const result = await addProjectMember(formData);
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
        <h2 className="font-heading text-base font-bold text-ink">Tambah Anggota Project</h2>
      </CardHeader>
      <CardBody>
        <form action={handleSubmit} className="space-y-4">
          <input type="hidden" name="projectId" value={projectId} />
          <div>
            <Label htmlFor="pm-email">Email</Label>
            <Input id="pm-email" name="email" type="email" placeholder="anggota@kampus.ac.id" required />
          </div>
          <div>
            <Label htmlFor="pm-role">Role</Label>
            <Select id="pm-role" name="role" defaultValue="member">
              <option value="coordinator">Coordinator</option>
              <option value="member">Member</option>
              <option value="viewer">Viewer</option>
            </Select>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          {success && <p className="text-sm text-green-600">Anggota berhasil ditambahkan.</p>}
          <Button type="submit" size="sm" className="w-full" disabled={busy}>
            {busy ? 'Menambahkan...' : 'Tambah'}
          </Button>
        </form>
      </CardBody>
      {busy && <LoadingOverlay label="Menambahkan anggota..." />}
    </Card>
  );
}
