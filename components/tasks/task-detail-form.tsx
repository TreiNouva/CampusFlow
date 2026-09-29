'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { updateTask } from '@/actions/task-actions';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Input, Label, Select } from '@/components/ui/input';
import type { Task } from '@/types/database';

interface Member {
  id: string;
  full_name: string;
}

export function TaskDetailForm({ task, members }: { task: Task; members: Member[] }) {
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleSubmit(formData: FormData) {
    setError(null);
    setSuccess(false);
    formData.set('taskId', task.id);
    startTransition(async () => {
      const result = await updateTask(formData);
      if (!result.success) {
        setError(result.error ?? 'Gagal memperbarui task.');
        return;
      }
      setSuccess(true);
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader>
        <h2 className="font-heading text-base font-bold text-ink">Kelola Task</h2>
        <p className="text-xs text-muted">Perubahan di sini akan mengirim email ke anggota terkait.</p>
      </CardHeader>
      <CardBody>
        <form action={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="status">Status</Label>
            <Select id="status" name="status" defaultValue={task.status}>
              <option value="todo">To Do</option>
              <option value="in_progress">In Progress</option>
              <option value="done">Done</option>
              <option value="blocked">Blocked</option>
            </Select>
          </div>
          <div>
            <Label htmlFor="priority">Priority</Label>
            <Select id="priority" name="priority" defaultValue={task.priority}>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </Select>
          </div>
          <div>
            <Label htmlFor="assigneeId">PIC</Label>
            <Select id="assigneeId" name="assigneeId" defaultValue={task.assignee_id ?? ''}>
              <option value="">Belum ditentukan</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.full_name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="dueDate">Deadline</Label>
            <Input id="dueDate" name="dueDate" type="date" defaultValue={task.due_date ?? ''} />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
          {success && <p className="text-sm text-green-600">Tersimpan. Email ke anggota terkait telah dikirim.</p>}

          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? 'Menyimpan...' : 'Simpan Perubahan'}
          </Button>
        </form>
      </CardBody>
    </Card>
  );
}
