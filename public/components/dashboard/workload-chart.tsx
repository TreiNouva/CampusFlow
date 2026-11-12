import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { initials } from '@/lib/utils';

export interface WorkloadRow { userId: string; name: string; open: number; overdue: number; done: number }

/** Beban kerja: jumlah task aktif per orang (merah = telat). */
export function WorkloadChart({ rows }: { rows: WorkloadRow[] }) {
  const max = Math.max(1, ...rows.map((r) => r.open + r.done));
  return (
    <Card>
      <CardHeader><h2 className="font-heading text-base font-bold text-ink">Beban Kerja Anggota</h2></CardHeader>
      <CardBody className="space-y-2.5">
        {rows.length === 0 && <p className="text-sm text-muted">Belum ada task yang ditugaskan.</p>}
        {rows.map((r) => (
          <div key={r.userId} className="flex items-center gap-2">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-navy text-[10px] font-bold text-white">{initials(r.name)}</span>
            <span className="w-24 shrink-0 truncate text-xs text-ink">{r.name}</span>
            <div className="flex h-3 flex-1 overflow-hidden rounded-full bg-gray-100" title={`${r.open - r.overdue} aktif, ${r.overdue} telat, ${r.done} selesai`}>
              <div className="anim-grow-x h-full bg-[#9DB7CC]" style={{ width: `${(r.done / max) * 100}%` }} />
              <div className="anim-grow-x h-full bg-navy" style={{ width: `${((r.open - r.overdue) / max) * 100}%` }} />
              <div className="anim-grow-x h-full bg-red-500" style={{ width: `${(r.overdue / max) * 100}%` }} />
            </div>
            <span className="w-8 shrink-0 text-right text-xs font-semibold text-navy">{r.open}</span>
          </div>
        ))}
        {rows.length > 0 && (
          <p className="flex gap-3 pt-1 text-[11px] text-muted">
            <span><i className="mr-1 inline-block h-2 w-2 rounded-sm bg-[#9DB7CC]" />Selesai</span>
            <span><i className="mr-1 inline-block h-2 w-2 rounded-sm bg-navy" />Aktif</span>
            <span><i className="mr-1 inline-block h-2 w-2 rounded-sm bg-red-500" />Telat</span>
          </p>
        )}
      </CardBody>
    </Card>
  );
}
