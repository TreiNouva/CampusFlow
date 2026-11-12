import { PageHeader } from '@/components/layout/page-header';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { KpiCard } from '@/components/dashboard/kpi-card';
import { CompletionChart } from '@/components/dashboard/completion-chart';
import { DivisionProgress, type DivisionStat } from '@/components/dashboard/division-progress';
import { WorkloadChart, type WorkloadRow } from '@/components/dashboard/workload-chart';
import { ActivityFeed } from '@/components/projects/activity-feed';
import { getProjectActivity } from '@/actions/project-actions';
import { createClient } from '@/lib/supabase/server';
import { getProjectContext } from '@/lib/project-context';
import { buildParticipants } from '@/lib/event-participants';
import { dayOfTimestamp, todayJakarta } from '@/lib/dates';
import { canViewBudgetRole } from '@/lib/roles';
import { calcProgress, formatRupiah } from '@/lib/utils';
import type { TaskStatus } from '@/types/database';

/** Statistik & aktivitas project — grafik dipisah dari Ringkasan supaya halaman utama tidak penuh. */
export default async function ProjectStatsPage({ params }: { params: { projectId: string } }) {
  const { project, myRole } = await getProjectContext(params.projectId);
  const supabase = createClient();
  const today = todayJakarta();
  const pid = project.id;
  const showBudget = canViewBudgetRole(myRole);

  const [{ data: tasks }, { data: divisions }, { data: members }, { data: events }, { data: attendance }, activity, budgetRows] = await Promise.all([
    supabase.from('tasks').select('id, status, due_date, completed_at, division_id, assignee:profiles!tasks_assignee_id_fkey(id, full_name)').eq('project_id', pid),
    supabase.from('project_divisions').select('id, name, color').eq('project_id', pid).order('created_at'),
    supabase.from('project_members').select('user_id, role, division_id, profile:profiles(full_name)').eq('project_id', pid),
    supabase.from('project_events').select('id, division_id, end_at').eq('project_id', pid).lt('end_at', new Date().toISOString()),
    supabase.from('event_attendance').select('event_id, user_id, status, checked_in_at'),
    getProjectActivity(pid, 15),
    showBudget
      ? Promise.all([
        supabase.from('budget_plans').select('planned_amount').eq('project_id', pid),
        supabase.from('budget_entries').select('entry_type, amount').eq('project_id', pid),
      ])
      : Promise.resolve(null),
  ]);

  const taskList = (tasks ?? []) as any[];
  const memberList = (members ?? []) as any[];
  const divStats: DivisionStat[] = ((divisions ?? []) as any[])
    .map((d) => {
      const ts = taskList.filter((t) => t.division_id === d.id);
      return { id: d.id, name: d.name, color: d.color, total: ts.length, done: ts.filter((t) => t.status === 'done').length, overdue: ts.filter((t) => t.status !== 'done' && t.due_date && t.due_date < today).length };
    })
    .filter((d) => d.total > 0 || myRole !== 'member');

  const workloadMap = new Map<string, WorkloadRow>();
  for (const t of taskList) {
    if (!t.assignee) continue;
    const row = workloadMap.get(t.assignee.id) ?? { userId: t.assignee.id, name: t.assignee.full_name, open: 0, overdue: 0, done: 0 };
    if (t.status === 'done') row.done += 1;
    else { row.open += 1; if (t.due_date && t.due_date < today) row.overdue += 1; }
    workloadMap.set(t.assignee.id, row);
  }
  const workload = [...workloadMap.values()].sort((a, b) => b.open - a.open).slice(0, 8);
  const statusCounts = { todo: 0, in_progress: 0, review: 0, done: 0, blocked: 0 } as Record<TaskStatus, number>;
  for (const t of taskList) statusCounts[t.status as TaskStatus] += 1;
  const completedDays = taskList.filter((t) => t.completed_at).map((t) => dayOfTimestamp(t.completed_at));

  const pastEvents = (events ?? []) as any[];
  const participants = buildParticipants(pastEvents, memberList, (attendance ?? []) as any[]);
  const slots = pastEvents.reduce((n, e) => n + participants[e.id].length, 0);
  const presents = pastEvents.reduce((n, e) => n + participants[e.id].filter((p) => p.status === 'present').length, 0);
  const attendanceRate = slots > 0 ? calcProgress(presents, slots) : null;

  let budget: { planned: number; spent: number } | null = null;
  if (budgetRows) {
    const [{ data: plans }, { data: entries }] = budgetRows;
    budget = {
      planned: (plans ?? []).reduce((a: number, p: any) => a + Number(p.planned_amount), 0),
      spent: (entries ?? []).filter((e: any) => e.entry_type === 'expense').reduce((a: number, e: any) => a + Number(e.amount), 0),
    };
  }

  return (
    <main className="mx-auto max-w-6xl space-y-4 px-4 py-6 sm:px-6 lg:px-8">
      <PageHeader title="Statistik" description="Perkembangan task, beban kerja anggota, kehadiran, dan riwayat aktivitas." />

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <KpiCard label="Anggota" value={String(memberList.length)} icon="users" hint="Di project ini" />
        <KpiCard label="Kehadiran" value={attendanceRate === null ? '—' : `${attendanceRate}%`} icon="check" delay={50}
          progress={attendanceRate ?? undefined} hint="Rata-rata acara yang sudah lewat" />
        {budget && (
          <KpiCard label="Budget terpakai" value={budget.planned > 0 ? `${calcProgress(budget.spent, budget.planned)}%` : '—'} icon="wallet" delay={100}
            alert={budget.planned > 0 && budget.spent > budget.planned ? 'bad' : undefined}
            progress={budget.planned > 0 ? calcProgress(budget.spent, budget.planned) : undefined}
            hint={`${formatRupiah(budget.spent)} dari ${formatRupiah(budget.planned)}`} />
        )}
      </section>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <CompletionChart completedDays={completedDays} today={today} statusCounts={statusCounts} />
        <DivisionProgress stats={divStats} />
        <WorkloadChart rows={workload} />
        <Card>
          <CardHeader><h2 className="font-heading text-base font-bold text-ink">Aktivitas terbaru</h2></CardHeader>
          <CardBody><ActivityFeed activity={activity} /></CardBody>
        </Card>
      </div>
    </main>
  );
}
