import { notFound } from 'next/navigation';
import { BudgetManager, type EntryRow, type PlanRow } from '@/components/budget/budget-manager';
import { requireUser } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { todayJakarta } from '@/lib/dates';
import { canManageBudgetRole, canViewBudgetRole } from '@/lib/roles';
import type { ProjectRole } from '@/types/database';

export default async function BudgetPage({ params }: { params: { projectId: string } }) {
  const user = await requireUser();
  const supabase = createClient();
  const pid = params.projectId;

  const [{ data: project }, { data: membership }, { data: plans }, { data: entries }, { data: divisions }] = await Promise.all([
    supabase.from('projects').select('id, name').eq('id', pid).single(),
    supabase.from('project_members').select('role').eq('project_id', pid).eq('user_id', user.id).maybeSingle(),
    supabase.from('budget_plans').select('*').eq('project_id', pid).order('created_at'),
    supabase.from('budget_entries').select('*').eq('project_id', pid).order('entry_date', { ascending: false }).order('created_at', { ascending: false }),
    supabase.from('project_divisions').select('id, name, color').eq('project_id', pid).order('created_at'),
  ]);
  if (!project || !membership) notFound();
  const myRole = membership.role as ProjectRole;

  return (
    <div>
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
        <h1 className="font-heading text-xl font-bold text-ink sm:text-2xl">Budget Project</h1>
        {canViewBudgetRole(myRole) ? (
          <div className="mt-5">
            <BudgetManager
              projectId={pid}
              today={todayJakarta()}
              canManage={canManageBudgetRole(myRole)}
              divisions={(divisions ?? []) as any[]}
              plans={((plans ?? []) as any[]).map((p): PlanRow => ({ id: p.id, divisionId: p.division_id, category: p.category, planned: Number(p.planned_amount) }))}
              entries={((entries ?? []) as any[]).map((e): EntryRow => ({ id: e.id, divisionId: e.division_id, type: e.entry_type, category: e.category, amount: Number(e.amount), note: e.note, date: e.entry_date }))}
            />
          </div>
        ) : (
          <p className="mt-4 rounded-lg bg-white p-6 text-sm text-muted shadow-sm">Budget hanya dapat dilihat oleh Ketua, Project Manager, Wakil PM, dan Bendahara.</p>
        )}
      </main>
    </div>
  );
}
