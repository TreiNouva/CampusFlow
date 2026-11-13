'use client';

import { useMemo, useRef, useState, useTransition, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { activatePlanDemo, cancelPlanDemo } from '@/actions/billing-actions';
import { Icon } from '@/components/ui/icons';
import { InterestForm } from '@/components/interest/interest-form';
import {
  FREE_MEMBERS, FREE_PROJECTS, MAX_SEAT_PACKS, ORG_BASE_MEMBERS, ORG_BASE_PRICE, PLAN_NAME, SEAT_PACK, SEAT_PACK_PRICE,
  YEARLY_MONTHS_CHARGED, minSeatPacks, planPrice, rupiah, type BillingCycle, type PlanKey,
} from '@/lib/plans';
import { cn } from '@/lib/utils';

export interface BillingPanelProps {
  organizationId: string;
  organizationName: string;
  plan: PlanKey;
  seatPacks: number;
  cycle: BillingCycle;
  periodEnd: string | null;
  expired: boolean;
  memberCount: number;
  memberLimit: number | null;
  activeProjects: number;
  projectLimit: number | null;
  canManage: boolean;
  unavailable: boolean;
  payments: { id: string; amount: number; plan: string; seat_packs: number; billing_cycle: string; created_at: string; status: string }[];
}

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Jakarta' });

function Usage({ label, used, limit }: { label: string; used: number; limit: number | null }) {
  const pct = limit ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  const full = limit !== null && used >= limit;
  return (
    <div>
      <div className="flex items-baseline justify-between text-sm">
        <span className="text-gray-600">{label}</span>
        <span className={cn('font-semibold', full ? 'text-red-700' : 'text-ink')}>
          {used}{limit !== null ? ` / ${limit}` : ''} {limit === null && <span className="font-normal text-muted">· tanpa batas</span>}
        </span>
      </div>
      {limit !== null && (
        <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-gray-100">
          <div className={cn('h-full rounded-full', full ? 'bg-red-600' : pct >= 80 ? 'bg-orange' : 'bg-brand')} style={{ width: `${pct}%` }} />
        </div>
      )}
      {full && <p className="mt-1 text-xs text-red-700">Kuota penuh: penambahan baru akan ditolak.</p>}
    </div>
  );
}

export function BillingPanel(props: BillingPanelProps) {
  const router = useRouter();
  const minPacks = minSeatPacks(props.memberCount);
  const [cycle, setCycle] = useState<BillingCycle>(props.plan === 'organization' ? props.cycle : 'monthly');
  const [packs, setPacks] = useState(Math.max(minPacks, props.plan === 'organization' ? props.seatPacks : 0));
  const [step, setStep] = useState<'configure' | 'checkout' | 'success'>('configure');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ amount: number; periodEnd: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const [showCampus, setShowCampus] = useState(false);
  const panelRef = useRef<HTMLElement>(null);

  // Di HP, panel pembayaran ada di bawah kartu paket: gulir ke sana saat langkah berganti.
  useEffect(() => {
    if (step !== 'configure') panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [step]);

  const total = planPrice(packs, cycle);
  const monthly = planPrice(packs, 'monthly');
  const capacity = ORG_BASE_MEMBERS + SEAT_PACK * packs;
  const isCurrent = props.plan === 'organization' && packs === props.seatPacks && cycle === props.cycle;

  function pay() {
    setError(null);
    startTransition(async () => {
      const res = await activatePlanDemo({ organizationId: props.organizationId, seatPacks: packs, cycle });
      if (!res.success) { setError(res.error); return; }
      setResult(res.data ?? null);
      setStep('success');
      router.refresh();
    });
  }

  function downgrade() {
    if (!window.confirm('Kembali ke paket Gratis? Anggota lama tidak dikeluarkan, tetapi penambahan anggota dan project baru akan mengikuti batas paket Gratis.')) return;
    setError(null);
    startTransition(async () => {
      const res = await cancelPlanDemo(props.organizationId);
      if (!res.success) { setError(res.error); return; }
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 rounded-card border border-warn-line bg-orange-light px-4 py-3 text-sm text-warn-ink">
        <Icon name="alert" size={18} className="mt-0.5 shrink-0" />
        <p>
          <b>Mode demo.</b> Pembayaran belum terhubung ke payment gateway. Kode QRIS masih placeholder, dan tombol
          “Saya sudah bayar” langsung mengaktifkan paket tanpa memotong uang.
        </p>
      </div>
      {props.unavailable && (
        <p className="rounded-card border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Fitur paket belum aktif di database. Jalankan migrasi <code>0005_billing_interest_security.sql</code> di Supabase.
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        {/* Paket saat ini */}
        <section className="rounded-card border border-line bg-surface p-5 lg:col-span-2" aria-labelledby="current-plan">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Paket saat ini</p>
          <div className="mt-1 flex items-center gap-2">
            <h2 id="current-plan" className="font-heading text-2xl font-bold text-navy">{PLAN_NAME[props.plan]}</h2>
            {props.plan === 'organization' && (
              <span className="rounded-full bg-sky px-2.5 py-0.5 text-xs font-semibold text-navy">{props.cycle === 'yearly' ? 'Tahunan' : 'Bulanan'}</span>
            )}
          </div>
          <p className="mt-1 text-sm text-muted">
            {props.plan === 'organization' && props.periodEnd
              ? `Aktif sampai ${fmtDate(props.periodEnd)}`
              : props.expired ? 'Masa aktif paket Organisasi sudah habis, kembali ke Gratis.'
              : props.plan === 'free' ? `Gratis untuk ${FREE_MEMBERS} anggota dan ${FREE_PROJECTS} project aktif.` : 'Sesuai kesepakatan dengan kampus.'}
          </p>
          <div className="mt-5 space-y-4">
            <Usage label="Anggota organisasi" used={props.memberCount} limit={props.memberLimit} />
            <Usage label="Project aktif" used={props.activeProjects} limit={props.projectLimit} />
          </div>
          {props.plan === 'organization' && props.canManage && (
            <button type="button" onClick={downgrade} disabled={pending}
              className="mt-5 text-xs font-semibold text-muted underline-offset-2 hover:text-red-700 hover:underline disabled:opacity-50">
              Kembali ke paket Gratis
            </button>
          )}
        </section>

        {/* Konfigurasi / checkout */}
        <section ref={panelRef} className="scroll-mt-20 rounded-card border border-line bg-surface p-5 lg:col-span-3" aria-label="Upgrade paket">
          {!props.canManage ? (
            <div className="flex h-full flex-col justify-center gap-2 text-sm text-gray-600">
              <h2 className="font-heading text-lg font-bold text-ink">Butuh kuota lebih?</h2>
              <p>Hanya Ketua, Wakil Ketua, atau Bendahara organisasi yang dapat mengubah paket. Hubungi mereka untuk upgrade.</p>
            </div>
          ) : step === 'configure' ? (
            <div>
              <h2 className="font-heading text-lg font-bold text-ink">{props.plan === 'organization' ? 'Ubah paket Organisasi' : 'Upgrade ke paket Organisasi'}</h2>
              <p className="text-sm text-muted">Project tanpa batas, dan kuota anggota bisa ditambah per {SEAT_PACK} orang.</p>

              <div className="mt-4 inline-flex rounded-lg bg-gray-100 p-1" role="radiogroup" aria-label="Periode tagihan">
                {(['monthly', 'yearly'] as const).map((c) => (
                  <button key={c} type="button" role="radio" aria-checked={cycle === c} onClick={() => setCycle(c)}
                    className={cn('rounded-md px-3.5 py-1.5 text-sm font-medium transition', cycle === c ? 'bg-surface font-semibold text-navy shadow-sm' : 'text-gray-600')}>
                    {c === 'monthly' ? 'Bulanan' : 'Tahunan · gratis 2 bulan'}
                  </button>
                ))}
              </div>

              <div className="mt-5 flex flex-wrap items-center justify-between gap-4 rounded-lg border border-line p-4">
                <div>
                  <p className="text-sm font-semibold text-ink">Tambahan anggota</p>
                  <p className="text-xs text-muted">Kapasitas total: <b className="text-ink">{capacity} anggota</b> (saat ini {props.memberCount})</p>
                </div>
                <div className="flex items-center gap-2">
                  <button type="button" aria-label="Kurangi tambahan" onClick={() => setPacks((p) => Math.max(minPacks, p - 1))} disabled={packs <= minPacks}
                    className="flex h-9 w-9 items-center justify-center rounded-lg border border-line text-lg font-semibold text-ink hover:bg-gray-50 disabled:opacity-40">−</button>
                  <span className="w-24 text-center text-sm font-semibold text-ink" aria-live="polite">+{packs * SEAT_PACK} anggota</span>
                  <button type="button" aria-label="Tambah tambahan" onClick={() => setPacks((p) => Math.min(MAX_SEAT_PACKS, p + 1))} disabled={packs >= MAX_SEAT_PACKS}
                    className="flex h-9 w-9 items-center justify-center rounded-lg border border-line text-lg font-semibold text-ink hover:bg-gray-50 disabled:opacity-40">+</button>
                </div>
              </div>
              {minPacks > 0 && <p className="mt-2 text-xs text-muted">Minimal +{minPacks * SEAT_PACK} karena organisasi ini sudah punya {props.memberCount} anggota.</p>}

              <dl className="mt-5 space-y-1.5 text-sm">
                <div className="flex justify-between"><dt className="text-gray-600">Paket dasar ({ORG_BASE_MEMBERS} anggota)</dt><dd>{rupiah(ORG_BASE_PRICE)}/bln</dd></div>
                {packs > 0 && <div className="flex justify-between"><dt className="text-gray-600">Tambahan {packs} × {SEAT_PACK} anggota</dt><dd>{rupiah(SEAT_PACK_PRICE * packs)}/bln</dd></div>}
                {cycle === 'yearly' && <div className="flex justify-between"><dt className="text-gray-600">Tahunan: bayar {YEARLY_MONTHS_CHARGED} bulan</dt><dd>{rupiah(monthly)} × {YEARLY_MONTHS_CHARGED}</dd></div>}
                <div className="flex justify-between border-t border-line pt-2 text-base font-bold text-ink">
                  <dt>Total</dt><dd>{rupiah(total)}<span className="text-sm font-normal text-muted">/{cycle === 'yearly' ? 'tahun' : 'bulan'}</span></dd>
                </div>
              </dl>

              <button type="button" onClick={() => { setError(null); setStep('checkout'); }} disabled={isCurrent || props.unavailable}
                className="mt-5 w-full rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-50">
                {isCurrent ? 'Ini paket kamu saat ini' : 'Lanjut ke pembayaran'}
              </button>
            </div>
          ) : step === 'checkout' ? (
            <Checkout amount={total} cycle={cycle} capacity={capacity} orgName={props.organizationName}
              pending={pending} error={error} onPaid={pay} onBack={() => { setStep('configure'); setError(null); }} />
          ) : (
            <div className="flex flex-col items-center py-6 text-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-700"><Icon name="check" size={28} /></span>
              <h2 className="mt-4 font-heading text-xl font-bold text-ink">Paket Organisasi aktif</h2>
              <p className="mt-1 text-sm text-muted">
                {rupiah(result?.amount ?? total)} tercatat (demo). Kapasitas kini {capacity} anggota
                {result?.periodEnd ? `, aktif sampai ${fmtDate(result.periodEnd)}` : ''}.
              </p>
              <button type="button" onClick={() => setStep('configure')} className="mt-5 rounded-lg border border-line px-4 py-2 text-sm font-semibold text-ink hover:bg-gray-50">Selesai</button>
            </div>
          )}
        </section>
      </div>

      {/* Bandingkan paket */}
      <section className="rounded-card border border-line bg-surface p-5" aria-label="Perbandingan paket">
        <h2 className="font-heading text-lg font-bold text-ink">Semua paket</h2>
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
          <PlanCard title="Gratis" price="Rp0" lines={[`${FREE_MEMBERS} anggota`, `${FREE_PROJECTS} project aktif`, 'Semua fitur inti']} current={props.plan === 'free'} />
          <PlanCard title="Organisasi" price={`${rupiah(ORG_BASE_PRICE)}/bln`} lines={[`${ORG_BASE_MEMBERS} anggota + ${rupiah(SEAT_PACK_PRICE)} per ${SEAT_PACK} anggota`, 'Project tanpa batas', 'Tahunan gratis 2 bulan']} current={props.plan === 'organization'} />
          <PlanCard title="Kampus" price="Hubungi kami" lines={['Banyak organisasi', 'Dashboard kemahasiswaan', 'Pendampingan']} current={props.plan === 'campus'}
            action={<button type="button" onClick={() => setShowCampus((v) => !v)} className="mt-3 text-sm font-semibold text-navy hover:underline">{showCampus ? 'Tutup' : 'Saya tertarik'}</button>} />
        </div>
        {showCampus && (
          <div className="mt-4 rounded-lg border border-line p-4">
            <InterestForm source="app" defaultPlan="campus" organizationId={props.organizationId} defaultOrgName={props.organizationName} compact />
          </div>
        )}
      </section>

      {props.canManage && (
        <section className="rounded-card border border-line bg-surface" aria-label="Riwayat pembayaran">
          <h2 className="border-b border-line px-5 py-3 font-heading text-lg font-bold text-ink">Riwayat pembayaran</h2>
          {props.payments.length === 0 ? (
            <p className="px-5 py-4 text-sm text-muted">Belum ada pembayaran.</p>
          ) : (
            <ul className="divide-y divide-line">
              {props.payments.map((p) => (
                <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-sm">
                  <div>
                    <p className="font-medium text-ink">Organisasi · {ORG_BASE_MEMBERS + SEAT_PACK * p.seat_packs} anggota · {p.billing_cycle === 'yearly' ? 'Tahunan' : 'Bulanan'}</p>
                    <p className="text-xs text-muted">{fmtDate(p.created_at)} · QRIS (demo)</p>
                  </div>
                  <span className="font-semibold text-ink">{rupiah(p.amount)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}

function PlanCard({ title, price, lines, current, action }: { title: string; price: string; lines: string[]; current: boolean; action?: React.ReactNode }) {
  return (
    <div className={cn('rounded-lg border p-4', current ? 'border-navy bg-sky/40' : 'border-line')}>
      <div className="flex items-center justify-between">
        <p className="font-semibold text-ink">{title}</p>
        {current && <span className="rounded-full bg-brand px-2 py-0.5 text-[11px] font-semibold text-white">Paket kamu</span>}
      </div>
      <p className="mt-1 font-heading text-lg font-bold text-navy">{price}</p>
      <ul className="mt-2 space-y-1">
        {lines.map((l) => <li key={l} className="flex gap-1.5 text-xs text-gray-600"><Icon name="check" size={14} className="mt-0.5 shrink-0 text-navy" />{l}</li>)}
      </ul>
      {action}
    </div>
  );
}

function Checkout({ amount, cycle, capacity, orgName, pending, error, onPaid, onBack }: {
  amount: number; cycle: BillingCycle; capacity: number; orgName: string; pending: boolean; error: string | null; onPaid: () => void; onBack: () => void;
}) {
  // Hitung mundur hanya tampilan (QRIS asli biasanya berlaku 15 menit).
  const [left, setLeft] = useState(15 * 60);
  useEffect(() => {
    const t = setInterval(() => setLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, []);
  const mm = String(Math.floor(left / 60)).padStart(2, '0');
  const ss = String(left % 60).padStart(2, '0');
  const orderId = useMemo(() => 'CF-' + Date.now().toString(36).toUpperCase(), []);

  return (
    <div>
      <button type="button" onClick={onBack} className="flex items-center gap-1 text-xs font-semibold text-muted hover:text-navy">
        <Icon name="chevronLeft" size={14} /> Ubah pilihan
      </button>
      <div className="mt-3 grid grid-cols-1 gap-5 sm:grid-cols-[auto_1fr]">
        <div className="flex flex-col items-center">
          <div className="rounded-xl border border-line p-3">
            {/* PLACEHOLDER QRIS: ganti dengan gambar QR dari payment gateway saat sudah terhubung */}
            <div className="flex h-[240px] w-[240px] items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-gray-50" role="img" aria-label="Placeholder kode QRIS">
              <span className="text-sm font-semibold tracking-wide text-gray-400">Placeholder</span>
            </div>
          </div>
          <p className="mt-2 text-xs text-muted">QRIS · berlaku <span className="font-semibold tabular-nums text-ink">{mm}:{ss}</span></p>
        </div>
        <div className="flex flex-col">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Total bayar</p>
          <p className="font-heading text-3xl font-bold text-navy">{rupiah(amount)}</p>
          <dl className="mt-3 space-y-1 text-sm">
            <div className="flex justify-between gap-3"><dt className="text-gray-600">Organisasi</dt><dd className="truncate font-medium text-ink">{orgName}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-gray-600">Paket</dt><dd className="text-ink">Organisasi · {capacity} anggota</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-gray-600">Periode</dt><dd className="text-ink">{cycle === 'yearly' ? '1 tahun' : '1 bulan'}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-gray-600">No. pesanan</dt><dd className="font-mono text-xs text-ink">{orderId}</dd></div>
          </dl>
          <ol className="mt-4 list-decimal space-y-1 pl-5 text-xs text-gray-600">
            <li>Buka aplikasi m-banking atau e-wallet yang mendukung QRIS.</li>
            <li>Pindai kode QR di samping, lalu periksa nominalnya.</li>
            <li>Selesaikan pembayaran, lalu tekan “Saya sudah bayar”.</li>
          </ol>
          {error && <p className="mt-3 text-sm text-red-700" role="alert">{error}</p>}
          <div className="mt-auto flex flex-wrap gap-2 pt-4">
            <button type="button" onClick={onPaid} disabled={pending || left === 0}
              className="flex-1 rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-50">
              {pending ? 'Memeriksa pembayaran…' : left === 0 ? 'Kode kedaluwarsa' : 'Saya sudah bayar'}
            </button>
            <button type="button" onClick={onBack} disabled={pending} className="rounded-lg border border-line px-4 py-2.5 text-sm font-semibold text-ink hover:bg-gray-50">Batal</button>
          </div>
        </div>
      </div>
    </div>
  );
}
