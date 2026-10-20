import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Navbar } from '@/components/layout/navbar';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { ActivityFeed } from '@/components/projects/activity-feed';
import { AnnouncementForm } from '@/components/projects/announcement-form';
import { AnnouncementList } from '@/components/projects/announcement-list';
import { ProjectNav } from '@/components/projects/project-nav';
import { ProjectRoleBadge } from '@/components/ui/role-badge';
import { KpiCard } from '@/components/dashboard/kpi-card';
import { ProjectTimeline } from '@/components/dashboard/project-timeline';
import { DivisionProgress, type DivisionStat } from '@/components/dashboard/division-progress';
import { WorkloadChart, type WorkloadRow } from '@/components/dashboard/workload-chart';
import { CompletionChart } from '@/components/dashboard/completion-chart';
import { DeadlineList, type DeadlineRow } from '@/components/dashboard/deadline-list';
import { ProjectCalendar } from '@/components/calendar/project-calendar';
import { buildItems } from '@/components/calendar/calendar-utils';
import type { Participant } from '@/components/calendar/calendar-dialogs';
import { requireUser } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { getProjectActivity } from '@/actions/project-actions';
import { addDays, dayOfTimestamp, todayJakarta } from '@/lib/dates';
import { divisionColor } from '@/lib/colors';
import { fileIcon, DOCUMENT_CATEGORY_LABEL } from '@/lib/documents';
import {
  canManageAnyScope, canPostAnnouncementRole, canViewBudgetRole, isProjectManagerRole, PROJECT_ROLES,
} from '@/lib/roles';
import { calcProgress, formatDate, formatRupiah } from '@/lib/utils';
import type { Announcement, ProjectRole, TaskStatus } from '@/types/database';

