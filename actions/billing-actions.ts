'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { requireUser } from '@/lib/auth/session';
import { rpcErrorMessage } from '@/lib/rpc';
import { createAdminClient } from '@/lib/supabase/admin';
import { getCurrentUser } from '@/lib/auth/session';
import { headers } from 'next/headers';
import { createHash } from 'crypto';
import { MAX_SEAT_PACKS } from '@/lib/plans';

type Result<T = undefined> = { success: true; data?: T } | { success: false; error: string };

const activateSchema = z.object({
  organizationId: z.string().uuid(),
  seatPacks: z.number().int().min(0).max(MAX_SEAT_PACKS),
  cycle: z.enum(['monthly', 'yearly']),
});

/**
 * MODE DEMO: tombol "Saya sudah bayar" langsung mengaktifkan paket.
 * Saat payment gateway (mis. QRIS dari Midtrans/Xendit) terhubung, aktivasi dipindah ke webhook
 * pembayaran di server dan tombol ini diganti pengecekan status pembayaran.
 */
export async function activatePlanDemo(input: z.infer<typeof activateSchema>): Promise<Result<{ amount: number; periodEnd: string }>> {
  await requireUser();
  const parsed = activateSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: 'Pilihan paket tidak valid.' };
  const { data, error } = await (await createClient()).rpc('activate_plan_demo', {
    p_org: parsed.data.organizationId,
    p_plan: 'organization',
    p_seat_packs: parsed.data.seatPacks,
    p_cycle: parsed.data.cycle,
  });
  if (error) return { success: false, error: rpcErrorMessage(error, 'Gagal mengaktifkan paket. Pastikan migrasi 0005 sudah dijalankan.') };
  revalidatePath(`/organizations/${parsed.data.organizationId}`, 'layout');
  return { success: true, data: { amount: (data as any)?.amount ?? 0, periodEnd: (data as any)?.period_end ?? '' } };
}

export async function cancelPlanDemo(organizationId: string): Promise<Result> {
  await requireUser();
  if (!z.string().uuid().safeParse(organizationId).success) return { success: false, error: 'Organisasi tidak valid.' };
  const { error } = await (await createClient()).rpc('cancel_plan_demo', { p_org: organizationId });
  if (error) return { success: false, error: rpcErrorMessage(error, 'Gagal mengubah paket.') };
  revalidatePath(`/organizations/${organizationId}`, 'layout');
  return { success: true };
}

const interestSchema = z.object({
  name: z.string().trim().min(2, 'Nama minimal 2 karakter').max(80),
  email: z.string().trim().email('Format email tidak valid').max(120),
  organizationName: z.string().trim().max(120).optional().default(''),
  organizationType: z.enum(['bem', 'himpunan', 'ukm', 'kepanitiaan', 'lainnya', '']).optional().default(''),
  memberCount: z.coerce.number().int().min(1).max(10000).optional().nullable(),
  plan: z.enum(['free', 'organization', 'campus', 'belum_tahu']).optional().default('belum_tahu'),
  willingToPay: z.enum(['ya', 'mungkin', 'tidak', '']).optional().default(''),
  note: z.string().trim().max(500).optional().default(''),
  source: z.enum(['web', 'festival', 'app']).optional().default('web'),
  organizationId: z.string().uuid().optional().or(z.literal('')).default(''),
});

/** Hash IP (dengan salt) — dipakai hanya untuk membatasi spam per perangkat, IP asli tidak disimpan. */
async function clientIpHash(): Promise<string | null> {
  const h = await headers();
  const ip = (h.get('x-forwarded-for') ?? '').split(',')[0].trim() || h.get('x-real-ip') || '';
  if (!ip) return null;
  const salt = process.env.SUPABASE_SERVICE_ROLE_KEY?.slice(-16) ?? 'campusflow';
  return createHash('sha256').update(`${salt}:${ip}`).digest('hex').slice(0, 32);
}

/**
 * Interest check: bisa dipakai tanpa login (halaman depan & mode booth festival).
 * Anti-spam: (1) kolom jebakan `website` yang tak terlihat manusia, (2) form harus terbuka ≥2 detik,
 * (3) persetujuan privasi wajib, (4) batas isian per perangkat di database. Fungsi database hanya bisa
 * dipanggil server (service role), jadi bot tidak bisa melewati pemeriksaan ini lewat API Supabase.
 */
export async function submitInterest(formData: FormData): Promise<Result> {
  const raw = Object.fromEntries(formData.entries());
  if (typeof raw.website === 'string' && raw.website.trim() !== '') return { success: true }; // bot: pura-pura berhasil
  const startedAt = Number(raw.startedAt ?? 0);
  if (!startedAt || Date.now() - startedAt < 2000) return { success: false, error: 'Terlalu cepat. Periksa lagi isianmu, lalu kirim.' };
  if (raw.consent !== 'on') return { success: false, error: 'Centang persetujuan Kebijakan Privasi terlebih dahulu.' };

  const parsed = interestSchema.safeParse({ ...raw, memberCount: raw.memberCount ? raw.memberCount : null });
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? 'Data tidak valid.' };
  const d = parsed.data;
  const user = await getCurrentUser();

  let admin;
  try { admin = createAdminClient(); } catch {
    return { success: false, error: 'Server belum dikonfigurasi (SUPABASE_SERVICE_ROLE_KEY).' };
  }
  const { error } = await admin.rpc('submit_interest', {
    p_name: d.name,
    p_email: d.email,
    p_org_name: d.organizationName,
    p_org_type: d.organizationType,
    p_member_count: d.memberCount ?? null,
    p_plan: d.plan,
    p_willing_to_pay: d.willingToPay === 'ya' ? true : d.willingToPay === 'tidak' ? false : null,
    p_note: d.willingToPay === 'mungkin' ? `[mungkin mau bayar] ${d.note}`.trim() : d.note,
    p_source: d.source,
    p_org: d.organizationId || null,
    p_user: user?.id ?? null,
    p_ip_hash: await clientIpHash(),
  });
  if (error) return { success: false, error: rpcErrorMessage(error, 'Gagal menyimpan. Coba lagi sebentar lagi.') };
  return { success: true };
}
