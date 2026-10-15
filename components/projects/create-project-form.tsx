'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createProject } from '@/actions/project-actions';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Input, Label, Textarea } from '@/components/ui/input';
import { LoadingOverlay } from '@/components/ui/loading-overlay';
import { NETWORK_ERROR_MESSAGE } from '@/lib/utils';

export function CreateProjectForm({ organizationId }: { organizationId: string }) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [, startTransition] = useTransition();
  const router = useRouter();

  function handleSubmit(formData: FormData) {
    setError(null);
    setBusy(true);
    startTransition(async () => {
      try {
        const result = await createProject(formData);
        if (!result.success) {
          setError(result.error ?? 'Gagal membuat project.');
          setBusy(false);
          return;
        }
        if (result.data) {
          // Overlay tetap tampil sampai halaman project terbuka.
          router.push(`/projects/${result.data.id}`);
        } else {
          setBusy(false);
        }
      } catch {
        // Sebelumnya error jaringan di sini membuat halaman crash ("client-side exception").
        setError(NETWORK_ERROR_MESSAGE);
        setBusy(false);
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <h2 className="font-heading text-base font-bold text-ink">Project/Event Baru</h2>
      </CardHeader>
      <CardBody>
        <form action={handleSubmit} className="space-y-4">
          <input type="hidden" name="organizationId" value={organizationId} />
          <div>
            <Label htmlFor="name">Nama Project</Label>
            <Input id="name" name="name" placeholder="mis. Student Festival 2026" required />
          </div>
          <div>
            <Label htmlFor="description">Deskripsi (opsional)</Label>
            <Textarea id="description" name="description" rows={2} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="startDate">Mulai</Label>
              <Input id="startDate" name="startDate" type="date" />
            </div>
            <div>
              <Label htmlFor="endDate">Selesai</Label>
              <Input id="endDate" name="endDate" type="date" />
            </div>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? 'Membuat...' : 'Buat Project'}
          </Button>
        </form>
      </CardBody>
      {busy && <LoadingOverlay label="Membuat project..." />}
    </Card>
  );
}
