import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'CampusFlow — Run Your Organization, Not Your Spreadsheets',
  description: 'Platform manajemen organisasi kampus: project, task, activity log, dan email notification dalam satu workspace.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body className="font-body min-h-screen antialiased">{children}</body>
    </html>
  );
}
