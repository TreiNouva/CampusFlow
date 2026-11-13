'use client';

/** Cadangan terakhir jika layout utama sendiri gagal. Tidak bisa memakai CSS aplikasi, jadi gaya ditulis langsung. */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="id">
      <body style={{ margin: 0, fontFamily: 'system-ui, sans-serif', background: '#F6F8FA', color: '#1B2430' }}>
        <main style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 16, textAlign: 'center' }}>
          <h1 style={{ fontSize: 22, margin: 0 }}>CampusFlow sedang bermasalah</h1>
          <p style={{ color: '#5F6B7A', maxWidth: 360 }}>Coba muat ulang halaman ini dalam beberapa saat.</p>
          <button type="button" onClick={reset} style={{ background: '#12365E', color: '#fff', border: 0, borderRadius: 8, padding: '10px 16px', fontWeight: 600, cursor: 'pointer' }}>
            Coba lagi
          </button>
        </main>
      </body>
    </html>
  );
}
