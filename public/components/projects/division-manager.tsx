'use client';

import { FormEvent, useRef } from 'react';
import { createDivision, deleteDivision, updateDivisionColor } from '@/actions/division-actions';
import { DIVISION_PALETTE, divisionColor } from '@/lib/colors';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Input, Label } from '@/components/ui/input';
import { LoadingOverlay } from '@/components/ui/loading-overlay';
import { useAction } from '@/lib/use-action';

interface Props {
  projectId: string;
  divisions: { id: string; name: string; color: string; memberCount: number }[];
  /** Hanya Project Manager / Wakil PM yang boleh membuat & menghapus divisi. */
  canManage: boolean;
}

export function DivisionManager({ projectId, divisions, canManage }: Props) {
  const { error, busy, run } = useAction();
  const formRef = useRef<HTMLFormElement>(null);

  function handleCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    void run(() => createDivision(formData), { onSuccess: () => formRef.current?.reset() });
  }

  function handleColor(id: string, color: string) {
    const fd = new FormData();
    fd.set('projectId', projectId);
    fd.set('divisionId', id);
    fd.set('color', color);
    void run(() => updateDivisionColor(fd));
  }

  function handleDelete(id: string, name: string) {
    if (!window.confirm(`Hapus divisi "${name}"? Anggotanya tetap di project, hanya kehilangan title divisi.`)) return;
    const fd = new FormData();
    fd.set('projectId', projectId);
    fd.set('divisionId', id);
    void run(() => deleteDivision(fd));
  }

  return (
    <Card>
      <CardHeader>
        <h2 className="font-heading text-base font-bold text-ink">Divisi</h2>
        <p className="text-xs text-muted">
          Divisi dibuat oleh Project Manager. PIC, Koordinator, dan Member yang masuk divisi mendapat title sesuai
          divisinya (mis. &quot;Koordinator Acara&quot;).
        </p>
      </CardHeader>
      <CardBody className="space-y-4">
        {divisions.length === 0 ? (
          <p className="text-sm text-muted">
            Belum ada divisi.{canManage ? ' Buat divisi pertama di bawah.' : ' Project Manager belum membuat divisi.'}
          </p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {divisions.map((d) => (
              <li
                key={d.id}
                className="flex items-center gap-2 rounded-full border border-gray-200 bg-gray-50 py-1 pl-3 pr-2 text-sm"
              >
                {canManage ? (
                  <label className="relative flex cursor-pointer items-center" title="Ganti warna divisi">
                    <span className="h-3.5 w-3.5 rounded-full ring-2 ring-white" style={{ backgroundColor: divisionColor(d.color).accent }} />
                    <select
                      aria-label={`Warna divisi ${d.name}`}
                      value={d.color}
                      onChange={(e) => handleColor(d.id, e.target.value)}
                      disabled={busy}
                      className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                    >
                      {DIVISION_PALETTE.map((c) => (
                        <option key={c.key} value={c.key}>{c.label}</option>
                      ))}
                    </select>
                  </label>
                ) : (
                  <span className="h-3.5 w-3.5 rounded-full" style={{ backgroundColor: divisionColor(d.color).accent }} />
                )}
                <span className="font-medium text-ink">{d.name}</span>
                <span className="text-xs text-muted">{d.memberCount} orang</span>
                {canManage && (
                  <button
                    type="button"
                    onClick={() => handleDelete(d.id, d.name)}
                    disabled={busy}
                    className="rounded-full px-1.5 text-muted hover:bg-red-100 hover:text-red-600"
                    aria-label={`Hapus divisi ${d.name}`}
                  >
                    ✕
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}

        {canManage && (
          <form ref={formRef} onSubmit={handleCreate} className="flex items-end gap-2">
            <input type="hidden" name="projectId" value={projectId} />
            <div className="flex-1">
              <Label htmlFor="division-name">Nama divisi baru</Label>
              <Input id="division-name" name="name" placeholder="mis. Acara, Konsumsi, Humas" required minLength={2} maxLength={60} />
            </div>
            <Button type="submit" size="sm" disabled={busy}>
              Tambah
            </Button>
          </form>
        )}
        {error && <p className="text-sm text-red-600">{error}</p>}
      </CardBody>
      {busy && <LoadingOverlay label="Memproses..." />}
    </Card>
  );
}
