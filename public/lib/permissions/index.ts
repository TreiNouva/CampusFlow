import { createClient } from '@/lib/supabase/server';
import { canWriteProjectRole } from '@/lib/roles';
import type { OrgRole, ProjectRole } from '@/types/database';

/**
 * Pemeriksaan hak akses di sisi server (lapisan tambahan). Penegak utamanya tetap
 * Row Level Security + fungsi di database (lihat supabase/migrations/0002_*.sql).
 */

export async function getOrgRole(organizationId: string, userId: string): Promise<OrgRole | null> {
  const supabase = createClient();
  const { data } = await supabase
    .from('organization_members')
    .select('role')
    .eq('organization_id', organizationId)
    .eq('user_id', userId)
    .maybeSingle();
  return (data?.role as OrgRole) ?? null;
}

export async function getProjectRole(projectId: string, userId: string): Promise<ProjectRole | null> {
  const supabase = createClient();
  const { data } = await supabase
    .from('project_members')
    .select('role')
    .eq('project_id', projectId)
    .eq('user_id', userId)
    .maybeSingle();
  return (data?.role as ProjectRole) ?? null;
}

/** Anggota project mana pun (termasuk Ketua yang viewer): boleh MELIHAT. */
export async function canAccessProject(projectId: string, userId: string): Promise<boolean> {
  return (await getProjectRole(projectId, userId)) !== null;
}

/** Boleh MENGUBAH (buat/ubah task): semua anggota kecuali Ketua (viewer). */
export async function canWriteProject(projectId: string, userId: string): Promise<boolean> {
  return canWriteProjectRole(await getProjectRole(projectId, userId));
}
