import { createClient } from '@/lib/supabase/server';
import { periodError, type ProjectPeriod } from '@/lib/period';

export { formatDay, periodError, type ProjectPeriod } from '@/lib/period';

export async function getProjectPeriod(projectId: string): Promise<ProjectPeriod> {
  const { data } = await createClient().from('projects').select('start_date, end_date').eq('id', projectId).single();
  return { start: data?.start_date ?? null, end: data?.end_date ?? null };
}

/**
 * Cek beberapa tanggal sekaligus terhadap periode project.
 * Database (migrasi 0004) juga menegakkan aturan yang sama; cek di sini memberi pesan
 * yang jelas lebih awal dan tetap melindungi jika migrasi belum dijalankan.
 */
export async function checkProjectPeriod(
  projectId: string,
  checks: Array<[day: string | null | undefined, label: string]>
): Promise<string | null> {
  if (checks.every(([day]) => !day)) return null;
  const period = await getProjectPeriod(projectId);
  for (const [day, label] of checks) {
    const err = periodError(period, day, label);
    if (err) return err;
  }
  return null;
}