export default async function ProjectOverviewPage({ params }: { params: { projectId: string } }) {
  const user = await requireUser();
  const supabase = createClient();
  const today = todayJakarta();
  const pid = params.projectId;

  const [
    { data: project }, { data: membership }, { data: tasks }, { data: members }, { data: announcements },
    activity, { data: divisions }, { data: events }, { data: milestones }, { data: attendance }, { data: docs },
  ] = await Promise.all([
    supabase.from('projects').select('*, organization:organizations(id, name)').eq('id', pid).single(),
    supabase.from('project_members').select('role, division_id, division:project_divisions(name)').eq('project_id', pid).eq('user_id', user.id).maybeSingle(),
    supabase
      .from('tasks')
      .select('id, title, status, priority, due_date, start_date, completed_at, division_id, assignee_id, assignee:profiles!tasks_assignee_id_fkey(id, full_name)')
      .eq('project_id', pid),
    supabase.from('project_members').select('id, user_id, role, division_id, division:project_divisions(name), profile:profiles(full_name)').eq('project_id', pid),
    supabase
      .from('announcements')
      .select('*, author:profiles!announcements_author_id_fkey(id, full_name), division:project_divisions(id, name, color)')
      .eq('project_id', pid)
      .order('created_at', { ascending: false })
      .limit(15),
    getProjectActivity(pid, 8),
    supabase.from('project_divisions').select('id, name, color').eq('project_id', pid).order('created_at'),
    supabase.from('project_events').select('*').eq('project_id', pid)
      .gte('start_at', new Date(Date.now() - 120 * 86400_000).toISOString())
      .lte('start_at', new Date(Date.now() + 240 * 86400_000).toISOString())
      .order('start_at'),
    supabase.from('project_milestones').select('*').eq('project_id', pid).order('due_date'),
    supabase.from('event_attendance').select('event_id, user_id, status, checked_in_at'),
    supabase.from('documents').select('id, name, category, size_bytes, created_at, task_id, division_id').eq('project_id', pid).order('created_at', { ascending: false }).limit(5),
  ]);
  if (!project || !membership) notFound();

  const myRole = membership.role as ProjectRole;
  const myDivisionId = ((membership as any).division_id as string | null) ?? null;
  const showBudget = canViewBudgetRole(myRole);

  let budget: { planned: number; spent: number; income: number } | null = null;
  if (showBudget) {
    const [{ data: plans }, { data: entries }] = await Promise.all([
      supabase.from('budget_plans').select('planned_amount').eq('project_id', pid),
      supabase.from('budget_entries').select('entry_type, amount').eq('project_id', pid),
    ]);
    budget = {
      planned: (plans ?? []).reduce((a: number, p: any) => a + Number(p.planned_amount), 0),
      spent: (entries ?? []).filter((e: any) => e.entry_type === 'expense').reduce((a: number, e: any) => a + Number(e.amount), 0),
      income: (entries ?? []).filter((e: any) => e.entry_type === 'income').reduce((a: number, e: any) => a + Number(e.amount), 0),
    };
  }

  const taskList = (tasks ?? []) as any[];
  const divList = (divisions ?? []) as { id: string; name: string; color: string }[];
  const divMap = new Map(divList.map((d) => [d.id, d]));
  const total = taskList.length;
  const done = taskList.filter((t) => t.status === 'done').length;
  const overdue = taskList.filter((t) => t.status !== 'done' && t.due_date && t.due_date < today);
  const progress = calcProgress(done, total);
  const isMemberScope = myRole === 'member';

  // Acara & kehadiran
  const eventList = (events ?? []) as any[];
  const memberList = (members ?? []) as any[];
  const attByEvent = new Map<string, any[]>();
  for (const a of (attendance ?? []) as any[]) attByEvent.set(a.event_id, [...(attByEvent.get(a.event_id) ?? []), a]);
  const participants: Record<string, Participant[]> = {};
  for (const ev of eventList) {
    const scope = memberList.filter((m) =>
      m.role !== 'ketua' && (!ev.division_id || m.division_id === ev.division_id || ['project_manager', 'wakil_project_manager', 'sekretaris'].includes(m.role)));
    participants[ev.id] = scope.map((m) => {
      const a = (attByEvent.get(ev.id) ?? []).find((x) => x.user_id === m.user_id);
      return { userId: m.user_id, name: m.profile?.full_name ?? 'Tanpa nama', status: a?.status ?? null, checkedInAt: a?.checked_in_at ?? null };
    });
  }
  const nowIso = new Date().toISOString();
  const pastEvents = eventList.filter((e) => e.end_at < nowIso);
  const slots = pastEvents.reduce((n, e) => n + participants[e.id].length, 0);
  const presents = pastEvents.reduce((n, e) => n + participants[e.id].filter((p) => p.status === 'present').length, 0);
  const attendanceRate = slots > 0 ? calcProgress(presents, slots) : null;
  const weekAhead = addDays(today, 7);
  const upcomingEvents = eventList.filter((e) => dayOfTimestamp(e.start_at) >= today && dayOfTimestamp(e.start_at) <= weekAhead);

  const calItems = buildItems({ projectId: pid, tasks: taskList, events: eventList, milestones: (milestones ?? []) as any[], divisions: divList });

  // Statistik
  const divStats: DivisionStat[] = divList
    .map((d) => {
      const ts = taskList.filter((t) => t.division_id === d.id);
      return { id: d.id, name: d.name, color: d.color, total: ts.length, done: ts.filter((t) => t.status === 'done').length, overdue: ts.filter((t) => t.status !== 'done' && t.due_date && t.due_date < today).length };
    })
    .filter((d) => d.total > 0 || !isMemberScope);
  const workloadMap = new Map<string, WorkloadRow>();
  for (const t of taskList) {
    if (!t.assignee) continue;
    const row = workloadMap.get(t.assignee.id) ?? { userId: t.assignee.id, name: t.assignee.full_name, open: 0, overdue: 0, done: 0 };
    if (t.status === 'done') row.done += 1;
    else { row.open += 1; if (t.due_date && t.due_date < today) row.overdue += 1; }
    workloadMap.set(t.assignee.id, row);
  }
  const workload = [...workloadMap.values()].sort((a, b) => b.open - a.open).slice(0, 6);
  const statusCounts = { todo: 0, in_progress: 0, review: 0, done: 0, blocked: 0 } as Record<TaskStatus, number>;
  for (const t of taskList) statusCounts[t.status as TaskStatus] += 1;
  const completedDays = taskList.filter((t) => t.completed_at).map((t) => dayOfTimestamp(t.completed_at));
  const deadlines: DeadlineRow[] = taskList
    .filter((t) => t.status !== 'done' && t.due_date && t.due_date <= addDays(today, 14))
    .sort((a, b) => a.due_date.localeCompare(b.due_date))
    .slice(0, 6)
    .map((t) => ({
      id: t.id, title: t.title, due: t.due_date, assignee: t.assignee?.full_name ?? null,
      divisionColor: t.division_id ? divMap.get(t.division_id)?.color ?? null : null,
      divisionName: t.division_id ? divMap.get(t.division_id)?.name ?? null : null, status: t.status,
    }));
  const myTasks = taskList.filter((t) => t.assignee_id === user.id && t.status !== 'done').slice(0, 5);

  const canPost = canPostAnnouncementRole(myRole) || canManageAnyScope(myRole, myDivisionId);
  const canModerate = isProjectManagerRole(myRole);
  const sortedMembers = [...memberList].sort((a, b) => PROJECT_ROLES.indexOf(a.role) - PROJECT_ROLES.indexOf(b.role));
  const memberPreview = sortedMembers.slice(0, 8);

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="mx-auto max-w-7xl px-6 py-8">
        <p className="text-xs font-semibold uppercase tracking-wide text-teal">
          <Link href={`/organizations/${(project as any).organization?.id}`}>{(project as any).organization?.name}</Link>
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-heading text-2xl font-bold text-ink">{project.name}</h1>
          <ProjectRoleBadge role={myRole} divisionName={(membership as any).division?.name} />
        </div>
        <p className="mt-1 text-sm text-muted">{project.description || 'Tidak ada deskripsi.'}</p>
        <p className="mt-1 mb-4 text-xs text-muted">{formatDate(project.start_date)} — {formatDate(project.end_date)}</p>
        <ProjectNav projectId={pid} projectName={project.name} active="overview" myRole={myRole} />

        {myRole === 'ketua' && (
          <p className="mt-4 rounded-lg border border-sky bg-sky/40 px-4 py-2 text-sm text-navy">
            Kamu melihat project ini sebagai <strong>Ketua</strong> (viewer): bisa melihat semua isi project dan mengatur keanggotaan, tetapi tidak mengubah task atau membuat pengumuman.
            Jika perlu, Project Manager atau kamu sendiri dapat menjadikanmu Project Manager di halaman Anggota & Divisi.
          </p>
        )}
        {isMemberScope && (
          <p className="mt-4 rounded-lg border border-sky bg-sky/40 px-4 py-2 text-sm text-navy">
            Sebagai <strong>Member</strong>, kamu melihat task, jadwal, dan pengumuman untuk <strong>divisimu</strong> serta yang bersifat <strong>Global</strong>.
          </p>
        )}

        {/* KPI */}
        <section className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <KpiCard label="Progress" value={`${progress}%`} icon="📈" tone="orange" progress={progress} hint={isMemberScope ? 'Task divisimu' : 'Semua task'} />
          <KpiCard label="Task Selesai" value={`${done}/${total}`} icon="✅" tone="green" delay={60} hint={`${total - done} masih berjalan`} />
          <KpiCard label="Telat" value={String(overdue.length)} icon="⏰" tone={overdue.length ? 'red' : 'teal'} delay={120} hint={overdue.length ? 'Lewat deadline' : 'Semua tepat waktu'} />
          <KpiCard label="Acara 7 Hari" value={String(upcomingEvents.length)} icon="📅" tone="teal" delay={180} hint="Jadwal yang akan datang" />
          <KpiCard label="Kehadiran" value={attendanceRate === null ? '—' : `${attendanceRate}%`} icon="🙋" tone="navy" delay={240} progress={attendanceRate ?? undefined} hint="Rata-rata acara lalu" />
          {budget ? (
            <KpiCard label="Budget Terpakai" value={budget.planned > 0 ? `${calcProgress(budget.spent, budget.planned)}%` : '—'} icon="💰" tone="orange" delay={300}
              progress={budget.planned > 0 ? calcProgress(budget.spent, budget.planned) : undefined} hint={`${formatRupiah(budget.spent)} dari ${formatRupiah(budget.planned)}`} />
          ) : (
            <KpiCard label="Anggota" value={String(memberList.length)} icon="👥" tone="navy" delay={300} hint="Di project ini" />
          )}
        </section>

        <section className="mt-6">
          <ProjectTimeline start={project.start_date} end={project.end_date} today={today} milestones={(milestones ?? []) as any[]} />
        </section>

        <section className="mt-6">
          <ProjectCalendar
            projectId={pid}
            today={today}
            items={calItems}
            divisions={divList}
            events={eventList}
            participants={participants}
            myRole={myRole}
            myDivisionId={myDivisionId}
            myUserId={user.id}
          />
        </section>

        <section className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <CompletionChart completedDays={completedDays} today={today} statusCounts={statusCounts} />
              <DeadlineList rows={deadlines} today={today} projectId={pid} />
            </div>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <DivisionProgress stats={divStats} />
              <WorkloadChart rows={workload} />
            </div>

            <Card>
              <CardHeader>
                <h2 className="font-heading text-base font-bold text-ink">Pengumuman</h2>
                <p className="text-xs text-muted">
                  Kamu melihat pengumuman Global{myDivisionId ? ' dan untuk divisimu' : ''}
                  {['ketua', 'project_manager', 'wakil_project_manager', 'sekretaris'].includes(myRole) ? ' — plus semua divisi' : ''}.
                  {canModerate ? ' Kamu bisa mengedit dan menghapus semua pengumuman.' : ' Pembuat bisa mengedit dan menghapus pengumumannya sendiri.'}
                </p>
              </CardHeader>
              <CardBody>
                <AnnouncementList announcements={(announcements ?? []) as unknown as Announcement[]} projectId={pid} currentUserId={user.id} canModerate={canModerate} />
              </CardBody>
            </Card>

            {canPost ? (
              <AnnouncementForm projectId={pid} divisions={divList} myRole={myRole} myDivisionId={myDivisionId} />
            ) : (
              <p className="text-xs text-muted">Pengumuman dibuat oleh Project Manager, Wakil PM, PIC, Koordinator, atau Sekretaris.</p>
            )}
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader className="flex items-center justify-between">
                <h2 className="font-heading text-base font-bold text-ink">Task Saya</h2>
                <Link href={`/projects/${pid}/tasks`} className="text-xs font-semibold text-navy hover:underline">Task Board →</Link>
              </CardHeader>
              <CardBody className="space-y-2">
                {myTasks.length === 0 && <p className="text-sm text-muted">Tidak ada task aktif yang ditugaskan kepadamu.</p>}
                {myTasks.map((t) => (
                  <Link key={t.id} href={`/projects/${pid}/tasks/${t.id}`} className="block rounded-lg border border-gray-100 px-3 py-2 text-sm hover:border-navy"
                    style={{ borderLeft: `4px solid ${divisionColor(t.division_id ? divMap.get(t.division_id)?.color : null).accent}` }}>
                    <span className="font-medium text-ink">{t.title}</span>
                    <span className="block text-xs text-muted">{t.due_date ? `Deadline ${formatDate(t.due_date)}` : 'Tanpa deadline'}</span>
                  </Link>
                ))}
              </CardBody>
            </Card>

            <Card>
              <CardHeader className="flex items-center justify-between">
                <h2 className="font-heading text-base font-bold text-ink">Dokumen Terbaru</h2>
                <Link href={`/projects/${pid}/documents`} className="text-xs font-semibold text-navy hover:underline">Semua →</Link>
              </CardHeader>
              <CardBody className="space-y-2">
                {(docs ?? []).length === 0 && <p className="text-sm text-muted">Belum ada dokumen.</p>}
                {(docs ?? []).map((d: any) => (
                  <Link key={d.id} href={`/projects/${pid}/documents`} className="flex items-center gap-2 text-sm hover:text-navy">
                    <span aria-hidden>{fileIcon(d.name)}</span>
                    <span className="min-w-0 flex-1 truncate">{d.name}</span>
                    <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-muted">{DOCUMENT_CATEGORY_LABEL[d.category as keyof typeof DOCUMENT_CATEGORY_LABEL]}</span>
                  </Link>
                ))}
              </CardBody>
            </Card>

            <Card>
              <CardHeader><h2 className="font-heading text-base font-bold text-ink">Activity Feed</h2></CardHeader>
              <CardBody><ActivityFeed activity={activity} /></CardBody>
            </Card>

            <Card>
              <CardHeader><h2 className="font-heading text-base font-bold text-ink">Anggota Project</h2></CardHeader>
              <ul className="divide-y divide-gray-100">
                {memberPreview.map((m: any) => (
                  <li key={m.id} className="flex items-center justify-between gap-2 px-5 py-2.5 text-sm">
                    <span className="truncate text-ink">{m.profile?.full_name}</span>
                    <ProjectRoleBadge role={m.role} divisionName={m.division?.name} />
                  </li>
                ))}
              </ul>
              <div className="border-t border-gray-100 px-5 py-3">
                <Link href={`/projects/${pid}/members`} className="text-sm font-semibold text-navy hover:underline">
                  {sortedMembers.length > memberPreview.length ? `Lihat semua ${sortedMembers.length} anggota →` : 'Kelola anggota, divisi & undangan →'}
                </Link>
              </div>
            </Card>
          </div>
        </section>
      </main>
    </div>
  );
}
