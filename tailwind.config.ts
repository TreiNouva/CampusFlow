import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          DEFAULT: '#12365E',
          dark: '#0E2A49',
        },
        // v7: palet dibuat lebih tenang — satu warna utama (navy), satu aksen (teal),
        // amber HANYA untuk peringatan, merah HANYA untuk error/telat. Sisanya abu-abu.
        teal: '#2B6C8A',
        orange: {
          // nama token dipertahankan agar kode lama tetap jalan; maknanya kini "peringatan"
          DEFAULT: '#B26B12',
          light: '#FBF3E6',
        },
        sky: '#E8EFF5',
        ink: '#1B2430',
        muted: '#5F6B7A',
        line: '#E6EAF0',
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
