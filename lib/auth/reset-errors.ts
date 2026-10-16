/**
 * Menerjemahkan error Supabase saat meminta email reset password menjadi pesan yang
 * ramah untuk user. Detail aslinya tetap dicatat di console browser untuk debugging.
 */
export function resetRequestErrorMessage(error: { status?: number; message: string }): string {
  console.error('[resetPasswordForEmail]', error.status, error.message);
  const message = error.message.toLowerCase();

  if (error.status === 429 || message.includes('rate limit') || message.includes('seconds')) {
    return 'Terlalu sering meminta link. Tunggu sekitar 1 menit lalu coba lagi.';
  }
  if (message.includes('not authorized')) {
    // Terjadi jika SMTP bawaan Supabase dipakai & penerima bukan anggota tim project Supabase.
    return 'Layanan pengiriman email belum dikonfigurasi (SMTP Supabase). Hubungi admin.';
  }
  return 'Gagal mengirim email reset. Coba lagi sebentar lagi.';
}
