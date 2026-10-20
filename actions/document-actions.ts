'use server';

import { randomUUID } from 'crypto';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireUser } from '@/lib/auth/session';
import { rpcErrorMessage } from '@/lib/rpc';
import { ALLOWED_DOCUMENT_EXTENSIONS, DOCUMENT_BUCKET, MAX_DOCUMENT_BYTES, extensionOf, safeFileName } from '@/lib/documents';
import { documentCategorySchema } from '@/lib/validations/schemas';
import type { ActionResult } from './organization-actions';

// Catatan: file 'use server' hanya boleh mengekspor fungsi async (konstanta ada di lib/documents.ts).

const uuidRe = /^[0-9a-f-]{36}$/i;
const DENIED = 'Kamu tidak berhak mengunggah dokumen di sini (Member hanya ke task/divisinya sendiri; Ketua hanya melihat).';

async function ensureBucket() {
  const admin = createAdminClient();
  const { error } = await admin.storage.createBucket(DOCUMENT_BUCKET, {
    public: false,
    fileSizeLimit: MAX_DOCUMENT_BYTES,
  });
  // "already exists" bukan masalah
  if (error && !/already exists|duplicate/i.test(error.message)) {
    console.error('[ensureBucket]', error.message);
  }
}

/** Langkah 1: cek hak akses + validasi file, lalu beri URL unggah sekali pakai (file langsung ke Storage, tidak lewat server). */
export async function prepareUpload(input: {
  projectId: string;
  taskId: string | null;
  divisionId: string | null;
  fileName: string;
  size: number;
}): Promise<ActionResult<{ path: string; token: string }>> {
  await requireUser();
  if (!uuidRe.test(input.projectId) || (input.taskId && !uuidRe.test(input.taskId)) || (input.divisionId && !uuidRe.test(input.divisionId))) {
    return { success: false, error: 'Permintaan tidak valid.' };
  }
  const ext = extensionOf(input.fileName);
  if (!ALLOWED_DOCUMENT_EXTENSIONS.includes(ext)) {
    return { success: false, error: `Jenis file .${ext || '?'} tidak didukung. Boleh: ${ALLOWED_DOCUMENT_EXTENSIONS.join(', ')}.` };
  }
  if (input.size <= 0 || input.size > MAX_DOCUMENT_BYTES) {
    return { success: false, error: `Ukuran file maksimal ${MAX_DOCUMENT_BYTES / 1024 / 1024} MB.` };
  }

  const supabase = createClient();
  const { data: allowed, error } = await supabase.rpc('can_add_document', {
    p_project: input.projectId, p_task: input.taskId, p_div: input.divisionId,
  });
  if (error) return { success: false, error: rpcErrorMessage(error) };
  if (!allowed) return { success: false, error: DENIED };

  await ensureBucket();
  const path = `${input.projectId}/${randomUUID()}-${safeFileName(input.fileName)}`;
  const { data, error: signError } = await createAdminClient().storage.from(DOCUMENT_BUCKET).createSignedUploadUrl(path);
  if (signError || !data) {
    console.error('[prepareUpload]', signError?.message);
    return { success: false, error: 'Gagal menyiapkan unggahan. Pastikan SUPABASE_SERVICE_ROLE_KEY sudah diisi di Vercel.' };
  }
  return { success: true, data: { path, token: data.token } };
}

/** Langkah 2: setelah file terunggah, catat di database (RLS memeriksa hak akses lagi). */
export async function registerDocument(input: {
  projectId: string;
  taskId: string | null;
  divisionId: string | null;
  category: string;
  path: string;
  name: string;
  size: number;
  mime: string | null;
}): Promise<ActionResult> {
  const user = await requireUser();
  const category = documentCategorySchema.safeParse(input.category);
  if (!uuidRe.test(input.projectId) || !input.path.startsWith(input.projectId + '/') || !category.success) {
    return { success: false, error: 'Permintaan tidak valid.' };
  }

  const admin = createAdminClient();
  const slash = input.path.lastIndexOf('/');
  const { data: found } = await admin.storage.from(DOCUMENT_BUCKET).list(input.path.slice(0, slash), { search: input.path.slice(slash + 1) });
  const stored = found?.find((f) => f.name === input.path.slice(slash + 1));
  if (!stored) return { success: false, error: 'File belum terunggah. Coba lagi.' };

  const { error } = await createClient().from('documents').insert({
    project_id: input.projectId,
    task_id: input.taskId,
    division_id: input.taskId ? null : input.divisionId,
    category: category.data,
    name: input.name.slice(0, 200),
    storage_path: input.path,
    mime_type: input.mime,
    size_bytes: input.size,
    uploaded_by: user.id,
  });
  if (error) {
    await admin.storage.from(DOCUMENT_BUCKET).remove([input.path]);
    if (error.code === '42501') return { success: false, error: DENIED };
    console.error('[registerDocument]', error.code, error.message);
    return { success: false, error: 'Gagal menyimpan dokumen.' };
  }

  await admin.from('activity_logs').insert({
    project_id: input.projectId, task_id: input.taskId, actor_id: user.id,
    action_type: 'document_uploaded', new_value: input.name.slice(0, 200),
  });
  revalidatePath(`/projects/${input.projectId}`, 'layout');
  return { success: true };
}

/** Link unduh sementara (60 detik). Baris dokumen diperiksa lewat RLS lebih dulu. */
export async function getDocumentUrl(documentId: string): Promise<ActionResult<{ url: string }>> {
  await requireUser();
  if (!uuidRe.test(documentId)) return { success: false, error: 'Dokumen tidak valid.' };
  const { data: doc } = await createClient().from('documents').select('storage_path, name').eq('id', documentId).maybeSingle();
  if (!doc) return { success: false, error: 'Dokumen tidak ditemukan atau kamu tidak berhak membukanya.' };
  const { data, error } = await createAdminClient().storage.from(DOCUMENT_BUCKET).createSignedUrl(doc.storage_path, 60, { download: doc.name });
  if (error || !data) return { success: false, error: 'Gagal membuat link unduhan.' };
  return { success: true, data: { url: data.signedUrl } };
}

export async function deleteDocument(documentId: string, projectId: string): Promise<ActionResult> {
  await requireUser();
  if (!uuidRe.test(documentId)) return { success: false, error: 'Dokumen tidak valid.' };
  const { data, error } = await createClient().from('documents').delete().eq('id', documentId).select('storage_path');
  if (error || !data?.length) return { success: false, error: 'Dokumen tidak ditemukan atau kamu tidak berhak menghapusnya.' };
  await createAdminClient().storage.from(DOCUMENT_BUCKET).remove([data[0].storage_path]);
  revalidatePath(`/projects/${projectId}`, 'layout');
  return { success: true };
}
