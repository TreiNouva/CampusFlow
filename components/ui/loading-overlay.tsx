import { cn } from '@/lib/utils';

interface LoadingOverlayProps {
  label?: string;
  /** Jika true, overlay muncul dengan delay singkat (untuk loading halaman) agar tidak berkedip. */
  delayed?: boolean;
}

/**
 * Layar diredupkan + diburamkan sementara sambil menampilkan spinner.
 * Dipakai di app/loading.tsx (pindah halaman) dan di form saat submit.
 */
export function LoadingOverlay({ label = 'Memuat...', delayed = false }: LoadingOverlayProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'fixed inset-0 z-[100] flex items-center justify-center bg-navy/30 backdrop-blur-[3px]',
        delayed ? 'animate-fade-in-delayed' : 'animate-fade-in'
      )}
    >
      <div className="flex items-center gap-3 rounded-card bg-white px-5 py-3 shadow-lg">
        <span
          className="h-5 w-5 animate-spin rounded-full border-2 border-gray-200 border-t-orange"
          aria-hidden="true"
        />
        <span className="text-sm font-medium text-ink">{label}</span>
      </div>
    </div>
  );
}
