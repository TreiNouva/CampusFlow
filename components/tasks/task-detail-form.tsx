'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { updateTask } from '@/actions/task-actions';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Input, Label, Select } from '@/components/ui/input';
import { LoadingOverlay } from '@/components/ui/loading-overlay';
import { NETWORK_ERROR_MESSAGE } from '@/lib/utils';
import type { ProjectRole, Task } from '@/types/database';

interface Member {
  id: string;
  full_name: string;
  role: ProjectRole;
  division_id: string | null;
}

export function TaskDetailForm({
  task, members, divisions, myRole,
}: {
  task: Task;
  members: Member[];
  divisions: { id: string; name: string }[];
  myRole: ProjectRole;
}) {
  const isMember = myRole === 'member';
  const [divisionId, setDivisionId] = useState(task.division_id ?? '');
  const assignable = members.filter((m) => m.role !== 'member' || (!!divisionId && m.division_id === divisionId));
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [busy, setBusy] = useState(false);
  const [, startTransition] = useTransition();
  const router = useRouter();

  function handleSubmit(formData: FormData) {
    setError(null);
    setSuccess(false);
    setBusy(true);
    formData.set('taskId', task.id);
    startTransition(async () => {
      try {
        const result = await updateTask(formData);
        if (!result.success) {
          setError(result.error ?? 'Gagal memperbarui task.');
          return;
        }
        setSuccess(true);
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
              <option value="review">Review</option>
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
            <Label htmlFor="divisionId">Divisi</Label>
            {isMember ? (
              <Select id="divisionId" value={task.division_id ?? ''} disabled>
                <option value="">Tanpa divisi</option>
                {divisions.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </Select>
            ) : (
              <Select id="divisionId" name="divisionId" value={divisionId} onChange={(e) => setDivisionId(e.target.value)}>
                <option value="">Tanpa divisi (umum)</option>
                {divisions.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </Select>
            )}
          </div>
          <div>
            <Label htmlFor="assigneeId">PIC</Label>
            <Select id="assigneeId" name="assigneeId" defaultValue={task.assignee_id ?? ''}>
              <option value="">Belum ditentukan</option>
              {assignable.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.full_name}
                </option>
              ))}
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="startDate">Mulai</Label>
              <Input id="startDate" name="startDate" type="date" defaultValue={task.start_date ?? ''} />
            </div>
            <div>
              <Label htmlFor="dueDate">Deadline</Label>
              <Input id="dueDate" name="dueDate" type="date" defaultValue={task.due_date ?? ''} />
            </div>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
          {success && <p className="text-sm text-green-600">Tersimpan. Email ke anggota terkait telah diproses.</p>}

          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? 'Menyimpan...' : 'Simpan Perubahan'}
          </Button>
        </form>
      </CardBody>
      {busy && <LoadingOverlay label="Menyimpan perubahan..." />}
    </Card>
  );
}
