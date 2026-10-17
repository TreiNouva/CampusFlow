'use client';

import { joinProject } from '@/actions/member-actions';
import { Button } from '@/components/ui/button';
import { LoadingOverlay } from '@/components/ui/loading-overlay';
import { useAction } from '@/lib/use-action';

/** Anggota organisasi bergabung sendiri ke project yang ada di organisasinya. */
export function JoinProjectButton({ projectId, organizationId }: { projectId: string; organizationId: string }) {
  const { error, busy, run } = useAction();

  function handleJoin() {
    const fd = new FormData();
    fd.set('projectId', projectId);
    fd.set('organizationId', organizationId);
    void run(() => joinProject(fd));
  }

  return (
    <div>
      <Button type="button" size="sm" variant="secondary" onClick={handleJoin} disabled={busy}>
        {busy ? 'Bergabung...' : 'Gabung Project'}
      </Button>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      {busy && <LoadingOverlay label="Bergabung ke project..." />}
    </div>
  );
}
