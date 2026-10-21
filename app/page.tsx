import Link from 'next/link';
import { Icon, type IconName } from '@/components/ui/icons';
import { getCurrentUser } from '@/lib/auth/session';
import { PLANS, SEAT_PACK } from '@/lib/plans';
import { cn } from '@/lib/utils';

/**
 * Halaman depan (sebelum login) — v7.
 * Tujuannya memberi ekspektasi yang jelas: CampusFlow itu apa, apa saja yang akan ditemui
 * setelah login, bagaimana cara mulainya, siapa melihat apa, dan rencana paketnya.
 */

const SCREENS: { icon: IconName; title: string; desc: string; who: string }[] = [
  { icon: 'home', title: 'Beranda', desc: 'Daftar organisasimu dan task yang mendekati deadline, dari semua project sekaligus.', who: 'Semua pengguna' },
  { icon: 'chart', title: 'Ringkasan project', desc: 'Progress, task yang telat, acara minggu ini, dan pengumuman terbaru dalam satu layar.', who: 'Ketua, PM, koordinator' },
  { icon: 'tasks', title: 'Task board', desc: 'Bagi tugas lengkap dengan PIC, divisi, prioritas, dan deadline. Status dari To Do sampai Done.', who: 'Semua anggota' },
  { icon: 'calendar', title: 'Kalender', desc: 'Task, rapat, acara, dan milestone per divisi. Bisa dilihat per minggu atau per bulan.', who: 'Semua anggota' },
  { icon: 'file', title: 'Dokumen & budget', desc: 'Proposal, rundown, dan LPJ tersimpan rapi. Pemasukan dan pengeluaran tercatat jelas.', who: 'Sekretaris, bendahara' },
  { icon: 'mail', title: 'Notifikasi email', desc: 'Email hanya untuk hal penting, misalnya task baru untukmu atau pengumuman. Bisa diatur.', who: 'Semua anggota' },
];

const STEPS: { title: string; desc: string }[] = [
  { title: 'Daftar gratis', desc: 'Cukup nama, email, dan password. Tidak perlu instalasi.' },
  { title: 'Buat atau gabung organisasi', desc: 'Pembuat organisasi menjadi Ketua. Anggota lain bergabung lewat link undangan.' },
  { title: 'Buat project/event', desc: 'Isi periode project dan pilih Project Manager. Buat divisi seperti Acara atau Konsumsi.' },
  { title: 'Bagi tugas & pantau', desc: 'Buat task, isi kalender, dan pantau progress. Update penting dikirim lewat email.' },
];

const ROLES: { role: string; sees: string }[] = [
  { role: 'Ketua organisasi', sees: 'Melihat semua project dan mengatur anggota.' },
  { role: 'Project Manager & Wakil', sees: 'Mengatur seluruh isi project: task, divisi, jadwal, pengumuman.' },
  { role: 'PIC / Koordinator divisi', sees: 'Mengatur task, jadwal, dan pengumuman untuk divisinya.' },
  { role: 'Sekretaris', sees: 'Membuat pengumuman dan mengelola dokumen.' },
  { role: 'Bendahara', sees: 'Mencatat rencana anggaran, pemasukan, dan pengeluaran.' },
  { role: 'Anggota', sees: 'Melihat dan mengerjakan task serta jadwal divisinya.' },
];

const FAQ: { q: string; a: string }[] = [
  { q: 'Apakah perlu instal aplikasi?', a: 'Tidak. CampusFlow berjalan di browser, baik di laptop maupun HP.' },
  { q: 'Apakah benar-benar gratis untuk mulai?', a: 'Ya. Paket Gratis cukup untuk mencoba dan kepanitiaan kecil, tanpa kartu pembayaran.' },
  { q: 'Bagaimana kalau anggota kami bertambah sedikit?', a: `Di paket Organisasi kamu cukup menambah kuota per ${SEAT_PACK} anggota, tidak perlu pindah ke paket yang jauh lebih besar.` },
  { q: 'Apa yang terjadi saat pergantian pengurus?', a: 'Task, dokumen, dan riwayat aktivitas tetap tersimpan, jadi pengurus berikutnya bisa melanjutkan.' },
];

