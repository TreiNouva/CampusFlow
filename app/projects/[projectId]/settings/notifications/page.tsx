import { notFound } from 'next/navigation';
import { Navbar } from '@/components/layout/navbar';
import { Card, CardBody, CardHeader, Badge } from '@/components/ui/card';
import { NotificationPreferenceForm } from '@/components/projects/notification-preference-form';
import { requireUser } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { getNotificationPreferences, getNotificationLogs } from '@/actions/notification-actions';
import { formatDateTime } from '@/lib/utils';

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

  const { data: project } = await supabase
    .from('projects')
    .select('id, name')
    .eq('id', params.projectId)
    .single();
  if (!project) notFound();

  const { data: membership } = await supabase
    .from('project_members')
    .select('role')
    .eq('project_id', params.projectId)
    .eq('user_id', user.id)
    .maybeSingle();
  if (!membership) notFound();

  const currentLevel = await getNotificationPreferences(params.projectId);
  const logs = await getNotificationLogs(params.projectId, 20);

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="mx-auto max-w-3xl px-6 py-8">
        <p className="text-xs font-semibold uppercase tracking-wide text-teal">{project.name}</p>
        <h1 className="font-heading text-2xl font-bold text-ink">Notification Settings</h1>
        <p className="mt-1 text-sm text-muted">
          Atur email apa saja yang ingin kamu terima dari project ini.
        </p>

        <div className="mt-6">
          <NotificationPreferenceForm projectId={params.projectId} currentLevel={currentLevel} />
        </div>

        <Card className="mt-6">
          <CardHeader>
            <h2 className="font-heading text-base font-bold text-ink">Log Pengiriman Email (Debug)</h2>
            <p className="text-xs text-muted">
              Untuk memverifikasi acceptance criteria: email hanya terkirim ke anggota yang sah, dan
              actor tidak menerima email dari aksinya sendiri.
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
                      <p className="text-xs text-muted">{formatDateTime(log.created_at)}</p>
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
