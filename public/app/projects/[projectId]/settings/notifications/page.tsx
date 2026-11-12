import { notFound } from 'next/navigation';
import { Card, CardBody, CardHeader, Badge } from '@/components/ui/card';
import { NotificationPreferenceForm } from '@/components/projects/notification-preference-form';
import { requireUser } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { formatDateTime } from '@/lib/utils';
import type { NotificationLevel, NotificationLog, ProjectRole } from '@/types/database';

const LOG_STATUS_COLOR: Record<string, string> = {
  sent: 'bg-green-100 text-green-700',
  failed: 'bg-red-100 text-red-700',
  pending: 'bg-gray-100 text-gray-600',
};

export default async function NotificationSettingsPage({
  params,
}: {
  params: { projectId: string };
}) {
  const user = await requireUser();
  const supabase = createClient();

  // Semua query dijalankan bersamaan. Level notifikasi diambil dari baris membership yang sama,
  // dan log diambil langsung (RLS sudah membatasi hanya untuk anggota project).
  const [{ data: project }, { data: membership }, { data: logRows }] = await Promise.all([
    supabase.from('projects').select('id, name').eq('id', params.projectId).single(),
    supabase
      .from('project_members')
      .select('role, notification_level')
      .eq('project_id', params.projectId)
      .eq('user_id', user.id)
      .maybeSingle(),
    supabase
      .from('notification_logs')
      .select('*, recipient:profiles!notification_logs_recipient_id_fkey(full_name)')
      .eq('project_id', params.projectId)
      .order('created_at', { ascending: false })
      .limit(20),
  ]);
  if (!project || !membership) notFound();

  const currentLevel = (membership.notification_level ?? 'important') as NotificationLevel;
  const logs = (logRows ?? []) as NotificationLog[];

  return (
    <div>
      <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6 lg:px-8">
        <h1 className="font-heading text-xl font-bold text-ink sm:text-2xl">Notification Settings</h1>
        <p className="mt-1 text-sm text-muted">
          Atur email apa saja yang ingin kamu terima dari project ini.
        </p>

        <div className="mt-6">
          <NotificationPreferenceForm projectId={params.projectId} currentLevel={currentLevel} />
        </div>

        <Card className="mt-6">
          <CardHeader>
            <h2 className="font-heading text-base font-bold text-ink">Riwayat Email Project Ini</h2>
            <p className="text-xs text-muted">
              Daftar email yang dikirim sistem untuk project ini. Email hanya dikirim ke anggota project, dan orang yang
              melakukan aksi (mis. yang membuat pengumuman) tidak dikirimi email atas aksinya sendiri. Isi aksinya tetap
              bisa ia lihat langsung di halaman project.
            </p>
          </CardHeader>
          <CardBody className="p-0">
            {logs.length === 0 ? (
              <p className="px-5 py-4 text-sm text-muted">Belum ada email yang tercatat.</p>
            ) : (
              <ul className="divide-y divide-gray-100">
                {logs.map((log) => (
                  <li key={log.id} className="flex items-center justify-between px-5 py-3 text-sm">
                    <div>
                      <p className="font-medium text-ink">{log.event_type.replaceAll('_', ' ')}</p>
                      <p className="text-xs text-muted">
                        ke {log.recipient?.full_name ?? 'anggota'} • {formatDateTime(log.created_at)}
                      </p>
                    </div>
                    <Badge color={LOG_STATUS_COLOR[log.status]}>{log.status}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </main>
    </div>
  );
}
