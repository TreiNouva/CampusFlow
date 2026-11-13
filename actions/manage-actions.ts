'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { requireUser } from '@/lib/auth/session';
import { rpcErrorMessage } from '@/lib/rpc';

export type ManageResult = { success: true } | { success: false; error: string };

const optDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal('')).transform((v) => v || null);

const projectSchema = z.object({
  projectId: z.string().uuid(),
  name: z.string().trim().min(3, 'Nama project minimal 3 karakter').max(120),
  description: z.string().trim().max(2000).optional().default(''),
  startDate: optDate,
  endDate: optDate,
});

/** Edit nama, deskripsi, dan periode project (PM, Wakil PM, atau Ketua/Wakil Ketua organisasi). */
export async function updateProject(formData: FormData): Promise<ManageResult> {
  await requireUser();
  const parsed = projectSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? 'Input tidak valid' };
  const d = parsed.data;
  if (d.startDate && d.endDate && d.endDate < d.startDate) return { success: false, error: 'Tanggal selesai tidak boleh sebelum tanggal mulai.' };
  const { error } = await createClient().rpc('update_project', {
    p_project: d.projectId, p_name: d.name, p_description: d.description, p_start: d.startDate, p_end: d.endDate,
  });
  if (error) return { success: false, error: rpcErrorMessage(error, 'Gagal menyimpan project. Pastikan migrasi 0006 sudah dijalankan.') };
  revalidatePath(`/projects/${d.projectId}`, 'layout');
  return { success: true };
}

export async function deleteProject(projectId: string, confirmName: string, organizationId: string): Promise<ManageResult> {
  await requireUser();
  if (!z.string().uuid().safeParse(projectId).success) return { success: false, error: 'Project tidak valid.' };
  const { error } = await createClient().rpc('delete_project', { p_project: projectId, p_confirm_name: confirmName });
  if (error) return { success: false, error: rpcErrorMessage(error, 'Gagal menghapus project.') };
  revalidatePath(`/organizations/${organizationId}`, 'layout');
  redirect(`/organizations/${organizationId}`);
}

const orgSchema = z.object({
  organizationId: z.string().uuid(),
  name: z.string().trim().min(3, 'Nama organisasi minimal 3 karakter').max(120),
  description: z.string().trim().max(1000).optional().default(''),
});

export async function updateOrganization(formData: FormData): Promise<ManageResult> {
  await requireUser();
  const parsed = orgSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? 'Input tidak valid' };
  const d = parsed.data;
  const { error } = await createClient().rpc('update_organization', { p_org: d.organizationId, p_name: d.name, p_description: d.description });
  if (error) return { success: false, error: rpcErrorMessage(error, 'Gagal menyimpan organisasi. Pastikan migrasi 0006 sudah dijalankan.') };
  revalidatePath(`/organizations/${d.organizationId}`, 'layout');
  revalidatePath('/dashboard');
  return { success: true };
}

export async function deleteOrganization(organizationId: string, confirmName: string): Promise<ManageResult> {
  await requireUser();
  if (!z.string().uuid().safeParse(organizationId).success) return { success: false, error: 'Organisasi tidak valid.' };
  const { error } = await createClient().rpc('delete_organization', { p_org: organizationId, p_confirm_name: confirmName });
  if (error) return { success: false, error: rpcErrorMessage(error, 'Gagal menghapus organisasi.') };
  revalidatePath('/dashboard');
  redirect('/dashboard');
}

export async function leaveOrganization(organizationId: string): Promise<ManageResult> {
  await requireUser();
  if (!z.string().uuid().safeParse(organizationId).success) return { success: false, error: 'Organisasi tidak valid.' };
  const { error } = await createClient().rpc('leave_organization', { p_org: organizationId });
  if (error) return { success: false, error: rpcErrorMessage(error, 'Gagal keluar dari organisasi.') };
  revalidatePath('/dashboard');
  redirect('/dashboard');
}

/** Ganti nama tampilan (tabel profiles, dibatasi RLS ke baris milik sendiri). */
export async function updateProfileName(formData: FormData): Promise<ManageResult> {
  const user = await requireUser();
  const parsed = z.string().trim().min(2, 'Nama minimal 2 karakter').max(80, 'Nama maksimal 80 karakter').safeParse(formData.get('fullName'));
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? 'Nama tidak valid' };
  const supabase = createClient();
  const { error } = await supabase.from('profiles').update({ full_name: parsed.data }).eq('id', user.id);
  if (error) return { success: false, error: 'Gagal menyimpan nama.' };
  await supabase.auth.updateUser({ data: { full_name: parsed.data } });
  revalidatePath('/', 'layout');
  return { success: true };
}

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Isi password saat ini'),
    newPassword: z.string().min(8, 'Password baru minimal 8 karakter').max(72, 'Password maksimal 72 karakter'),
    confirmPassword: z.string(),
  })
  .refine((d) => d.newPassword === d.confirmPassword, { message: 'Konfirmasi password tidak sama', path: ['confirmPassword'] })
  .refine((d) => d.newPassword !== d.currentPassword, { message: 'Password baru harus berbeda dari yang lama', path: ['newPassword'] });

/** Ganti password: password lama diverifikasi dulu supaya sesi yang tertinggal di perangkat lain tidak bisa mengganti password. */
export async function changePassword(formData: FormData): Promise<ManageResult> {
  const user = await requireUser();
  const parsed = passwordSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? 'Input tidak valid' };
  const supabase = createClient();
  const { error: signInError } = await supabase.auth.signInWithPassword({ email: user.email, password: parsed.data.currentPassword });
  if (signInError) return { success: false, error: 'Password saat ini salah.' };
  const { error } = await supabase.auth.updateUser({ password: parsed.data.newPassword });
  if (error) {
    if (/weak|pwned|leaked/i.test(error.message)) return { success: false, error: 'Password ini terlalu lemah atau pernah bocor. Pilih password lain.' };
    return { success: false, error: 'Gagal mengganti password. Coba lagi.' };
  }
  return { success: true };
}
