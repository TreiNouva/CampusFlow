'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createOrganization } from '@/actions/organization-actions';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Input, Label, Textarea } from '@/components/ui/input';
import { LoadingOverlay } from '@/components/ui/loading-overlay';
import { NETWORK_ERROR_MESSAGE } from '@/lib/utils';

export function CreateOrganizationForm() {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [, startTransition] = useTransition();
  const router = useRouter();

  function handleSubmit(formData: FormData) {
    setError(null);
    setBusy(true);
    startTransition(async () => {
      try {
        const result = await createOrganization(formData);
        if (!result.success) {
          setError(result.error ?? 'Gagal membuat organisasi.');
          setBusy(false);
          return;
        }
        if (result.data) {
          // Overlay tetap tampil sampai halaman organisasi terbuka.
          router.push(`/organizations/${result.data.id}`);
        } else {
          setBusy(false);
        }
      } catch {
        setError(NETWORK_ERROR_MESSAGE);
        setBusy(false);
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <h2 className="font-heading text-base font-bold text-ink">Buat Organisasi Baru</h2>
        <p className="text-sm text-muted">Kamu otomatis menjadi admin dari organisasi ini.</p>
      </CardHeader>
      <CardBody>
        <form action={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="name">Nama Organisasi</Label>
            <Input id="name" name="name" placeholder="mis. BEM Fakultas Ilmu Komputer" required />
          </div>
          <div>
            <Label htmlFor="description">Deskripsi (opsional)</Label>
            <Textarea id="description" name="description" rows={2} placeholder="Deskripsi singkat organisasi" />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" disabled={busy}>
            {busy ? 'Membuat...' : 'Buat Organisasi'}
          </Button>
        </form>
      </CardBody>
      {busy && <LoadingOverlay label="Membuat organisasi..." />}
    </Card>
  );
}
