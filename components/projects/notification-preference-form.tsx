'use client';

import { useState, useTransition } from 'react';
import { updateNotificationPreference } from '@/actions/notification-actions';
import { Button } from '@/components/ui/button';
import { Card, CardBody } from '@/components/ui/card';
import { LoadingOverlay } from '@/components/ui/loading-overlay';
import { cn, NETWORK_ERROR_MESSAGE } from '@/lib/utils';
import type { NotificationLevel } from '@/types/database';

const OPTIONS: { value: NotificationLevel; label: string; desc: string }[] = [
  { value: 'all', label: 'All updates', desc: 'Terima semua email, termasuk perubahan kecil.' },
  { value: 'important', label: 'Important updates only', desc: 'Hanya status, PIC, dan deadline berubah.' },
  { value: 'off', label: 'Off', desc: 'Tidak menerima email dari project ini sama sekali.' },
];

export function NotificationPreferenceForm({
  projectId,
  currentLevel,
}: {
  projectId: string;
  currentLevel: NotificationLevel;
}) {
  const [selected, setSelected] = useState<NotificationLevel>(currentLevel);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    setSuccess(false);
    setError(null);
    setBusy(true);
    startTransition(async () => {
      try {
        const result = await updateNotificationPreference(formData);
        if (result.success) setSuccess(true);
        else setError(result.error ?? 'Gagal menyimpan preferensi.');
      } catch {
        setError(NETWORK_ERROR_MESSAGE);
      } finally {
        setBusy(false);
      }
    });
  }

  return (
    <Card>
      <CardBody>
        <form action={handleSubmit} className="space-y-3">
          <input type="hidden" name="projectId" value={projectId} />
          <input type="hidden" name="level" value={selected} />
          {OPTIONS.map((opt) => (
            <label
              key={opt.value}
              className={cn(
                'flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition',
                selected === opt.value ? 'border-navy bg-sky/40' : 'border-gray-200 hover:bg-gray-50'
              )}
            >
              <input
                type="radio"
                name="level-radio"
                value={opt.value}
                checked={selected === opt.value}
                onChange={() => setSelected(opt.value)}
                className="mt-1"
              />
              <div>
                <p className="text-sm font-semibold text-ink">{opt.label}</p>
                <p className="text-xs text-muted">{opt.desc}</p>
              </div>
            </label>
          ))}

          {error && <p className="text-sm text-red-600">{error}</p>}
          {success && <p className="text-sm text-green-600">Preferensi disimpan.</p>}

          <Button type="submit" disabled={busy}>
            {busy ? 'Menyimpan...' : 'Simpan Preferensi'}
          </Button>
        </form>
      </CardBody>
      {busy && <LoadingOverlay label="Menyimpan preferensi..." />}
    </Card>
  );
}
