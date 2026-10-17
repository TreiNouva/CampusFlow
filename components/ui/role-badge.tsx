import { Badge } from '@/components/ui/card';
import { memberTitle, ORG_ROLE_COLOR, ORG_ROLE_LABEL, PROJECT_ROLE_COLOR } from '@/lib/roles';
import type { OrgRole, ProjectRole } from '@/types/database';

export function OrgRoleBadge({ role }: { role: OrgRole }) {
  return <Badge color={ORG_ROLE_COLOR[role]}>{ORG_ROLE_LABEL[role]}</Badge>;
}

/** Badge role project; menampilkan title lengkap (role + divisi), mis. "Koordinator Acara". */
export function ProjectRoleBadge({ role, divisionName }: { role: ProjectRole; divisionName?: string | null }) {
  return <Badge color={PROJECT_ROLE_COLOR[role]}>{memberTitle(role, divisionName)}</Badge>;
}
