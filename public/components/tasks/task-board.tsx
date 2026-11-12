'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { updateTask } from '@/actions/task-actions';
import { divisionColor } from '@/lib/colors';
import { diffDays, shortDate } from '@/lib/dates';
import { useAction } from '@/lib/use-action';
import { cn, initials, PRIORITY_COLOR, PRIORITY_LABEL, STATUS_LABEL } from '@/lib/utils';
import { Badge } from '@/components/ui/card';
import { Input, Select } from '@/components/ui/input';
import type { ProjectRole, TaskPriority, TaskStatus } from '@/types/database';

export interface BoardTask {
  id: string;
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  due_date: string | null;
  start_date: string | null;
  division_id: string | null;
  assignee_id: string | null;
  assigneeName: string | null;
  attachments: number;
}

const COLUMNS: TaskStatus[] = ['todo', 'in_progress', 'review', 'done', 'blocked'];
const COLUMN_ACCENT: Record<TaskStatus, string> = {
  todo: '#A0A8B4', in_progress: '#2B6C8A', review: '#64748B', done: '#3F8F63', blocked: '#C24141',
};

export function TaskBoard({
  projectId, tasks, divisions, myRole, myUserId, myDivisionId, today,
}: {
  projectId: string;
  tasks: BoardTask[];
  divisions: { id: string; name: string; color: string }[];
  myRole: ProjectRole;
  myUserId: string;
  myDivisionId: string | null;
  today: string;
}) {
  const [view, setView] = useState<'board' | 'list'>('board');
  const [q, setQ] = useState('');
  const [div, setDiv] = useState('');
  const [prio, setPrio] = useState('');
  const [mineOnly, setMineOnly] = useState(false);
  const { error, busy, run } = useAction();
  const divMap = useMemo(() => new Map(divisions.map((d) => [d.id, d])), [divisions]);

  const canWrite = (t: BoardTask) =>
    myRole !== 'ketua' && (myRole !== 'member' || t.assignee_id === myUserId || (!!t.division_id && t.division_id === myDivisionId));

  const filtered = tasks.filter(
    (t) =>
      (!q || t.title.toLowerCase().includes(q.toLowerCase())) &&
      (!div || (div === '_none' ? !t.division_id : t.division_id === div)) &&
      (!prio || t.priority === prio) &&
      (!mineOnly || t.assignee_id === myUserId)
  );
  const isOverdue = (t: BoardTask) => t.status !== 'done' && !!t.due_date && t.due_date < today;

  function changeStatus(t: BoardTask, status: string) {
    const fd = new FormData();
    fd.set('taskId', t.id);
    fd.set('status', status);
    void run(() => updateTask(fd));
  }

  const total = tasks.length;
  const done = tasks.filter((t) => t.status === 'done').length;
  const late = tasks.filter(isOverdue).length;
  const dueSoon = tasks.filter((t) => t.status !== 'done' && t.due_date && t.due_date >= today && diffDays(t.due_date, today) <= 3).length;

  return (
    <div>
      {/* Ringkasan */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { label: 'Total task', value: total, tone: 'text-navy' },
          { label: 'Selesai', value: `${done} (${total ? Math.round((done / total) * 100) : 0}%)`, tone: 'text-navy' },
          { label: 'Jatuh tempo ≤ 3 hari', value: dueSoon, tone: 'text-orange' },
          { label: 'Telat', value: late, tone: late ? 'text-red-600' : 'text-muted' },
        ].map((s) => (
          <div key={s.label} className="anim-rise rounded-card border border-gray-100 bg-white px-4 py-3 shadow-sm">
            <p className="text-[11px] font-bold uppercase tracking-wide text-muted">{s.label}</p>
            <p className={cn('font-heading text-xl font-bold', s.tone)}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filter */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari task…" className="w-48" aria-label="Cari task" />
        <Select value={div} onChange={(e) => setDiv(e.target.value)} className="w-40" aria-label="Filter divisi">
          <option value="">Semua divisi</option>
          {divisions.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          <option value="_none">Tanpa divisi</option>
        </Select>
        <Select value={prio} onChange={(e) => setPrio(e.target.value)} className="w-36" aria-label="Filter prioritas">
          <option value="">Semua prioritas</option>
          {(Object.keys(PRIORITY_LABEL) as TaskPriority[]).map((p) => <option key={p} value={p}>{PRIORITY_LABEL[p]}</option>)}
        </Select>
        <label className="flex items-center gap-1.5 text-xs font-semibold text-muted">
          <input type="checkbox" checked={mineOnly} onChange={(e) => setMineOnly(e.target.checked)} /> Task saya
        </label>
        <div className="ml-auto inline-flex rounded-lg bg-gray-100 p-0.5 text-xs font-semibold">
          {(['board', 'list'] as const).map((v) => (
            <button key={v} type="button" onClick={() => setView(v)} className={cn('rounded-md px-3 py-1', view === v ? 'bg-white text-navy shadow-sm' : 'text-muted')}>
              {v === 'board' ? 'Board' : 'Daftar'}
            </button>
          ))}
        </div>
      </div>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      {view === 'board' ? (
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
          {COLUMNS.map((status) => {
            const list = filtered.filter((t) => t.status === status);
            return (
              <div key={status} className="rounded-card bg-white/60 p-2.5" style={{ borderTop: `3px solid ${COLUMN_ACCENT[status]}` }}>
                <h2 className="mb-2.5 flex items-center justify-between px-1 text-xs font-bold uppercase tracking-wide text-muted">
                  {STATUS_LABEL[status]}
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px]">{list.length}</span>
                </h2>
                <div className="space-y-2.5">
                  {list.map((t) => (
                    <TaskCardView key={t.id} t={t} projectId={projectId} today={today} divisionColorKey={t.division_id ? divMap.get(t.division_id)?.color : null}
                      divisionName={t.division_id ? divMap.get(t.division_id)?.name : null} overdue={isOverdue(t)}
                      canWrite={canWrite(t)} busy={busy} onStatus={(s) => changeStatus(t, s)} />
                  ))}
                  {list.length === 0 && <p className="rounded-lg border border-dashed border-gray-200 px-3 py-6 text-center text-xs text-muted">Kosong</p>}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-card border border-gray-100 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-[11px] uppercase tracking-wide text-muted">
              <tr><th className="px-4 py-2">Task</th><th>Divisi</th><th>PIC</th><th>Status</th><th>Prioritas</th><th>Deadline</th><th className="pr-4">📎</th></tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((t) => {
                const d = t.division_id ? divMap.get(t.division_id) : null;
                const c = divisionColor(d?.color);
                return (
                  <tr key={t.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2"><Link href={`/projects/${projectId}/tasks/${t.id}`} className="font-medium text-navy hover:underline">{t.title}</Link></td>
                    <td>{d ? <span className="inline-flex items-center gap-1.5 text-xs"><i className="h-2 w-2 rounded-full" style={{ backgroundColor: c.accent }} />{d.name}</span> : <span className="text-xs text-muted">—</span>}</td>
                    <td className="text-xs text-ink">{t.assigneeName ?? '—'}</td>
                    <td>
                      {canWrite(t) ? (
                        <select value={t.status} disabled={busy} onChange={(e) => changeStatus(t, e.target.value)} className="rounded border border-gray-200 bg-white px-1.5 py-1 text-xs" aria-label={`Status ${t.title}`}>
                          {COLUMNS.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                        </select>
                      ) : <span className="text-xs">{STATUS_LABEL[t.status]}</span>}
                    </td>
                    <td><Badge color={PRIORITY_COLOR[t.priority]}>{PRIORITY_LABEL[t.priority]}</Badge></td>
                    <td className={cn('text-xs', isOverdue(t) ? 'font-semibold text-red-600' : 'text-muted')}>{t.due_date ? shortDate(t.due_date) : '—'}</td>
                    <td className="pr-4 text-xs text-muted">{t.attachments || ''}</td>
                  </tr>
                );
              })}
              {filtered.length === 0 && <tr><td colSpan={7} className="px-4 py-8 text-center text-sm text-muted">Tidak ada task yang cocok dengan filter.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function TaskCardView({ t, projectId, today, divisionColorKey, divisionName, overdue, canWrite, busy, onStatus }: {
  t: BoardTask; projectId: string; today: string; divisionColorKey?: string | null; divisionName?: string | null; overdue: boolean;
  canWrite: boolean; busy: boolean; onStatus: (s: string) => void;
}) {
  const c = divisionColor(divisionColorKey);
  const left = t.due_date ? diffDays(t.due_date, today) : null;
  return (
    <div className="anim-rise rounded-lg border border-gray-100 bg-white p-3 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md" style={{ borderLeft: `4px solid ${c.accent}` }}>
      <Link href={`/projects/${projectId}/tasks/${t.id}`} className="block">
        {divisionName && (
          <span className="mb-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ backgroundColor: c.bg, color: c.text }}>{divisionName}</span>
        )}
        <p className="text-sm font-medium text-ink">{t.title}</p>
        <div className="mt-2 flex items-center justify-between gap-2">
          <Badge color={PRIORITY_COLOR[t.priority]}>{PRIORITY_LABEL[t.priority]}</Badge>
          <span className={cn('text-xs', overdue ? 'font-semibold text-red-600' : left !== null && left <= 2 && t.status !== 'done' ? 'font-semibold text-orange' : 'text-muted')}>
            {t.due_date ? (overdue ? `Telat ${-(left as number)} hr` : shortDate(t.due_date)) : 'Tanpa deadline'}
          </span>
        </div>
        <div className="mt-2 flex items-center justify-between">
          {t.assigneeName ? (
            <span className="flex items-center gap-1.5">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-navy text-[10px] font-bold text-white">{initials(t.assigneeName)}</span>
              <span className="text-xs text-muted">{t.assigneeName}</span>
            </span>
          ) : <span className="text-xs text-muted">Belum ada PIC</span>}
          {t.attachments > 0 && <span className="text-xs text-muted" title="Lampiran">📎 {t.attachments}</span>}
        </div>
      </Link>
      {canWrite && (
        <select value={t.status} disabled={busy} onChange={(e) => onStatus(e.target.value)} aria-label={`Pindahkan ${t.title}`}
          className="mt-2 w-full rounded border border-gray-200 bg-gray-50 px-1.5 py-1 text-xs text-muted">
          {COLUMNS.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
        </select>
      )}
    </div>
  );
}
