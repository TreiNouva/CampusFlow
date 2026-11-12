/**
 * Paket CampusFlow (v8). Angka di sini HARUS sama dengan fungsi SQL di migrasi 0005
 * (`plan_price`, `org_member_limit`, `org_project_limit`) — database yang menjadi penentu akhir.
 *
 * Model "tumbuh bertahap" (masukan expert): organisasi yang hanya butuh sedikit tambahan anggota
 * cukup membeli tambahan per SEAT_PACK anggota, bukan pindah ke paket yang jauh lebih besar.
 */
export const SEAT_PACK = 10;
export const FREE_MEMBERS = 15;
export const FREE_PROJECTS = 2;
export const ORG_BASE_MEMBERS = 30;
export const ORG_BASE_PRICE = 49_000; // per bulan
export const SEAT_PACK_PRICE = 10_000; // per bulan per tambahan SEAT_PACK anggota
export const YEARLY_MONTHS_CHARGED = 10; // bayar tahunan = 10 bulan (gratis 2 bulan)
export const MAX_SEAT_PACKS = 50;

export type PlanKey = 'free' | 'organization' | 'campus';
export type BillingCycle = 'monthly' | 'yearly';

export interface Plan {
  key: PlanKey;
  name: string;
  forWho: string;
  price: string;
  priceNote: string;
  members: string;
  features: string[];
  highlight?: boolean;
}

export const PLANS: Plan[] = [
  {
    key: 'free',
    name: 'Gratis',
    forWho: 'Untuk mencoba dan kepanitiaan kecil',
    price: 'Rp0',
    priceNote: 'selamanya',
    members: `Sampai ${FREE_MEMBERS} anggota`,
    features: [`${FREE_PROJECTS} project aktif`, 'Task, kalender, dan pengumuman', 'Notifikasi email', 'Dokumen dan budget'],
  },
  {
    key: 'organization',
    name: 'Organisasi',
    forWho: 'Untuk BEM, himpunan, dan UKM yang aktif',
    price: 'Rp49.000',
    priceNote: `per bulan untuk ${ORG_BASE_MEMBERS} anggota · +Rp10.000 per ${SEAT_PACK} anggota`,
    members: `${ORG_BASE_MEMBERS} anggota, bisa ditambah per ${SEAT_PACK}`,
    features: ['Project tidak terbatas', 'Statistik lengkap', 'Riwayat kerja untuk pengurus berikutnya', 'Bayar tahunan: gratis 2 bulan'],
    highlight: true,
  },
  {
    key: 'campus',
    name: 'Kampus',
    forWho: 'Untuk kemahasiswaan yang memantau banyak organisasi',
    price: 'Hubungi kami',
    priceNote: 'sesuai kesepakatan',
    members: 'Anggota tanpa batas',
    features: ['Semua fitur paket Organisasi', 'Dashboard lintas organisasi', 'Laporan kegiatan untuk kampus', 'Pendampingan penggunaan'],
  },
];

export const PLAN_NAME: Record<PlanKey, string> = { free: 'Gratis', organization: 'Organisasi', campus: 'Kampus' };

/** Harga paket Organisasi (Rupiah) — sama dengan `plan_price` di SQL. */
export function planPrice(seatPacks: number, cycle: BillingCycle): number {
  const monthly = ORG_BASE_PRICE + SEAT_PACK_PRICE * Math.max(0, Math.floor(seatPacks));
  return cycle === 'yearly' ? monthly * YEARLY_MONTHS_CHARGED : monthly;
}

export function memberLimit(plan: PlanKey, seatPacks: number): number | null {
  if (plan === 'free') return FREE_MEMBERS;
  if (plan === 'organization') return ORG_BASE_MEMBERS + SEAT_PACK * seatPacks;
  return null;
}

/** Tambahan paket minimum agar semua anggota saat ini tertampung. */
export function minSeatPacks(memberCount: number): number {
  return Math.max(0, Math.ceil((memberCount - ORG_BASE_MEMBERS) / SEAT_PACK));
}

export function rupiah(n: number): string {
  return 'Rp' + n.toLocaleString('id-ID');
}
