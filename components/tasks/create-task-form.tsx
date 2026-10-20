'use client';

import { FormEvent, useState } from 'react';
import { createTask } from '@/actions/task-actions';
import { Button } from '@/components/ui/button';
import { Input, Label, Select, Textarea } from '@/components/ui/input';
import { LoadingOverlay } from '@/components/ui/loading-overlay';
import { Modal } from '@/components/ui/modal';
import { useAction } from '@/lib/use-action';
import type { ProjectRole } from '@/types/database';

interface Member { id: string; full_name: string; role: ProjectRole; division_id: string | null }

/**
 * Form task baru (modal). Member hanya bisa membuat task untuk divisinya sendiri (dipaksa di form, server, dan database),
 * dan hanya bisa menugaskan sesama anggota divisi yang sama.
 */
export function CreateTaskForm({
  projectId, members, divisions, myRole, myDivisionId, defaultStart,
}: {
  projectId: string;
  members: Member[];
  divisions: { id: string; name: string }[];
  myRole: ProjectRole;
  myDivisionId: string | null;
  defaultStart: string;
}) {
  const [open, setOpen] = useState(false);
  const { error, setError, busy, run } = useAction();
  const isMember = myRole === 'member';
  const [divisionId, setDivisionId] = useState<string>(isMember ? myDivisionId ?? '' : '');

  // Member biasa harus satu divisi dengan task; selain itu bebas
  const assignable = members.filter((m) => m.role !== 'member' || (!!divisionId && m.division_id === divisionId));

  function close() {
    if (busy) return;
    setError(null);
    setOpen(false);
  }
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    void run(() => createTask(fd), { onSuccess: () => setOpen(false) });
  }

  if (isMember && !myDivisionId) {
    return <span className="rounded-lg bg-orange-light px-3 py-1.5 text-xs text-orange">Kamu belum masuk divisi, jadi belum bisa membuat task.</span>;
  }

  return (
    <>
      <Button onClick={() => setOpen(true)} size="sm">+ Task Baru</Button>
      {open && (
        <Modal title="Task Baru" onClose={close} busy={busy}>
          <form onSubmit={submit} className="space-y-3">
            <input type="hidden" name="projectId" value={projectId} />
            <div>
              <Label htmlFor="title">Judul Task</Label>
              <Input id="title" name="title" placeholder="mis. Booking Venue" required autoFocus />
            </div>
            <div>
              <Label htmlFor="description">Deskripsi</Label>
              <Textarea id="description" name="description" rows={3} />
            </div>
            <div>
              <Label htmlFor="divisionId">Divisi</Label>
              {isMember ? (
                <>
                  <Select id="divisionId" value={myDivisionId ?? ''} disabled>
                    {divisions.filter((d) => d.id === myDivisionId).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </Select>
                  <p className="mt-1 text-[11px] text-muted">Member hanya dapat membuat task untuk divisinya sendiri.</p>
                </>
              ) : (
                <Select id="divisionId" name="divisionId" value={divisionId} onChange={(e) => setDivisionId(e.target.value)}>
                  <option value="">Tanpa divisi (umum)</option>
                  {divisions.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </Select>
              )}
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="assigneeId">PIC</Label>
                <Select id="assigneeId" name="assigneeId" defaultValue="">
                  <option value="">Belum ditentukan</option>
                  {assignable.map((m) => <option key={m.id} value={m.id}>{m.full_name}</option>)}
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
              <div>
                <Label htmlFor="startDate">Mulai</Label>
                <Input id="startDate" name="startDate" type="date" defaultValue={defaultStart} />
              </div>
              <div>
                <Label htmlFor="dueDate">Deadline</Label>
                <Input id="dueDate" name="dueDate" type="date" />
              </div>
            </div>
            <p className="text-[11px] text-muted">Tanggal mulai & deadline dipakai untuk menampilkan task di kalender project.</p>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex gap-2 pt-1">
              <Button type="submit" className="flex-1" disabled={busy}>{busy ? 'Menyimpan...' : 'Simpan'}</Button>
              <Button type="button" variant="ghost" onClick={close} disabled={busy}>Batal</Button>
            </div>
          </form>
        </Modal>
      )}
      {busy && <LoadingOverlay label="Menyimpan task..." />}
    </>
  );
}
