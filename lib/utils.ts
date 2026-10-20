import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { TaskPriority, TaskStatus } from '@/types/database';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—';
  return new Date(value).toLocaleString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export const STATUS_LABEL: Record<TaskStatus, string> = {
  todo: 'To Do',
  in_progress: 'In Progress',
  review: 'Review',
  done: 'Done',
  blocked: 'Blocked',
};

export const STATUS_COLOR: Record<TaskStatus, string> = {
  todo: 'bg-gray-100 text-gray-700',
  in_progress: 'bg-sky text-navy',
  review: 'bg-purple-100 text-purple-700',
  done: 'bg-green-100 text-green-700',
  blocked: 'bg-red-100 text-red-700',
};

export const PRIORITY_LABEL: Record<TaskPriority, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  urgent: 'Urgent',
};

export const PRIORITY_COLOR: Record<TaskPriority, string> = {
  low: 'bg-gray-100 text-gray-600',
  medium: 'bg-sky text-navy',
  high: 'bg-orange-light text-orange',
  urgent: 'bg-red-100 text-red-700',
};

export function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase())
    .join('');
}

export function calcProgress(done: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((done / total) * 100);
}

/** Pesan standar saat request ke server gagal (koneksi putus / server lambat). */
export const NETWORK_ERROR_MESSAGE =
  'Koneksi bermasalah atau server sedang lambat. Coba lagi sebentar lagi.';

/** Mengenali "error" redirect internal Next.js (bukan error sungguhan). */
export function isNextRedirect(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'digest' in err &&
    String((err as { digest?: unknown }).digest).startsWith('NEXT_REDIRECT')
  );
}

export function formatRupiah(n: number | null | undefined): string {
  return 'Rp ' + new Intl.NumberFormat('id-ID').format(Math.round(Number(n ?? 0)));
}

export function formatBytes(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}
