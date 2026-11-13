'use client';

import { useRef, useState, useTransition, type FormEvent } from 'react';
import { submitInterest } from '@/actions/billing-actions';
import { track } from '@vercel/analytics';
import { Input, Label, Select, Textarea } from '@/components/ui/input';
import { Icon } from '@/components/ui/icons';
import { cn } from '@/lib/utils';

type Source = 'web' | 'festival' | 'app';
type PlanChoice = 'free' | 'organization' | 'campus' | 'belum_tahu';

const PLAN_OPTIONS: { value: PlanChoice; label: string; hint: string }[] = [
  { value: 'free', label: 'Gratis', hint: 'Sampai 15 anggota' },
  { value: 'organization', label: 'Organisasi', hint: 'Rp49rb/bln, 30 anggota' },
  { value: 'campus', label: 'Kampus', hint: 'Banyak organisasi' },
  { value: 'belum_tahu', label: 'Belum tahu', hint: 'Masih melihat-lihat' },
];

/**
 * Form interest check. Dipakai di halaman depan (web), mode booth festival (/minat), dan di
 * halaman paket (app). `kiosk` = setelah terkirim, form otomatis kosong lagi untuk pengunjung berikutnya.
 */
export function InterestForm({
  source, defaultPlan = 'belum_tahu', organizationId, defaultOrgName = '', compact = false, kiosk = false,
}: {
  source: Source; defaultPlan?: PlanChoice; organizationId?: string; defaultOrgName?: string; compact?: boolean; kiosk?: boolean;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [plan, setPlan] = useState<PlanChoice>(defaultPlan);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();
  // Waktu form mulai tampil (anti-bot: form yang dikirim <2 detik setelah tampil ditolak).
  const [startedAt, setStartedAt] = useState(() => Date.now());

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    fd.set('plan', plan);
    fd.set('source', source);
    if (organizationId) fd.set('organizationId', organizationId);
    startTransition(async () => {
      const res = await submitInterest(fd);
      if (!res.success) { setError(res.error); return; }
      setDone(true);
      try { track('interest_submitted', { source, plan }); } catch { /* analytics opsional */ }
      if (kiosk) {
        setTimeout(() => { formRef.current?.reset(); setPlan(defaultPlan); setStartedAt(Date.now()); setDone(false); }, 4000);
      }
    });
  }

  if (done) {
    return (
      <div className={cn('flex flex-col items-center text-center', kiosk ? 'py-16' : 'py-6')} role="status">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-700"><Icon name="check" size={28} /></span>
        <p className={cn('mt-4 font-heading font-bold text-ink', kiosk ? 'text-3xl' : 'text-xl')}>Terima kasih!</p>
        <p className="mt-1 text-sm text-muted">
          {kiosk ? 'Data kamu sudah tercatat. Form akan siap lagi untuk pengunjung berikutnya.' : 'Kami akan menghubungimu lewat email saat paket berbayar dibuka.'}
        </p>
        {!kiosk && (
          <button type="button" onClick={() => setDone(false)} className="mt-4 text-sm font-semibold text-navy hover:underline">Isi lagi</button>
        )}
      </div>
    );
  }

  const big = kiosk ? 'py-3 text-base' : '';
  return (
    <form ref={formRef} onSubmit={onSubmit} className="space-y-4" noValidate>
      <input type="hidden" name="startedAt" value={startedAt} />
      {/* Kolom jebakan bot: tidak terlihat dan tidak bisa difokus oleh manusia */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label>Website<input type="text" name="website" tabIndex={-1} autoComplete="off" defaultValue="" /></label>
      </div>
      <div className={cn('grid grid-cols-1 gap-4', !compact && 'sm:grid-cols-2')}>
        <div>
          <Label htmlFor={`i-name-${source}`}>Nama</Label>
          <Input id={`i-name-${source}`} name="name" required minLength={2} maxLength={80} autoComplete="name" className={big} />
        </div>
        <div>
          <Label htmlFor={`i-email-${source}`}>Email</Label>
          <Input id={`i-email-${source}`} name="email" type="email" required maxLength={120} autoComplete="email" inputMode="email" className={big} />
        </div>
        <div>
          <Label htmlFor={`i-org-${source}`}>Nama organisasi</Label>
          <Input id={`i-org-${source}`} name="organizationName" maxLength={120} defaultValue={defaultOrgName} placeholder="mis. HIMTI BINUS" className={big} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor={`i-type-${source}`}>Jenis</Label>
            <Select id={`i-type-${source}`} name="organizationType" defaultValue="" className={big}>
              <option value="">Pilih</option>
              <option value="bem">BEM</option>
              <option value="himpunan">Himpunan</option>
              <option value="ukm">UKM</option>
              <option value="kepanitiaan">Kepanitiaan</option>
              <option value="lainnya">Lainnya</option>
            </Select>
          </div>
          <div>
            <Label htmlFor={`i-count-${source}`}>Jumlah anggota</Label>
            <Input id={`i-count-${source}`} name="memberCount" type="number" min={1} max={10000} inputMode="numeric" className={big} />
          </div>
        </div>
      </div>

      <fieldset>
        <legend className="mb-1.5 text-sm font-medium text-ink">Paket yang paling cocok</legend>
        <div className={cn('grid gap-2', compact ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-4')}>
          {PLAN_OPTIONS.map((o) => (
            <label key={o.value}
              className={cn('cursor-pointer rounded-lg border px-3 py-2.5 text-sm transition',
                plan === o.value ? 'border-navy bg-sky/60' : 'border-line hover:border-gray-300')}>
              <input type="radio" name="planChoice" value={o.value} checked={plan === o.value} onChange={() => setPlan(o.value)} className="sr-only" />
              <span className="block font-semibold text-ink">{o.label}</span>
              <span className="block text-xs text-muted">{o.hint}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-1.5 text-sm font-medium text-ink">Bersedia membayar jika fiturnya cocok?</legend>
        <div className="flex flex-wrap gap-2">
          {[['ya', 'Ya'], ['mungkin', 'Mungkin'], ['tidak', 'Tidak']].map(([v, l]) => (
            <label key={v} className="flex cursor-pointer items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm has-[:checked]:border-navy has-[:checked]:bg-sky/60">
              <input type="radio" name="willingToPay" value={v} className="accent-[#12365E]" /> {l}
            </label>
          ))}
        </div>
      </fieldset>

      {!kiosk && (
        <div>
          <Label htmlFor={`i-note-${source}`}>Catatan (opsional)</Label>
          <Textarea id={`i-note-${source}`} name="note" rows={2} maxLength={500} placeholder="Fitur yang paling kamu butuhkan?" />
        </div>
      )}

      <label className="flex items-start gap-2.5 text-sm text-gray-700">
        <input type="checkbox" name="consent" required className="mt-0.5 h-4 w-4 shrink-0 accent-[#12365E]" />
        <span>
          Saya setuju data ini disimpan tim CampusFlow untuk menghubungi saya, sesuai{' '}
          <a href="/privasi" target="_blank" rel="noopener" className="font-semibold text-navy underline underline-offset-2">Kebijakan Privasi</a>.
        </span>
      </label>
      {error && <p className="text-sm text-red-700" role="alert">{error}</p>}
      <button type="submit" disabled={pending}
        className={cn('w-full rounded-lg bg-brand font-semibold text-white hover:bg-brand-dark disabled:opacity-50', kiosk ? 'py-4 text-lg' : 'py-2.5 text-sm')}>
        {pending ? 'Menyimpan…' : 'Kirim'}
      </button>
    </form>
  );
}
