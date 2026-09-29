'use client';

import { useState, useTransition } from 'react';
import { updateNotificationPreference } from '@/actions/notification-actions';
import { Button } from '@/components/ui/button';
import { Card, CardBody } from '@/components/ui/card';
import { cn } from '@/lib/utils';
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
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    setSuccess(false);
    startTransition(async () => {
      const result = await updateNotificationPreference(formData);
      if (result.success) setSuccess(true);
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

          {success && <p className="text-sm text-green-600">Preferensi disimpan.</p>}

          <Button type="submit" disabled={isPending}>
            {isPending ? 'Menyimpan...' : 'Simpan Preferensi'}
          </Button>
        </form>
      </CardBody>
    </Card>
  );
}
