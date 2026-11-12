'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireUser } from '@/lib/auth/session';
import {
  addOrganizationMemberSchema,
  addProjectMemberSchema,
  changeOrgMemberRoleSchema,
  changeProjectMemberSchema,
  orgMemberTargetSchema,
  projectMemberTargetSchema,
} from '@/lib/validations/schemas';
import { rpcErrorMessage } from '@/lib/rpc';
import type { ActionResult } from './organization-actions';

/**
 * Semua perubahan keanggotaan memanggil FUNGSI DATABASE (lihat supabase/migrations/0002_*.sql)
 * yang memeriksa hak akses & aturan "satu orang" (Ketua, Wakil Ketua, PM, Wakil PM) secara atomik.
 * Action di sini hanya memvalidasi input dan menerjemahkan hasilnya.
 */

const firstError = (parsed: { error: { errors: { message: string }[] } }) =>
  parsed.error.errors[0]?.message ?? 'Input tidak valid';

/** Cari id user berdasarkan email (hanya user yang sudah terdaftar di CampusFlow). */
async function findUserIdByEmail(email: string): Promise<string | null> {
  const admin = createAdminClient();
  const { data } = await admin.from('profiles').select('id').eq('email', email.trim().toLowerCase()).maybeSingle();
  return data?.id ?? null;
}

function revalidateOrg(organizationId: string) {
  revalidatePath(`/organizations/${organizationId}`);
  revalidatePath(`/organizations/${organizationId}/members`);
}
function revalidateProject(projectId: string) {
  revalidatePath(`/projects/${projectId}`, 'layout');
  revalidatePath(`/projects/${projectId}/members`);
}

// ------------------------------------------------------------------ Organisasi

/** Tambah anggota organisasi lewat email (user harus sudah punya akun). */
export async function addOrganizationMember(formData: FormData): Promise<ActionResult> {
  await requireUser();
  const parsed = addOrganizationMemberSchema.safeParse({
    organizationId: formData.get('organizationId'),
    email: formData.get('email'),
    role: formData.get('role'),
  });
  if (!parsed.success) return { success: false, error: firstError(parsed) };

  const targetId = await findUserIdByEmail(parsed.data.email);
  if (!targetId) return { success: false, error: 'User dengan email tersebut belum terdaftar di CampusFlow.' };

  const { error } = await createClient().rpc('set_org_member', {
    p_org: parsed.data.organizationId,
    p_user: targetId,
    p_role: parsed.data.role,
  });
  if (error) return { success: false, error: rpcErrorMessage(error, 'Gagal menambahkan anggota.') };

  revalidateOrg(parsed.data.organizationId);
  return { success: true };
}

export async function changeOrganizationMemberRole(formData: FormData): Promise<ActionResult> {
  await requireUser();
  const parsed = changeOrgMemberRoleSchema.safeParse({
    organizationId: formData.get('organizationId'),
    userId: formData.get('userId'),
    role: formData.get('role'),
  });
  if (!parsed.success) return { success: false, error: firstError(parsed) };

  const { error } = await createClient().rpc('set_org_member', {
    p_org: parsed.data.organizationId,
    p_user: parsed.data.userId,
    p_role: parsed.data.role,
  });
  if (error) return { success: false, error: rpcErrorMessage(error, 'Gagal mengubah role.') };

  revalidateOrg(parsed.data.organizationId);
  return { success: true };
}

export async function removeOrganizationMember(formData: FormData): Promise<ActionResult> {
  await requireUser();
  const parsed = orgMemberTargetSchema.safeParse({
    organizationId: formData.get('organizationId'),
    userId: formData.get('userId'),
  });
  if (!parsed.success) return { success: false, error: firstError(parsed) };

  const { error } = await createClient().rpc('remove_org_member', {
    p_org: parsed.data.organizationId,
    p_user: parsed.data.userId,
  });
  if (error) return { success: false, error: rpcErrorMessage(error, 'Gagal mengeluarkan anggota.') };

  revalidateOrg(parsed.data.organizationId);
  return { success: true };
}

