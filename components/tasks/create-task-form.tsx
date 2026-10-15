'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createTask } from '@/actions/task-actions';
import { Button } from '@/components/ui/button';
import { Input, Label, Select, Textarea } from '@/components/ui/input';
import { LoadingOverlay } from '@/components/ui/loading-overlay';
import { NETWORK_ERROR_MESSAGE } from '@/lib/utils';

interface Member {
  id: string;
  full_name: string;
}

/**
 * Form task baru ditampilkan sebagai MODAL (bukan popover absolut lagi) sehingga
 * tidak bisa terpotong layar/navbar: panel punya tinggi maksimum dan bisa di-scroll
 * sendiri di layar kecil / HP.
 */
export function CreateTaskForm({ projectId, members }: { projectId: string; members: Member[] }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();

  // Tutup modal dengan tombol Esc & kunci scroll halaman di belakang saat modal terbuka.
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) setOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, busy]);

  function close() {
    if (busy) return;
    setError(null);
    setOpen(false);
  }

  function handleSubmit(formData: FormData) {
    setError(null);
    setBusy(true);
    startTransition(async () => {
      try {
        const result = await createTask(formData);
        if (!result.success) {
          setError(result.error ?? 'Gagal membuat task.');
          return;
        }
        formRef.current?.reset();
        setOpen(false);
        router.refresh();
      } catch {
        setError(NETWORK_ERROR_MESSAGE);
      } finally {
        setBusy(false);
      }
    });
  }

  return (
    <>
      <Button onClick={() => setOpen(true)} size="sm">
        + Task Baru
      </Button>

      {open && (
        <div
          className="fixed inset-0 z-50 overflow-y-auto bg-navy/30 p-4 backdrop-blur-[2px] animate-fade-in"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) close();
          }}
        >
          <div className="flex min-h-full items-center justify-center">
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="create-task-title"
              className="w-full max-w-md rounded-card bg-white p-5 shadow-xl"
            >
              <div className="mb-4 flex items-center justify-between">
                <h2 id="create-task-title" className="font-heading text-lg font-bold text-ink">
                  Task Baru
                </h2>
                <button
                  type="button"
                  onClick={close}
                  className="rounded-md px-2 py-1 text-sm text-muted hover:bg-gray-100"
                  aria-label="Tutup"
                >
                  ✕
                </button>
              </div>

              <form ref={formRef} action={handleSubmit} className="space-y-3">
                <input type="hidden" name="projectId" value={projectId} />
                <div>
                  <Label htmlFor="title">Judul Task</Label>
                  <Input id="title" name="title" placeholder="mis. Booking Venue" required autoFocus />
                </div>
                <div>
                  <Label htmlFor="description">Deskripsi</Label>
                  <Textarea id="description" name="description" rows={3} />
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="assigneeId">PIC</Label>
                    <Select id="assigneeId" name="assigneeId" defaultValue="">
                      <option value="">Belum ditentukan</option>
                      {members.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.full_name}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="priority">Priority</Label>
                    <Select id="priority" name="priority" defaultValue="medium">
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="urgent">Urgent</option>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label htmlFor="dueDate">Deadline</Label>
                  <Input id="dueDate" name="dueDate" type="date" />
                </div>

                {error && <p className="text-sm text-red-600">{error}</p>}

                <div className="flex gap-2 pt-1">
                  <Button type="submit" className="flex-1" disabled={busy}>
                    {busy ? 'Menyimpan...' : 'Simpan'}
                  </Button>
                  <Button type="button" variant="ghost" onClick={close} disabled={busy}>
                    Batal
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {busy && <LoadingOverlay label="Menyimpan task..." />}
    </>
  );
}
