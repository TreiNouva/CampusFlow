/**
 * Mengubah error dari fungsi database (RPC) menjadi pesan untuk user.
 * Fungsi di SQL memakai `raise exception '<pesan Indonesia>'` (kode P0001) untuk penolakan yang wajar
 * (mis. "Hanya Ketua yang dapat ..."), jadi pesannya aman & informatif untuk ditampilkan.
 * Error lain (koneksi, constraint, dll) hanya dicatat di log server dan diganti pesan umum.
 */
export function rpcErrorMessage(
  error: { code?: string; message: string },
  fallback = 'Terjadi kesalahan. Coba lagi sebentar lagi.'
): string {
  if (error.code === 'P0001') return error.message;
  if (error.code === '23505') return 'Data tersebut sudah ada.';
  if (error.code === '42501') return 'Kamu tidak memiliki izin untuk melakukan aksi ini.';
  console.error('[rpc]', error.code, error.message);
  return fallback;
}
