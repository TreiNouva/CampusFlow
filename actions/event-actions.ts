'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireUser } from '@/lib/auth/session';
import { rpcErrorMessage } from '@/lib/rpc';
import { jakartaToIso } from '@/lib/dates';
import { attendanceSchema, eventSchema, updateEventSchema } from '@/lib/validations/schemas';
import type { ActionResult } from './organization-actions';

function buildTimes(d: { startDate: string; endDate: string; startTime?: string | null; endTime?: string | null; allDay: boolean }) {
  if (d.allDay) {
    return { start_at: jakartaToIso(d.startDate, '00:00'), end_at: jakartaToIso(d.endDate, '23:59') };
  }
  return {
    start_at: jakartaToIso(d.startDate, d.startTime || '09:00'),
    end_at: jakartaToIso(d.endDate, d.endTime || '10:00'),
  };
}

function readEvent(formData: FormData) {
  return {
    projectId: formData.get('projectId'),
    eventId: formData.get('eventId') || undefined,
    title: formData.get('title'),
    description: formData.get('description') || null,
    location: formData.get('location') || null,
    divisionId: formData.get('divisionId') || null,
    startDate: formData.get('startDate'),
    endDate: formData.get('endDate') || formData.get('startDate'),
    startTime: formData.get('startTime') || null,
    endTime: formData.get('endTime') || null,
    allDay: formData.get('allDay') === 'on' || formData.get('allDay') === 'true',
  };
}

export async function createEvent(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = eventSchema.safeParse(readEvent(formData));
  if (!parsed.success) return { success: false, error: parsed.error.errors[0]?.message ?? 'Input tidak valid' };
  const times = buildTimes(parsed.data);
  if (times.end_at < times.start_at) return { success: false, error: 'Waktu selesai tidak boleh sebelum waktu mulai.' };

  const { data, error } = await createClient()
    .from('project_events')
    .insert({
      project_id: parsed.data.projectId,
      division_id: parsed.data.divisionId ?? null,
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      location: parsed.data.location ?? null,
      all_day: parsed.data.allDay,
      created_by: user.id,
      ...times,
    })
    .select('id')
    .single();
  if (error || !data) {
    if (error?.code === '42501') return { success: false, error: 'Kamu tidak berhak membuat acara untuk cakupan ini (PIC/Koordinator hanya untuk divisinya sendiri).' };
    console.error('[createEvent]', error?.code, error?.message);
    return { success: false, error: 'Gagal menyimpan acara.' };
  }
  await createAdminClient().from('activity_logs').insert({
    project_id: parsed.data.projectId, actor_id: user.id, action_type: 'event_created', new_value: parsed.data.title,
    metadata: { event_id: data.id, division_id: parsed.data.divisionId ?? null },
  });
  revalidatePath(`/projects/${parsed.data.projectId}`);
  return { success: true };
}

export async function updateEvent(formData: FormData): Promise<ActionResult> {
  await requireUser();
  const parsed = updateEventSchema.safeParse(readEvent(formData));
  if (!parsed.success) return { success: false, error: parsed.error.errors[0]?.message ?? 'Input tidak valid' };
  const times = buildTimes(parsed.data);
  if (times.end_at < times.start_at) return { success: false, error: 'Waktu selesai tidak boleh sebelum waktu mulai.' };

  const { data, error } = await createClient()
    .from('project_events')
    .update({
      division_id: parsed.data.divisionId ?? null,
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      location: parsed.data.location ?? null,
      all_day: parsed.data.allDay,
      ...times,
    })
    .eq('id', parsed.data.eventId)
    .eq('project_id', parsed.data.projectId)
    .select('id');
  if (error || !data || data.length === 0) {
    return { success: false, error: 'Acara tidak ditemukan atau kamu tidak berhak mengubahnya.' };
  }
  revalidatePath(`/projects/${parsed.data.projectId}`);
  return { success: true };
}

export async function deleteEvent(formData: FormData): Promise<ActionResult> {
  await requireUser();
  const eventId = String(formData.get('eventId') ?? '');
  const projectId = String(formData.get('projectId') ?? '');
  if (!/^[0-9a-f-]{36}$/i.test(eventId) || !/^[0-9a-f-]{36}$/i.test(projectId)) return { success: false, error: 'Acara tidak valid.' };
  const { data, error } = await createClient().from('project_events').delete().eq('id', eventId).eq('project_id', projectId).select('id');
  if (error || !data || data.length === 0) return { success: false, error: 'Acara tidak ditemukan atau kamu tidak berhak menghapusnya.' };
  revalidatePath(`/projects/${projectId}`);
  return { success: true };
}

/** Catat kehadiran peserta (pengelola acara). */
export async function setAttendance(formData: FormData): Promise<ActionResult> {
  await requireUser();
  const parsed = attendanceSchema.safeParse({
    projectId: formData.get('projectId'), eventId: formData.get('eventId'),
    userId: formData.get('userId'), status: formData.get('status'),
  });
  if (!parsed.success) return { success: false, error: 'Input tidak valid' };
  const { error } = await createClient().rpc('set_attendance', {
    p_event: parsed.data.eventId, p_user: parsed.data.userId, p_status: parsed.data.status,
  });
  if (error) return { success: false, error: rpcErrorMessage(error, 'Gagal menyimpan kehadiran.') };
  revalidatePath(`/projects/${parsed.data.projectId}`);
  return { success: true };
}

/** Check-in mandiri (2 jam sebelum sampai 12 jam setelah acara dimulai). */
export async function checkInEvent(formData: FormData): Promise<ActionResult> {
  await requireUser();
  const eventId = String(formData.get('eventId') ?? '');
  const projectId = String(formData.get('projectId') ?? '');
  if (!/^[0-9a-f-]{36}$/i.test(eventId)) return { success: false, error: 'Acara tidak valid.' };
  const { error } = await createClient().rpc('check_in_event', { p_event: eventId });
  if (error) return { success: false, error: rpcErrorMessage(error, 'Gagal check-in.') };
  revalidatePath(`/projects/${projectId}`);
  return { success: true };
}
