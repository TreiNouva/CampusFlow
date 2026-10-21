import { PageHeader } from '@/components/layout/page-header';
import { Card, CardBody } from '@/components/ui/card';
import { AnnouncementForm } from '@/components/projects/announcement-form';
import { AnnouncementList } from '@/components/projects/announcement-list';
import { createClient } from '@/lib/supabase/server';
import { getProjectContext } from '@/lib/project-context';
import { canManageAnyScope, canPostAnnouncementRole, isProjectManagerRole } from '@/lib/roles';
import type { Announcement } from '@/types/database';

export default async function AnnouncementsPage({ params }: { params: { projectId: string } }) {
  const { project, myRole, myDivisionId, userId } = await getProjectContext(params.projectId);
  const supabase = createClient();
  const [{ data: announcements }, { data: divisions }] = await Promise.all([
    supabase
      .from('announcements')
      .select('*, author:profiles!announcements_author_id_fkey(id, full_name), division:project_divisions(id, name, color)')
      .eq('project_id', project.id)
      .order('created_at', { ascending: false })
      .limit(50),
    supabase.from('project_divisions').select('id, name, color').eq('project_id', project.id).order('created_at'),
  ]);

  const canPost = canPostAnnouncementRole(myRole) || canManageAnyScope(myRole, myDivisionId);
  const canModerate = isProjectManagerRole(myRole);
  const seesAll = ['ketua', 'project_manager', 'wakil_project_manager', 'sekretaris'].includes(myRole);

  return (
    <main className="mx-auto max-w-4xl space-y-4 px-4 py-6 sm:px-6 lg:px-8">
      <PageHeader
        title="Pengumuman"
        description={seesAll ? 'Kamu melihat pengumuman Global dan semua divisi.' : `Kamu melihat pengumuman Global${myDivisionId ? ' dan untuk divisimu' : ''}.`}
      />
      {canPost ? (
        <AnnouncementForm projectId={project.id} divisions={(divisions ?? []) as any[]} myRole={myRole} myDivisionId={myDivisionId} />
      ) : (
        <p className="text-xs text-muted">Pengumuman dibuat oleh Project Manager, Wakil PM, PIC, Koordinator, atau Sekretaris.</p>
      )}
      <Card>
        <CardBody>
          <AnnouncementList announcements={(announcements ?? []) as unknown as Announcement[]} projectId={project.id} currentUserId={userId} canModerate={canModerate} />
        </CardBody>
      </Card>
    </main>
  );
}
