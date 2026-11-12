import { Icon, type IconName } from '@/components/ui/icons';
import { cn } from '@/lib/utils';

/**
 * Kartu angka ringkas (KPI). v7: ikon satu warna & latar netral; warna hanya dipakai
 * untuk memberi tanda (amber = perlu perhatian, merah = bermasalah).
 */
export function KpiCard({
  label, value, hint, icon, alert, progress, delay = 0,
}: {
  label: string; value: string; hint?: string; icon: IconName; alert?: 'warn' | 'bad'; progress?: number; delay?: number;
}) {
  return (
    <div className="anim-rise rounded-card border border-line bg-white p-4" style={{ animationDelay: `${delay}ms` }}>
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
          <div className="anim-grow-x h-full rounded-full bg-navy" style={{ width: `${Math.min(100, Math.max(0, progress))}%` }} />
        </div>
      )}
      {hint && <p className="mt-1.5 text-xs text-muted">{hint}</p>}
    </div>
  );
}
