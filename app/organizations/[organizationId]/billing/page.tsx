import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/layout/page-header';
import { BillingPanel } from '@/components/billing/billing-panel';
import { requireUser } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { getOrgBilling } from '@/lib/billing';
import type { OrgRole } from '@/types/database';

export default async function BillingPage(props: { params: Promise<{ organizationId: string }> }) {
  const params = await props.params;
  const user = await requireUser();
  const { data: membership } = await createClient()
    .from('organization_members')
    .select('role, organization:organizations(id, name)')
    .eq('organization_id', params.organizationId)
    .eq('user_id', user.id)
    .maybeSingle();
  const org = (membership as any)?.organization as { id: string; name: string } | null;
  if (!membership || !org) notFound();

  const billing = await getOrgBilling(org.id, membership.role as OrgRole);

  return (
    <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
      <PageHeader title="Paket & Pembayaran" description={`Kuota dan langganan untuk ${org.name}.`} />
      <BillingPanel organizationId={org.id} organizationName={org.name} {...billing} />
    </main>
  );
}
