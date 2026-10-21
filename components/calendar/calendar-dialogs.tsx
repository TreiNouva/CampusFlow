'use client';

import { FormEvent, useState } from 'react';
import { createEvent, deleteEvent, updateEvent, setAttendance, checkInEvent } from '@/actions/event-actions';
import { createMilestone, deleteMilestone } from '@/actions/milestone-actions';
import { Button } from '@/components/ui/button';
import { Input, Label, Select, Textarea } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { useAction } from '@/lib/use-action';
import { dayOfTimestamp, formatTime } from '@/lib/dates';
import { canManageScoped } from '@/lib/roles';
import { clampDay, dateBounds, periodError, periodLabel, type ProjectPeriod } from '@/lib/period';
import type { AttendanceStatus, ProjectRole } from '@/types/database';

export interface EventRecord {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  start_at: string;
  end_at: string;
  all_day: boolean;
  division_id: string | null;
}

interface Division { id: string; name: string }

export function EventDialog({
  projectId, divisions, myRole, myDivisionId, initialDay, event, onClose, period,
}: {
  projectId: string;
  period?: ProjectPeriod;
  divisions: Division[];
  myRole: ProjectRole;
  myDivisionId: string | null;
  initialDay: string;
  event?: EventRecord;
  onClose: () => void;
}) {
  const { error, setError, busy, run } = useAction();
  const [allDay, setAllDay] = useState(event?.all_day ?? false);
  const canGlobal = canManageScoped(myRole, myDivisionId, null);
  const allowed = divisions.filter((d) => canManageScoped(myRole, myDivisionId, d.id));
  const day0 = period ? clampDay(initialDay, period) : initialDay;
  const startDay = event ? dayOfTimestamp(event.start_at) : day0;
  const endDay = event ? dayOfTimestamp(event.end_at) : day0;
  const bounds = dateBounds(period);
  const hint = periodLabel(period);

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.set('allDay', allDay ? 'true' : 'false');
    if (period) {
      const err = periodError(period, String(fd.get('startDate') ?? ''), 'Acara') ?? periodError(period, String(fd.get('endDate') ?? ''), 'Acara');
      if (err) { setError(err); return; }
    }
    void run(() => (event ? updateEvent(fd) : createEvent(fd)), { onSuccess: onClose });
  }

  function remove() {
    if (!event || !window.confirm('Hapus acara ini?')) return;
    const fd = new FormData();
    fd.set('projectId', projectId);
    fd.set('eventId', event.id);
    void run(() => deleteEvent(fd), { onSuccess: onClose });
  }

  return (
    <Modal title={event ? 'Edit Acara' : 'Acara Baru'} onClose={onClose} busy={busy}>
      <form onSubmit={submit} className="space-y-3">
        <input type="hidden" name="projectId" value={projectId} />
        {event && <input type="hidden" name="eventId" value={event.id} />}
        <div>
          <Label htmlFor="ev-title">Judul</Label>
          <Input id="ev-title" name="title" defaultValue={event?.title} required minLength={2} autoFocus />
        </div>
        <div>
          <Label htmlFor="ev-scope">Untuk</Label>
          <Select id="ev-scope" name="divisionId" defaultValue={event?.division_id ?? (canGlobal ? '' : allowed[0]?.id ?? '')}>
            {(canGlobal || !event?.division_id) && canGlobal && <option value="">Global (semua anggota)</option>}
            {allowed.map((d) => (
              <option key={d.id} value={d.id}>Divisi {d.name}</option>
            ))}
          </Select>
        </div>
        <label className="flex items-center gap-2 text-sm text-ink">
          <input type="checkbox" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} />
          Sepanjang hari
        </label>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="ev-sd">Mulai</Label>
            <Input id="ev-sd" name="startDate" type="date" defaultValue={startDay} required {...bounds} />
          </div>
          <div>
            <Label htmlFor="ev-ed">Selesai</Label>
            <Input id="ev-ed" name="endDate" type="date" defaultValue={endDay} required {...bounds} />
          </div>
          {!allDay && (
            <>
              <div>
                <Label htmlFor="ev-st">Jam mulai (WIB)</Label>
                <Input id="ev-st" name="startTime" type="time" defaultValue={event ? formatTime(event.start_at) : '09:00'} />
              </div>
              <div>
                <Label htmlFor="ev-et">Jam selesai (WIB)</Label>
                <Input id="ev-et" name="endTime" type="time" defaultValue={event ? formatTime(event.end_at) : '10:00'} />
              </div>
            </>
          )}
        </div>
        {hint && <p className="-mt-1 text-xs text-muted">{hint}</p>}
        <div>
          <Label htmlFor="ev-loc">Lokasi (opsional)</Label>
          <Input id="ev-loc" name="location" defaultValue={event?.location ?? ''} maxLength={150} />
        </div>
        <div>
          <Label htmlFor="ev-desc">Catatan (opsional)</Label>
          <Textarea id="ev-desc" name="description" rows={2} defaultValue={event?.description ?? ''} />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex gap-2 pt-1">
          <Button type="submit" className="flex-1" disabled={busy}>{busy ? 'Menyimpan...' : 'Simpan'}</Button>
          {event && <Button type="button" variant="danger" onClick={remove} disabled={busy}>Hapus</Button>}
          <Button type="button" variant="ghost" onClick={onClose} disabled={busy}>Batal</Button>
        </div>
      </form>
    </Modal>
  );
}

