import Link from 'next/link';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { divisionColor } from '@/lib/colors';
import { diffDays, shortDate } from '@/lib/dates';

export interface DeadlineRow {
  id: string; title: string; due: string; assignee: string | null; divisionColor: string | null; divisionName: string | null; status: string;
}

export function DeadlineList({ rows, today, projectId, title = 'Deadline Terdekat' }: { rows: DeadlineRow[]; today: string; projectId: string; title?: string }) {
  return (
    <Card>
      <CardHeader><h2 className="font-heading text-base font-bold text-ink">{title}</h2></CardHeader>
      <CardBody className="space-y-2">
        {rows.length === 0 && <p className="text-sm text-muted">Tidak ada deadline dalam 14 hari ke depan.</p>}
        {rows.map((r) => {
          const left = diffDays(r.due, today);
          const c = divisionColor(r.divisionColor);
          const tone = left < 0 ? 'bg-red-50 text-red-700' : left <= 2 ? 'bg-orange-light text-orange' : 'bg-gray-100 text-gray-700';
          return (
            <Link key={r.id} href={`/projects/${projectId}/tasks/${r.id}`}
              className="flex items-center gap-3 rounded-lg border border-line px-3 py-2 transition hover:border-gray-300 hover:bg-gray-50"
              style={{ borderLeft: `4px solid ${c.accent}` }}>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-ink">{r.title}</p>
                <p className="truncate text-xs text-muted">{r.divisionName ? `${r.divisionName} · ` : ''}{r.assignee ?? 'Belum ada PIC'}</p>
              </div>
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${tone}`}>
                {left < 0 ? `Telat ${-left} hari` : left === 0 ? 'Hari ini' : left === 1 ? 'Besok' : shortDate(r.due)}
              </span>
            </Link>
          );
        })}
      </CardBody>
    </Card>
  );
}
