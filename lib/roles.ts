import type { OrgRole, ProjectRole } from '@/types/database';

/**
 * Definisi role & aturan hak akses di sisi aplikasi (untuk tampilan & pemeriksaan awal).
 * PENTING: aturan yang SEBENARNYA ditegakkan ada di database (supabase/migrations/0002_*.sql);
 * file ini harus tetap selaras dengan SQL tersebut. Mengubah di sini saja tidak memberi akses baru.
 */

// ---------------------------------------------------------------- Organisasi
export const ORG_ROLES: OrgRole[] = ['ketua', 'wakil_ketua', 'koordinator', 'sekretaris', 'bendahara', 'member'];

/** Role organisasi yang bisa dipilih saat menambah/mengubah anggota (Ketua hanya lewat "Alihkan jabatan"). */
export const ASSIGNABLE_ORG_ROLES: OrgRole[] = ['wakil_ketua', 'koordinator', 'sekretaris', 'bendahara', 'member'];

export const ORG_ROLE_LABEL: Record<OrgRole, string> = {
  ketua: 'Ketua',
  wakil_ketua: 'Wakil Ketua',
  koordinator: 'Koordinator',
  sekretaris: 'Sekretaris',
  bendahara: 'Bendahara',
  member: 'Member',
};

/** Jabatan yang hanya boleh dipegang satu orang per organisasi. */
export const ORG_SINGLE_ROLES: OrgRole[] = ['ketua', 'wakil_ketua'];

// ---------------------------------------------------------------- Project
export const PROJECT_ROLES: ProjectRole[] = [
  'ketua',
  'project_manager',
  'wakil_project_manager',
  'pic',
  'koordinator',
  'bendahara',
  'sekretaris',
  'member',
];

/** Role project yang bisa dipilih manual (Ketua otomatis dari organisasi). */
export const ASSIGNABLE_PROJECT_ROLES: ProjectRole[] = [
  'project_manager',
  'wakil_project_manager',
  'pic',
  'koordinator',
  'bendahara',
  'sekretaris',
  'member',
];

export const PROJECT_ROLE_LABEL: Record<ProjectRole, string> = {
  ketua: 'Ketua',
  project_manager: 'Project Manager',
  wakil_project_manager: 'Wakil Project Manager',
  pic: 'PIC',
  koordinator: 'Koordinator',
  bendahara: 'Bendahara',
  sekretaris: 'Sekretaris',
  member: 'Member',
};

/** Role project yang boleh memiliki divisi. */
export const DIVISION_ROLES: ProjectRole[] = ['pic', 'koordinator', 'member'];

/** Jabatan yang hanya boleh dipegang satu orang per project. */
export const PROJECT_SINGLE_ROLES: ProjectRole[] = ['project_manager', 'wakil_project_manager'];

/** Title yang tampil di UI: peran + nama divisi, mis. "Koordinator Acara", "PIC Konsumsi". */
export function memberTitle(role: ProjectRole, divisionName?: string | null): string {
  const base = PROJECT_ROLE_LABEL[role];
  return divisionName && DIVISION_ROLES.includes(role) ? `${base} ${divisionName}` : base;
}

// ---------------------------------------------------------------- Aturan akses
export const isOrgManagerRole = (role: OrgRole | null | undefined) => role === 'ketua' || role === 'wakil_ketua';

export const canInviteToOrg = (role: OrgRole | null | undefined) =>
  role === 'ketua' || role === 'wakil_ketua' || role === 'koordinator';

export const isProjectManagerRole = (role: ProjectRole | null | undefined) =>
  role === 'project_manager' || role === 'wakil_project_manager';

/** Boleh mengubah task / membuat task (Ketua hanya viewer). */
export const canWriteProjectRole = (role: ProjectRole | null | undefined) => !!role && role !== 'ketua';

export const canPostAnnouncementRole = (role: ProjectRole | null | undefined) =>
  role === 'project_manager' ||
  role === 'wakil_project_manager' ||
  role === 'pic' ||
  role === 'koordinator' ||
  role === 'sekretaris';

export const canInviteToProjectRole = (role: ProjectRole | null | undefined, orgRole?: OrgRole | null) =>
  role === 'project_manager' ||
  role === 'wakil_project_manager' ||
  role === 'pic' ||
  role === 'koordinator' ||
  isOrgManagerRole(orgRole);

/** Boleh mengatur anggota project (ubah role, divisi, kick): PM, Wakil PM, Ketua/Wakil Ketua organisasi. */
export const canManageProjectMembers = (role: ProjectRole | null | undefined, orgRole?: OrgRole | null) =>
  isProjectManagerRole(role) || isOrgManagerRole(orgRole);

// ---------------------------------------------------------------- Warna badge
export const ORG_ROLE_COLOR: Record<OrgRole, string> = {
  ketua: 'bg-navy text-white',
  wakil_ketua: 'bg-sky text-navy',
  koordinator: 'bg-sky text-navy',
  sekretaris: 'bg-gray-100 text-gray-700',
  bendahara: 'bg-gray-100 text-gray-700',
  member: 'bg-gray-100 text-gray-700',
};

export const PROJECT_ROLE_COLOR: Record<ProjectRole, string> = {
  ketua: 'bg-navy text-white',
  project_manager: 'bg-navy text-white',
  wakil_project_manager: 'bg-sky text-navy',
  pic: 'bg-sky text-navy',
  koordinator: 'bg-sky text-navy',
  bendahara: 'bg-gray-100 text-gray-700',
  sekretaris: 'bg-gray-100 text-gray-700',
  member: 'bg-gray-100 text-gray-700',
};

// ---------------------------------------------------------------- Cakupan divisi (v6)
export const isPlainMemberRole = (role: ProjectRole | null | undefined) => role === 'member';

/** Melihat SEMUA pengumuman/jadwal/dokumen (Global + semua divisi). Peran lain: Global + divisinya. */
export const seesAllScopedItems = (role: ProjectRole | null | undefined) =>
  role === 'ketua' || role === 'project_manager' || role === 'wakil_project_manager' || role === 'sekretaris';

/** Boleh membuat pengumuman/jadwal untuk divisi `divisionId` (null = Global). */
export function canManageScoped(role: ProjectRole | null | undefined, myDivisionId: string | null, divisionId: string | null) {
  if (role === 'project_manager' || role === 'wakil_project_manager' || role === 'sekretaris') return true;
  if (role === 'pic' || role === 'koordinator') return divisionId !== null && divisionId === myDivisionId;
  return false;
}

export const canManageAnyScope = (role: ProjectRole | null | undefined, myDivisionId: string | null) =>
  role === 'project_manager' || role === 'wakil_project_manager' || role === 'sekretaris' ||
  ((role === 'pic' || role === 'koordinator') && !!myDivisionId);

export const canViewBudgetRole = (role: ProjectRole | null | undefined) =>
  role === 'ketua' || role === 'project_manager' || role === 'wakil_project_manager' || role === 'bendahara';

export const canManageBudgetRole = (role: ProjectRole | null | undefined) =>
  role === 'project_manager' || role === 'wakil_project_manager' || role === 'bendahara';

/** Boleh mengunggah dokumen umum (non-task). Member hanya ke divisinya sendiri. */
export const canUploadProjectDocument = (role: ProjectRole | null | undefined, myDivisionId: string | null, divisionId: string | null) => {
  if (!role || role === 'ketua') return false;
  if (role === 'member') return divisionId !== null && divisionId === myDivisionId;
  return true;
};