export default async function LandingPage() {
  const user = await getCurrentUser();

  return (
    <div className="min-h-screen bg-white text-ink">
      {/* Navigasi atas */}
      <header className="sticky top-0 z-20 border-b border-line bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Link href="/" className="font-heading text-lg font-bold text-navy">CampusFlow</Link>
          <nav className="hidden items-center gap-6 text-sm text-gray-600 md:flex" aria-label="Bagian halaman">
            <a href="#fitur" className="hover:text-ink">Fitur</a>
            <a href="#cara-mulai" className="hover:text-ink">Cara mulai</a>
            <a href="#peran" className="hover:text-ink">Peran</a>
            <a href="#paket" className="hover:text-ink">Paket</a>
          </nav>
          <div className="flex items-center gap-2">
            {user ? (
              <Link href="/dashboard" className="rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-navy-dark">Buka dashboard</Link>
            ) : (
              <>
                <Link href="/login" className="rounded-lg px-3 py-2 text-sm font-semibold text-navy hover:bg-gray-50">Masuk</Link>
                <Link href="/register" className="rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-navy-dark">Daftar gratis</Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="border-b border-line bg-[#F6F8FA]">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-14 sm:px-6 md:py-20 lg:grid-cols-2">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-line bg-white px-3 py-1 text-xs font-medium text-muted">
              Untuk BEM, himpunan, UKM, dan panitia event
            </p>
            <h1 className="mt-5 font-heading text-4xl font-bold leading-tight text-navy sm:text-5xl">
              Run Your Organization, Not Your Spreadsheets.
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-gray-600">
              CampusFlow menggantikan campuran grup WhatsApp, Google Sheets, dan Drive dengan satu tempat kerja:
              pembagian tugas, kalender, pengumuman, dokumen, dan dana organisasi.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href={user ? '/dashboard' : '/register'} className="inline-flex items-center gap-2 rounded-lg bg-navy px-5 py-3 text-sm font-semibold text-white hover:bg-navy-dark">
                {user ? 'Buka dashboard' : 'Mulai gratis'} <Icon name="arrowRight" size={16} />
              </Link>
              <a href="#fitur" className="rounded-lg border border-line bg-white px-5 py-3 text-sm font-semibold text-navy hover:bg-gray-50">
                Lihat isi aplikasinya
              </a>
            </div>
            <p className="mt-4 text-xs text-muted">Gratis untuk mulai · Tanpa instalasi · Bisa dipakai di HP</p>
          </div>
          <AppPreview />
        </div>
      </section>

      {/* Apa yang ditemui setelah login */}
      <section id="fitur" className="scroll-mt-16">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <SectionTitle eyebrow="Setelah login" title="Ini yang akan kamu temui di dalam" desc="Setiap menu punya satu tugas yang jelas. Kamu juga akan dipandu tur singkat saat pertama kali masuk, dan bisa melewatinya." />
          <ul className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {SCREENS.map((s) => (
              <li key={s.title} className="rounded-card border border-line bg-white p-5">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky text-navy"><Icon name={s.icon} /></span>
                <h3 className="mt-4 font-heading text-lg font-bold text-ink">{s.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-gray-600">{s.desc}</p>
                <p className="mt-3 text-xs text-muted">Dipakai oleh: {s.who}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Cara mulai */}
      <section id="cara-mulai" className="scroll-mt-16 border-y border-line bg-[#F6F8FA]">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <SectionTitle eyebrow="Cara mulai" title="Siap dipakai dalam 4 langkah" />
          <ol className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s, i) => (
              <li key={s.title} className="rounded-card border border-line bg-white p-5">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-navy text-sm font-bold text-white">{i + 1}</span>
                <h3 className="mt-4 font-semibold text-ink">{s.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-gray-600">{s.desc}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Peran */}
      <section id="peran" className="scroll-mt-16">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[1fr_1.4fr]">
          <SectionTitle eyebrow="Peran" title="Setiap orang melihat yang ia butuhkan" align="left"
            desc="Anggota tidak dibanjiri informasi divisi lain, sementara ketua tetap bisa melihat gambaran besarnya." />
          <ul className="divide-y divide-line rounded-card border border-line">
            {ROLES.map((r) => (
              <li key={r.role} className="flex flex-col gap-0.5 px-5 py-3.5 sm:flex-row sm:items-center sm:gap-4">
                <span className="w-56 shrink-0 text-sm font-semibold text-ink">{r.role}</span>
                <span className="text-sm text-gray-600">{r.sees}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Paket */}
      <section id="paket" className="scroll-mt-16 border-y border-line bg-[#F6F8FA]">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <SectionTitle eyebrow="Paket" title="Bayar sesuai ukuran organisasimu"
            desc={`Tidak perlu loncat ke paket besar hanya karena anggota bertambah sedikit. Di paket Organisasi, kuota anggota ditambah per ${SEAT_PACK} orang.`} />
          <ul className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-3">
            {PLANS.map((p) => (
              <li key={p.key} className={cn('flex flex-col rounded-card border bg-white p-6', p.highlight ? 'border-navy' : 'border-line')}>
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-heading text-lg font-bold text-ink">{p.name}</h3>
                  {p.highlight && <span className="rounded-full bg-sky px-2.5 py-0.5 text-xs font-semibold text-navy">Paling fleksibel</span>}
                </div>
                <p className="mt-1 text-sm text-muted">{p.forWho}</p>
                <p className="mt-5 font-heading text-3xl font-bold text-navy">{p.price}</p>
                <p className="text-xs text-muted">{p.priceNote}</p>
                <p className="mt-5 flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-2 text-sm font-medium text-ink">
                  <Icon name="users" size={16} className="text-navy" /> {p.members}
                </p>
                <ul className="mt-4 flex-1 space-y-2">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-gray-600">
                      <Icon name="check" size={16} className="mt-0.5 shrink-0 text-navy" /> {f}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
          <div className="mx-auto mt-6 max-w-3xl rounded-card border border-line bg-white px-5 py-4 text-sm text-gray-600">
            <strong className="text-ink">Contoh:</strong> himpunan dengan 38 anggota cukup memakai paket Organisasi (30 anggota) ditambah satu
            tambahan {SEAT_PACK} anggota, tanpa harus membayar paket Kampus. Saat ini semua fitur bisa dicoba gratis selama masa uji coba.
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section>
        <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
          <SectionTitle eyebrow="Pertanyaan umum" title="Yang sering ditanyakan" />
          <div className="mt-8 divide-y divide-line rounded-card border border-line">
            {FAQ.map((f) => (
              <details key={f.q} className="group px-5 py-4">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-semibold text-ink">
                  {f.q}
                  <Icon name="plus" size={16} className="shrink-0 text-muted transition-transform group-open:rotate-45" />
                </summary>
                <p className="mt-2 text-sm leading-relaxed text-gray-600">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Ajakan akhir */}
      <section className="bg-navy">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 px-4 py-12 sm:px-6 md:flex-row md:items-center">
          <div>
            <h2 className="font-heading text-2xl font-bold text-white">Siap merapikan organisasimu?</h2>
            <p className="mt-1 text-sm text-white/70">Daftar dalam satu menit. Tur singkat akan memandumu setelah login.</p>
          </div>
          <Link href={user ? '/dashboard' : '/register'} className="rounded-lg bg-white px-5 py-3 text-sm font-semibold text-navy hover:bg-gray-100">
            {user ? 'Buka dashboard' : 'Daftar gratis'}
          </Link>
        </div>
      </section>
      <footer className="border-t border-line py-6 text-center text-xs text-muted">
        © 2026 CampusFlow · Kelompok 5 Venture Creation, BINUS University
      </footer>
    </div>
  );
}

function SectionTitle({ eyebrow, title, desc, align = 'center' }: { eyebrow: string; title: string; desc?: string; align?: 'center' | 'left' }) {
  return (
    <div className={cn(align === 'center' ? 'mx-auto max-w-2xl text-center' : '')}>
      <p className="text-xs font-semibold uppercase tracking-wider text-teal">{eyebrow}</p>
      <h2 className="mt-2 font-heading text-2xl font-bold text-ink sm:text-3xl">{title}</h2>
      {desc && <p className="mt-3 text-sm leading-relaxed text-gray-600 sm:text-base">{desc}</p>}
    </div>
  );
}

/** Pratinjau tampilan aplikasi (digambar dengan HTML, bukan screenshot) supaya pengunjung tahu bentuknya. */
function AppPreview() {
  const menu: { icon: IconName; label: string; active?: boolean }[] = [
    { icon: 'home', label: 'Ringkasan', active: true }, { icon: 'tasks', label: 'Task' }, { icon: 'calendar', label: 'Kalender' },
    { icon: 'megaphone', label: 'Pengumuman' }, { icon: 'file', label: 'Dokumen' }, { icon: 'wallet', label: 'Budget' },
  ];
  const tasks = [
    { t: 'Booking venue', d: 'Acara', due: 'Besok', warn: true },
    { t: 'Proposal sponsor', d: 'Humas', due: '28 Okt' },
    { t: 'Konsumsi peserta', d: 'Konsumsi', due: '30 Okt' },
  ];
  return (
    <div className="relative" aria-label="Contoh tampilan aplikasi" role="img">
      <div className="overflow-hidden rounded-2xl border border-line bg-white shadow-[0_20px_60px_-20px_rgba(18,54,94,0.25)]">
        <div className="flex items-center gap-1.5 border-b border-line px-4 py-2.5">
          <span className="h-2.5 w-2.5 rounded-full bg-gray-200" /><span className="h-2.5 w-2.5 rounded-full bg-gray-200" /><span className="h-2.5 w-2.5 rounded-full bg-gray-200" />
          <span className="ml-3 truncate text-[11px] text-muted">campusflow · Festival Teknologi 2026</span>
        </div>
        <div className="grid grid-cols-[132px_1fr] sm:grid-cols-[150px_1fr]">
          <div className="border-r border-line p-2.5">
            {menu.map((m) => (
              <div key={m.label} className={cn('mb-0.5 flex items-center gap-2 rounded-md px-2 py-1.5 text-[11px]', m.active ? 'bg-sky font-semibold text-navy' : 'text-gray-500')}>
                <Icon name={m.icon} size={14} /> {m.label}
              </div>
            ))}
          </div>
          <div className="space-y-2.5 p-3">
            <div className="grid grid-cols-3 gap-2">
              {[['Progress', '64%'], ['Task aktif', '12'], ['Telat', '1']].map(([l, v]) => (
                <div key={l} className="rounded-lg border border-line p-2">
                  <p className="text-[9px] text-muted">{l}</p>
                  <p className={cn('font-heading text-base font-bold', l === 'Telat' ? 'text-red-700' : 'text-ink')}>{v}</p>
                </div>
              ))}
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-gray-100"><div className="h-full w-[64%] rounded-full bg-navy" /></div>
            <div className="rounded-lg border border-line">
              <p className="border-b border-line px-2.5 py-1.5 text-[10px] font-semibold text-ink">Perlu perhatian</p>
              {tasks.map((t) => (
                <div key={t.t} className="flex items-center justify-between gap-2 px-2.5 py-1.5 text-[10px]">
                  <span className="truncate text-ink">{t.t} <span className="text-muted">· {t.d}</span></span>
                  <span className={cn('shrink-0 rounded-full px-1.5 py-0.5', t.warn ? 'bg-orange-light text-orange' : 'bg-gray-100 text-gray-600')}>{t.due}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
