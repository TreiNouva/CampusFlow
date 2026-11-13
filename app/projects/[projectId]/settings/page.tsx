import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/layout/page-header';
import { ArchiveProjectButton, DeleteProjectForm, Panel, ProjectInfoForm } from '@/components/manage/manage-forms';
import { getProjectContext } from '@/lib/project-context';

export default async function ProjectSettingsPage(props: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await props.params;
  const ctx = await getProjectContext(projectId);
  if (!ctx.canManage) notFound();
  const p = ctx.project;
  const archived = p.status === 'archived';
  return (
    <main className="mx-auto max-w-3xl space-y-5 px-4 py-6 sm:px-6 lg:px-8">
      <PageHeader title="Pengaturan Project" description="Ubah nama, deskripsi, dan periode project." />
      {!archived && (
        <Panel title="Info project">
          <ProjectInfoForm project={p} />
        </Panel>
      )}
      <Panel title={archived ? 'Project diarsipkan' : 'Arsipkan project'}
        description={archived
          ? 'Project ini hanya bisa dilihat dan tidak dihitung dalam kuota project aktif. Buka arsip untuk mengubahnya lagi (kuota dicek).'
          : 'Untuk project yang sudah selesai: semua data tetap tersimpan dan bisa dilihat, tapi tidak bisa diubah, dan tidak dihitung dalam kuota project aktif.'}>
        <ArchiveProjectButton projectId={p.id} archived={archived} />
      </Panel>
      {ctx.canDelete && p.organization && (
        <Panel danger title="Hapus project" description="Semua task, acara, pengumuman, dokumen, budget, dan riwayat project ini ikut terhapus dan tidak bisa dikembalikan.">
          <DeleteProjectForm projectId={p.id} organizationId={p.organization.id} name={p.name} />
        </Panel>
      )}
    </main>
  );
}
