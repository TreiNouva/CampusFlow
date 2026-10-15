import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          DEFAULT: '#12365E',
          dark: '#0E2A49',
        },
        teal: '#1C7293',
        orange: {
          DEFAULT: '#FF7A45',
          light: '#FDEBE1',
        },
        sky: '#CFE4F0',
        ink: '#1B1B1F',
        muted: '#5B6472',
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
