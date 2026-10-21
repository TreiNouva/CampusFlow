/** Fungsi murni periode project — aman dipakai di client maupun server. */

export interface ProjectPeriod {
  start: string | null; // 'YYYY-MM-DD'
  end: string | null;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

export function formatDay(day: string): string {
  const [y, m, d] = day.split('-');
  return `${Number(d)} ${MONTHS[Number(m) - 1]} ${y}`;
}

/** Pesan error jika `day` berada di luar periode project, atau null jika aman. Murni (bisa dipakai di client). */
export function periodError(period: ProjectPeriod, day: string | null | undefined, label: string): string | null {
  if (!day) return null;
  if (period.start && day < period.start) return `${label} tidak boleh sebelum project dimulai (${formatDay(period.start)}).`;
  if (period.end && day > period.end) return `${label} tidak boleh setelah project selesai (${formatDay(period.end)}).`;
  return null;
}

/** Geser `day` ke dalam periode project (untuk nilai default form). */
export function clampDay(day: string, period: ProjectPeriod): string {
  if (period.start && day < period.start) return period.start;
  if (period.end && day > period.end) return period.end;
  return day;
}

export function inPeriod(day: string, period: ProjectPeriod): boolean {
  return (!period.start || day >= period.start) && (!period.end || day <= period.end);
}

/** Atribut min/max untuk <input type="date"> sesuai periode project. */
export function dateBounds(period?: ProjectPeriod | null): { min?: string; max?: string } {
  if (!period) return {};
  return { ...(period.start ? { min: period.start } : {}), ...(period.end ? { max: period.end } : {}) };
}

/** Teks keterangan periode untuk ditampilkan di bawah input tanggal. */
export function periodLabel(period?: ProjectPeriod | null): string | null {
  if (!period || (!period.start && !period.end)) return null;
  if (period.start && period.end) return `Periode project: ${formatDay(period.start)} – ${formatDay(period.end)}`;
  return period.start ? `Project mulai ${formatDay(period.start)}` : `Project selesai ${formatDay(period.end!)}`;
}
