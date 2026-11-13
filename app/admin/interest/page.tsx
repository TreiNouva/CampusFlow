import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/layout/page-header';
import { KpiCard } from '@/components/dashboard/kpi-card';
import { isTeamAdmin } from '@/lib/admin-access';
import { createAdminClient } from '@/lib/supabase/admin';
import { rupiah } from '@/lib/plans';

export const metadata: Metadata = { title: 'Rekap interest check · CampusFlow' };
export const dynamic = 'force-dynamic';

const PLAN_LABEL: Record<string, string> = { free: 'Gratis', organization: 'Organisasi', campus: 'Kampus', belum_tahu: 'Belum tahu' };
const TYPE_LABEL: Record<string, string> = { bem: 'BEM', himpunan: 'Himpunan', ukm: 'UKM', kepanitiaan: 'Kepanitiaan', lainnya: 'Lainnya' };
const SOURCE_LABEL: Record<string, string> = { web: 'Halaman depan', festival: 'Booth festival', app: 'Dalam aplikasi' };

function Breakdown({ title, rows }: { title: string; rows: [string, number][] }) {
  const max = Math.max(1, ...rows.map(([, n]) => n));
  return (
    <div className="rounded-card border border-line bg-surface p-5">
      <h2 className="font-heading text-base font-bold text-ink">{title}</h2>
      <ul className="mt-3 space-y-2.5">
        {rows.map(([label, n]) => (
          <li key={label}>
            <div className="flex justify-between text-sm"><span className="text-gray-600">{label}</span><span className="font-semibold text-ink">{n}</span></div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-gray-100"><div className="h-full rounded-full bg-brand" style={{ width: `${(n / max) * 100}%` }} /></div>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Rekap interest check untuk tim (hanya email di ADMIN_EMAILS). */
export default async function InterestRecapPage() {
  if (!(await isTeamAdmin())) notFound();
  const admin = createAdminClient();
  const [{ data: rows, error }, { data: payments }, { count: orgCount }] = await Promise.all([
    admin.from('interest_signups').select('*').order('created_at', { ascending: false }).limit(2000),
    admin.from('billing_payments').select('amount, created_at'),
    admin.from('organizations').select('id', { count: 'exact', head: true }),
  ]);
  const list = (rows ?? []) as any[];
  const todayWib = new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);
  const isToday = (iso: string) => new Date(new Date(iso).getTime() + 7 * 3600_000).toISOString().slice(0, 10) === todayWib;
  const count = <T extends string>(key: (r: any) => T | null | undefined, labels: Record<string, string>) => {
    const m = new Map<string, number>();
    for (const r of list) { const k = key(r) ?? ''; const l = labels[k] ?? 'Tidak diisi'; m.set(l, (m.get(l) ?? 0) + 1); }
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  };
  const willing = list.filter((r) => r.willing_to_pay === true).length;
  const answered = list.filter((r) => r.willing_to_pay !== null).length;
  const paidDemo = (payments ?? []) as any[];

  return (
    <AppShell>
      <main className="mx-auto max-w-6xl space-y-4 px-4 py-6 sm:px-6 lg:px-8">
        <PageHeader
          title="Rekap interest check"
          description="Data dari halaman depan, booth festival (/minat), dan dalam aplikasi. Hanya terlihat oleh tim."
          actions={<>
            <Link href="/minat" target="_blank" className="rounded-lg border border-line bg-surface px-4 py-2 text-sm font-semibold text-ink hover:bg-gray-50">Buka mode booth</Link>
            <Link href="/minat/poster" target="_blank" className="rounded-lg border border-line bg-surface px-4 py-2 text-sm font-semibold text-ink hover:bg-gray-50">Poster QR</Link>
            <a href="/admin/interest/export" className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark">Unduh CSV</a>
          </>}
        />
        {error && <p className="rounded-card border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">Gagal membaca data. Pastikan migrasi 0005 sudah dijalankan dan SUPABASE_SERVICE_ROLE_KEY terisi.</p>}

        <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <KpiCard label="Total pendaftar" value={String(list.length)} icon="users" hint={`${list.filter((r) => isToday(r.created_at)).length} hari ini`} />
          <KpiCard label="Mau membayar" value={answered ? `${Math.round((willing / answered) * 100)}%` : '—'} icon="wallet" delay={50} hint={`${willing} dari ${answered} yang menjawab`} />
          <KpiCard label="Minat paket berbayar" value={String(list.filter((r) => r.interested_plan === 'organization' || r.interested_plan === 'campus').length)} icon="chart" delay={100} hint="Organisasi + Kampus" />
          <KpiCard label="Upgrade demo" value={String(paidDemo.length)} icon="check" delay={150} hint={`${rupiah(paidDemo.reduce((a, p) => a + Number(p.amount), 0))} · ${orgCount ?? 0} organisasi terdaftar`} />
        </section>

        <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Breakdown title="Paket yang diminati" rows={count((r) => r.interested_plan, PLAN_LABEL)} />
          <Breakdown title="Jenis organisasi" rows={count((r) => r.organization_type, TYPE_LABEL)} />
          <Breakdown title="Sumber" rows={count((r) => r.source, SOURCE_LABEL)} />
        </section>

        <section className="overflow-hidden rounded-card border border-line bg-surface">
          <h2 className="border-b border-line px-5 py-3 font-heading text-base font-bold text-ink">Pendaftar terbaru</h2>
          {list.length === 0 ? (
            <p className="px-5 py-4 text-sm text-muted">Belum ada pendaftar.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="bg-gray-50 text-xs uppercase tracking-wide text-muted">
                  <tr><th className="px-4 py-2">Waktu</th><th className="px-4 py-2">Nama</th><th className="px-4 py-2">Organisasi</th><th className="px-4 py-2">Anggota</th><th className="px-4 py-2">Paket</th><th className="px-4 py-2">Mau bayar</th><th className="px-4 py-2">Sumber</th></tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {list.slice(0, 200).map((r) => (
                    <tr key={r.id}>
                      <td className="whitespace-nowrap px-4 py-2 text-muted">{new Date(r.created_at).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', dateStyle: 'short', timeStyle: 'short' })}</td>
                      <td className="px-4 py-2"><p className="font-medium text-ink">{r.name}</p><p className="text-xs text-muted">{r.email}</p></td>
                      <td className="px-4 py-2 text-gray-700">{r.organization_name ?? '—'}{r.organization_type ? <span className="text-xs text-muted"> · {TYPE_LABEL[r.organization_type]}</span> : null}</td>
                      <td className="px-4 py-2 text-gray-700">{r.member_count ?? '—'}</td>
                      <td className="px-4 py-2 text-gray-700">{PLAN_LABEL[r.interested_plan] ?? r.interested_plan}</td>
                      <td className="px-4 py-2 text-gray-700">{r.willing_to_pay === true ? 'Ya' : r.willing_to_pay === false ? 'Tidak' : (r.note ?? '').startsWith('[mungkin') ? 'Mungkin' : '—'}</td>
                      <td className="px-4 py-2 text-gray-700">{SOURCE_LABEL[r.source] ?? r.source}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </AppShell>
  );
}
