'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { prepareUpload, registerDocument } from '@/actions/document-actions';
import { createClient } from '@/lib/supabase/client';
import { ACCEPT_ATTRIBUTE, DOCUMENT_BUCKET, DOCUMENT_CATEGORIES, DOCUMENT_CATEGORY_LABEL, MAX_DOCUMENT_BYTES, fileIcon } from '@/lib/documents';
import { Select } from '@/components/ui/input';
import { cn, formatBytes, NETWORK_ERROR_MESSAGE } from '@/lib/utils';

interface Props {
  projectId: string;
  taskId?: string | null;
  /** Pilihan cakupan (hanya untuk dokumen umum, bukan lampiran task). */
  scopeOptions?: { id: string | null; label: string }[];
  compact?: boolean;
}

type Item = { name: string; size: number; state: 'uploading' | 'done' | 'error'; message?: string };

/** Unggah file langsung ke Supabase Storage (tidak lewat server Vercel), lalu dicatat di database. Mendukung banyak file & drag-drop. */
export function DocumentUploader({ projectId, taskId = null, scopeOptions, compact = false }: Props) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [drag, setDrag] = useState(false);
  const [category, setCategory] = useState('lainnya');
  const [scope, setScope] = useState<string>(scopeOptions?.[0]?.id ?? '');
  const busy = items.some((i) => i.state === 'uploading');

  const patch = (idx: number, p: Partial<Item>) => setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...p } : it)));

  async function uploadAll(files: File[]) {
    if (!files.length) return;
    const base = items.length;
    setItems((prev) => [...prev, ...files.map((f) => ({ name: f.name, size: f.size, state: 'uploading' as const }))]);
    const supabase = createClient();
    for (let n = 0; n < files.length; n++) {
      const file = files[n];
      const idx = base + n;
      try {
        if (file.size > MAX_DOCUMENT_BYTES) { patch(idx, { state: 'error', message: `Maksimal ${MAX_DOCUMENT_BYTES / 1024 / 1024} MB` }); continue; }
        const divisionId = taskId ? null : scope || null;
        const prep = await prepareUpload({ projectId, taskId, divisionId, fileName: file.name, size: file.size });
        if (!prep.success || !prep.data) { patch(idx, { state: 'error', message: prep.error }); continue; }
        const { error: upErr } = await supabase.storage.from(DOCUMENT_BUCKET).uploadToSignedUrl(prep.data.path, prep.data.token, file, { contentType: file.type || undefined });
        if (upErr) { patch(idx, { state: 'error', message: 'Gagal mengunggah file.' }); continue; }
        const reg = await registerDocument({ projectId, taskId, divisionId, category, path: prep.data.path, name: file.name, size: file.size, mime: file.type || null });
        patch(idx, reg.success ? { state: 'done' } : { state: 'error', message: reg.error });
      } catch {
        patch(idx, { state: 'error', message: NETWORK_ERROR_MESSAGE });
      }
    }
    router.refresh();
  }

  return (
    <div>
      {!taskId && (
        <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-semibold text-muted" htmlFor="doc-cat">Kategori</label>
            <Select id="doc-cat" value={category} onChange={(e) => setCategory(e.target.value)}>
              {DOCUMENT_CATEGORIES.map((c) => <option key={c} value={c}>{DOCUMENT_CATEGORY_LABEL[c]}</option>)}
            </Select>
          </div>
          {scopeOptions && (
            <div>
              <label className="mb-1 block text-xs font-semibold text-muted" htmlFor="doc-scope">Dapat dilihat oleh</label>
              <Select id="doc-scope" value={scope} onChange={(e) => setScope(e.target.value)}>
                {scopeOptions.map((o) => <option key={o.id ?? 'global'} value={o.id ?? ''}>{o.label}</option>)}
              </Select>
            </div>
          )}
        </div>
      )}
      <div
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); void uploadAll(Array.from(e.dataTransfer.files)); }}
        onClick={() => inputRef.current?.click()}
        role="button" tabIndex={0}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && inputRef.current?.click()}
        className={cn('cursor-pointer rounded-lg border-2 border-dashed text-center transition-colors',
          compact ? 'px-4 py-4' : 'px-4 py-8', drag ? 'border-orange bg-orange-light' : 'border-gray-200 hover:border-teal hover:bg-sky/30')}
      >
        <p className="text-sm font-semibold text-navy">{drag ? 'Lepaskan file di sini' : '📎 Tarik file ke sini atau klik untuk memilih'}</p>
        <p className="mt-0.5 text-xs text-muted">PDF, Word, Excel, PowerPoint, gambar, ZIP · maks. {MAX_DOCUMENT_BYTES / 1024 / 1024} MB per file</p>
        <input ref={inputRef} type="file" multiple accept={ACCEPT_ATTRIBUTE} className="hidden"
          onChange={(e) => { void uploadAll(Array.from(e.target.files ?? [])); e.target.value = ''; }} />
      </div>
      {items.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {items.map((it, i) => (
            <li key={i} className="flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-1.5 text-xs">
              <span aria-hidden>{fileIcon(it.name)}</span>
              <span className="min-w-0 flex-1 truncate text-ink">{it.name} <span className="text-muted">({formatBytes(it.size)})</span></span>
              {it.state === 'uploading' && <span className="animate-pulse font-semibold text-teal">Mengunggah…</span>}
              {it.state === 'done' && <span className="font-semibold text-green-700">✓ Terunggah</span>}
              {it.state === 'error' && <span className="font-semibold text-red-600">{it.message ?? 'Gagal'}</span>}
            </li>
          ))}
        </ul>
      )}
      {busy && <p className="mt-2 text-xs text-muted">Jangan tutup halaman sampai selesai.</p>}
    </div>
  );
}
