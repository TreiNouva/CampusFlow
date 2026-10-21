import type { Participant } from '@/components/calendar/calendar-dialogs';

/**
 * Peserta tiap acara: acara Global untuk semua anggota (kecuali Ketua/viewer), acara divisi untuk
 * anggota divisi itu + PM/Wakil PM/Sekretaris. Status kehadiran diambil dari event_attendance.
 */
export function buildParticipants(events: any[], members: any[], attendance: any[]): Record<string, Participant[]> {
  const byEvent = new Map<string, any[]>();
  for (const a of attendance) byEvent.set(a.event_id, [...(byEvent.get(a.event_id) ?? []), a]);
  const out: Record<string, Participant[]> = {};
  for (const ev of events) {
    const scope = members.filter((m) =>
      m.role !== 'ketua' && (!ev.division_id || m.division_id === ev.division_id || ['project_manager', 'wakil_project_manager', 'sekretaris'].includes(m.role)));
    out[ev.id] = scope.map((m) => {
      const a = (byEvent.get(ev.id) ?? []).find((x) => x.user_id === m.user_id);
      return { userId: m.user_id, name: m.profile?.full_name ?? 'Tanpa nama', status: a?.status ?? null, checkedInAt: a?.checked_in_at ?? null };
    });
  }
  return out;
}
