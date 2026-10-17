'use client';

import { FormEvent, useState } from 'react';
import { deleteAnnouncement, updateAnnouncement } from '@/actions/announcement-actions';
import { Button } from '@/components/ui/button';
import { Input, Label, Textarea } from '@/components/ui/input';
import { LoadingOverlay } from '@/components/ui/loading-overlay';
import { useAction } from '@/lib/use-action';
import { formatDateTime } from '@/lib/utils';
import type { Announcement } from '@/types/database';

interface Props {
  announcements: Announcement[];
  projectId: string;
  currentUserId: string;
  /** Project Manager / Wakil PM: boleh mengedit & menghapus pengumuman siapa pun. */
  canModerate: boolean;
}

export function AnnouncementList({ announcements, projectId, currentUserId, canModerate }: Props) {
  if (announcements.length === 0) {
    return <p className="text-sm text-muted">Belum ada pengumuman.</p>;
  }

  return (
    <ul className="space-y-4">
      {announcements.map((a) => (
        <AnnouncementItem
          key={a.id}
          announcement={a}
          projectId={projectId}
          canEdit={a.author_id === currentUserId || canModerate}
          isMine={a.author_id === currentUserId}
        />
      ))}
    </ul>
  );
}

function AnnouncementItem({
  announcement,
  projectId,
  canEdit,
  isMine,
}: {
  announcement: Announcement;
  projectId: string;
  canEdit: boolean;
  isMine: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const { error, busy, run } = useAction();
  const edited = new Date(announcement.updated_at).getTime() - new Date(announcement.created_at).getTime() > 1000;

  function handleSave(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    void run(() => updateAnnouncement(formData), { onSuccess: () => setEditing(false) });
  }

  function handleDelete() {
    if (!window.confirm('Hapus pengumuman ini? Tindakan ini tidak bisa dibatalkan.')) return;
    const formData = new FormData();
    formData.set('announcementId', announcement.id);
    formData.set('projectId', projectId);
    void run(() => deleteAnnouncement(formData));
  }

  return (
    <li className="rounded-lg border border-gray-100 bg-gray-50 p-4">
      {editing ? (
        <form onSubmit={handleSave} className="space-y-3">
          <input type="hidden" name="announcementId" value={announcement.id} />
          <input type="hidden" name="projectId" value={projectId} />
          <div>
            <Label htmlFor={`t-${announcement.id}`}>Judul</Label>
            <Input id={`t-${announcement.id}`} name="title" defaultValue={announcement.title} required minLength={3} />
          </div>
          <div>
            <Label htmlFor={`b-${announcement.id}`}>Isi</Label>
            <Textarea id={`b-${announcement.id}`} name="body" rows={5} defaultValue={announcement.body} required />
          </div>
          <label className="flex items-center gap-2 text-xs text-muted">
            <input type="checkbox" name="resend" />
            Kirim ulang email pengumuman yang sudah diperbarui ke anggota project
          </label>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={busy}>
              {busy ? 'Menyimpan...' : 'Simpan'}
            </Button>
            <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={() => setEditing(false)}>
              Batal
            </Button>
          </div>
        </form>
      ) : (
        <>
          <div className="flex items-start justify-between gap-3">
            <h3 className="font-heading text-sm font-bold text-ink">{announcement.title}</h3>
            {canEdit && (
              <div className="flex shrink-0 gap-1.5">
                <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(true)} disabled={busy}>
                  Edit
                </Button>
                <Button type="button" size="sm" variant="danger" onClick={handleDelete} disabled={busy}>
                  Hapus
                </Button>
              </div>
            )}
          </div>
          <p className="mt-2 whitespace-pre-line text-sm text-ink">{announcement.body}</p>
          <p className="mt-3 text-xs text-muted">
            Oleh {isMine ? 'kamu' : announcement.author?.full_name ?? 'Seseorang'} • {formatDateTime(announcement.created_at)}
            {edited && ` • diedit ${formatDateTime(announcement.updated_at)}`}
          </p>
          {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        </>
      )}
      {busy && !editing && <LoadingOverlay label="Memproses..." />}
    </li>
  );
}
