'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createTask } from '@/actions/task-actions';
import { Button } from '@/components/ui/button';
import { Input, Label, Select, Textarea } from '@/components/ui/input';

interface Member {
  id: string;
  full_name: string;
}

export function CreateTaskForm({ projectId, members }: { projectId: string; members: Member[] }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await createTask(formData);
      if (!result.success) {
        setError(result.error ?? 'Gagal membuat task.');
        return;
      }
      formRef.current?.reset();
      setOpen(false);
      router.refresh();
    });
  }

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)} size="sm">
        + Task Baru
      </Button>
    );
  }

  return (
    <div className="absolute right-6 z-20 mt-2 w-80 rounded-card border border-gray-200 bg-white p-4 shadow-lg">
      <form ref={formRef} action={handleSubmit} className="space-y-3">
        <input type="hidden" name="projectId" value={projectId} />
        <div>
          <Label htmlFor="title">Judul Task</Label>
          <Input id="title" name="title" placeholder="mis. Booking Venue" required />
        </div>
        <div>
          <Label htmlFor="description">Deskripsi</Label>
          <Textarea id="description" name="description" rows={2} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label htmlFor="assigneeId">PIC</Label>
            <Select id="assigneeId" name="assigneeId" defaultValue="">
              <option value="">Belum ditentukan</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.full_name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="priority">Priority</Label>
            <Select id="priority" name="priority" defaultValue="medium">
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </Select>
          </div>
        </div>
        <div>
          <Label htmlFor="dueDate">Deadline</Label>
          <Input id="dueDate" name="dueDate" type="date" />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex gap-2">
          <Button type="submit" size="sm" className="flex-1" disabled={isPending}>
            {isPending ? 'Menyimpan...' : 'Simpan'}
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
            Batal
          </Button>
        </div>
      </form>
    </div>
  );
}
