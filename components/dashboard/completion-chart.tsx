import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { addDays, parseDay } from '@/lib/dates';
import { STATUS_LABEL } from '@/lib/utils';
import type { TaskStatus } from '@/types/database';

const STATUS_FILL: Record<TaskStatus, string> = {
  todo: '#9CA3AF', in_progress: '#1C7293', review: '#A855F7', done: '#22C55E', blocked: '#EF4444',
};

/** Task selesai per hari (14 hari terakhir) + sebaran status. `completedDays` berisi tanggal (YYYY-MM-DD) selesai tiap task. */
export function CompletionChart({
  completedDays, today, statusCounts,
}: { completedDays: string[]; today: string; statusCounts: Record<TaskStatus, number> }) {
  const days = Array.from({ length: 14 }, (_, i) => addDays(today, i - 13));
  const counts = days.map((d) => completedDays.filter((x) => x === d).length);
  const max = Math.max(1, ...counts);
  const total = Object.values(statusCounts).reduce((a, b) => a + b, 0);
  const W = 420, H = 110, bw = 20, gap = (W - bw * 14) / 13;

  return (
    <Card>
      <CardHeader><h2 className="font-heading text-base font-bold text-ink">Perkembangan Task</h2></CardHeader>
      <CardBody>
        <p className="text-xs font-semibold text-muted">Task selesai · 14 hari terakhir</p>
        <svg viewBox={`0 0 ${W} ${H + 18}`} className="mt-1 w-full" role="img" aria-label="Grafik task selesai per hari">
          <line x1="0" x2={W} y1={H} y2={H} stroke="#E5E7EB" />
          {counts.map((c, i) => {
            const h = (c / max) * (H - 14);
            const x = i * (bw + gap);
            return (
              <g key={days[i]}>
                <rect className="anim-grow-y" style={{ transformBox: 'fill-box', animationDelay: `${i * 30}ms` }} x={x} y={H - Math.max(h, c ? 2 : 0)} width={bw} height={Math.max(h, c ? 2 : 0)} rx="3" fill={days[i] === today ? '#FF7A45' : '#1C7293'} />
                {c > 0 && <text x={x + bw / 2} y={H - h - 3} textAnchor="middle" fontSize="9" fill="#12365E" fontWeight="700">{c}</text>}
                {(i % 2 === 1 || i === 13) && <text x={x + bw / 2} y={H + 12} textAnchor="middle" fontSize="8" fill="#5B6472">{parseDay(days[i]).getUTCDate()}</text>}
              </g>
            );
          })}
        </svg>

        <p className="mt-4 text-xs font-semibold text-muted">Sebaran status ({total} task)</p>
        <div className="mt-1.5 flex h-3 overflow-hidden rounded-full bg-gray-100">
          {(Object.keys(STATUS_FILL) as TaskStatus[]).map((s) => statusCounts[s] > 0 && (
            <div key={s} className="anim-grow-x h-full" title={`${STATUS_LABEL[s]}: ${statusCounts[s]}`} style={{ width: `${(statusCounts[s] / total) * 100}%`, backgroundColor: STATUS_FILL[s] }} />
          ))}
        </div>
        <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted">
          {(Object.keys(STATUS_FILL) as TaskStatus[]).map((s) => (
            <li key={s}><i className="mr-1 inline-block h-2 w-2 rounded-sm" style={{ backgroundColor: STATUS_FILL[s] }} />{STATUS_LABEL[s]} {statusCounts[s]}</li>
          ))}
        </ul>
      </CardBody>
    </Card>
  );
}
