/**
 * Rencana paket CampusFlow (v7) — DRAF untuk divalidasi lewat interest check.
 *
 * Masukan expert: organisasi yang hanya butuh "sedikit lebih banyak" anggota jadi boros kalau harus
 * naik ke paket yang jauh lebih besar. Karena itu paket berbayar memakai model "tumbuh bertahap":
 * kuota dasar + tambahan per kelipatan kecil (SEAT_PACK), bukan lompatan antar-tier.
 *
 * Semua angka di sini masih asumsi. Ubah di satu tempat ini, halaman depan ikut berubah.
 */
export const SEAT_PACK = 10;

export interface Plan {
  key: 'free' | 'organization' | 'campus';
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
    members: 'Sampai 15 anggota',
    features: ['2 project aktif', 'Task, kalender, dan pengumuman', 'Notifikasi email', 'Penyimpanan dokumen 500 MB'],
  },
  {
    key: 'organization',
    name: 'Organisasi',
    forWho: 'Untuk BEM, himpunan, dan UKM yang aktif',
    price: 'Segera',
    priceNote: 'harga diumumkan setelah masa uji coba',
    members: `Mulai 30 anggota, tambah per ${SEAT_PACK} anggota`,
    features: ['Project tidak terbatas', 'Budget dan statistik lengkap', 'Riwayat kerja untuk pengurus berikutnya', 'Penyimpanan dokumen lebih besar'],
    highlight: true,
  },
  {
    key: 'campus',
    name: 'Kampus',
    forWho: 'Untuk kemahasiswaan yang memantau banyak organisasi',
    price: 'Hubungi kami',
    priceNote: 'sesuai kesepakatan',
    members: 'Banyak organisasi dalam satu akun',
    features: ['Semua fitur paket Organisasi', 'Dashboard lintas organisasi', 'Laporan kegiatan untuk kampus', 'Pendampingan penggunaan'],
  },
];
