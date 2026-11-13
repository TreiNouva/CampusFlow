import type { Metadata } from 'next';
import { headers } from 'next/headers';
import QRCode from 'qrcode';
import { PrintButton } from '@/app/projects/[projectId]/laporan/print-button';
import { FREE_MEMBERS, ORG_BASE_MEMBERS, SEAT_PACK } from '@/lib/plans';

export const metadata: Metadata = { title: 'Poster QR · CampusFlow' };

/** Poster A4 untuk stan festival: QR ke form minat (/minat). Cetak dari browser. */
export default async function PosterPage() {
  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'campus-flow-sepia.vercel.app';
  const proto = h.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https');
  const url = `${proto}://${host}/minat?src=qr`;
  const svg = await QRCode.toString(url, { type: 'svg', margin: 1, errorCorrectionLevel: 'M', color: { dark: '#12365E', light: '#FFFFFF' } });

  return (
    <div className="min-h-screen bg-canvas py-8 print:bg-white print:py-0">
      <div className="mx-auto mb-4 flex max-w-[210mm] items-center justify-between px-4 print:hidden">
        <p className="text-sm text-muted">Ukuran A4. Pilih “Simpan sebagai PDF” atau langsung cetak.</p>
        <PrintButton />
      </div>
      <article className="mx-auto flex aspect-[210/297] max-w-[210mm] flex-col items-center justify-between bg-white px-[12mm] py-[14mm] text-center text-[#1B2430] shadow-lg print:shadow-none">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/campusflow-logo-horizontal.svg" alt="CampusFlow" className="h-[16mm]" />
        <div>
          <h1 className="font-heading text-[11mm] font-bold leading-tight text-[#12365E]">
            Organisasimu masih koordinasi lewat grup WhatsApp?
          </h1>
          <p className="mx-auto mt-[5mm] max-w-[150mm] text-[4.6mm] leading-snug text-[#5F6B7A]">
            Task, kalender, pengumuman, dokumen, dan dana organisasi dalam satu tempat.
          </p>
        </div>
        <div className="rounded-[6mm] border-[1.2mm] border-[#12365E] p-[5mm]">
          <div className="h-[82mm] w-[82mm] [&>svg]:h-full [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: svg }} />
        </div>
        <div>
          <p className="font-heading text-[7mm] font-bold text-[#12365E]">Scan & daftar jadi pengguna awal</p>
          <p className="mt-[2mm] text-[4mm] text-[#5F6B7A]">
            Gratis untuk {FREE_MEMBERS} anggota · Organisasi Rp49rb/bln ({ORG_BASE_MEMBERS} anggota, +Rp10rb per {SEAT_PACK})
          </p>
          <p className="mt-[3mm] font-mono text-[3.6mm] text-[#2B6C8A]">{url.replace(/^https?:\/\//, '').replace('?src=qr', '')}</p>
        </div>
      </article>
    </div>
  );
}
