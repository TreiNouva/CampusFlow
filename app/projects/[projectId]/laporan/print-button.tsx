'use client';

export function PrintButton() {
  return (
    <button type="button" onClick={() => window.print()}
      className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark print:hidden">
      Cetak / Simpan PDF
    </button>
  );
}
