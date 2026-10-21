'use client';

import { useCallback, useEffect, useState } from 'react';
import { completeOnboarding } from '@/actions/onboarding-actions';
import { Icon, type IconName } from '@/components/ui/icons';
import { cn } from '@/lib/utils';

const OPEN_EVENT = 'cf:open-tour';
const LOCAL_KEY = 'cf:onboarded';

/** Buka tutorial dari mana saja (mis. tombol "Panduan singkat" di menu). */
export function openTour() {
  window.dispatchEvent(new Event(OPEN_EVENT));
}

interface Step { icon: IconName; title: string; body: string; tip?: string }

const STEPS: Step[] = [
  {
    icon: 'sparkle',
    title: 'Selamat datang di CampusFlow',
    body: 'Semua urusan organisasi (task, jadwal, pengumuman, dokumen, dan dana) ada di satu tempat. Tur ini hanya sekitar 1 menit.',
    tip: 'Bisa dilewati kapan saja, dan dibuka lagi dari menu → Panduan singkat.',
  },
  {
    icon: 'building',
    title: 'Mulai dari organisasi',
    body: 'Di Beranda, buat organisasi baru (kamu otomatis menjadi Ketua) atau bergabung lewat link undangan. Di dalam organisasi, buat project/event lalu pilih Project Manager-nya.',
  },
  {
    icon: 'menu',
    title: 'Semua menu ada di satu tempat',
    body: 'Di laptop, menu ada di sisi kiri. Di HP, tekan tombol ☰ di kiri atas atau "Lainnya" di bar bawah. Menu yang paling sering dipakai (Ringkasan, Task, Kalender, Dokumen) selalu ada di bar bawah.',
  },
  {
    icon: 'tasks',
    title: 'Bagi tugas dengan jelas',
    body: 'Buat task, tentukan PIC, divisi, prioritas, dan deadline. Ubah status dari To Do sampai Done supaya progress terlihat oleh ketua dan koordinator.',
    tip: 'Deadline harus berada di dalam periode project.',
  },
  {
    icon: 'calendar',
    title: 'Kalender & pengumuman',
    body: 'Kalender menampilkan task, acara, dan milestone. Pengumuman bisa untuk semua anggota (Global) atau divisi tertentu saja. Anggota hanya melihat yang relevan untuk divisinya.',
  },
  {
    icon: 'file',
    title: 'Dokumen, budget, dan anggota',
    body: 'Simpan proposal, rundown, dan LPJ di Dokumen. Bendahara mencatat pemasukan dan pengeluaran di Budget. Undang anggota dengan link di Anggota & Divisi.',
  },
  {
    icon: 'bell',
    title: 'Notifikasi tanpa spam',
    body: 'Kamu menerima email hanya untuk update penting, misalnya task baru untukmu atau pengumuman. Atur levelnya di menu Notifikasi Email pada tiap project.',
    tip: 'Siap! Klik "Mulai pakai" untuk menutup panduan.',
  },
];

export function OnboardingTour({ initialOpen, inProject }: { initialOpen: boolean; inProject: boolean }) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  // Tampilkan otomatis untuk user yang belum pernah menyelesaikan/melewati tutorial.
  useEffect(() => {
    let seen = false;
    try { seen = window.localStorage.getItem(LOCAL_KEY) === '1'; } catch { /* storage diblokir */ }
    if (initialOpen && !seen) setOpen(true);
    const onOpen = () => { setStep(0); setOpen(true); };
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_EVENT, onOpen);
  }, [initialOpen]);

  const finish = useCallback(() => {
    setOpen(false);
    try { window.localStorage.setItem(LOCAL_KEY, '1'); } catch { /* abaikan */ }
    void completeOnboarding().catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') finish();
      if (e.key === 'ArrowRight') setStep((s) => Math.min(STEPS.length - 1, s + 1));
      if (e.key === 'ArrowLeft') setStep((s) => Math.max(0, s - 1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, finish]);

  if (!open) return null;
  const s = STEPS[step];
  const last = step === STEPS.length - 1;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby="tour-title">
      <div className="animate-fade-in absolute inset-0 bg-[#0B1B2E]/45" onClick={finish} aria-hidden />
      <div className="anim-rise relative w-full max-w-md rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl">
        <div className="flex items-center justify-between px-5 pt-4">
          <span className="text-xs font-medium text-muted">Panduan {step + 1} dari {STEPS.length}</span>
          <button type="button" onClick={finish} className="rounded-lg px-2.5 py-1 text-xs font-semibold text-muted hover:bg-gray-100 hover:text-ink">
            Lewati
          </button>
        </div>

        <div className="px-6 pb-2 pt-4">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sky text-navy">
            <Icon name={s.icon} size={24} />
          </span>
          <h2 id="tour-title" className="mt-4 font-heading text-xl font-bold text-ink">{s.title}</h2>
          <p className="mt-2 text-sm leading-relaxed text-gray-600">{s.body}</p>
          {s.tip && <p className="mt-3 rounded-lg bg-gray-50 px-3 py-2 text-xs text-muted">{s.tip}</p>}
          {step === 2 && !inProject && (
            <p className="mt-2 text-xs text-muted">Menu project akan muncul setelah kamu membuka sebuah project.</p>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 px-5 pb-5 pt-4">
          <div className="flex gap-1.5" aria-hidden>
            {STEPS.map((_, i) => (
              <span key={i} className={cn('h-1.5 rounded-full transition-all', i === step ? 'w-5 bg-navy' : 'w-1.5 bg-gray-200')} />
            ))}
          </div>
          <div className="flex gap-2">
            {step > 0 && (
              <button type="button" onClick={() => setStep(step - 1)} className="rounded-lg border border-line px-3.5 py-2 text-sm font-medium text-ink hover:bg-gray-50">
                Kembali
              </button>
            )}
            <button type="button" onClick={() => (last ? finish() : setStep(step + 1))} autoFocus
              className="rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-navy-dark">
              {last ? 'Mulai pakai' : 'Lanjut'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
