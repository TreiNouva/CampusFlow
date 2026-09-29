import { formatDateTime } from '@/lib/utils';
import type { ActivityLog } from '@/types/database';

const ACTION_LABEL: Record<string, string> = {
  task_created: 'membuat task',
  task_status_changed: 'mengubah status task',
  task_assignee_changed: 'mengubah PIC task',
  task_due_date_changed: 'mengubah deadline task',
  task_priority_changed: 'mengubah priority task',
  task_commented: 'berkomentar pada task',
  project_created: 'membuat project ini',
  project_announcement: 'membuat pengumuman',
  member_added: 'menambahkan anggota',
};

export function ActivityFeed({ activity }: { activity: ActivityLog[] }) {
  if (activity.length === 0) {
    return <p className="text-sm text-muted">Belum ada aktivitas.</p>;
  }

  return (
    <ol className="space-y-4">
      {activity.map((log) => (
        <li key={log.id} className="flex gap-3 text-sm">
          <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-orange" />
          <div>
            <p className="text-ink">
              <span className="font-semibold">{log.actor?.full_name ?? 'Seseorang'}</span>{' '}
              {ACTION_LABEL[log.action_type] ?? log.action_type}
              {log.task?.title ? (
                <>
                  {' '}
                  — <span className="font-medium">{log.task.title}</span>
                </>
              ) : null}
              {log.action_type === 'task_status_changed' && log.old_value && log.new_value ? (
                <span className="text-muted"> ({log.old_value} → {log.new_value})</span>
              ) : null}
            </p>
            <p className="text-xs text-muted">{formatDateTime(log.created_at)}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}
