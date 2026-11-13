import { createAdminClient } from '@/lib/supabase/admin';

export interface InAppItem {
  userId: string;
  projectId?: string | null;
  type: string;
  title: string;
  body?: string | null;
  link?: string | null;
}

/**
 * Simpan notifikasi in-app (lonceng). Dipanggil setelah aksi berhasil, bersamaan dengan email.
 * Gagal menyimpan notifikasi tidak boleh menggagalkan aksi utama, jadi error hanya dicatat.
 */
export async function pushInApp(items: InAppItem[]) {
  if (items.length === 0) return;
  try {
    const { error } = await createAdminClient().from('notifications').insert(
      items.map((i) => ({
        user_id: i.userId,
        project_id: i.projectId ?? null,
        type: i.type,
        title: i.title.slice(0, 200),
        body: i.body ? i.body.slice(0, 300) : null,
        link: i.link ?? null,
      }))
    );
    if (error) console.error('[inapp]', error.code, error.message);
  } catch (e) {
    console.error('[inapp]', e);
  }
}
