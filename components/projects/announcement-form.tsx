'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { sendProjectAnnouncement } from '@/actions/notification-actions';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Input, Label, Textarea } from '@/components/ui/input';
import { LoadingOverlay } from '@/components/ui/loading-overlay';
import { NETWORK_ERROR_MESSAGE } from '@/lib/utils';

export function AnnouncementForm({ projectId }: { projectId: string }) {
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [busy, setBusy] = useState(false);
  const [, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();

  function handleSubmit(formData: FormData) {
    setError(null);
    setSuccess(false);
    setBusy(true);
    startTransition(async () => {
      try {
        const result = await sendProjectAnnouncement(formData);
        if (!result.success) {
          setError(result.error ?? 'Gagal mengirim pengumuman.');
          return;
        }
        setSuccess(true);
        formRef.current?.reset();
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
        <h2 className="font-heading text-base font-bold text-ink">Buat Pengumuman</h2>
        <p className="text-xs text-muted">Dikirim ke seluruh anggota project (kecuali kamu) lewat email.</p>
      </CardHeader>
      <CardBody>
        <form ref={formRef} action={handleSubmit} className="space-y-4">
          <input type="hidden" name="projectId" value={projectId} />
          <div>
            <Label htmlFor="ann-title">Judul</Label>
            <Input id="ann-title" name="title" placeholder="mis. Rapat koordinasi H-7" required />
          </div>
          <div>
            <Label htmlFor="ann-body">Isi Pengumuman</Label>
            <Textarea id="ann-body" name="body" rows={4} placeholder="Tulis pengumuman di sini..." required />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          {success && <p className="text-sm text-green-600">Pengumuman terkirim ke anggota project.</p>}
          <Button type="submit" disabled={busy}>
            {busy ? 'Mengirim...' : 'Kirim Pengumuman'}
          </Button>
        </form>
      </CardBody>
      {busy && <LoadingOverlay label="Mengirim pengumuman..." />}
    </Card>
  );
}
