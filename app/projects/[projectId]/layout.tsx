import Link from 'next/link';
import { AppShell } from '@/components/layout/app-shell';
import { getProjectContext } from '@/lib/project-context';

export default async function ProjectLayout(
  props: { children: React.ReactNode; params: Promise<{ projectId: string }> }
) {
  const { projectId } = await props.params;
  const ctx = await getProjectContext(projectId);
  const archived = ctx.project.status === 'archived';
  return (
    <AppShell project={ctx}>
      {archived && (
        <div className="border-b border-warn-line bg-orange-light px-4 py-2.5 text-sm text-warn-ink sm:px-6 lg:px-8 print:hidden" role="status">
          Project ini sudah <b>diarsipkan</b> dan hanya bisa dilihat.
          {ctx.canManage && (
            <> <Link href={`/projects/${projectId}/settings`} className="font-semibold underline underline-offset-2">Buka arsip</Link></>
          )}
        </div>
      )}
      {props.children}
    </AppShell>
  );
}
