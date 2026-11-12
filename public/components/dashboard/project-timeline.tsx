import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { diffDays, shortDate } from '@/lib/dates';

/** Garis waktu project: bar dari tanggal mulai ke selesai, penanda hari ini, dan milestone. */
export function ProjectTimeline({
  start, end, today, milestones,
}: {
  start: string | null; end: string | null; today: string; milestones: { id: string; title: string; due_date: string }[];
}) {
  if (!start || !end || end < start) {
    return (
      <Card>
        <CardHeader><h2 className="font-heading text-base font-bold text-ink">Timeline Project</h2></CardHeader>
        <CardBody><p className="text-sm text-muted">Tanggal mulai & selesai project belum diisi, jadi timeline belum bisa ditampilkan.</p></CardBody>
      </Card>
    );
  }
  const total = Math.max(diffDays(end, start), 1);
  const pct = (d: string) => Math.min(100, Math.max(0, (diffDays(d, start) / total) * 100));
  const elapsed = pct(today);
  const daysLeft = diffDays(end, today);
  const status = today < start ? `Mulai ${diffDays(start, today)} hari lagi` : daysLeft < 0 ? `Selesai ${-daysLeft} hari lalu` : daysLeft === 0 ? 'Berakhir hari ini' : `${daysLeft} hari lagi`;
  const sorted = [...milestones].sort((a, b) => a.due_date.localeCompare(b.due_date));

  return (
    <Card>
      <CardHeader className="flex items-center justify-between">
        <h2 className="font-heading text-base font-bold text-ink">Timeline Project</h2>
        <span className="rounded-full bg-sky px-2.5 py-0.5 text-xs font-semibold text-navy">{status}</span>
      </CardHeader>
      <CardBody>
        <div className="relative mt-6 h-3 rounded-full bg-gray-100">
          <div className="anim-grow-x absolute inset-y-0 left-0 rounded-full bg-navy" style={{ width: `${elapsed}%` }} />
          {sorted.map((m) => (
            <div key={m.id} className="group absolute top-1/2 -translate-x-1/2 -translate-y-1/2" style={{ left: `${pct(m.due_date)}%` }}>
              <span className={`block h-4 w-4 rotate-45 rounded-sm border-2 border-white shadow ${m.due_date < today ? 'bg-gray-400' : 'bg-navy'}`} />
              <span className="pointer-events-none absolute bottom-6 left-1/2 z-10 hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-navy px-2 py-1 text-[11px] text-white shadow group-hover:block">
                {m.title} · {shortDate(m.due_date)}
              </span>
            </div>
          ))}
          {today >= start && today <= end && (
            <div className="absolute -top-5 -translate-x-1/2 text-[10px] font-bold text-red-600" style={{ left: `${elapsed}%` }}>
              Hari ini
              <span className="mx-auto mt-0.5 block h-6 w-0.5 bg-red-500" />
            </div>
          )}
        </div>
        <div className="mt-2 flex justify-between text-xs text-muted">
          <span>{shortDate(start)}</span>
          <span>{shortDate(end)}</span>
        </div>
        {sorted.length > 0 && (
          <ul className="mt-3 flex flex-wrap gap-2">
            {sorted.slice(0, 6).map((m) => (
              <li key={m.id} className="rounded-full border border-gray-200 px-2.5 py-0.5 text-xs text-ink">
                <span className={m.due_date < today ? 'text-gray-400' : 'text-navy'}>◆</span> {m.title} · {shortDate(m.due_date)}
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}
