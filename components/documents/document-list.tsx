'use client';

import { useState } from 'react';
import { deleteDocument, getDocumentUrl } from '@/actions/document-actions';
import { DOCUMENT_CATEGORY_LABEL, fileIcon } from '@/lib/documents';
import { divisionColor, GLOBAL_COLOR } from '@/lib/colors';
import { useAction } from '@/lib/use-action';
import { formatBytes, formatDateTime } from '@/lib/utils';
import type { DocumentCategory } from '@/types/database';

export interface DocItem {
  id: string;
  name: string;
  category: DocumentCategory;
  size_bytes: number;
  created_at: string;
  uploaderName: string;
  uploadedBy: string;
  taskId: string | null;
  taskTitle: string | null;
  divisionName: string | null;
  divisionColor: string | null;
}

export function DocumentList({ projectId, docs, currentUserId, canModerate }: { projectId: string; docs: DocItem[]; currentUserId: string; canModerate: boolean }) {
  const { error, busy, run } = useAction();
  const [opening, setOpening] = useState<string | null>(null);

  async function open(id: string) {
    setOpening(id);
    const res = await run(() => getDocumentUrl(id), { refresh: false, onSuccess: (r) => r.data && window.open(r.data.url, '_blank', 'noopener') });
    void res;
    setOpening(null);
  }
  function remove(d: DocItem) {
    if (!window.confirm(`Hapus "${d.name}"?`)) return;
    void run(() => deleteDocument(d.id, projectId));
  }

  if (docs.length === 0) return <p className="text-sm text-muted">Belum ada dokumen.</p>;
  return (
    <>
      <ul className="divide-y divide-gray-100">
        {docs.map((d) => {
          const c = d.divisionName ? divisionColor(d.divisionColor) : GLOBAL_COLOR;
          return (
            <li key={d.id} className="flex flex-wrap items-center gap-3 py-2.5">
              <span className="text-xl" aria-hidden>{fileIcon(d.name)}</span>
              <div className="min-w-0 flex-1">
                <button type="button" onClick={() => open(d.id)} disabled={busy} className="block max-w-full truncate text-left text-sm font-semibold text-navy hover:underline">
                  {opening === d.id ? 'Membuka…' : d.name}
                </button>
                <p className="text-xs text-muted">
                  {formatBytes(d.size_bytes)} · {d.uploaderName} · {formatDateTime(d.created_at)}
                  {d.taskId && d.taskTitle && <> · task: <a className="underline" href={`/projects/${projectId}/tasks/${d.taskId}`}>{d.taskTitle ?? 'lihat'}</a></>}
                </p>
              </div>
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-muted">{DOCUMENT_CATEGORY_LABEL[d.category]}</span>
              {!d.taskId && (
                <span className="rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ backgroundColor: c.bg, color: c.text }}>
                  {d.divisionName ? `Divisi ${d.divisionName}` : 'Global'}
                </span>
              )}
              {(d.uploadedBy === currentUserId || canModerate) && (
                <button type="button" onClick={() => remove(d)} disabled={busy} className="rounded-md px-2 py-1 text-xs text-red-600 hover:bg-red-50">Hapus</button>
              )}
            </li>
          );
        })}
      </ul>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </>
  );
}
