'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { markNotificationsRead } from '@/actions/inapp-actions';
import { Icon } from '@/components/ui/icons';
import { cn } from '@/lib/utils';

export interface BellItem { id: string; title: string; body: string | null; link: string | null; is_read: boolean; created_at: string }

function ago(iso: string) {
  const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (m < 1) return 'baru saja';
  if (m < 60) return `${m} mnt lalu`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} jam lalu`;
  const d = Math.round(h / 24);
  return d < 7 ? `${d} hari lalu` : new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
}

/** Lonceng notifikasi in-app: task baru/diubah untukmu dan pengumuman. */
export function NotificationBell({ items, unread, align = 'right' }: { items: BellItem[]; unread: number; align?: 'left' | 'right' }) {
  const [open, setOpen] = useState(false);
  const [, start] = useTransition();
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey); };
  }, [open]);

  const readAll = () => start(async () => { await markNotificationsRead(); router.refresh(); });
  const readOne = (id: string) => start(async () => { await markNotificationsRead(id); router.refresh(); });

  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open}
        aria-label={unread ? `Notifikasi, ${unread} belum dibaca` : 'Notifikasi'}
        className="relative rounded-lg p-2 text-gray-600 hover:bg-gray-100 hover:text-ink">
        <Icon name="bell" size={19} />
        {unread > 0 && (
          <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold leading-none text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>
      {open && (
        <div className={cn('anim-rise z-50 overflow-hidden rounded-xl border border-line bg-surface shadow-xl',
          // HP: panel selebar layar di bawah bar atas. Desktop: menempel di samping lonceng.
          'fixed inset-x-3 top-14 sm:absolute sm:inset-x-auto sm:top-11 sm:w-[22rem]',
          align === 'right' ? 'sm:right-0' : 'sm:left-0')} role="dialog" aria-label="Notifikasi">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <p className="text-sm font-semibold text-ink">Notifikasi</p>
            {unread > 0 && <button type="button" onClick={readAll} className="text-xs font-semibold text-navy hover:underline">Tandai semua dibaca</button>}
          </div>
          {items.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted">Belum ada notifikasi. Task baru untukmu dan pengumuman akan muncul di sini.</p>
          ) : (
            <ul className="max-h-[60vh] divide-y divide-line overflow-y-auto">
              {items.map((n) => {
                const content = (
                  <span className="flex gap-3 px-4 py-3">
                    <span className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', n.is_read ? 'bg-transparent' : 'bg-teal')} aria-hidden />
                    <span className="min-w-0">
                      <span className={cn('block text-sm', n.is_read ? 'text-gray-600' : 'font-medium text-ink')}>{n.title}</span>
                      {n.body && <span className="block truncate text-xs text-muted">{n.body}</span>}
                      <span className="mt-0.5 block text-[11px] text-gray-400">{ago(n.created_at)}</span>
                    </span>
                  </span>
                );
                return (
                  <li key={n.id} className="hover:bg-gray-50">
                    {n.link ? (
                      <Link href={n.link} onClick={() => { setOpen(false); if (!n.is_read) readOne(n.id); }}>{content}</Link>
                    ) : content}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
