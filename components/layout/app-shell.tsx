import { getCurrentProfile, requireUser } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { canViewBudgetRole, memberTitle } from '@/lib/roles';
import type { ProjectContext } from '@/lib/project-context';
import { ShellFrame, type MenuSection, type ProjectHeader } from './shell-frame';

/**
 * Kerangka aplikasi setelah login (v7), terinspirasi menu m-banking:
 *  - Desktop: menu samping (sidebar) yang rapi per kelompok.
 *  - HP: bar atas dengan tombol menu (hamburger) + bar navigasi bawah untuk menu yang paling sering dipakai.
 * Konten halaman tidak lagi menumpuk tab/menu di atasnya.
 */
export async function AppShell({ children, project }: { children: React.ReactNode; project?: ProjectContext }) {
  const user = await requireUser();
  const [profile, { data: orgRows }] = await Promise.all([
    getCurrentProfile(),
    createClient().from('organization_members').select('organization:organizations(id, name)').eq('user_id', user.id),
  ]);

  const organizations = ((orgRows ?? []) as any[])
    .map((r) => r.organization as { id: string; name: string } | null)
    .filter((o): o is { id: string; name: string } => Boolean(o))
    .sort((a, b) => a.name.localeCompare(b.name));

  let sections: MenuSection[];
  let header: ProjectHeader | undefined;
  let bottomNav: MenuSection['items'] | undefined;

  if (project) {
    const base = `/projects/${project.project.id}`;
    const main: MenuSection['items'] = [
      { href: base, label: 'Ringkasan', icon: 'home', exact: true },
      { href: `${base}/tasks`, label: 'Task', icon: 'tasks' },
      { href: `${base}/calendar`, label: 'Kalender', icon: 'calendar' },
      { href: `${base}/announcements`, label: 'Pengumuman', icon: 'megaphone' },
      { href: `${base}/documents`, label: 'Dokumen', icon: 'file' },
    ];
    const manage: MenuSection['items'] = [
      ...(canViewBudgetRole(project.myRole) ? [{ href: `${base}/budget`, label: 'Budget', icon: 'wallet' as const }] : []),
      { href: `${base}/members`, label: 'Anggota & Divisi', icon: 'users' },
      { href: `${base}/stats`, label: 'Statistik', icon: 'chart' },
      { href: `${base}/settings/notifications`, label: 'Notifikasi Email', icon: 'bell' },
    ];
    sections = [
      { title: 'Project', items: main },
      { title: 'Kelola', items: manage },
    ];
    header = {
      backHref: project.project.organization ? `/organizations/${project.project.organization.id}` : '/dashboard',
      backLabel: project.project.organization?.name ?? 'Beranda',
      title: project.project.name,
      subtitle: memberTitle(project.myRole, project.myDivisionName),
    };
    bottomNav = [main[0], main[1], main[2], main[4]];
  } else {
    sections = [
      { title: 'Menu', items: [{ href: '/dashboard', label: 'Beranda', icon: 'home', exact: true }] },
      {
        title: 'Organisasi',
        items: organizations.length
          ? organizations.map((o) => ({ href: `/organizations/${o.id}`, label: o.name, icon: 'building' as const }))
          : [{ href: '/dashboard#create-organization', label: 'Buat organisasi', icon: 'plus' as const }],
      },
    ];
  }

  return (
    <ShellFrame
      sections={sections}
      header={header}
      bottomNav={bottomNav}
      user={{ name: profile?.full_name || profile?.email || 'Pengguna', email: profile?.email ?? '' }}
      showTour={profile ? !profile.onboarded_at : false}
    >
      {children}
    </ShellFrame>
  );
}
