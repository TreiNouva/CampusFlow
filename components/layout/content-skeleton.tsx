/**
 * Skeleton untuk area konten saja. Dipakai loading.tsx di dalam layout ber-menu, sehingga saat pindah
 * halaman menu samping/bawah tetap tampil dan hanya isi halaman yang menunggu — terasa jauh lebih cepat.
 */
export function ContentSkeleton() {
  return (
    <main className="mx-auto max-w-6xl space-y-4 px-4 py-6 sm:px-6 lg:px-8" aria-busy="true" aria-label="Memuat halaman">
      <div className="h-7 w-56 animate-pulse rounded-lg bg-gray-200" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => <div key={i} className="h-24 animate-pulse rounded-card bg-gray-200/80" />)}
      </div>
      <div className="h-64 animate-pulse rounded-card bg-gray-200/70" />
    </main>
  );
}
