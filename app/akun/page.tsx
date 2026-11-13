import type { Metadata } from 'next';
import { PageHeader } from '@/components/layout/page-header';
import { ChangePasswordForm, Panel, ProfileNameForm } from '@/components/manage/manage-forms';
import { getCurrentProfile, requireUser } from '@/lib/auth/session';

export const metadata: Metadata = { title: 'Akun saya · CampusFlow' };

export default async function AccountPage() {
  const user = await requireUser();
  const profile = await getCurrentProfile();
  return (
    <main className="mx-auto max-w-3xl space-y-5 px-4 py-6 sm:px-6 lg:px-8">
      <PageHeader title="Akun saya" description={user.email} />
      <Panel title="Profil" description="Nama ini yang terlihat oleh anggota lain.">
        <ProfileNameForm fullName={profile?.full_name ?? ''} />
      </Panel>
      <Panel title="Ganti password" description="Masukkan password lama untuk konfirmasi. Lupa password? Keluar lalu pakai “Lupa password” di halaman masuk.">
        <ChangePasswordForm />
      </Panel>
    </main>
  );
}
