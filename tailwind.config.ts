import type { Config } from 'tailwindcss';

/** Warna dari CSS variable berisi kanal RGB ("18 54 94"), tetap mendukung opacity (bg-navy/30). */
const v = (name: string) => `rgb(var(--c-${name}) / <alpha-value>)`;
const scale = (name: string, steps: number[]) => Object.fromEntries(steps.map((n) => [n, v(`${name}-${n}`)]));

const config: Config = {
  darkMode: 'class',
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      // v8.3: semua warna lewat CSS variable (lihat app/globals.css) supaya ada tema terang & gelap.
      colors: {
        navy: { DEFAULT: v('navy'), dark: v('navy-dark') },
        // brand = warna latar tombol utama; di tema gelap sedikit lebih terang agar teks putih tetap kontras.
        brand: { DEFAULT: v('brand'), dark: v('brand-dark') },
        teal: v('teal'),
        orange: { DEFAULT: v('orange'), light: v('orange-light') },
        warn: { line: v('warn-line'), ink: v('warn-ink') },
        sky: { DEFAULT: v('sky'), strong: v('sky-strong') },
        ink: v('ink'),
        muted: v('muted'),
        line: v('line'),
        surface: v('surface'),
        canvas: v('canvas'),
        gray: scale('gray', [50, 100, 200, 300, 400, 500, 600, 700, 800, 900]),
        red: scale('red', [50, 100, 200, 300, 500, 600, 700]),
        green: scale('green', [50, 100, 200, 600, 700, 800]),
        emerald: scale('emerald', [50, 700]),
      },
      fontFamily: {
        heading: ['Georgia', 'Cambria', 'serif'],
        body: ['-apple-system', 'Segoe UI', 'Inter', 'sans-serif'],
      },
      borderRadius: {
        card: '0.75rem',
      },
      keyframes: {
        fadeIn: {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
      },
      animation: {
        // Delay 150ms: kalau halaman termuat cepat, overlay tidak sempat muncul (tidak "berkedip").
        'fade-in-delayed': 'fadeIn 0.2s ease-out 0.15s both',
        'fade-in': 'fadeIn 0.15s ease-out both',
      },
    },
  },
  plugins: [],
};

export default config;
