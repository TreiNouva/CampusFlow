import { LoadingOverlay } from '@/components/ui/loading-overlay';

/**
 * Tampil otomatis oleh Next.js setiap kali pindah halaman yang masih memuat data.
 * Kerangka halaman (skeleton) ditampilkan di belakang, lalu diredupkan & diburamkan.
 */
export default function Loading() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="h-[57px] border-b border-gray-100 bg-white" />
      <main className="mx-auto max-w-6xl space-y-6 px-6 py-8">
        <div className="h-8 w-60 animate-pulse rounded-lg bg-gray-200" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-28 animate-pulse rounded-card bg-gray-200" />
          ))}
        </div>
        <div className="h-64 animate-pulse rounded-card bg-gray-200" />
      </main>
      <LoadingOverlay label="Memuat halaman..." delayed />
    </div>
  );
}
