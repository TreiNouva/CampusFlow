import Link from 'next/link';
import { Icon, type IconName } from '@/components/ui/icons';
import { cn } from '@/lib/utils';

/**
 * Kartu angka ringkas (KPI). v7: ikon satu warna & latar netral; warna hanya dipakai
 * untuk memberi tanda (amber = perlu perhatian, merah = bermasalah).
 */
export function KpiCard({
  label, value, hint, icon, alert, progress, delay = 0, href,
}: {
  label: string; value: string; hint?: string; icon: IconName; alert?: 'warn' | 'bad'; progress?: number; delay?: number;
  /** v8.4: kartu bisa diklik (masukan pengguna: refleks menekan kartu angka). */
  href?: string;
}) {
  const body = (
    <>
      <div className="flex items-center gap-2 text-muted">
        <span className={cn('flex h-7 w-7 items-center justify-center rounded-lg bg-gray-50',
          alert === 'bad' ? 'text-red-600' : alert === 'warn' ? 'text-orange' : 'text-navy')}>
          <Icon name={icon} size={16} />
        </span>
        <p className="text-xs font-semibold">{label}</p>
      </div>
      <p className={cn('mt-2 font-heading text-2xl font-bold', alert === 'bad' ? 'text-red-700' : 'text-ink')}>{value}</p>
      {progress !== undefined && (
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
          <div className="anim-grow-x h-full rounded-full bg-brand" style={{ width: `${Math.min(100, Math.max(0, progress))}%` }} />
        </div>
      )}
      {hint && <p className="mt-1.5 text-xs text-muted">{hint}</p>}
      {href && <Icon name="chevronRight" size={16} className="absolute right-3 top-4 text-gray-300 transition group-hover:translate-x-0.5 group-hover:text-navy" />}
    </>
  );
  const cls = 'anim-rise rounded-card border border-line bg-surface p-4';
  if (!href) return <div className={cls} style={{ animationDelay: `${delay}ms` }}>{body}</div>;
  return (
    <Link href={href} aria-label={`${label}: ${value}. Lihat detail`}
      className={cn(cls, 'group relative block transition hover:border-gray-300 hover:shadow-sm active:scale-[0.98]')} style={{ animationDelay: `${delay}ms` }}>
      {body}
    </Link>
  );
}
