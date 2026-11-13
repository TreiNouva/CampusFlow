import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/layout/page-header';
import { DeleteOrganizationForm, LeaveOrganizationButton, OrganizationInfoForm, Panel } from '@/components/manage/manage-forms';
import { requireUser } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';

export default async function OrganizationSettingsPage(props: { params: Promise<{ organizationId: string }> }) {
  const { organizationId } = await props.params;
  const user = await requireUser();
  const { data } = await (await createClient())
    .from('organization_members')
    .select('role, organization:organizations(id, name, description)')
    .eq('organization_id', organizationId)
    .eq('user_id', user.id)
    .maybeSingle();
  const org = (data as any)?.organization as { id: string; name: string; description: string | null } | null;
  if (!data || !org) notFound();
  const role = (data as any).role as string;
  const canEdit = role === 'ketua' || role === 'wakil_ketua';
  const isKetua = role === 'ketua';

  return (
    <main className="mx-auto max-w-3xl space-y-5 px-4 py-6 sm:px-6 lg:px-8">
      <PageHeader title="Pengaturan Organisasi" description={org.name} />
      {canEdit ? (
        <Panel title="Info organisasi">
          <OrganizationInfoForm org={org} />
        </Panel>
      ) : (
        <Panel title="Info organisasi" description="Hanya Ketua dan Wakil Ketua yang bisa mengubah info organisasi.">
          <p className="font-semibold text-ink">{org.name}</p>
          {org.description && <p className="mt-1 whitespace-pre-line text-sm text-gray-600">{org.description}</p>}
        </Panel>
      )}
      {isKetua ? (
        <Panel danger title="Hapus organisasi" description="Semua project, anggota, undangan, dan data organisasi ini ikut terhapus dan tidak bisa dikembalikan.">
          <DeleteOrganizationForm organizationId={org.id} name={org.name} />
        </Panel>
      ) : (
        <Panel danger title="Keluar dari organisasi" description="Kamu juga akan dikeluarkan dari semua project di organisasi ini. Untuk bergabung lagi perlu undangan baru.">
          <LeaveOrganizationButton organizationId={org.id} name={org.name} />
        </Panel>
      )}
    </main>
  );
}