export function MilestoneDialog({ projectId, initialDay, onClose, period }: { projectId: string; initialDay: string; onClose: () => void; period?: ProjectPeriod }) {
  const { error, setError, busy, run } = useAction();
  const hint = periodLabel(period);
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const err = period ? periodError(period, String(fd.get('dueDate') ?? ''), 'Tanggal milestone') : null;
    if (err) { setError(err); return; }
    void run(() => createMilestone(fd), { onSuccess: onClose });
  }
  return (
    <Modal title="Milestone Baru" onClose={onClose} busy={busy}>
      <form onSubmit={submit} className="space-y-3">
        <input type="hidden" name="projectId" value={projectId} />
        <div>
          <Label htmlFor="ms-title">Judul</Label>
          <Input id="ms-title" name="title" placeholder="mis. Proposal disetujui" required minLength={2} autoFocus />
        </div>
        <div>
          <Label htmlFor="ms-date">Tanggal</Label>
          <Input id="ms-date" name="dueDate" type="date" defaultValue={period ? clampDay(initialDay, period) : initialDay} required {...dateBounds(period)} />
          {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex gap-2">
          <Button type="submit" className="flex-1" disabled={busy}>{busy ? 'Menyimpan...' : 'Simpan'}</Button>
          <Button type="button" variant="ghost" onClick={onClose} disabled={busy}>Batal</Button>
        </div>
      </form>
    </Modal>
  );
}

export function DeleteMilestoneButton({ projectId, milestoneId, onDone }: { projectId: string; milestoneId: string; onDone: () => void }) {
  const { error, busy, run } = useAction();
  function remove() {
    if (!window.confirm('Hapus milestone ini?')) return;
    const fd = new FormData();
    fd.set('projectId', projectId);
    fd.set('milestoneId', milestoneId);
    void run(() => deleteMilestone(fd), { onSuccess: onDone });
  }
  return (
    <>
      <Button type="button" size="sm" variant="danger" onClick={remove} disabled={busy}>Hapus milestone</Button>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </>
  );
}

export interface Participant { userId: string; name: string; status: AttendanceStatus | null; checkedInAt: string | null }

const STATUS_LABEL: Record<AttendanceStatus, string> = { present: 'Hadir', excused: 'Izin', absent: 'Tidak hadir' };

/** Panel kehadiran: peserta check-in sendiri; pengelola acara bisa mencatat kehadiran siapa pun. */
export function AttendancePanel({
  projectId, eventId, participants, canManage, canCheckIn, myUserId, startAt,
}: {
  projectId: string; eventId: string; participants: Participant[]; canManage: boolean; canCheckIn: boolean; myUserId: string; startAt: string;
}) {
  const { error, busy, run } = useAction();
  const mine = participants.find((p) => p.userId === myUserId);
  const now = Date.now();
  const start = new Date(startAt).getTime();
  const windowOpen = now >= start - 2 * 3600_000 && now <= start + 12 * 3600_000;

  function mark(userId: string, status: AttendanceStatus) {
    const fd = new FormData();
    fd.set('projectId', projectId); fd.set('eventId', eventId); fd.set('userId', userId); fd.set('status', status);
    void run(() => setAttendance(fd));
  }
  function checkIn() {
    const fd = new FormData();
    fd.set('projectId', projectId); fd.set('eventId', eventId);
    void run(() => checkInEvent(fd));
  }

  const present = participants.filter((p) => p.status === 'present').length;
  return (
    <div className="mt-3 border-t border-gray-100 pt-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold uppercase tracking-wide text-muted">Kehadiran · {present}/{participants.length}</p>
        {canCheckIn && mine?.status !== 'present' && (
          <Button type="button" size="sm" onClick={checkIn} disabled={busy || !windowOpen} title={windowOpen ? '' : 'Check-in dibuka 2 jam sebelum acara'}>
            Check-in
          </Button>
        )}
        {canCheckIn && mine?.status === 'present' && <span className="text-xs font-semibold text-green-700">✓ Kamu sudah check-in</span>}
      </div>
      <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto">
        {participants.map((p) => (
          <li key={p.userId} className="flex items-center justify-between gap-2 text-xs">
            <span className="truncate text-ink">{p.name}</span>
            {canManage ? (
              <select
                aria-label={`Kehadiran ${p.name}`}
                value={p.status ?? ''}
                disabled={busy}
                onChange={(e) => e.target.value && mark(p.userId, e.target.value as AttendanceStatus)}
                className="rounded border border-gray-200 bg-white px-1.5 py-0.5"
              >
                <option value="">—</option>
                {(Object.keys(STATUS_LABEL) as AttendanceStatus[]).map((s) => (
                  <option key={s} value={s}>{STATUS_LABEL[s]}</option>
                ))}
              </select>
            ) : (
              <span className="text-muted">{p.status ? STATUS_LABEL[p.status] : '—'}</span>
            )}
          </li>
        ))}
      </ul>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
