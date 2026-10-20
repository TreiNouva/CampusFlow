'use client';

import { FormEvent, useRef } from 'react';
import { createAnnouncement } from '@/actions/announcement-actions';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Input, Label, Textarea } from '@/components/ui/input';
import { LoadingOverlay } from '@/components/ui/loading-overlay';
import { useAction } from '@/lib/use-action';
import { Select } from '@/components/ui/input';
import { canManageScoped } from '@/lib/roles';
import type { ProjectRole } from '@/types/database';

interface Props {
  projectId: string;
  divisions: { id: string; name: string }[];
  myRole: ProjectRole;
  myDivisionId: string | null;
}

export function AnnouncementForm({ projectId, divisions, myRole, myDivisionId }: Props) {
  // Global: PM, Wakil PM, Sekretaris (dan PIC/Koordinator lewat aturan v5). Divisi: sesuai hak masing-masing.
  const canGlobal = canManageScoped(myRole, myDivisionId, null) || myRole === 'pic' || myRole === 'koordinator';
  const allowedDivisions = divisions.filter((d) => canManageScoped(myRole, myDivisionId, d.id));
  const { error, busy, run } = useAction();
  const formRef = useRef<HTMLFormElement>(null);

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    void run(() => createAnnouncement(formData), { onSuccess: () => formRef.current?.reset() });
  }

  return (
    <Card>
      <CardHeader>
        <h2 className="font-heading text-base font-bold text-ink">Buat Pengumuman</h2>
        <p className="text-xs text-muted">
          Tampil di halaman project untuk anggota yang dituju dan dikirim lewat email (kecuali kepada kamu sendiri, karena
          kamu yang membuatnya). Pengumuman yang kamu buat tetap bisa dilihat dan diedit di daftar di atas.
        </p>
      </CardHeader>
      <CardBody>
        <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
          <input type="hidden" name="projectId" value={projectId} />
          <div>
            <Label htmlFor="ann-scope">Ditujukan untuk</Label>
            <Select id="ann-scope" name="divisionId" defaultValue={canGlobal ? '' : allowedDivisions[0]?.id ?? ''}>
              {canGlobal && <option value="">Global (semua anggota project)</option>}
              {allowedDivisions.map((d) => (
                <option key={d.id} value={d.id}>Divisi {d.name}</option>
              ))}
            </Select>
            <p className="mt-1 text-[11px] text-muted">
              Pengumuman divisi hanya dilihat & dikirim ke anggota divisi itu (plus Project Manager & Wakil PM). Global dilihat semua.
            </p>
          </div>
          <div>
            <Label htmlFor="ann-title">Judul</Label>
            <Input id="ann-title" name="title" placeholder="mis. Rapat koordinasi H-7" required minLength={3} />
          </div>
          <div>
            <Label htmlFor="ann-body">Isi Pengumuman</Label>
            <Textarea id="ann-body" name="body" rows={4} placeholder="Tulis pengumuman di sini..." required />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" disabled={busy}>
            {busy ? 'Mengirim...' : 'Kirim Pengumuman'}
          </Button>
        </form>
      </CardBody>
      {busy && <LoadingOverlay label="Mengirim pengumuman..." />}
    </Card>
  );
}
