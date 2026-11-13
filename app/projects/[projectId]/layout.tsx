import { AppShell } from '@/components/layout/app-shell';
import { getProjectContext } from '@/lib/project-context';

export default async function ProjectLayout(
  props: { children: React.ReactNode; params: Promise<{ projectId: string }> }
) {
  const params = await props.params;

  const {
    children
  } = props;

  const ctx = await getProjectContext(params.projectId);
  return <AppShell project={ctx}>{children}</AppShell>;
}
