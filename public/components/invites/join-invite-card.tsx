'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { acceptInvite } from '@/actions/invite-actions';
import { WaveBackground } from '@/components/auth/wave-background';
import { LoadingOverlay } from '@/components/ui/loading-overlay';
import { isNextRedirect, NETWORK_ERROR_MESSAGE } from '@/lib/utils';

interface Props {
  token: string;
  valid: boolean;
  reason?: string | null;
  organizationName?: string | null;
  projectName?: string | null;
  divisionName?: string | null;
  inviterName?: string | null;
  isLoggedIn: boolean;
}

/** Halaman undangan: menampilkan detail undangan lalu tombol Gabung (atau ajakan login/daftar). */
export function JoinInviteCard(props: Props) {
  const { token, valid, reason, organizationName, projectName, divisionName, inviterName, isLoggedIn } = props;
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [, startTransition] = useTransition();
  const nextParam = encodeURIComponent(`/join/${token}`);

  function handleJoin() {
    setError(null);
    setBusy(true);
    startTransition(async () => {
      try {
        const result = await acceptInvite(token);
        if (!result.success || !result.data) {
          setError(result.error ?? 'Gagal bergabung.');
          setBusy(false);
          return;
        }
        // Overlay tetap tampil sampai halaman tujuan terbuka
        router.push(result.data.projectId ? `/projects/${result.data.projectId}` : `/organizations/${result.data.organizationId}`);
      } catch (err) {
        if (isNextRedirect(err)) return;
        setError(NETWORK_ERROR_MESSAGE);
        setBusy(false);
      }
    });
  }

  return (
    <main className="auth-page">
      <WaveBackground />
      <div className="auth-container auth-single">
        <div className="auth-single-body">
          <div className="auth-form">
            <span className="auth-brand">CampusFlow</span>
            {valid ? (
              <>
                <h1 className="auth-title" style={{ fontSize: '1.6rem' }}>
                  Kamu Diundang!
                </h1>
                <p className="auth-sub">
                  {inviterName ? <strong>{inviterName}</strong> : 'Seseorang'} mengundangmu bergabung ke{' '}
                  {projectName ? (
                    <>
                      project <strong>{projectName}</strong> di organisasi <strong>{organizationName}</strong>
                    </>
                  ) : (
                    <>
                      organisasi <strong>{organizationName}</strong>
                    </>
                  )}
                  {divisionName ? (
                    <>
                      {' '}
                      pada divisi <strong>{divisionName}</strong>
                    </>
                  ) : null}
                  .
                </p>

                {error && (
                  <p role="alert" className="auth-error">
                    {error}
                  </p>
                )}

                {isLoggedIn ? (
                  <button type="button" className="auth-btn" onClick={handleJoin} disabled={busy}>
                    {busy ? 'Bergabung...' : 'Gabung Sekarang'}
                  </button>
                ) : (
                  <>
                    <p className="auth-sub" style={{ marginTop: 0 }}>
                      Masuk atau daftar dulu untuk bergabung.
                    </p>
                    <Link href={`/login?next=${nextParam}`} className="auth-btn auth-btn-link">
                      Masuk
                    </Link>
                    <Link href={`/register?next=${nextParam}`} className="auth-link">
                      Belum punya akun? Daftar
                    </Link>
                  </>
                )}
              </>
            ) : (
              <>
                <h1 className="auth-title" style={{ fontSize: '1.6rem' }}>
                  Link Tidak Bisa Dipakai
                </h1>
                <p className="auth-sub">{reason ?? 'Link undangan tidak valid.'} Minta link baru kepada pengundang.</p>
                <Link href={isLoggedIn ? '/dashboard' : '/login'} className="auth-btn auth-btn-link">
                  {isLoggedIn ? 'Ke Dashboard' : 'Ke Halaman Masuk'}
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
      {busy && <LoadingOverlay label="Bergabung..." />}
    </main>
  );
}
