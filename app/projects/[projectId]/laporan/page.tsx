import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getProjectContext } from '@/lib/project-context';
import { canViewBudgetRole, memberTitle } from '@/lib/roles';
import { STATUS_LABEL, formatDate, formatRupiah } from '@/lib/utils';
import type { ProjectRole, TaskStatus } from '@/types/database';
import { PrintButton } from './print-button';

export const metadata: Metadata = { title: 'Laporan project · CampusFlow' };

/**
 * Laporan ringkas project (bahan LPJ): info, panitia, capaian task, acara & kehadiran, dan rekap dana.
 * Dibuka di browser lalu "Cetak / Simpan PDF". Hanya untuk pengelola project.
 */
export default async function ProjectReportPage(props: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await props.params;
  const ctx = await getProjectContext(projectId);
  if (!ctx.canManage) notFound();
  const showBudget = canViewBudgetRole(ctx.myRole);
  const supabase = await createClient();

  const [{ data: members }, { data: tasks }, { data: events }, { data: milestones }, budget] = await Promise.all([
    supabase.from('project_members').select('role, profile:profiles(full_name), division:project_divisions(name)').eq('project_id', projectId),
    supabase.from('tasks').select('title, status, due_date, division:project_divisions(name)').eq('project_id', projectId).order('due_date', { ascending: true, nullsFirst: false }),
    supabase.from('project_events').select('id, title, location, start_at, event_attendance(status)').eq('project_id', projectId).order('start_at'),
    supabase.from('project_milestones').select('title, due_date').eq('project_id', projectId).order('due_date'),
    showBudget
      ? Promise.all([
          supabase.from('budget_entries').select('entry_type, category, amount').eq('project_id', projectId),
          supabase.from('budget_plans').select('category, planned_amount').eq('project_id', projectId),
        ])
      : Promise.resolve(null),
  ]);

  const p = ctx.project;
  const taskList = (tasks ?? []) as any[];
  const byStatus = taskList.reduce<Record<string, number>>((acc, t) => { acc[t.status] = (acc[t.status] ?? 0) + 1; return acc; }, {});
  const done = byStatus.done ?? 0;
  const pct = taskList.length ? Math.round((done / taskList.length) * 100) : 0;

  const entries = ((budget?.[0].data ?? []) as any[]);
  const plans = ((budget?.[1].data ?? []) as any[]);
  const income = entries.filter((e) => e.entry_type === 'income').reduce((s, e) => s + Number(e.amount), 0);
  const expense = entries.filter((e) => e.entry_type === 'expense').reduce((s, e) => s + Number(e.amount), 0);
  const categories = Array.from(new Set([...plans.map((x) => x.category), ...entries.filter((e) => e.entry_type === 'expense').map((e) => e.category)]));

  const today = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
  const th = 'border-b border-line py-2 pr-3 text-left text-xs font-semibold uppercase tracking-wide text-muted';
  const td = 'border-b border-line py-2 pr-3 align-top';

  return (
    <main className="mx-auto max-w-4xl px-4 py-6 text-sm text-ink sm:px-6 lg:px-8 print:max-w-none print:px-0 print:py-0">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <p className="text-muted">Bahan LPJ. Tekan tombol di kanan, lalu pilih <b>Simpan sebagai PDF</b>.</p>
        <PrintButton />
      </div>

      <article className="rounded-card border border-line bg-surface p-6 sm:p-8 print:border-0 print:p-0">
        <header className="border-b-2 border-navy pb-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-teal">Laporan Pelaksanaan Kegiatan</p>
          <h1 className="mt-1 font-heading text-2xl font-bold">{p.name}</h1>
          <p className="mt-1 text-muted">
            {p.organization?.name ?? ''}{p.start_date ? ` · ${formatDate(p.start_date)} – ${formatDate(p.end_date)}` : ''}
          </p>
          {p.description && <p className="mt-3 whitespace-pre-line">{p.description}</p>}
        </header>

        <section className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ['Panitia', `${members?.length ?? 0} orang`],
            ['Task selesai', `${done}/${taskList.length} (${pct}%)`],
            ['Acara', `${events?.length ?? 0}`],
            ...(showBudget ? [['Saldo', formatRupiah(income - expense)]] : [['Milestone', `${milestones?.length ?? 0}`]]),
          ].map(([k, v]) => (
            <div key={k} className="rounded-lg border border-line px-3 py-2">
              <p className="text-xs text-muted">{k}</p>
              <p className="font-heading text-lg font-bold">{v}</p>
            </div>
          ))}
        </section>

        <section className="mt-8 break-inside-avoid">
          <h2 className="font-heading text-lg font-bold">1. Susunan panitia</h2>
          <table className="mt-2 w-full">
            <thead><tr><th className={th}>Nama</th><th className={th}>Jabatan</th></tr></thead>
            <tbody>
              {((members ?? []) as any[])
                .sort((a, b) => String(a.role).localeCompare(String(b.role)))
                .map((m, i) => (
                  <tr key={i}><td className={td}>{m.profile?.full_name || 'Anggota'}</td><td className={td}>{memberTitle(m.role as ProjectRole, m.division?.name)}</td></tr>
                ))}
            </tbody>
          </table>
        </section>

        <section className="mt-8">
          <h2 className="font-heading text-lg font-bold">2. Capaian pekerjaan</h2>
          <p className="mt-1 text-muted">
            {Object.entries(byStatus).map(([s, n]) => `${STATUS_LABEL[s as TaskStatus] ?? s}: ${n}`).join(' · ') || 'Belum ada task.'}
          </p>
          {taskList.length > 0 && (
            <table className="mt-2 w-full">
              <thead><tr><th className={th}>Task</th><th className={th}>Divisi</th><th className={th}>Deadline</th><th className={th}>Status</th></tr></thead>
              <tbody>
                {taskList.map((t, i) => (
                  <tr key={i} className="break-inside-avoid">
                    <td className={td}>{t.title}</td><td className={td}>{t.division?.name ?? 'Global'}</td>
                    <td className={td}>{formatDate(t.due_date)}</td><td className={td}>{STATUS_LABEL[t.status as TaskStatus] ?? t.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className="mt-8 break-inside-avoid">
          <h2 className="font-heading text-lg font-bold">3. Acara & kehadiran</h2>
          {(events ?? []).length === 0 ? <p className="mt-1 text-muted">Belum ada acara.</p> : (
            <table className="mt-2 w-full">
              <thead><tr><th className={th}>Acara</th><th className={th}>Waktu</th><th className={th}>Tempat</th><th className={th}>Hadir</th></tr></thead>
              <tbody>
                {((events ?? []) as any[]).map((e) => {
                  const att = (e.event_attendance ?? []) as { status: string }[];
                  return (
                    <tr key={e.id}>
                      <td className={td}>{e.title}</td>
                      <td className={td}>{new Date(e.start_at).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Jakarta' })}</td>
                      <td className={td}>{e.location ?? '-'}</td>
                      <td className={td}>{att.length ? `${att.filter((a) => a.status === 'present').length}/${att.length}` : '-'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
          {(milestones ?? []).length > 0 && (
            <p className="mt-3 text-muted">Milestone: {((milestones ?? []) as any[]).map((m) => `${m.title} (${formatDate(m.due_date)})`).join(' · ')}</p>
          )}
        </section>

        {showBudget && (
          <section className="mt-8 break-inside-avoid">
            <h2 className="font-heading text-lg font-bold">4. Laporan keuangan</h2>
            <table className="mt-2 w-full">
              <thead><tr><th className={th}>Kategori pengeluaran</th><th className={`${th} text-right`}>Rencana</th><th className={`${th} text-right`}>Realisasi</th></tr></thead>
              <tbody>
                {categories.map((c) => (
                  <tr key={c}>
                    <td className={td}>{c}</td>
                    <td className={`${td} text-right`}>{formatRupiah(plans.filter((x) => x.category === c).reduce((s, x) => s + Number(x.planned_amount), 0))}</td>
                    <td className={`${td} text-right`}>{formatRupiah(entries.filter((e) => e.entry_type === 'expense' && e.category === c).reduce((s, e) => s + Number(e.amount), 0))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <dl className="mt-3 grid max-w-xs grid-cols-2 gap-y-1">
              <dt className="text-muted">Pemasukan</dt><dd className="text-right font-medium">{formatRupiah(income)}</dd>
              <dt className="text-muted">Pengeluaran</dt><dd className="text-right font-medium">{formatRupiah(expense)}</dd>
              <dt className="font-semibold">Saldo akhir</dt><dd className="text-right font-bold">{formatRupiah(income - expense)}</dd>
            </dl>
          </section>
        )}

        <footer className="mt-10 text-xs text-muted">Dibuat dengan CampusFlow pada {today}.</footer>
      </article>
    </main>
  );
}