/** Alihkan jabatan Ketua ke anggota lain (hanya Ketua). Ketua lama menjadi Member. */
export async function transferKetua(formData: FormData): Promise<ActionResult> {
  await requireUser();
  const parsed = orgMemberTargetSchema.safeParse({
    organizationId: formData.get('organizationId'),
    userId: formData.get('userId'),
  });
  if (!parsed.success) return { success: false, error: firstError(parsed) };

  const { error } = await createClient().rpc('transfer_ketua', {
    p_org: parsed.data.organizationId,
    p_new_ketua: parsed.data.userId,
  });
  if (error) return { success: false, error: rpcErrorMessage(error, 'Gagal mengalihkan jabatan Ketua.') };

  revalidateOrg(parsed.data.organizationId);
  return { success: true };
}

// ------------------------------------------------------------------ Project

/** Tambah anggota organisasi ke project lewat email, lengkap dengan role & divisi. */
export async function addProjectMember(formData: FormData): Promise<ActionResult> {
  await requireUser();
  const parsed = addProjectMemberSchema.safeParse({
    projectId: formData.get('projectId'),
    email: formData.get('email'),
    role: formData.get('role'),
    divisionId: formData.get('divisionId') || undefined,
  });
  if (!parsed.success) return { success: false, error: firstError(parsed) };

  const targetId = await findUserIdByEmail(parsed.data.email);
  if (!targetId) return { success: false, error: 'User dengan email tersebut belum terdaftar di CampusFlow.' };

  const { error } = await createClient().rpc('set_project_member', {
    p_project: parsed.data.projectId,
    p_user: targetId,
    p_role: parsed.data.role,
    p_division: parsed.data.divisionId ?? null,
  });
  if (error) return { success: false, error: rpcErrorMessage(error, 'Gagal menambahkan anggota.') };

  revalidateProject(parsed.data.projectId);
  return { success: true };
}

/** Ubah role / divisi anggota project. */
export async function changeProjectMember(formData: FormData): Promise<ActionResult> {
  await requireUser();
  const parsed = changeProjectMemberSchema.safeParse({
    projectId: formData.get('projectId'),
    userId: formData.get('userId'),
    role: formData.get('role'),
    divisionId: formData.get('divisionId') || undefined,
  });
  if (!parsed.success) return { success: false, error: firstError(parsed) };

  const { error } = await createClient().rpc('set_project_member', {
    p_project: parsed.data.projectId,
    p_user: parsed.data.userId,
    p_role: parsed.data.role,
    p_division: parsed.data.divisionId ?? null,
  });
  if (error) return { success: false, error: rpcErrorMessage(error, 'Gagal menyimpan perubahan.') };

  revalidateProject(parsed.data.projectId);
  return { success: true };
}

/** Keluarkan (kick) anggota dari project. */
export async function removeProjectMember(formData: FormData): Promise<ActionResult> {
  await requireUser();
  const parsed = projectMemberTargetSchema.safeParse({
    projectId: formData.get('projectId'),
    userId: formData.get('userId'),
  });
  if (!parsed.success) return { success: false, error: firstError(parsed) };

  const { error } = await createClient().rpc('remove_project_member', {
    p_project: parsed.data.projectId,
    p_user: parsed.data.userId,
  });
  if (error) return { success: false, error: rpcErrorMessage(error, 'Gagal mengeluarkan anggota.') };

  revalidateProject(parsed.data.projectId);
  return { success: true };
}

/** Anggota organisasi bergabung sendiri ke sebuah project. */
export async function joinProject(formData: FormData): Promise<ActionResult> {
  await requireUser();
  const projectId = String(formData.get('projectId') ?? '');
  const organizationId = String(formData.get('organizationId') ?? '');
  if (!/^[0-9a-f-]{36}$/i.test(projectId)) return { success: false, error: 'Project tidak valid.' };

  const { error } = await createClient().rpc('join_project', { p_project: projectId });
  if (error) return { success: false, error: rpcErrorMessage(error, 'Gagal bergabung ke project.') };

  if (organizationId) revalidateOrg(organizationId);
  revalidateProject(projectId);
  return { success: true };
}
