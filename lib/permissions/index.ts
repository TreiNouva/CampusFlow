import { createClient } from '@/lib/supabase/server';
import type { OrgRole, ProjectRole } from '@/types/database';

/**
 * Lapisan permission di sisi server. Ini adalah pengaman TAMBAHAN di
 * level aplikasi — pengaman utama tetap Row Level Security di database
 * (§14: "Server memeriksa authorization, bukan hanya frontend").
 */

export async function getOrgRole(organizationId: string, userId: string): Promise<OrgRole | null> {
  const supabase = createClient();
  const { data } = await supabase
    .from('organization_members')
    .select('role')
    .eq('organization_id', organizationId)
    .eq('user_id', userId)
    .single();
  return (data?.role as OrgRole) ?? null;
}

export async function getProjectRole(projectId: string, userId: string): Promise<ProjectRole | null> {
  const supabase = createClient();
  const { data } = await supabase
    .from('project_members')
    .select('role')
    .eq('project_id', projectId)
    .eq('user_id', userId)
    .single();
  return (data?.role as ProjectRole) ?? null;
}

export async function isOrgAdmin(organizationId: string, userId: string): Promise<boolean> {
  return (await getOrgRole(organizationId, userId)) === 'admin';
}

export async function canManageProject(projectId: string, userId: string): Promise<boolean> {
  const role = await getProjectRole(projectId, userId);
  return role === 'coordinator';
}

/** Member hanya boleh mengubah task yang ada di project yang dia ikuti (§14). */
export async function canAccessProject(projectId: string, userId: string): Promise<boolean> {
  const role = await getProjectRole(projectId, userId);
  return role !== null;
}
