import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { memberLimit, FREE_PROJECTS, type BillingCycle, type PlanKey } from '@/lib/plans';
import type { OrgRole } from '@/types/database';

export interface OrgBilling {
  plan: PlanKey;
  seatPacks: number;
  cycle: BillingCycle;
  periodEnd: string | null;
  expired: boolean;
  memberCount: number;
  memberLimit: number | null;
  activeProjects: number;
  projectLimit: number | null;
  canManage: boolean;
  /** true jika migrasi 0005 belum dijalankan — UI tetap tampil, tanpa batas. */
  unavailable: boolean;
  payments: { id: string; amount: number; plan: string; seat_packs: number; billing_cycle: string; created_at: string; status: string }[];
}

export function canManageBillingRole(role: OrgRole | null | undefined): boolean {
  return role === 'ketua' || role === 'wakil_ketua' || role === 'bendahara';
}

/** Paket, kuota, dan riwayat pembayaran sebuah organisasi (dibaca lewat RLS user yang login). */
export async function getOrgBilling(orgId: string, myRole: OrgRole | null): Promise<OrgBilling> {
  const supabase = createClient();
  const today = new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10); // tanggal WIB
  const canManage = canManageBillingRole(myRole);

  const [{ data: sub, error: subErr }, { count: memberCount }, { data: projects }, payments] = await Promise.all([
    supabase.from('organization_subscriptions').select('plan, seat_packs, billing_cycle, current_period_end').eq('organization_id', orgId).maybeSingle(),
    supabase.from('organization_members').select('id', { count: 'exact', head: true }).eq('organization_id', orgId),
    supabase.from('projects').select('end_date').eq('organization_id', orgId),
    canManage
      ? supabase.from('billing_payments').select('id, amount, plan, seat_packs, billing_cycle, created_at, status').eq('organization_id', orgId).order('created_at', { ascending: false }).limit(20)
      : Promise.resolve({ data: [] as any[] }),
  ]);

  const unavailable = Boolean(subErr);
  const rawPlan = ((sub?.plan as PlanKey | undefined) ?? 'free');
  const periodEnd = (sub?.current_period_end as string | null | undefined) ?? null;
  const expired = rawPlan === 'organization' && Boolean(periodEnd) && new Date(periodEnd!).getTime() <= Date.now();
  const plan: PlanKey = expired ? 'free' : rawPlan;
  const seatPacks = plan === 'organization' ? Number(sub?.seat_packs ?? 0) : 0;
  const activeProjects = (projects ?? []).filter((p: any) => !p.end_date || p.end_date >= today).length;

  return {
    plan,
    seatPacks,
    cycle: ((sub?.billing_cycle as BillingCycle | undefined) ?? 'monthly'),
    periodEnd: plan === 'organization' ? periodEnd : null,
    expired,
    memberCount: memberCount ?? 0,
    memberLimit: unavailable ? null : memberLimit(plan, seatPacks),
    activeProjects,
    projectLimit: unavailable || plan !== 'free' ? null : FREE_PROJECTS,
    canManage,
    unavailable,
    payments: ((payments as any)?.data ?? []) as OrgBilling['payments'],
  };
}
