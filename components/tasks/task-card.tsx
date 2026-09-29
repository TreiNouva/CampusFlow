import Link from 'next/link';
import { Badge } from '@/components/ui/card';
import { formatDate, PRIORITY_COLOR, PRIORITY_LABEL, initials } from '@/lib/utils';
import type { Task, TaskPriority } from '@/types/database';

export function TaskCard({ task, projectId }: { task: Task; projectId: string }) {
  return (
    <Link href={`/projects/${projectId}/tasks/${task.id}`}>
      <div className="rounded-lg border border-gray-100 bg-white p-3 shadow-sm transition hover:border-navy">
        <p className="text-sm font-medium text-ink">{task.title}</p>
        <div className="mt-2 flex items-center justify-between">
          <Badge color={PRIORITY_COLOR[task.priority as TaskPriority]}>
            {PRIORITY_LABEL[task.priority as TaskPriority]}
          </Badge>
          <span className="text-xs text-muted">{formatDate(task.due_date)}</span>
        </div>
        {task.assignee && (
          <div className="mt-2 flex items-center gap-1.5">
            <div className="flex h-5 w-5 items-center justify-center rounded-full bg-navy text-[10px] font-bold text-white">
              {initials(task.assignee.full_name)}
            </div>
            <span className="text-xs text-muted">{task.assignee.full_name}</span>
          </div>
        )}
      </div>
    </Link>
  );
}
