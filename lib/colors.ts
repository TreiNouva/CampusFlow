/** Warna divisi (dipakai di kalender, task board, pengumuman). Setiap divisi punya satu kunci warna. */
export interface ColorSpec {
  key: string;
  label: string;
  accent: string; // warna solid (garis/titik)
  bg: string; // latar lembut
  text: string; // teks di atas bg
}

export const DIVISION_PALETTE: ColorSpec[] = [
  { key: 'blue', label: 'Biru', accent: '#3B82F6', bg: '#DBEAFE', text: '#1E3A8A' },
  { key: 'orange', label: 'Oranye', accent: '#F97316', bg: '#FFEDD5', text: '#9A3412' },
  { key: 'green', label: 'Hijau', accent: '#22C55E', bg: '#DCFCE7', text: '#166534' },
  { key: 'purple', label: 'Ungu', accent: '#A855F7', bg: '#F3E8FF', text: '#6B21A8' },
  { key: 'pink', label: 'Pink', accent: '#EC4899', bg: '#FCE7F3', text: '#9D174D' },
  { key: 'teal', label: 'Tosca', accent: '#14B8A6', bg: '#CCFBF1', text: '#115E59' },
  { key: 'yellow', label: 'Kuning', accent: '#EAB308', bg: '#FEF9C3', text: '#854D0E' },
  { key: 'red', label: 'Merah', accent: '#EF4444', bg: '#FEE2E2', text: '#991B1B' },
  { key: 'indigo', label: 'Nila', accent: '#6366F1', bg: '#E0E7FF', text: '#3730A3' },
  { key: 'gray', label: 'Abu', accent: '#6B7280', bg: '#F3F4F6', text: '#374151' },
];

export const GLOBAL_COLOR: ColorSpec = { key: 'global', label: 'Global', accent: '#12365E', bg: '#E3EBF5', text: '#12365E' };
export const EVENT_COLOR: ColorSpec = { key: 'event', label: 'Acara', accent: '#1C7293', bg: '#D7EEF6', text: '#0E4A63' };
export const MILESTONE_COLOR: ColorSpec = { key: 'milestone', label: 'Milestone', accent: '#FF7A45', bg: '#FFE9DF', text: '#9A3412' };

export function divisionColor(key: string | null | undefined): ColorSpec {
  if (!key) return GLOBAL_COLOR;
  return DIVISION_PALETTE.find((c) => c.key === key) ?? DIVISION_PALETTE[0];
}

/** Warna berikutnya yang belum dipakai divisi lain. */
export function nextDivisionColorKey(used: string[]): string {
  const free = DIVISION_PALETTE.find((c) => !used.includes(c.key));
  return (free ?? DIVISION_PALETTE[used.length % DIVISION_PALETTE.length]).key;
}
