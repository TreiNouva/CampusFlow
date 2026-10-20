'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireUser } from '@/lib/auth/session';
import { budgetEntrySchema, budgetPlanSchema } from '@/lib/validations/schemas';
import type { ActionResult } from './organization-actions';

const DENIED = 'Hanya Project Manager, Wakil PM, atau Bendahara yang dapat mengubah budget.';
const uuid = (v: string) => /^[0-9a-f-]{36}$/i.test(v);

export async function saveBudgetPlan(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = budgetPlanSchema.safeParse({
    projectId: formData.get('projectId'), divisionId: formData.get('divisionId') || null,
    category: formData.get('category'), plannedAmount: formData.get('plannedAmount'),
  });
  if (!parsed.success) return { success: false, error: parsed.error.errors[0]?.message ?? 'Input tidak valid' };
  const { error } = await createClient().from('budget_plans').insert({
    project_id: parsed.data.projectId, division_id: parsed.data.divisionId ?? null,
    category: parsed.data.category, planned_amount: parsed.data.plannedAmount, created_by: user.id,
  });
  if (error) {
    if (error.code === '23505') return { success: false, error: 'Rencana untuk kategori & divisi tersebut sudah ada. Hapus dulu lalu buat ulang.' };
    if (error.code === '42501') return { success: false, error: DENIED };
    return { success: false, error: 'Gagal menyimpan rencana budget.' };
  }
  revalidatePath(`/projects/${parsed.data.projectId}/budget`);
  return { success: true };
}

export async function deleteBudgetPlan(formData: FormData): Promise<ActionResult> {
  await requireUser();
  const id = String(formData.get('id') ?? ''); const projectId = String(formData.get('projectId') ?? '');
  if (!uuid(id)) return { success: false, error: 'Data tidak valid.' };
  const { data, error } = await createClient().from('budget_plans').delete().eq('id', id).eq('project_id', projectId).select('id');
  if (error || !data?.length) return { success: false, error: DENIED };
  revalidatePath(`/projects/${projectId}/budget`);
  return { success: true };
}

export async function addBudgetEntry(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = budgetEntrySchema.safeParse({
    projectId: formData.get('projectId'), divisionId: formData.get('divisionId') || null,
    entryType: formData.get('entryType'), category: formData.get('category'), amount: formData.get('amount'),
    note: formData.get('note') || null, entryDate: formData.get('entryDate'),
  });
  if (!parsed.success) return { success: false, error: parsed.error.errors[0]?.message ?? 'Input tidak valid' };
  const { error } = await createClient().from('budget_entries').insert({
    project_id: parsed.data.projectId, division_id: parsed.data.divisionId ?? null,
    entry_type: parsed.data.entryType, category: parsed.data.category, amount: parsed.data.amount,
    note: parsed.data.note ?? null, entry_date: parsed.data.entryDate, created_by: user.id,
  });
  if (error) {
    if (error.code === '42501') return { success: false, error: DENIED };
    return { success: false, error: 'Gagal menyimpan transaksi.' };
  }
  revalidatePath(`/projects/${parsed.data.projectId}/budget`);
  return { success: true };
}

export async function deleteBudgetEntry(formData: FormData): Promise<ActionResult> {
  await requireUser();
  const id = String(formData.get('id') ?? ''); const projectId = String(formData.get('projectId') ?? '');
  if (!uuid(id)) return { success: false, error: 'Data tidak valid.' };
  const { data, error } = await createClient().from('budget_entries').delete().eq('id', id).eq('project_id', projectId).select('id');
  if (error || !data?.length) return { success: false, error: DENIED };
  revalidatePath(`/projects/${projectId}/budget`);
  return { success: true };
}
