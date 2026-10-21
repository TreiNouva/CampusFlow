'use client';

import { FormEvent, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createProject } from '@/actions/project-actions';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Input, Label, Select, Textarea } from '@/components/ui/input';
import { LoadingOverlay } from '@/components/ui/loading-overlay';
import { NETWORK_ERROR_MESSAGE } from '@/lib/utils';

interface Props {
  organizationId: string;
  /** Anggota organisasi yang bisa ditunjuk sebagai Project Manager (Ketua boleh). */
  candidates: { id: string; name: string }[];
  currentUserId: string;
}

export function CreateProjectForm({ organizationId, candidates, currentUserId }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [start, setStart] = useState('');
  const [, startTransition] = useTransition();
  const router = useRouter();
  const noCandidate = candidates.length === 0;

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
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
        <form onSubmit={handleSubmit} className="space-y-4">
          <input type="hidden" name="organizationId" value={organizationId} />
          <div>
            <Label htmlFor="name">Nama Project</Label>
            <Input id="name" name="name" placeholder="mis. Student Festival 2026" required minLength={3} />
          </div>
          <div>
            <Label htmlFor="description">Deskripsi (opsional)</Label>
            <Textarea id="description" name="description" rows={2} />
          </div>
          <div>
            <Label htmlFor="projectManagerId">Project Manager</Label>
            <Select id="projectManagerId" name="projectManagerId" defaultValue={currentUserId} required>
              {candidates.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {c.id === currentUserId ? ' (kamu)' : ''}
                </option>
              ))}
            </Select>
            <p className="mt-1 text-xs text-muted">
              Ketua organisasi otomatis ikut project ini sebagai viewer, kecuali ia dipilih sebagai Project Manager.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="startDate">Mulai</Label>
              <Input id="startDate" name="startDate" type="date" value={start} onChange={(e) => setStart(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="endDate">Selesai</Label>
              <Input id="endDate" name="endDate" type="date" min={start || undefined} />
            </div>
          </div>
          <p className="-mt-1 text-xs text-muted">Semua task, acara, dan milestone nanti harus berada di dalam periode ini.</p>
          {noCandidate && (
            <p className="rounded-lg bg-orange-light px-3 py-2 text-xs text-orange">
              Belum ada anggota yang bisa menjadi Project Manager.
            </p>
          )}
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" className="w-full" disabled={busy || noCandidate}>
            {busy ? 'Membuat...' : 'Buat Project'}
          </Button>
        </form>
      </CardBody>
      {busy && <LoadingOverlay label="Membuat project..." />}
    </Card>
  );
}
