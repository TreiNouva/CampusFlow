'use client';

import { FormEvent, useRef } from 'react';
import { createAnnouncement } from '@/actions/announcement-actions';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Input, Label, Textarea } from '@/components/ui/input';
import { LoadingOverlay } from '@/components/ui/loading-overlay';
import { useAction } from '@/lib/use-action';

export function AnnouncementForm({ projectId }: { projectId: string }) {
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
          Tampil di halaman project untuk semua anggota dan dikirim lewat email (kecuali kepada kamu sendiri, karena
          kamu yang membuatnya). Pengumuman yang kamu buat tetap bisa dilihat dan diedit di daftar di atas.
        </p>
      </CardHeader>
      <CardBody>
        <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
          <input type="hidden" name="projectId" value={projectId} />
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
