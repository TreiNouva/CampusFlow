import { cn } from '@/lib/utils';

const TONES = {
  navy: 'bg-navy/10 text-navy',
  orange: 'bg-orange-light text-orange',
  green: 'bg-green-100 text-green-700',
  red: 'bg-red-100 text-red-700',
  teal: 'bg-sky text-teal',
} as const;

/** Kartu angka ringkas (KPI) dengan ikon, nilai besar, dan keterangan. */
export function KpiCard({
  label, value, hint, icon, tone = 'navy', progress, delay = 0,
}: {
  label: string; value: string; hint?: string; icon: string; tone?: keyof typeof TONES; progress?: number; delay?: number;
}) {
  return (
    <div className="anim-rise rounded-card border border-gray-100 bg-white p-4 shadow-sm" style={{ animationDelay: `${delay}ms` }}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-bold uppercase tracking-wide text-muted">{label}</p>
        <span className={cn('flex h-8 w-8 items-center justify-center rounded-lg text-base', TONES[tone])} aria-hidden>{icon}</span>
      </div>
      <p className="mt-1 font-heading text-2xl font-bold text-navy">{value}</p>
      {progress !== undefined && (
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
          <div className="anim-grow-x h-full rounded-full bg-orange" style={{ width: `${Math.min(100, Math.max(0, progress))}%` }} />
        </div>
      )}
      {hint && <p className="mt-1.5 text-xs text-muted">{hint}</p>}
    </div>
  );
}
