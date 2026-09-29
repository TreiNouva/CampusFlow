import Link from 'next/link';

const FEATURES = [
  { title: 'Organization Workspace', desc: 'Profil, struktur, dan role anggota dalam satu tempat.' },
  { title: 'Task Management', desc: 'PIC, status, priority, dan deadline yang jelas.' },
  { title: 'Activity Feed', desc: 'Histori perubahan tercatat otomatis, siap diteruskan ke pengurus berikutnya.' },
  { title: 'Email Notification', desc: 'Update penting dikirim ke email — terkontrol, tanpa spam.' },
];

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-navy text-white">
      <div className="mx-auto max-w-5xl px-6 py-24">
        <p className="text-sm font-semibold tracking-widest text-orange">CAMPUSFLOW</p>
        <h1 className="mt-4 font-heading text-4xl font-bold sm:text-5xl">
          Run Your Organization,
          <br /> Not Your Spreadsheets.
        </h1>
        <p className="mt-6 max-w-xl text-sky">
          Platform web untuk BEM, himpunan, UKM, dan panitia event mengelola project, task,
          anggota, dan progress dalam satu workspace — dengan update penting yang dikirim
          otomatis lewat email.
        </p>
        <div className="mt-8 flex gap-3">
          <Link
            href="/register"
            className="rounded-lg bg-orange px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90"
          >
            Mulai Gratis
          </Link>
          <Link
            href="/login"
            className="rounded-lg border border-white/30 px-5 py-2.5 text-sm font-semibold text-white hover:bg-white/10"
          >
            Masuk
          </Link>
        </div>

        <div className="mt-20 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f) => (
            <div key={f.title} className="rounded-card border border-white/10 bg-white/5 p-5">
              <h3 className="font-heading text-base font-bold">{f.title}</h3>
              <p className="mt-2 text-sm text-sky">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
