'use client';

import { FormEvent, useRef } from 'react';
import { addBudgetEntry, deleteBudgetEntry, deleteBudgetPlan, saveBudgetPlan } from '@/actions/budget-actions';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Input, Label, Select } from '@/components/ui/input';
import { divisionColor } from '@/lib/colors';
import { shortDate } from '@/lib/dates';
import { useAction } from '@/lib/use-action';
import { calcProgress, cn, formatRupiah } from '@/lib/utils';
import type { BudgetEntryType } from '@/types/database';

export interface PlanRow { id: string; divisionId: string | null; category: string; planned: number }
export interface EntryRow { id: string; divisionId: string | null; type: BudgetEntryType; category: string; amount: number; note: string | null; date: string }
interface Div { id: string; name: string; color: string }

const key = (d: string | null, c: string) => `${d ?? ''}|${c.trim().toLowerCase()}`;

export function BudgetManager({ projectId, plans, entries, divisions, canManage, today }: {
  projectId: string; plans: PlanRow[]; entries: EntryRow[]; divisions: Div[]; canManage: boolean; today: string;
}) {
  const divMap = new Map(divisions.map((d) => [d.id, d]));
  const spentBy = new Map<string, number>();
  for (const e of entries) if (e.type === 'expense') spentBy.set(key(e.divisionId, e.category), (spentBy.get(key(e.divisionId, e.category)) ?? 0) + e.amount);

  const planned = plans.reduce((a, p) => a + p.planned, 0);
  const spent = entries.filter((e) => e.type === 'expense').reduce((a, e) => a + e.amount, 0);
  const income = entries.filter((e) => e.type === 'income').reduce((a, e) => a + e.amount, 0);
  const planKeys = new Set(plans.map((p) => key(p.divisionId, p.category)));
  const unplanned = [...spentBy.entries()].filter(([k]) => !planKeys.has(k)).reduce((a, [, v]) => a + v, 0);

  const planForm = useAction();
  const entryForm = useAction();
  const del = useAction();
  const planRef = useRef<HTMLFormElement>(null);
  const entryRef = useRef<HTMLFormElement>(null);

  const submit = (ref: typeof planRef, hook: typeof planForm, fn: (fd: FormData) => Promise<any>) => (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    void hook.run(() => fn(fd), { onSuccess: () => ref.current?.reset() });
  };
  const remove = (fn: (fd: FormData) => Promise<any>, id: string, msg: string) => {
    if (!window.confirm(msg)) return;
    const fd = new FormData();
    fd.set('id', id); fd.set('projectId', projectId);
    void del.run(() => fn(fd));
  };

  const pct = calcProgress(spent, planned);
  const stats = [
    { label: 'Total rencana', value: formatRupiah(planned), tone: 'text-navy' },
    { label: 'Terpakai', value: formatRupiah(spent), tone: pct > 100 ? 'text-red-600' : 'text-navy', sub: planned ? `${pct}% dari rencana` : undefined },
    { label: 'Pemasukan', value: formatRupiah(income), tone: 'text-navy' },
    { label: 'Saldo kas', value: formatRupiah(income - spent), tone: income - spent < 0 ? 'text-red-600' : 'text-navy', sub: 'pemasukan − pengeluaran' },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="anim-rise rounded-card border border-gray-100 bg-white p-4 shadow-sm">
            <p className="text-[11px] font-bold uppercase tracking-wide text-muted">{s.label}</p>
            <p className={cn('mt-1 font-heading text-xl font-bold', s.tone)}>{s.value}</p>
            {s.sub && <p className="text-xs text-muted">{s.sub}</p>}
          </div>
        ))}
      </div>
      {planned > 0 && (
        <div className="h-2.5 overflow-hidden rounded-full bg-gray-100">
          <div className={cn('anim-grow-x h-full rounded-full', pct > 100 ? 'bg-red-500' : pct > 85 ? 'bg-orange' : 'bg-navy')} style={{ width: `${Math.min(100, pct)}%` }} />
        </div>
      )}
      {unplanned > 0 && (
        <p className="rounded-lg bg-orange-light px-3 py-2 text-xs text-orange">
          Ada pengeluaran {formatRupiah(unplanned)} pada kategori/divisi yang belum punya rencana budget.
        </p>
      )}
      {(planForm.error || entryForm.error || del.error) && <p className="text-sm text-red-600">{planForm.error || entryForm.error || del.error}</p>}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader><h2 className="font-heading text-base font-bold text-ink">Rencana vs Realisasi</h2></CardHeader>
            <CardBody className="space-y-3">
              {plans.length === 0 && <p className="text-sm text-muted">Belum ada rencana budget.</p>}
              {plans.map((p) => {
                const used = spentBy.get(key(p.divisionId, p.category)) ?? 0;
                const pr = p.planned > 0 ? calcProgress(used, p.planned) : used > 0 ? 100 : 0;
                const d = p.divisionId ? divMap.get(p.divisionId) : null;
                const c = divisionColor(d?.color);
                return (
                  <div key={p.id}>
                    <div className="flex items-center justify-between gap-2 text-sm">
                      <span className="flex min-w-0 items-center gap-2">
                        <i className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: d ? c.accent : '#12365E' }} />
                        <span className="truncate font-medium text-ink">{p.category}</span>
                        <span className="text-xs text-muted">{d ? d.name : 'Umum'}</span>
                      </span>
                      <span className="flex shrink-0 items-center gap-2 text-xs text-muted">
                        {formatRupiah(used)} / {formatRupiah(p.planned)}
                        {canManage && <button type="button" onClick={() => remove(deleteBudgetPlan, p.id, `Hapus rencana "${p.category}"?`)} className="text-red-500 hover:text-red-700" aria-label="Hapus rencana">✕</button>}
                      </span>
                    </div>
                    <div className="mt-1 h-2 overflow-hidden rounded-full bg-gray-100">
                      <div className={cn('anim-grow-x h-full rounded-full', pr > 100 ? 'bg-red-500' : '')} style={{ width: `${Math.min(100, pr)}%`, backgroundColor: pr > 100 ? undefined : d ? c.accent : '#12365E' }} />
                    </div>
                  </div>
                );
              })}
            </CardBody>
          </Card>

          <Card>
            <CardHeader><h2 className="font-heading text-base font-bold text-ink">Transaksi</h2></CardHeader>
            <CardBody>
              {entries.length === 0 ? <p className="text-sm text-muted">Belum ada transaksi.</p> : (
                <ul className="divide-y divide-gray-100">
                  {entries.map((e) => (
                    <li key={e.id} className="flex items-center gap-3 py-2 text-sm">
                      <span className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold', e.type === 'income' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700')}>{e.type === 'income' ? '+' : '−'}</span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium text-ink">{e.category}{e.note ? <span className="font-normal text-muted"> · {e.note}</span> : null}</p>
                        <p className="text-xs text-muted">{shortDate(e.date)}{e.divisionId && divMap.get(e.divisionId) ? ` · ${divMap.get(e.divisionId)!.name}` : ''}</p>
                      </div>
                      <span className={cn('shrink-0 font-semibold', e.type === 'income' ? 'text-green-600' : 'text-red-600')}>{e.type === 'income' ? '+' : '−'}{formatRupiah(e.amount)}</span>
                      {canManage && <button type="button" onClick={() => remove(deleteBudgetEntry, e.id, 'Hapus transaksi ini?')} className="text-xs text-red-500 hover:text-red-700" aria-label="Hapus transaksi">✕</button>}
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
        </div>

        <div className="space-y-6">
          {canManage ? (
            <>
              <Card>
                <CardHeader><h2 className="font-heading text-base font-bold text-ink">Catat Transaksi</h2></CardHeader>
                <CardBody>
                  <form ref={entryRef} onSubmit={submit(entryRef, entryForm, addBudgetEntry)} className="space-y-3">
                    <input type="hidden" name="projectId" value={projectId} />
                    <div className="grid grid-cols-2 gap-3">
                      <div><Label htmlFor="e-type">Jenis</Label>
                        <Select id="e-type" name="entryType" defaultValue="expense"><option value="expense">Pengeluaran</option><option value="income">Pemasukan</option></Select></div>
                      <div><Label htmlFor="e-date">Tanggal</Label><Input id="e-date" name="entryDate" type="date" defaultValue={today} required /></div>
                    </div>
                    <div><Label htmlFor="e-cat">Kategori</Label><Input id="e-cat" name="category" placeholder="mis. Konsumsi" required minLength={2} maxLength={60} /></div>
                    <div><Label htmlFor="e-div">Divisi</Label>
                      <Select id="e-div" name="divisionId" defaultValue=""><option value="">Umum</option>{divisions.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</Select></div>
                    <div><Label htmlFor="e-amt">Nominal (Rp)</Label><Input id="e-amt" name="amount" type="number" min={1} step={1} required /></div>
                    <div><Label htmlFor="e-note">Catatan</Label><Input id="e-note" name="note" maxLength={300} /></div>
                    <Button type="submit" size="sm" className="w-full" disabled={entryForm.busy}>{entryForm.busy ? 'Menyimpan...' : 'Simpan Transaksi'}</Button>
                  </form>
                </CardBody>
              </Card>
              <Card>
                <CardHeader><h2 className="font-heading text-base font-bold text-ink">Tambah Rencana</h2></CardHeader>
                <CardBody>
                  <form ref={planRef} onSubmit={submit(planRef, planForm, saveBudgetPlan)} className="space-y-3">
                    <input type="hidden" name="projectId" value={projectId} />
                    <div><Label htmlFor="p-cat">Kategori</Label><Input id="p-cat" name="category" placeholder="mis. Konsumsi" required minLength={2} maxLength={60} /></div>
                    <div><Label htmlFor="p-div">Divisi</Label>
                      <Select id="p-div" name="divisionId" defaultValue=""><option value="">Umum</option>{divisions.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</Select></div>
                    <div><Label htmlFor="p-amt">Rencana (Rp)</Label><Input id="p-amt" name="plannedAmount" type="number" min={0} step={1} required /></div>
                    <Button type="submit" size="sm" className="w-full" disabled={planForm.busy}>{planForm.busy ? 'Menyimpan...' : 'Simpan Rencana'}</Button>
                  </form>
                </CardBody>
              </Card>
            </>
          ) : (
            <Card><CardBody className="text-sm text-muted">Kamu melihat budget sebagai viewer. Hanya Project Manager, Wakil PM, dan Bendahara yang dapat mengubahnya.</CardBody></Card>
          )}
        </div>
      </div>
    </div>
  );
}
