/** Warna divisi (dipakai di kalender, task board, pengumuman). Setiap divisi punya satu kunci warna. */
export interface ColorSpec {
  key: string;
  label: string;
  accent: string; // warna solid (garis/titik)
  bg: string; // latar lembut
  text: string; // teks di atas bg
}

/**
 * v7: palet divisi dibuat redup (muted) supaya kalender tetap bisa membedakan divisi
 * tanpa terasa "ramai". Kunci warna lama tetap dipakai, jadi data divisi lama aman.
 */
export const DIVISION_PALETTE: ColorSpec[] = [
  { key: 'blue', label: 'Biru', accent: '#4A78A8', bg: '#E8EFF6', text: '#2A4A6B' },
  { key: 'green', label: 'Hijau', accent: '#5E8C6A', bg: '#E9F1EB', text: '#365A40' },
  { key: 'orange', label: 'Tanah liat', accent: '#B07A50', bg: '#F5EDE5', text: '#6E4626' },
  { key: 'purple', label: 'Ungu redup', accent: '#8470A0', bg: '#EFECF4', text: '#4D3E63' },
  { key: 'teal', label: 'Tosca', accent: '#4C8C8C', bg: '#E5F0EF', text: '#2C5757' },
  { key: 'yellow', label: 'Pasir', accent: '#A88C42', bg: '#F4F0E2', text: '#5E4D1E' },
  { key: 'pink', label: 'Mawar', accent: '#A86A7E', bg: '#F4EAEE', text: '#683B4A' },
  { key: 'indigo', label: 'Nila', accent: '#5F6CA8', bg: '#EAECF5', text: '#363F6B' },
  { key: 'red', label: 'Bata', accent: '#A85656', bg: '#F4E8E8', text: '#6A3030' },
  { key: 'gray', label: 'Abu', accent: '#6B7280', bg: '#F1F2F4', text: '#374151' },
];

export const GLOBAL_COLOR: ColorSpec = { key: 'global', label: 'Global', accent: '#12365E', bg: '#E8EEF5', text: '#12365E' };
export const EVENT_COLOR: ColorSpec = { key: 'event', label: 'Acara', accent: '#2B6C8A', bg: '#E4EFF4', text: '#1D4D63' };
export const MILESTONE_COLOR: ColorSpec = { key: 'milestone', label: 'Milestone', accent: '#1B2430', bg: '#ECEEF1', text: '#1B2430' };

export function divisionColor(key: string | null | undefined): ColorSpec {
  if (!key) return GLOBAL_COLOR;
  return DIVISION_PALETTE.find((c) => c.key === key) ?? DIVISION_PALETTE[0];
}

/** Warna berikutnya yang belum dipakai divisi lain. */
export function nextDivisionColorKey(used: string[]): string {
  const free = DIVISION_PALETTE.find((c) => !used.includes(c.key));
  return (free ?? DIVISION_PALETTE[used.length % DIVISION_PALETTE.length]).key;
}
