import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { divisionColor } from '@/lib/colors';
import { calcProgress } from '@/lib/utils';

export interface DivisionStat { id: string; name: string; color: string; total: number; done: number; overdue: number }

export function DivisionProgress({ stats }: { stats: DivisionStat[] }) {
  return (
    <Card>
      <CardHeader><h2 className="font-heading text-base font-bold text-ink">Progress per Divisi</h2></CardHeader>
      <CardBody className="space-y-3">
        {stats.length === 0 && <p className="text-sm text-muted">Belum ada divisi / task berdivisi.</p>}
        {stats.map((d, i) => {
          const c = divisionColor(d.color);
          const pct = calcProgress(d.done, d.total);
          return (
            <div key={d.id}>
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 font-medium text-ink">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: c.accent }} />{d.name}
                </span>
                <span className="text-xs text-muted">
                  {d.done}/{d.total} task · {pct}%{d.overdue > 0 && <span className="ml-1 font-semibold text-red-600">· {d.overdue} telat</span>}
                </span>
              </div>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-gray-100">
                <div className="anim-grow-x h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: c.accent, animationDelay: `${i * 80}ms` }} />
              </div>
            </div>
          );
        })}
      </CardBody>
    </Card>
  );
}
