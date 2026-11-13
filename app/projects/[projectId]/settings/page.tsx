import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/layout/page-header';
import { DeleteProjectForm, Panel, ProjectInfoForm } from '@/components/manage/manage-forms';
import { getProjectContext } from '@/lib/project-context';

export default async function ProjectSettingsPage(props: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await props.params;
  const ctx = await getProjectContext(projectId);
  if (!ctx.canManage) notFound();
  const p = ctx.project;
  return (
    <main className="mx-auto max-w-3xl space-y-5 px-4 py-6 sm:px-6 lg:px-8">
      <PageHeader title="Pengaturan Project" description="Ubah nama, deskripsi, dan periode project." />
      <Panel title="Info project">
        <ProjectInfoForm project={p} />
      </Panel>
      {ctx.canDelete && p.organization && (
        <Panel danger title="Hapus project" description="Semua task, acara, pengumuman, dokumen, budget, dan riwayat project ini ikut terhapus dan tidak bisa dikembalikan.">
          <DeleteProjectForm projectId={p.id} organizationId={p.organization.id} name={p.name} />
        </Panel>
      )}
    </main>
  );
}
