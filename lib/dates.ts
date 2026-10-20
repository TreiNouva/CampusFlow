/** Utilitas tanggal. Tanggal task disimpan sebagai 'YYYY-MM-DD'; "hari ini" dihitung di zona Asia/Jakarta. */
export const TZ = 'Asia/Jakarta';
export const DAY_NAMES_SHORT = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];
export const MONTH_NAMES = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

export function todayJakarta(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

export function parseDay(day: string): Date {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function toDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function addDays(day: string, n: number): string {
  const d = parseDay(day);
  d.setUTCDate(d.getUTCDate() + n);
  return toDay(d);
}

export function diffDays(a: string, b: string): number {
  return Math.round((parseDay(a).getTime() - parseDay(b).getTime()) / 86400000);
}

/** Senin sebagai awal minggu. */
export function startOfWeek(day: string): string {
  const dow = (parseDay(day).getUTCDay() + 6) % 7;
  return addDays(day, -dow);
}

export function startOfMonth(day: string): string {
  return day.slice(0, 8) + '01';
}

export function addMonths(day: string, n: number): string {
  const d = parseDay(startOfMonth(day));
  d.setUTCMonth(d.getUTCMonth() + n);
  return toDay(d);
}

/** Matriks 6 minggu x 7 hari untuk tampilan bulan. */
export function monthMatrix(day: string): string[][] {
  const first = startOfWeek(startOfMonth(day));
  return Array.from({ length: 6 }, (_, w) => Array.from({ length: 7 }, (_, i) => addDays(first, w * 7 + i)));
}

export function monthTitle(day: string): string {
  const d = parseDay(day);
  return `${MONTH_NAMES[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

export function shortDate(day: string): string {
  const d = parseDay(day);
  return `${d.getUTCDate()} ${MONTH_NAMES[d.getUTCMonth()].slice(0, 3)}`;
}

/** Tanggal (YYYY-MM-DD, zona Jakarta) dari timestamp ISO. */
export function dayOfTimestamp(ts: string): string {
  return todayJakarta(new Date(ts));
}

/** Menit sejak 00:00 (zona Jakarta) dari timestamp ISO. */
export function minutesOfDay(ts: string): number {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(new Date(ts));
  const h = Number(parts.find((p) => p.type === 'hour')?.value ?? 0) % 24;
  const m = Number(parts.find((p) => p.type === 'minute')?.value ?? 0);
  return h * 60 + m;
}

export function formatTime(ts: string): string {
  return new Intl.DateTimeFormat('id-ID', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(ts)).replace('.', ':');
}

/** Gabungkan tanggal + jam lokal Jakarta (WIB, UTC+7) menjadi timestamp ISO. */
export function jakartaToIso(day: string, time: string): string {
  return new Date(`${day}T${time}:00+07:00`).toISOString();
}
