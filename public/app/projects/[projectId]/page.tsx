import Link from 'next/link';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Icon, type IconName } from '@/components/ui/icons';
import { KpiCard } from '@/components/dashboard/kpi-card';
import { DeadlineList, type DeadlineRow } from '@/components/dashboard/deadline-list';
import { createClient } from '@/lib/supabase/server';
import { getProjectContext } from '@/lib/project-context';
import { addDays, dayOfTimestamp, diffDays, shortDate, todayJakarta, formatTime } from '@/lib/dates';
import { divisionColor } from '@/lib/colors';
import { canViewBudgetRole } from '@/lib/roles';
import { calcProgress, formatDate } from '@/lib/utils';

/**
 * Ringkasan project (v7) — sengaja dibuat ringan: angka penting, menu cepat (gaya m-banking),
 * hal yang perlu perhatian, dan pengumuman terbaru. Kalender, grafik, dan aktivitas dipindah
 * ke halaman masing-masing (menu Kalender & Statistik) supaya halaman ini tidak "penuh".
 */
export default async function ProjectOverviewPage({ params }: { params: { projectId: string } }) {
  const ctx = await getProjectContext(params.projectId);
  const { project, myRole, userId } = ctx;
  const supabase = createClient();
  const today = todayJakarta();
  const pid = project.id;

  const [{ data: tasks }, { data: divisions }, { data: events }, { data: announcements }] = await Promise.all([
    supabase
      .from('tasks')
      .select('id, title, status, due_date, division_id, assignee_id, assignee:profiles!tasks_assignee_id_fkey(id, full_name)')
      .eq('project_id', pid),
    supabase.from('project_divisions').select('id, name, color').eq('project_id', pid),
    supabase.from('project_events').select('id, title, start_at, all_day, location, division_id').eq('project_id', pid)
      .gte('start_at', new Date().toISOString()).order('start_at').limit(3),
    supabase.from('announcements').select('id, title, body, created_at, division:project_divisions(name), author:profiles!announcements_author_id_fkey(full_name)')
      .eq('project_id', pid).order('created_at', { ascending: false }).limit(3),
  ]);

  const taskList = (tasks ?? []) as any[];
  const divMap = new Map(((divisions ?? []) as any[]).map((d) => [d.id, d]));
  const total = taskList.length;
  const done = taskList.filter((t) => t.status === 'done').length;
  const overdue = taskList.filter((t) => t.status !== 'done' && t.due_date && t.due_date < today).length;
  const progress = calcProgress(done, total);
  const eventsWeek = ((events ?? []) as any[]).filter((e) => dayOfTimestamp(e.start_at) <= addDays(today, 7)).length;

  const deadlines: DeadlineRow[] = taskList
    .filter((t) => t.status !== 'done' && t.due_date && t.due_date <= addDays(today, 14))
    .sort((a, b) => a.due_date.localeCompare(b.due_date))
    .slice(0, 5)
    .map((t) => ({
      id: t.id, title: t.title, due: t.due_date, assignee: t.assignee?.full_name ?? null,
      divisionColor: t.division_id ? divMap.get(t.division_id)?.color ?? null : null,
      divisionName: t.division_id ? divMap.get(t.division_id)?.name ?? null : null, status: t.status,
    }));
  const myTasks = taskList.filter((t) => t.assignee_id === userId && t.status !== 'done')
    .sort((a, b) => (a.due_date ?? '9999').localeCompare(b.due_date ?? '9999')).slice(0, 4);

  const base = `/projects/${pid}`;
  const quickMenu: { href: string; label: string; icon: IconName }[] = [
    { href: `${base}/tasks`, label: 'Task', icon: 'tasks' },
    { href: `${base}/calendar`, label: 'Kalender', icon: 'calendar' },
    { href: `${base}/announcements`, label: 'Pengumuman', icon: 'megaphone' },
    { href: `${base}/documents`, label: 'Dokumen', icon: 'file' },
    ...(canViewBudgetRole(myRole) ? [{ href: `${base}/budget`, label: 'Budget', icon: 'wallet' as const }] : []),
    { href: `${base}/members`, label: 'Anggota', icon: 'users' },
    { href: `${base}/stats`, label: 'Statistik', icon: 'chart' },
    { href: `${base}/settings/notifications`, label: 'Notifikasi', icon: 'bell' },
  ];

  const period = project.start_date && project.end_date
    ? `${shortDate(project.start_date)} – ${formatDate(project.end_date)}`
    : 'Periode belum diatur';
  const status = !project.start_date || !project.end_date ? null
    : today < project.start_date ? `Mulai ${diffDays(project.start_date, today)} hari lagi`
    : today > project.end_date ? 'Sudah selesai'
    : `${diffDays(project.end_date, today)} hari lagi`;

  return (
    <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
      {/* Kepala halaman */}
      <div className="rounded-card border border-line bg-white p-5">
        <p className="text-xs text-muted">{project.organization?.name}</p>
        <h1 className="mt-0.5 font-heading text-xl font-bold text-ink sm:text-2xl">{project.name}</h1>
        {project.description && <p className="mt-1 line-clamp-2 text-sm text-muted">{project.description}</p>}
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-2.5 py-1 text-gray-700">
            <Icon name="calendar" size={14} /> {period}
          </span>
          {status && <span className="rounded-full bg-sky px-2.5 py-1 font-semibold text-navy">{status}</span>}
        </div>
        {(myRole === 'ketua' || myRole === 'member') && (
          <p className="mt-3 border-t border-line pt-3 text-xs text-muted">
            {myRole === 'ketua'
              ? 'Kamu melihat sebagai Ketua: bisa melihat semua isi project dan mengatur anggota, tetapi tidak mengubah task.'
              : 'Kamu melihat task, jadwal, dan pengumuman untuk divisimu serta yang bersifat Global.'}
          </p>
        )}
      </div>

      {/* Angka penting */}
      <section className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Ringkasan angka">
        <KpiCard label="Progress" value={`${progress}%`} icon="chart" progress={progress} hint={`${done} dari ${total} task selesai`} />
        <KpiCard label="Task aktif" value={String(total - done)} icon="tasks" delay={50} hint={myRole === 'member' ? 'Di divisimu' : 'Semua divisi'} />
        <KpiCard label="Telat" value={String(overdue)} icon="alert" alert={overdue ? 'bad' : undefined} delay={100} hint={overdue ? 'Lewat deadline' : 'Semua tepat waktu'} />
        <KpiCard label="Acara 7 hari" value={String(eventsWeek)} icon="calendar" delay={150} hint="Jadwal terdekat" />
      </section>

      {/* Menu cepat — gaya aplikasi m-banking, hanya di HP/tablet (di laptop sudah ada menu samping) */}
      <section className="mt-4 rounded-card border border-line bg-white p-4 lg:hidden" aria-label="Menu cepat">
        <ul className="grid grid-cols-4 gap-y-4">
          {quickMenu.map((m) => (
            <li key={m.href}>
              <Link href={m.href} className="flex flex-col items-center gap-1.5 text-center">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sky text-navy"><Icon name={m.icon} size={20} /></span>
                <span className="text-[11px] font-medium text-gray-700">{m.label}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <DeadlineList rows={deadlines} today={today} projectId={pid} title="Perlu perhatian (14 hari)" />
        </div>
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader className="flex items-center justify-between">
              <h2 className="font-heading text-base font-bold text-ink">Task saya</h2>
              <Link href={`${base}/tasks`} className="text-xs font-semibold text-navy hover:underline">Lihat semua</Link>
            </CardHeader>
            <CardBody className="space-y-2">
              {myTasks.length === 0 && <p className="text-sm text-muted">Tidak ada task aktif untukmu.</p>}
              {myTasks.map((t) => (
                <Link key={t.id} href={`${base}/tasks/${t.id}`} className="flex items-center gap-2 rounded-lg px-1 py-1 text-sm hover:bg-gray-50">
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: divisionColor(t.division_id ? divMap.get(t.division_id)?.color : null).accent }} />
                  <span className="min-w-0 flex-1 truncate text-ink">{t.title}</span>
                  <span className={t.due_date && t.due_date < today ? 'shrink-0 text-xs font-semibold text-red-600' : 'shrink-0 text-xs text-muted'}>
                    {t.due_date ? shortDate(t.due_date) : '—'}
                  </span>
                </Link>
              ))}
            </CardBody>
          </Card>
          <Card>
            <CardHeader className="flex items-center justify-between">
              <h2 className="font-heading text-base font-bold text-ink">Acara mendatang</h2>
              <Link href={`${base}/calendar`} className="text-xs font-semibold text-navy hover:underline">Kalender</Link>
            </CardHeader>
            <CardBody className="space-y-2">
              {(events ?? []).length === 0 && <p className="text-sm text-muted">Belum ada acara terjadwal.</p>}
              {((events ?? []) as any[]).map((e) => (
                <div key={e.id} className="flex items-center gap-3 text-sm">
                  <span className="flex w-11 shrink-0 flex-col items-center rounded-lg bg-gray-50 py-1 leading-tight">
                    <span className="text-[10px] text-muted">{shortDate(dayOfTimestamp(e.start_at)).split(' ')[1]}</span>
                    <span className="font-bold text-ink">{shortDate(dayOfTimestamp(e.start_at)).split(' ')[0]}</span>
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-medium text-ink">{e.title}</p>
                    <p className="truncate text-xs text-muted">{e.all_day ? 'Sepanjang hari' : `${formatTime(e.start_at)} WIB`}{e.location ? ` · ${e.location}` : ''}</p>
                  </div>
                </div>
              ))}
            </CardBody>
          </Card>
        </div>
      </section>

      <Card className="mt-4">
        <CardHeader className="flex items-center justify-between">
          <h2 className="font-heading text-base font-bold text-ink">Pengumuman terbaru</h2>
          <Link href={`${base}/announcements`} className="text-xs font-semibold text-navy hover:underline">Lihat semua</Link>
        </CardHeader>
        <ul className="divide-y divide-line">
          {(announcements ?? []).length === 0 && <li className="px-5 py-4 text-sm text-muted">Belum ada pengumuman.</li>}
          {((announcements ?? []) as any[]).map((a) => (
            <li key={a.id} className="px-5 py-3">
              <Link href={`${base}/announcements`} className="block">
                <p className="text-sm font-semibold text-ink">{a.title}</p>
                <p className="line-clamp-1 text-sm text-muted">{a.body}</p>
                <p className="mt-0.5 text-xs text-gray-400">{a.author?.full_name ?? 'Anonim'} · {a.division?.name ?? 'Global'} · {formatDate(a.created_at)}</p>
              </Link>
            </li>
          ))}
        </ul>
      </Card>
    </main>
  );
}
