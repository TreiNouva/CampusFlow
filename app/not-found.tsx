import Image from 'next/image';
import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-canvas px-4 text-center">
      <Image src="/brand/campusflow-icon.svg" alt="" width={72} height={72} />
      <p className="mt-6 font-heading text-5xl font-bold text-navy">404</p>
      <h1 className="mt-2 font-heading text-xl font-bold text-ink">Halaman tidak ditemukan</h1>
      <p className="mt-2 max-w-sm text-sm text-muted">
        Alamatnya mungkin salah ketik, sudah dihapus, atau kamu belum punya akses ke halaman ini.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <Link href="/dashboard" className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark">Ke Beranda</Link>
        <Link href="/" className="rounded-lg border border-line bg-surface px-4 py-2 text-sm font-semibold text-ink hover:bg-gray-50">Halaman depan</Link>
      </div>
    </main>
  );
}
