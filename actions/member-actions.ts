'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireUser } from '@/lib/auth/session';
import { isOrgAdmin, canManageProject } from '@/lib/permissions';
import { addOrganizationMemberSchema, addProjectMemberSchema } from '@/lib/validations/schemas';
import type { ActionResult } from './organization-actions';

/**
 * addOrganizationMember — Menambahkan user ke organisasi berdasarkan email.
 * Prototype membutuhkan user tsb sudah pernah register (punya baris di `profiles`);
 * alur "invite lewat email untuk orang yang belum daftar" masuk backlog production (§15).
 */
export async function addOrganizationMember(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();

  const parsed = addOrganizationMemberSchema.safeParse({
    organizationId: formData.get('organizationId'),
    email: formData.get('email'),
    role: formData.get('role'),
  });
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message ?? 'Input tidak valid' };
  }

  const allowed = await isOrgAdmin(parsed.data.organizationId, user.id);
  if (!allowed) {
    return { success: false, error: 'Hanya admin organisasi yang dapat menambah anggota.' };
  }

  // Pakai admin client untuk mencari profile lintas-user berdasarkan email (RLS profiles
  // membolehkan select oleh authenticated user, tapi kita samakan jalurnya di server saja).
  const admin = createAdminClient();
  const { data: targetProfile, error: profileError } = await admin
    .from('profiles')
    .select('id')
    .eq('email', parsed.data.email)
    .maybeSingle();

  if (profileError) {
    return { success: false, error: profileError.message };
  }
  if (!targetProfile) {
    return { success: false, error: 'User dengan email tersebut belum terdaftar di CampusFlow.' };
  }

  const supabase = createClient();
  const { error } = await supabase.from('organization_members').insert({
    organization_id: parsed.data.organizationId,
    user_id: targetProfile.id,
    role: parsed.data.role,
  });

  if (error) {
    return {
      success: false,
      error: error.code === '23505' ? 'User sudah menjadi anggota organisasi ini.' : error.message,
    };
  }

  revalidatePath(`/organizations/${parsed.data.organizationId}/members`);
  return { success: true };
}

/** addProjectMember — Menambahkan anggota organisasi ke sebuah project. */
export async function addProjectMember(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();

  const parsed = addProjectMemberSchema.safeParse({
    projectId: formData.get('projectId'),
    email: formData.get('email'),
    role: formData.get('role'),
  });
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message ?? 'Input tidak valid' };
  }

  const allowed = await canManageProject(parsed.data.projectId, user.id);
  if (!allowed) {
    return { success: false, error: 'Hanya coordinator project yang dapat menambah anggota.' };
  }

  const admin = createAdminClient();
  const { data: targetProfile } = await admin
    .from('profiles')
    .select('id')
    .eq('email', parsed.data.email)
    .maybeSingle();

  if (!targetProfile) {
    return { success: false, error: 'User dengan email tersebut belum terdaftar di CampusFlow.' };
  }

  const supabase = createClient();
  const { error } = await supabase.from('project_members').insert({
    project_id: parsed.data.projectId,
    user_id: targetProfile.id,
    role: parsed.data.role,
    notification_level: 'important',
  });

  if (error) {
    return {
      success: false,
      error: error.code === '23505' ? 'User sudah menjadi anggota project ini.' : error.message,
    };
  }

  revalidatePath(`/projects/${parsed.data.projectId}`);
  return { success: true };
}
