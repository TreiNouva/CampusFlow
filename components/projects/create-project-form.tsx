'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createProject } from '@/actions/project-actions';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Input, Label, Textarea } from '@/components/ui/input';

export function CreateProjectForm({ organizationId }: { organizationId: string }) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await createProject(formData);
      if (!result.success) {
        setError(result.error ?? 'Gagal membuat project.');
        return;
      }
      if (result.data) {
        router.push(`/projects/${result.data.id}`);
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
          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? 'Membuat...' : 'Buat Project'}
          </Button>
        </form>
      </CardBody>
    </Card>
  );
}
