import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';

export const metadata: Metadata = { title: 'Kebijakan Privasi · CampusFlow' };

const UPDATED = '13 November 2026';

/**
 * Kebijakan privasi singkat, ditulis dengan bahasa sehari-hari, merujuk prinsip UU No. 27 Tahun 2022
 * tentang Pelindungan Data Pribadi. Email kontak diambil dari SMTP_USER (Gmail tim) bila diisi.
 */
export default function PrivacyPage() {
  const contact = process.env.SMTP_USER || 'email tim CampusFlow';
  return (
    <div className="min-h-screen bg-[#F6F8FA]">
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3 sm:px-6">
          <Link href="/" aria-label="CampusFlow"><Image src="/brand/campusflow-logo-horizontal.svg" alt="CampusFlow" width={150} height={38} /></Link>
          <Link href="/" className="text-sm font-semibold text-navy hover:underline">Kembali</Link>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <h1 className="font-heading text-3xl font-bold text-navy">Kebijakan Privasi</h1>
        <p className="mt-2 text-sm text-muted">Terakhir diperbarui {UPDATED}</p>

        <div className="mt-8 space-y-8 text-[15px] leading-relaxed text-gray-700">
          <Section title="Siapa kami">
            CampusFlow adalah proyek mahasiswa Kelompok 5 mata kuliah Venture Creation, BINUS University. Kami yang
            mengelola data yang kamu berikan di situs ini. Pertanyaan atau permintaan soal datamu bisa dikirim ke{' '}
            <b>{contact}</b>.
          </Section>

          <Section title="Data yang kami kumpulkan">
            <ul className="list-disc space-y-1.5 pl-5">
              <li><b>Akun:</b> nama, email, dan password. Password disimpan dalam bentuk terenkripsi oleh Supabase, dan kami tidak bisa melihatnya.</li>
              <li><b>Isi aplikasi:</b> organisasi, project, task, jadwal, pengumuman, dokumen, dan catatan budget yang kamu atau timmu buat.</li>
              <li><b>Form minat (interest check):</b> nama, email, nama dan jenis organisasi, jumlah anggota, paket yang diminati, kesediaan membayar, dan catatan.</li>
              <li><b>Data teknis:</b> alamat IP disimpan hanya dalam bentuk acak (hash) untuk mencegah spam, ditambah statistik kunjungan anonim tanpa cookie pelacak (Vercel Analytics).</li>
            </ul>
          </Section>

          <Section title="Untuk apa datanya dipakai">
            <ul className="list-disc space-y-1.5 pl-5">
              <li>Menjalankan fitur CampusFlow, termasuk mengirim email konfirmasi akun, reset password, dan notifikasi task.</li>
              <li>Menghubungimu soal peluncuran paket berbayar, jika kamu mengisi form minat.</li>
              <li>Mengukur minat terhadap CampusFlow untuk tugas kuliah, dalam bentuk angka gabungan tanpa menampilkan nama.</li>
            </ul>
            <p className="mt-2">Kami <b>tidak menjual</b> datamu dan tidak membagikannya untuk iklan.</p>
          </Section>

          <Section title="Di mana data disimpan">
            Data disimpan di Supabase (server Singapura) dan aplikasi dijalankan di Vercel. Email dikirim melalui Gmail.
            Akses ke data dibatasi per peran, sehingga anggota hanya melihat data organisasi dan divisinya.
          </Section>

          <Section title="Berapa lama disimpan">
            Data akun disimpan selama akunmu aktif. Data form minat disimpan paling lama 12 bulan setelah festival,
            lalu dihapus. Kamu bisa meminta penghapusan lebih cepat kapan saja.
          </Section>

          <Section title="Hakmu">
            Sesuai UU No. 27 Tahun 2022 tentang Pelindungan Data Pribadi, kamu berhak meminta salinan, memperbaiki,
            atau menghapus datamu, serta menarik persetujuan. Kirim permintaan ke <b>{contact}</b>, dan kami tanggapi
            paling lambat 3 x 24 jam.
          </Section>
        </div>
      </main>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 font-heading text-lg font-bold text-ink">{title}</h2>
      <div>{children}</div>
    </section>
  );
}
