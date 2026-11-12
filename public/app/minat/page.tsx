import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { InterestForm } from '@/components/interest/interest-form';
import { FREE_MEMBERS, ORG_BASE_MEMBERS, SEAT_PACK } from '@/lib/plans';

export const metadata: Metadata = { title: 'Daftar minat · CampusFlow' };

/**
 * Mode booth festival: buka halaman ini di laptop/tablet stan. Setelah pengunjung mengirim form,
 * form kosong lagi otomatis untuk pengunjung berikutnya. Rekap ada di /admin/interest.
 */
export default function InterestKioskPage() {
  return (
    <div className="min-h-screen bg-[#F6F8FA]">
      <div className="mx-auto grid min-h-screen max-w-6xl grid-cols-1 gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[1fr_1.15fr] lg:items-center lg:py-12">
        <div>
          <Link href="/" aria-label="Halaman depan CampusFlow">
            <Image src="/brand/campusflow-logo-horizontal.svg" alt="CampusFlow" width={220} height={56} priority />
          </Link>
          <h1 className="mt-8 font-heading text-3xl font-bold leading-tight text-navy sm:text-4xl">
            Organisasimu masih koordinasi lewat grup WhatsApp dan Sheets?
          </h1>
          <p className="mt-4 text-base leading-relaxed text-gray-600">
            CampusFlow menyatukan task, kalender, pengumuman, dokumen, dan dana organisasi dalam satu tempat.
            Isi form ini untuk jadi pengguna awal, dan kami kabari saat paket berbayar dibuka.
          </p>
          <ul className="mt-6 space-y-2 text-sm text-gray-700">
            <li>• <b>Gratis</b> untuk {FREE_MEMBERS} anggota</li>
            <li>• <b>Organisasi</b> Rp49.000/bulan untuk {ORG_BASE_MEMBERS} anggota, tambah Rp10.000 per {SEAT_PACK} anggota</li>
            <li>• <b>Kampus</b> untuk kemahasiswaan, sesuai kesepakatan</li>
          </ul>
        </div>
        <div className="rounded-2xl border border-line bg-white p-5 shadow-sm sm:p-8">
          <h2 className="font-heading text-xl font-bold text-ink">Daftar jadi pengguna awal</h2>
          <p className="mb-5 mt-1 text-sm text-muted">Kurang dari 1 menit.</p>
          <InterestForm source="festival" kiosk />
        </div>
      </div>
    </div>
  );
}
