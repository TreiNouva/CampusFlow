import type { Metadata } from 'next';
import { Analytics } from '@vercel/analytics/next';
import './globals.css';
import { THEME_INIT_SCRIPT } from '@/components/theme/theme';

export const metadata: Metadata = {
  title: 'CampusFlow — Run Your Organization, Not Your Spreadsheets',
  description: 'Platform manajemen organisasi kampus: project, task, activity log, dan email notification dalam satu workspace.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" suppressHydrationWarning>
      <head>
        {/* Pasang tema gelap sebelum halaman tergambar (tanpa kedipan) */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="font-body min-h-screen antialiased">
        {children}
        {/* Statistik kunjungan anonim tanpa cookie (aktifkan "Analytics" di dashboard Vercel). */}
        <Analytics />
      </body>
    </html>
  );
}
