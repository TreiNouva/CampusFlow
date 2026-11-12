import type { Metadata } from 'next';
import { JoinInviteCard } from '@/components/invites/join-invite-card';
import { getCurrentUser } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Undangan — CampusFlow' };

interface Preview {
  valid: boolean;
  reason?: string | null;
  organization_name?: string | null;
  project_name?: string | null;
  division_name?: string | null;
  inviter_name?: string | null;
}

export default async function JoinPage({ params }: { params: { token: string } }) {
  const token = params.token;
  const user = await getCurrentUser();

  // Format token tidak valid -> tidak perlu bertanya ke database
  let preview: Preview = { valid: false, reason: 'Link undangan tidak valid.' };
  if (/^[A-Za-z0-9]{20,100}$/.test(token)) {
    const { data } = await createClient().rpc('invite_preview', { p_token: token });
    if (data) preview = data as Preview;
  }

  return (
    <JoinInviteCard
      token={token}
      valid={preview.valid}
      reason={preview.reason}
      organizationName={preview.organization_name}
      projectName={preview.project_name}
      divisionName={preview.division_name}
      inviterName={preview.inviter_name}
      isLoggedIn={Boolean(user)}
    />
  );
}
