import { AppShell } from '@/components/layout/app-shell';
import { getProjectContext } from '@/lib/project-context';

export default async function ProjectLayout({ children, params }: { children: React.ReactNode; params: { projectId: string } }) {
  const ctx = await getProjectContext(params.projectId);
  return <AppShell project={ctx}>{children}</AppShell>;
}
