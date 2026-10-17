'use client';

import { FormEvent, useEffect, useState } from 'react';
import { createInvite, revokeInvite } from '@/actions/invite-actions';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Input, Label, Select } from '@/components/ui/input';
import { LoadingOverlay } from '@/components/ui/loading-overlay';
import { useAction } from '@/lib/use-action';
import { formatDate } from '@/lib/utils';
import type { Invite } from '@/types/database';

interface Props {
  scope: 'organization' | 'project';
  organizationId: string;
  projectId?: string;
  divisions?: { id: string; name: string }[];
  /** Daftar link yang masih aktif (belum dicabut & belum kedaluwarsa). */
  invites: Invite[];
  /** Halaman yang perlu di-refresh setelah link dicabut. */
  path: string;
}

/** Membuat, menyalin, membagikan (WhatsApp), dan mencabut link undangan. */
export function InviteManager({ scope, organizationId, projectId, divisions = [], invites, path }: Props) {
  const [origin, setOrigin] = useState('');
  const [newToken, setNewToken] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const { error, busy, run } = useAction();

  useEffect(() => setOrigin(window.location.origin), []);

  const linkFor = (token: string) => `${origin}/join/${token}`;

  function handleCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    if (scope === 'project') formData.set('projectId', projectId ?? '');
    else formData.set('organizationId', organizationId);
    void run(() => createInvite(formData), { onSuccess: (r) => setNewToken(r.data?.token ?? null) });
  }

  function handleRevoke(inviteId: string) {
    if (!window.confirm('Cabut link ini? Orang yang belum bergabung tidak akan bisa memakainya lagi.')) return;
    const formData = new FormData();
    formData.set('inviteId', inviteId);
    formData.set('path', path);
    void run(() => revokeInvite(formData));
  }

  async function copy(token: string) {
    try {
      await navigator.clipboard.writeText(linkFor(token));
      setCopied(token);
      setTimeout(() => setCopied((c) => (c === token ? null : c)), 2000);
    } catch {
      window.prompt('Salin link ini:', linkFor(token));
    }
  }

  const shareText = (token: string) =>
    encodeURIComponent(
      `Kamu diundang bergabung ${scope === 'project' ? 'ke project' : 'ke organisasi'} di CampusFlow: ${linkFor(token)}`
    );

  return (
    <Card>
      <CardHeader>
        <h2 className="font-heading text-base font-bold text-ink">Link Undangan</h2>
        <p className="text-xs text-muted">
          {scope === 'project'
            ? 'Siapa pun yang punya link dan sudah login bisa langsung bergabung ke project ini sebagai Member (dan ke organisasi bila belum).'
            : 'Siapa pun yang punya link dan sudah login bisa langsung bergabung ke organisasi ini sebagai Member.'}{' '}
          Peran lain bisa diatur setelah bergabung.
        </p>
      </CardHeader>
      <CardBody className="space-y-5">
        <form onSubmit={handleCreate} className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <Label htmlFor={`exp-${scope}`}>Berlaku</Label>
            <Select id={`exp-${scope}`} name="expiresDays" defaultValue="7">
              <option value="1">1 hari</option>
              <option value="3">3 hari</option>
              <option value="7">7 hari</option>
              <option value="14">14 hari</option>
              <option value="30">30 hari</option>
            </Select>
          </div>
          <div>
            <Label htmlFor={`max-${scope}`}>Batas pemakaian</Label>
            <Input id={`max-${scope}`} name="maxUses" type="number" min={1} placeholder="Tanpa batas" />
          </div>
          {scope === 'project' && (
            <div>
              <Label htmlFor="inv-division">Divisi (opsional)</Label>
              <Select id="inv-division" name="divisionId" defaultValue="">
                <option value="">Tanpa divisi</option>
                {divisions.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </Select>
            </div>
          )}
          <div className="sm:col-span-3">
            <Button type="submit" size="sm" disabled={busy}>
              {busy ? 'Membuat...' : '+ Buat Link Baru'}
            </Button>
          </div>
        </form>

        {error && <p className="text-sm text-red-600">{error}</p>}

        {newToken && (
          <div className="rounded-lg border border-green-200 bg-green-50 p-3">
            <p className="text-xs font-semibold text-green-800">Link baru siap dibagikan:</p>
            <p className="mt-1 break-all text-sm text-ink">{linkFor(newToken)}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Button type="button" size="sm" onClick={() => copy(newToken)}>
                {copied === newToken ? 'Tersalin ✓' : 'Salin Link'}
              </Button>
              <a
                href={`https://wa.me/?text=${shareText(newToken)}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-navy hover:bg-gray-50"
              >
                Bagikan lewat WhatsApp
              </a>
            </div>
          </div>
        )}

        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Link aktif</h3>
          {invites.length === 0 ? (
            <p className="text-sm text-muted">Belum ada link aktif.</p>
          ) : (
            <ul className="divide-y divide-gray-100 rounded-lg border border-gray-100">
              {invites.map((inv) => (
                <li key={inv.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-mono text-xs text-ink">…/join/{inv.token.slice(0, 10)}…</p>
                    <p className="text-xs text-muted">
                      Sampai {formatDate(inv.expires_at)} • dipakai {inv.uses_count}
                      {inv.max_uses ? `/${inv.max_uses}` : ''}×
                    </p>
                  </div>
                  <div className="flex gap-1.5">
                    <Button type="button" size="sm" variant="ghost" onClick={() => copy(inv.token)}>
                      {copied === inv.token ? 'Tersalin ✓' : 'Salin'}
                    </Button>
                    <Button type="button" size="sm" variant="danger" disabled={busy} onClick={() => handleRevoke(inv.id)}>
                      Cabut
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </CardBody>
      {busy && <LoadingOverlay label="Memproses..." />}
    </Card>
  );
}
