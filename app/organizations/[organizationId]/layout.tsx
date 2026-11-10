import { notFound } from 'next/navigation';
import { AppShell } from '@/components/layout/app-shell';
import { requireUser } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';

export default async function OrganizationLayout({ children, params }: { children: React.ReactNode; params: { organizationId: string } }) {
  const user = await requireUser();
  const { data } = await createClient()
    .from('organization_members')
    .select('role, organization:organizations(id, name)')
    .eq('organization_id', params.organizationId)
    .eq('user_id', user.id)
    .maybeSingle();
  const org = (data as any)?.organization as { id: string; name: string } | null;
  if (!data || !org) notFound();
  return <AppShell org={{ id: org.id, name: org.name, role: (data as any).role }}>{children}</AppShell>;
}
