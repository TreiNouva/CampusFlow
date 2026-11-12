import { cache } from 'react';
import { notFound } from 'next/navigation';
import { requireUser } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import type { ProjectRole } from '@/types/database';

export interface ProjectContext {
  userId: string;
  project: {
    id: string;
    name: string;
    description: string | null;
    start_date: string | null;
    end_date: string | null;
    organization: { id: string; name: string } | null;
  };
  myRole: ProjectRole;
  myDivisionId: string | null;
  myDivisionName: string | null;
}

/**
 * Data dasar project + peran user yang login. Dibungkus `cache()` sehingga layout (menu samping)
 * dan halaman memakai hasil query yang sama dalam satu request.
 */
export const getProjectContext = cache(async (projectId: string): Promise<ProjectContext> => {
  const user = await requireUser();
  const supabase = createClient();
  const [{ data: project }, { data: membership }] = await Promise.all([
    supabase.from('projects').select('id, name, description, start_date, end_date, organization:organizations(id, name)').eq('id', projectId).single(),
    supabase.from('project_members').select('role, division_id, division:project_divisions(name)').eq('project_id', projectId).eq('user_id', user.id).maybeSingle(),
  ]);
  if (!project || !membership) notFound();
  return {
    userId: user.id,
    project: project as unknown as ProjectContext['project'],
    myRole: membership.role as ProjectRole,
    myDivisionId: ((membership as any).division_id as string | null) ?? null,
    myDivisionName: ((membership as any).division?.name as string | undefined) ?? null,
  };
});
