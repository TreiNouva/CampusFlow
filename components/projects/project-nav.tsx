import Link from 'next/link';
import { canViewBudgetRole } from '@/lib/roles';
import { cn } from '@/lib/utils';
import type { ProjectRole } from '@/types/database';

export type ProjectTab = 'overview' | 'tasks' | 'documents' | 'budget' | 'members' | 'notifications';

/** Navigasi tab antar halaman project. Tab Budget hanya muncul untuk yang berhak melihatnya. */
export function ProjectNav({
  projectId,
  projectName,
  active,
  myRole,
}: {
  projectId: string;
  projectName: string;
  active: ProjectTab;
  myRole: ProjectRole;
}) {
  const tabs: { key: ProjectTab; label: string; href: string }[] = [
    { key: 'overview', label: 'Ringkasan', href: `/projects/${projectId}` },
    { key: 'tasks', label: 'Task Board', href: `/projects/${projectId}/tasks` },
    { key: 'documents', label: 'Dokumen', href: `/projects/${projectId}/documents` },
    ...(canViewBudgetRole(myRole) ? [{ key: 'budget' as const, label: 'Budget', href: `/projects/${projectId}/budget` }] : []),
    { key: 'members', label: 'Anggota & Divisi', href: `/projects/${projectId}/members` },
    { key: 'notifications', label: 'Notifikasi', href: `/projects/${projectId}/settings/notifications` },
  ];
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-teal">{projectName}</p>
      <nav className="mt-2 flex gap-1 overflow-x-auto border-b border-gray-200" aria-label="Navigasi project">
        {tabs.map((t) => (
          <Link
            key={t.key}
            href={t.href}
            className={cn(
              'whitespace-nowrap border-b-2 px-3 py-2 text-sm font-semibold transition-colors',
              active === t.key ? 'border-orange text-navy' : 'border-transparent text-muted hover:text-ink'
            )}
          >
            {t.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
