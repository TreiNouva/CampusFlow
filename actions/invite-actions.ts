'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireUser } from '@/lib/auth/session';
import { createInviteSchema } from '@/lib/validations/schemas';
import { rpcErrorMessage } from '@/lib/rpc';
import type { ActionResult } from './organization-actions';

/** Buat link undangan. Dengan projectId = undangan project; tanpa projectId = undangan organisasi. */
export async function createInvite(formData: FormData): Promise<ActionResult<{ token: string }>> {
  await requireUser();
  const parsed = createInviteSchema.safeParse({
    organizationId: formData.get('organizationId') || undefined,
    projectId: formData.get('projectId') || undefined,
    divisionId: formData.get('divisionId') || undefined,
    expiresDays: formData.get('expiresDays') || 7,
    maxUses: formData.get('maxUses') || undefined,
  });
  if (!parsed.success) return { success: false, error: parsed.error.errors[0]?.message ?? 'Input tidak valid' };

  const { data, error } = await createClient().rpc('create_invite', {
    p_org: parsed.data.organizationId ?? null,
    p_project: parsed.data.projectId ?? null,
    p_division: parsed.data.divisionId ?? null,
    p_expires_days: parsed.data.expiresDays,
    p_max_uses: parsed.data.maxUses ?? null,
  });
  if (error || !data) {
    return { success: false, error: error ? rpcErrorMessage(error, 'Gagal membuat link undangan.') : 'Gagal membuat link undangan.' };
  }

  if (parsed.data.projectId) revalidatePath(`/projects/${parsed.data.projectId}/members`);
  if (parsed.data.organizationId) revalidatePath(`/organizations/${parsed.data.organizationId}/members`);
  return { success: true, data: { token: data as string } };
}

export async function revokeInvite(formData: FormData): Promise<ActionResult> {
  await requireUser();
  const inviteId = String(formData.get('inviteId') ?? '');
  const path = String(formData.get('path') ?? '');
  if (!/^[0-9a-f-]{36}$/i.test(inviteId)) return { success: false, error: 'Link tidak valid.' };

  const { error } = await createClient().rpc('revoke_invite', { p_invite: inviteId });
  if (error) return { success: false, error: rpcErrorMessage(error, 'Gagal mencabut link.') };

  if (path.startsWith('/')) revalidatePath(path);
  return { success: true };
}

/** Gabung lewat link undangan (user harus sudah login). */
export async function acceptInvite(
  token: string
): Promise<ActionResult<{ organizationId: string; projectId: string | null; joined: boolean }>> {
  await requireUser();
  if (!/^[A-Za-z0-9]{20,100}$/.test(token)) return { success: false, error: 'Link undangan tidak valid.' };

  const { data, error } = await createClient().rpc('accept_invite', { p_token: token });
  if (error || !data) {
    return { success: false, error: error ? rpcErrorMessage(error, 'Gagal bergabung.') : 'Gagal bergabung.' };
  }

  const result = data as { organization_id: string; project_id: string | null; joined: boolean };
  revalidatePath('/dashboard');
  revalidatePath(`/organizations/${result.organization_id}`);
  if (result.project_id) revalidatePath(`/projects/${result.project_id}`);
  return {
    success: true,
    data: { organizationId: result.organization_id, projectId: result.project_id, joined: result.joined },
  };
}
